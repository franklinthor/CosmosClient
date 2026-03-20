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
function getClient(connectionId) {
    const connections = store_1.store.get('connections');
    const conn = connections.find(c => c.id === connectionId);
    if (!conn)
        throw new Error('Connection not found');
    return new cosmos_1.CosmosClient({ endpoint: conn.endpoint, key: conn.key });
}
async function testConnection(endpoint, key) {
    try {
        const client = new cosmos_1.CosmosClient({ endpoint, key });
        await client.getDatabaseAccount();
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message || 'Unknown connection error' };
    }
}
async function listDatabases(connectionId) {
    const client = getClient(connectionId);
    const { resources } = await client.databases.readAll().fetchAll();
    return resources.map(r => ({ id: r.id }));
}
async function listContainers(connectionId, databaseId) {
    const client = getClient(connectionId);
    const { resources } = await client.database(databaseId).containers.readAll().fetchAll();
    return resources.map(r => ({ id: r.id }));
}
async function listDocuments(connectionId, databaseId, containerId, maxItemCount = 50, continuationToken) {
    const client = getClient(connectionId);
    const container = client.database(databaseId).container(containerId);
    const response = await container.items.readAll({ maxItemCount, continuationToken }).fetchNext();
    return { documents: response.resources ?? [], continuationToken: response.continuationToken };
}
async function queryDocuments(connectionId, databaseId, containerId, query, maxItemCount = 50, continuationToken) {
    const client = getClient(connectionId);
    const container = client.database(databaseId).container(containerId);
    const response = await container.items.query(query, { maxItemCount, continuationToken }).fetchNext();
    return { documents: response.resources ?? [], continuationToken: response.continuationToken };
}
async function createDocument(connectionId, databaseId, containerId, document) {
    const client = getClient(connectionId);
    const { resource } = await client.database(databaseId).container(containerId).items.create(document);
    return resource;
}
async function replaceDocument(connectionId, databaseId, containerId, document, partitionKey) {
    const client = getClient(connectionId);
    // partitionKey should be passed if the container is partitioned
    const item = partitionKey !== undefined
        ? client.database(databaseId).container(containerId).item(document.id, partitionKey)
        : client.database(databaseId).container(containerId).item(document.id);
    const { resource } = await item.replace(document);
    return resource;
}
async function deleteDocument(connectionId, databaseId, containerId, documentId, partitionKey) {
    const client = getClient(connectionId);
    const item = partitionKey !== undefined
        ? client.database(databaseId).container(containerId).item(documentId, partitionKey)
        : client.database(databaseId).container(containerId).item(documentId);
    await item.delete();
    return { success: true };
}
async function exportContainer(connectionId, databaseId, containerId, filePath) {
    const client = getClient(connectionId);
    const container = client.database(databaseId).container(containerId);
    const { resources } = await container.items.readAll().fetchAll();
    fs.writeFileSync(filePath, JSON.stringify(resources, null, 2), 'utf-8');
    return { success: true, count: resources.length };
}
async function importContainer(connectionId, databaseId, containerId, filePath) {
    const client = getClient(connectionId);
    const container = client.database(databaseId).container(containerId);
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
        catch (e) {
            errorCount++;
        }
    }
    return { success: true, successCount, errorCount };
}
