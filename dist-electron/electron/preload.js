"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('api', {
    getVersion: () => electron_1.ipcRenderer.invoke('app:getVersion'),
    getConnections: () => electron_1.ipcRenderer.invoke('connections:get'),
    addConnection: (profile) => electron_1.ipcRenderer.invoke('connections:add', profile),
    updateConnection: (profile) => electron_1.ipcRenderer.invoke('connections:update', profile),
    deleteConnection: (id) => electron_1.ipcRenderer.invoke('connections:delete', id),
    testConnection: (endpoint, key) => electron_1.ipcRenderer.invoke('cosmos:testConnection', endpoint, key),
    listDatabases: (connId) => electron_1.ipcRenderer.invoke('cosmos:listDatabases', connId),
    listContainers: (connId, dbId) => electron_1.ipcRenderer.invoke('cosmos:listContainers', connId, dbId),
    listDocuments: (connId, dbId, contId, max, token) => electron_1.ipcRenderer.invoke('cosmos:listDocuments', connId, dbId, contId, max, token),
    queryDocuments: (connId, dbId, contId, query, max, token) => electron_1.ipcRenderer.invoke('cosmos:queryDocuments', connId, dbId, contId, query, max, token),
    createDocument: (connId, dbId, contId, doc) => electron_1.ipcRenderer.invoke('cosmos:createDocument', connId, dbId, contId, doc),
    replaceDocument: (connId, dbId, contId, doc, partitionKeyOrSource) => electron_1.ipcRenderer.invoke('cosmos:replaceDocument', connId, dbId, contId, doc, partitionKeyOrSource),
    deleteDocument: (connId, dbId, contId, docId, partitionKeyOrSource) => electron_1.ipcRenderer.invoke('cosmos:deleteDocument', connId, dbId, contId, docId, partitionKeyOrSource),
    exportContainer: (connId, dbId, contId) => electron_1.ipcRenderer.invoke('cosmos:exportContainer', connId, dbId, contId),
    importContainer: (connId, dbId, contId) => electron_1.ipcRenderer.invoke('cosmos:importContainer', connId, dbId, contId),
    getFavourites: () => electron_1.ipcRenderer.invoke('favourites:get'),
    toggleFavourite: (key) => electron_1.ipcRenderer.invoke('favourites:toggle', key),
});
