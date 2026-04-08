import { contextBridge, ipcRenderer } from 'electron';
import type { FavoriteKey } from '../src/shared/types';
import { CosmosConnectionProfile } from '../src/shared/types';

contextBridge.exposeInMainWorld('api', {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getConnections: () => ipcRenderer.invoke('connections:get'),
    addConnection: (profile: CosmosConnectionProfile) => ipcRenderer.invoke('connections:add', profile),
    updateConnection: (profile: CosmosConnectionProfile) => ipcRenderer.invoke('connections:update', profile),
    deleteConnection: (id: string) => ipcRenderer.invoke('connections:delete', id),
    testConnection: (endpoint: string, key: string) => ipcRenderer.invoke('cosmos:testConnection', endpoint, key),
    listDatabases: (connId: string) => ipcRenderer.invoke('cosmos:listDatabases', connId),
    listContainers: (connId: string, dbId: string) => ipcRenderer.invoke('cosmos:listContainers', connId, dbId),
    listDocuments: (connId: string, dbId: string, contId: string, max?: number, token?: string) => ipcRenderer.invoke('cosmos:listDocuments', connId, dbId, contId, max, token),
    queryDocuments: (connId: string, dbId: string, contId: string, query: string, max?: number, token?: string) => ipcRenderer.invoke('cosmos:queryDocuments', connId, dbId, contId, query, max, token),
    createDocument: (connId: string, dbId: string, contId: string, doc: any) => ipcRenderer.invoke('cosmos:createDocument', connId, dbId, contId, doc),
    replaceDocument: (connId: string, dbId: string, contId: string, doc: any, partitionKeyOrSource?: any) => ipcRenderer.invoke('cosmos:replaceDocument', connId, dbId, contId, doc, partitionKeyOrSource),
    deleteDocument: (connId: string, dbId: string, contId: string, docId: string, partitionKeyOrSource?: any) => ipcRenderer.invoke('cosmos:deleteDocument', connId, dbId, contId, docId, partitionKeyOrSource),
    exportContainer: (connId: string, dbId: string, contId: string) => ipcRenderer.invoke('cosmos:exportContainer', connId, dbId, contId),
    importContainer: (connId: string, dbId: string, contId: string) => ipcRenderer.invoke('cosmos:importContainer', connId, dbId, contId),
    getFavourites: () => ipcRenderer.invoke('favourites:get') as Promise<FavoriteKey[]>,
    toggleFavourite: (key: FavoriteKey | string) => ipcRenderer.invoke('favourites:toggle', key),
});
