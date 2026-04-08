"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.testConnection = testConnection;
exports.listDatabases = listDatabases;
exports.listContainers = listContainers;
exports.listDocuments = listDocuments;
exports.queryDocuments = queryDocuments;
exports.createDocument = createDocument;
exports.replaceDocument = replaceDocument;
exports.deleteDocument = deleteDocument;
exports.exportContainer = exportContainer;
exports.importContainer = importContainer;
const cosmos_1 = require("@azure/cosmos");
const fs = __importStar(require("fs"));
const store_1 = require("../store");
const DEFAULT_PARTITION_KEY_PATH = '/_partitionKey';
const NONE_PARTITION_KEY_LITERAL = {};
const partitionKeyDefinitionCache = new Map();
function getClient(connectionId) {
    const connections = store_1.store.get('connections');
    const conn = connections.find(c => c.id === connectionId);
    if (!conn)
        throw new Error('Connection not found');
    return new cosmos_1.CosmosClient({ endpoint: conn.endpoint, key: conn.key });
}
function getContainer(connectionId, databaseId, containerId) {
    return getClient(connectionId).database(databaseId).container(containerId);
}
function normalizeDocumentId(value) {
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
function getContainerCacheKey(connectionId, databaseId, containerId) {
    return `${connectionId}::${databaseId}::${containerId}`;
}
function isDocumentPartitionKeySource(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && !isNonePartitionKeyLiteral(value);
}
function isNonePartitionKeyLiteral(value) {
    return typeof value === 'object' && value !== null && Object.keys(value).length === 0;
}
async function getPartitionKeyDefinition(container, cacheKey) {
    if (partitionKeyDefinitionCache.has(cacheKey)) {
        return partitionKeyDefinitionCache.get(cacheKey);
    }
    const { resource } = await container.read();
    const partitionKeyDefinition = resource?.partitionKey;
    partitionKeyDefinitionCache.set(cacheKey, partitionKeyDefinition);
    return partitionKeyDefinition;
}
function parsePartitionKeyPath(path) {
    const pathParts = [];
    let currentIndex = 0;
    const throwError = () => {
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
        let token;
        if (newIndex === -1) {
            token = path.substring(currentIndex);
            currentIndex = path.length;
        }
        else {
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
        }
        else {
            pathParts.push(getToken());
        }
    }
    return pathParts;
}
function extractPartitionKeyValue(path, source) {
    const pathParts = parsePartitionKeyPath(path);
    let current = source;
    for (const part of pathParts) {
        if (typeof current === 'object' && current !== null && part in current) {
            current = current[part];
        }
        else {
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
    if (current === undefined) {
        return undefined;
    }
    if (path === DEFAULT_PARTITION_KEY_PATH && isNonePartitionKeyLiteral(current)) {
        return NONE_PARTITION_KEY_LITERAL;
    }
    return undefined;
}
function describePartitionKeyValue(value) {
    if (value === undefined) {
        return 'undefined';
    }
    if (isNonePartitionKeyLiteral(value)) {
        return '{}';
    }
    return JSON.stringify(value);
}
function extractPartitionKeyFromDocument(document, partitionKeyDefinition) {
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
async function resolvePartitionKey(container, cacheKey, partitionKeyOrSource, fallbackDocument, documentId) {
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
    }
    catch (error) {
        const extractedValues = paths.map(path => `${path}=${describePartitionKeyValue(extractPartitionKeyValue(path, sourceDocument))}`);
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${message} Extracted values: ${extractedValues.join(', ')}`);
    }
}
async function testConnection(endpoint, key) {
    try {
        const client = new cosmos_1.CosmosClient({ endpoint, key });
        await client.getDatabaseAccount();
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown connection error' };
    }
}
async function listDatabases(connectionId) {
    const client = getClient(connectionId);
    const { resources } = await client.databases.readAll().fetchAll();
    return resources.map(r => ({ id: r.id }));
}
async function listContainers(connectionId, databaseId) {
    const { resources } = await getClient(connectionId).database(databaseId).containers.readAll().fetchAll();
    return resources.map(r => ({ id: r.id }));
}
async function listDocuments(connectionId, databaseId, containerId, maxItemCount = 50, continuationToken) {
    const container = getContainer(connectionId, databaseId, containerId);
    const response = await container.items.readAll({ maxItemCount, continuationToken }).fetchNext();
    return { documents: response.resources ?? [], continuationToken: response.continuationToken };
}
async function queryDocuments(connectionId, databaseId, containerId, query, maxItemCount = 50, continuationToken) {
    const container = getContainer(connectionId, databaseId, containerId);
    const response = await container.items.query(query, { maxItemCount, continuationToken }).fetchNext();
    return { documents: response.resources ?? [], continuationToken: response.continuationToken };
}
async function createDocument(connectionId, databaseId, containerId, document) {
    const { resource } = await getContainer(connectionId, databaseId, containerId).items.create(document);
    return resource;
}
async function replaceDocument(connectionId, databaseId, containerId, document, partitionKeyOrSource) {
    if (!document.id) {
        throw new Error('Document id is required');
    }
    const container = getContainer(connectionId, databaseId, containerId);
    const partitionKey = await resolvePartitionKey(container, getContainerCacheKey(connectionId, databaseId, containerId), partitionKeyOrSource, document, document.id);
    const item = partitionKey !== undefined
        ? container.item(document.id, partitionKey)
        : container.item(document.id);
    const { resource } = await item.replace(document);
    return resource;
}
async function deleteDocument(connectionId, databaseId, containerId, documentId, partitionKeyOrSource) {
    if (documentId === undefined || documentId === null || documentId === '') {
        throw new Error('Document id is required');
    }
    const normalizedDocumentId = normalizeDocumentId(documentId);
    const container = getContainer(connectionId, databaseId, containerId);
    const partitionKey = await resolvePartitionKey(container, getContainerCacheKey(connectionId, databaseId, containerId), partitionKeyOrSource, isDocumentPartitionKeySource(partitionKeyOrSource) ? partitionKeyOrSource : undefined, normalizedDocumentId);
    const item = partitionKey !== undefined
        ? container.item(normalizedDocumentId, partitionKey)
        : container.item(normalizedDocumentId);
    await item.delete();
    return { success: true };
}
async function exportContainer(connectionId, databaseId, containerId, filePath) {
    const container = getContainer(connectionId, databaseId, containerId);
    const { resources } = await container.items.readAll().fetchAll();
    fs.writeFileSync(filePath, JSON.stringify(resources, null, 2), 'utf-8');
    return { success: true, count: resources.length };
}
async function importContainer(connectionId, databaseId, containerId, filePath) {
    const container = getContainer(connectionId, databaseId, containerId);
    const data = fs.readFileSync(filePath, 'utf-8');
    const items = JSON.parse(data);
    if (!Array.isArray(items))
        throw new Error('JSON file must contain an array of documents');
    let successCount = 0;
    let errorCount = 0;
    for (const item of items) {
        try {
            await container.items.upsert(item);
            successCount++;
        }
        catch {
            errorCount++;
        }
    }
    return { success: true, successCount, errorCount };
}
