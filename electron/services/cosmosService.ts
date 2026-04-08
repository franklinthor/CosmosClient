import { CosmosClient, type Container, type PartitionKey, type PartitionKeyDefinition, type PrimitivePartitionKeyValue } from '@azure/cosmos';
import * as fs from 'fs';
import { store } from '../store';

type CosmosDocument = Record<string, unknown> & {
    id?: string;
};

type PartitionKeySource = PartitionKey | CosmosDocument;

const DEFAULT_PARTITION_KEY_PATH = '/_partitionKey';
const NONE_PARTITION_KEY_LITERAL = {} as Record<string, never>;
const partitionKeyDefinitionCache = new Map<string, PartitionKeyDefinition | undefined>();

function getClient(connectionId: string): CosmosClient {
    const connections = store.get('connections') as any[];
    const conn = connections.find(c => c.id === connectionId);
    if (!conn) throw new Error('Connection not found');
    return new CosmosClient({ endpoint: conn.endpoint, key: conn.key });
}

function getContainer(connectionId: string, databaseId: string, containerId: string): Container {
    return getClient(connectionId).database(databaseId).container(containerId);
}

function normalizeDocumentId(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }

    if (value instanceof String) {
        return value.valueOf();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    throw new Error(`Document id must be a string, number, or boolean. Received ${value === null ? 'null' : typeof value}.`);
}

function getContainerCacheKey(connectionId: string, databaseId: string, containerId: string) {
    return `${connectionId}::${databaseId}::${containerId}`;
}

function isDocumentPartitionKeySource(value: PartitionKeySource | undefined): value is CosmosDocument {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonePartitionKeyLiteral(value: unknown): value is Record<string, never> {
    return typeof value === 'object' && value !== null && Object.keys(value).length === 0;
}

async function getPartitionKeyDefinition(container: Container, cacheKey: string): Promise<PartitionKeyDefinition | undefined> {
    const cached = partitionKeyDefinitionCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const { resource } = await container.read();
    const partitionKeyDefinition = resource?.partitionKey;
    partitionKeyDefinitionCache.set(cacheKey, partitionKeyDefinition);
    return partitionKeyDefinition;
}

function parsePartitionKeyPath(path: string): string[] {
    const pathParts: string[] = [];
    let currentIndex = 0;

    const throwError = (): never => {
        throw new Error(`Partition key path ${path} is invalid at index ${currentIndex}`);
    };

    const getEscapedToken = () => {
        const quote = path[currentIndex];
        let newIndex = ++currentIndex;

        for (;;) {
            newIndex = path.indexOf(quote, newIndex);
            if (newIndex === -1) {
                throwError();
            }

            if (path[newIndex - 1] !== '\\') {
                break;
            }

            ++newIndex;
        }

        const token = path.substring(currentIndex, newIndex);
        currentIndex = newIndex + 1;
        return token;
    };

    const getToken = () => {
        const newIndex = path.indexOf('/', currentIndex);
        let token: string;

        if (newIndex === -1) {
            token = path.substring(currentIndex);
            currentIndex = path.length;
        } else {
            token = path.substring(currentIndex, newIndex);
            currentIndex = newIndex;
        }

        return token.trim();
    };

    while (currentIndex < path.length) {
        if (path[currentIndex] !== '/') {
            throwError();
        }

        if (++currentIndex === path.length) {
            break;
        }

        if (path[currentIndex] === '"' || path[currentIndex] === '\'') {
            pathParts.push(getEscapedToken());
        } else {
            pathParts.push(getToken());
        }
    }

    return pathParts;
}

function extractPartitionKeyValue(path: string, source: unknown): PrimitivePartitionKeyValue | undefined {
    const pathParts = parsePartitionKeyPath(path);
    let current = source;

    for (const part of pathParts) {
        if (typeof current === 'object' && current !== null && part in current) {
            current = (current as Record<string, unknown>)[part];
        } else {
            current = undefined;
            break;
        }
    }

    if (typeof current === 'string' || typeof current === 'number' || typeof current === 'boolean') {
        return current;
    }

    if (current === null) {
        return null;
    }

    if (current === undefined || isNonePartitionKeyLiteral(current)) {
        return NONE_PARTITION_KEY_LITERAL;
    }

    return undefined;
}

function describePartitionKeyValue(value: PrimitivePartitionKeyValue | undefined) {
    if (value === undefined) {
        return 'undefined';
    }

    if (isNonePartitionKeyLiteral(value)) {
        return '{}';
    }

    return JSON.stringify(value);
}

function extractPartitionKeyFromDocument(document: CosmosDocument, partitionKeyDefinition?: PartitionKeyDefinition): PartitionKey | undefined {
    if (!partitionKeyDefinition?.paths?.length) {
        return undefined;
    }

    if (partitionKeyDefinition.systemKey === true) {
        return [];
    }

    const values = partitionKeyDefinition.paths.map(path => {
        const value = extractPartitionKeyValue(path, document);
        if (value === undefined) {
            throw new Error(`Could not resolve partition key path ${path} from the selected document.`);
        }

        return value;
    });

    if (values.length === 1 && partitionKeyDefinition.paths[0] === DEFAULT_PARTITION_KEY_PATH) {
        return values[0];
    }

    return values.length === 1 ? values[0] : values;
}

async function resolvePartitionKey(
    container: Container,
    cacheKey: string,
    partitionKeyOrSource?: PartitionKeySource,
    fallbackDocument?: CosmosDocument,
    documentId?: string
): Promise<PartitionKey | undefined> {
    if (partitionKeyOrSource !== undefined && !isDocumentPartitionKeySource(partitionKeyOrSource)) {
        return partitionKeyOrSource;
    }

    const partitionKeyDefinition = await getPartitionKeyDefinition(container, cacheKey);
    const paths = partitionKeyDefinition?.paths ?? [];
    if (paths.length === 0) {
        return undefined;
    }

    const sourceDocument = isDocumentPartitionKeySource(partitionKeyOrSource) ? partitionKeyOrSource : fallbackDocument;
    if (!sourceDocument) {
        if (paths.length === 1 && paths[0] === '/id' && documentId) {
            return documentId;
        }

        throw new Error(`This container is partitioned on ${paths.join(', ')}. The document payload is required to resolve its partition key.`);
    }

    try {
        return extractPartitionKeyFromDocument(sourceDocument, partitionKeyDefinition);
    } catch (error) {
        const extractedValues = paths.map(path => `${path}=${describePartitionKeyValue(extractPartitionKeyValue(path, sourceDocument))}`);
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${message} Extracted values: ${extractedValues.join(', ')}`);
    }
}

export async function testConnection(endpoint: string, key: string): Promise<{ success: boolean; error?: string }> {
    try {
        const client = new CosmosClient({ endpoint, key });
        await client.getDatabaseAccount();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Unknown connection error' };
    }
}

export async function listDatabases(connectionId: string) {
    const client = getClient(connectionId);
    const { resources } = await client.databases.readAll().fetchAll();
    return resources.map(r => ({ id: r.id }));
}

export async function listContainers(connectionId: string, databaseId: string) {
    const { resources } = await getClient(connectionId).database(databaseId).containers.readAll().fetchAll();
    return resources.map(r => ({ id: r.id }));
}

export async function listDocuments(connectionId: string, databaseId: string, containerId: string, maxItemCount: number = 50, continuationToken?: string) {
    const container = getContainer(connectionId, databaseId, containerId);
    const response = await container.items.readAll({ maxItemCount, continuationToken }).fetchNext();
    return { documents: response.resources ?? [], continuationToken: response.continuationToken };
}

export async function queryDocuments(connectionId: string, databaseId: string, containerId: string, query: string, maxItemCount: number = 50, continuationToken?: string) {
    const container = getContainer(connectionId, databaseId, containerId);
    const response = await container.items.query(query, { maxItemCount, continuationToken }).fetchNext();
    return { documents: response.resources ?? [], continuationToken: response.continuationToken };
}

export async function createDocument(connectionId: string, databaseId: string, containerId: string, document: CosmosDocument) {
    const { resource } = await getContainer(connectionId, databaseId, containerId).items.create(document);
    return resource;
}

export async function replaceDocument(connectionId: string, databaseId: string, containerId: string, document: CosmosDocument, partitionKeyOrSource?: PartitionKeySource) {
    if (!document.id) {
        throw new Error('Document id is required');
    }

    const container = getContainer(connectionId, databaseId, containerId);
    const partitionKey = await resolvePartitionKey(
        container,
        getContainerCacheKey(connectionId, databaseId, containerId),
        partitionKeyOrSource,
        document,
        document.id
    );
    const item = partitionKey !== undefined
        ? container.item(document.id, partitionKey)
        : container.item(document.id);
    const { resource } = await item.replace(document);
    return resource;
}

export async function deleteDocument(connectionId: string, databaseId: string, containerId: string, documentId: unknown, partitionKeyOrSource?: PartitionKeySource) {
    if (documentId === undefined || documentId === null || documentId === '') {
        throw new Error('Document id is required');
    }

    const normalizedDocumentId = normalizeDocumentId(documentId);
    const container = getContainer(connectionId, databaseId, containerId);
    const partitionKey = await resolvePartitionKey(
        container,
        getContainerCacheKey(connectionId, databaseId, containerId),
        partitionKeyOrSource,
        isDocumentPartitionKeySource(partitionKeyOrSource) ? partitionKeyOrSource : undefined,
        normalizedDocumentId
    );
    const item = partitionKey !== undefined
        ? container.item(normalizedDocumentId, partitionKey)
        : container.item(normalizedDocumentId);
    await item.delete();
    return { success: true };
}

export async function exportContainer(connectionId: string, databaseId: string, containerId: string, filePath: string) {
    const container = getContainer(connectionId, databaseId, containerId);

    const { resources } = await container.items.readAll().fetchAll();
    fs.writeFileSync(filePath, JSON.stringify(resources, null, 2), 'utf-8');
    return { success: true, count: resources.length };
}

export async function importContainer(connectionId: string, databaseId: string, containerId: string, filePath: string) {
    const container = getContainer(connectionId, databaseId, containerId);

    const data = fs.readFileSync(filePath, 'utf-8');
    const items = JSON.parse(data);
    if (!Array.isArray(items)) throw new Error('JSON file must contain an array of documents');

    let successCount = 0;
    let errorCount = 0;

    for (const item of items) {
        try {
            await container.items.upsert(item);
            successCount++;
        } catch (e) {
            errorCount++;
        }
    }
    return { success: true, successCount, errorCount };
}
