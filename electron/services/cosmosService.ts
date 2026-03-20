import { CosmosClient } from '@azure/cosmos';
import * as fs from 'fs';
import { store } from '../store';

function getClient(connectionId: string): CosmosClient {
    const connections = store.get('connections') as any[];
    const conn = connections.find(c => c.id === connectionId);
    if (!conn) throw new Error('Connection not found');
    return new CosmosClient({ endpoint: conn.endpoint, key: conn.key });
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
    const client = getClient(connectionId);
    const { resources } = await client.database(databaseId).containers.readAll().fetchAll();
    return resources.map(r => ({ id: r.id }));
}

export async function listDocuments(connectionId: string, databaseId: string, containerId: string, maxItemCount: number = 50, continuationToken?: string) {
    const client = getClient(connectionId);
    const container = client.database(databaseId).container(containerId);
    const response = await container.items.readAll({ maxItemCount, continuationToken }).fetchNext();
    return { documents: response.resources ?? [], continuationToken: response.continuationToken };
}

export async function queryDocuments(connectionId: string, databaseId: string, containerId: string, query: string, maxItemCount: number = 50, continuationToken?: string) {
    const client = getClient(connectionId);
    const container = client.database(databaseId).container(containerId);
    const response = await container.items.query(query, { maxItemCount, continuationToken }).fetchNext();
    return { documents: response.resources ?? [], continuationToken: response.continuationToken };
}

export async function createDocument(connectionId: string, databaseId: string, containerId: string, document: any) {
    const client = getClient(connectionId);
    const { resource } = await client.database(databaseId).container(containerId).items.create(document);
    return resource;
}

export async function replaceDocument(connectionId: string, databaseId: string, containerId: string, document: any, partitionKey?: any) {
    const client = getClient(connectionId);
    // partitionKey should be passed if the container is partitioned
    const item = partitionKey !== undefined
        ? client.database(databaseId).container(containerId).item(document.id, partitionKey)
        : client.database(databaseId).container(containerId).item(document.id);
    const { resource } = await item.replace(document);
    return resource;
}

export async function deleteDocument(connectionId: string, databaseId: string, containerId: string, documentId: string, partitionKey?: any) {
    const client = getClient(connectionId);
    const item = partitionKey !== undefined
        ? client.database(databaseId).container(containerId).item(documentId, partitionKey)
        : client.database(databaseId).container(containerId).item(documentId);
    await item.delete();
    return { success: true };
}

export async function exportContainer(connectionId: string, databaseId: string, containerId: string, filePath: string) {
    const client = getClient(connectionId);
    const container = client.database(databaseId).container(containerId);

    const { resources } = await container.items.readAll().fetchAll();
    fs.writeFileSync(filePath, JSON.stringify(resources, null, 2), 'utf-8');
    return { success: true, count: resources.length };
}

export async function importContainer(connectionId: string, databaseId: string, containerId: string, filePath: string) {
    const client = getClient(connectionId);
    const container = client.database(databaseId).container(containerId);

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
