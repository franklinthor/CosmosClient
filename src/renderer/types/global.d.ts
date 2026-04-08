import type { CosmosConnectionProfile, FavoriteKey } from '../../shared/types';

declare global {
    interface IPCAPI {
        getVersion: () => Promise<string>;
        getConnections: () => Promise<CosmosConnectionProfile[]>;
        addConnection: (profile: CosmosConnectionProfile) => Promise<CosmosConnectionProfile[]>;
        updateConnection: (profile: CosmosConnectionProfile) => Promise<CosmosConnectionProfile[]>;
        deleteConnection: (id: string) => Promise<CosmosConnectionProfile[]>;
        testConnection: (endpoint: string, key: string) => Promise<{ success: boolean; error?: string }>;
        listDatabases: (connId: string) => Promise<{ id: string }[]>;
        listContainers: (connId: string, dbId: string) => Promise<{ id: string }[]>;
        listDocuments: (connId: string, dbId: string, contId: string, max?: number, token?: string) => Promise<{ documents: any[]; continuationToken?: string }>;
        queryDocuments: (connId: string, dbId: string, contId: string, query: string, max?: number, token?: string) => Promise<{ documents: any[]; continuationToken?: string }>;
        createDocument: (connId: string, dbId: string, contId: string, doc: any) => Promise<any>;
        replaceDocument: (connId: string, dbId: string, contId: string, doc: any, partitionKeyOrSource?: any) => Promise<any>;
        deleteDocument: (connId: string, dbId: string, contId: string, docId: string, partitionKeyOrSource?: any) => Promise<{ success: boolean }>;
        exportContainer: (connId: string, dbId: string, contId: string) => Promise<{ success: boolean; count: number } | null>;
        importContainer: (connId: string, dbId: string, contId: string) => Promise<{ success: boolean; successCount: number; errorCount: number } | null>;
        getFavourites: () => Promise<FavoriteKey[]>;
        toggleFavourite: (key: FavoriteKey | string) => Promise<FavoriteKey[]>;
    }

    interface Window {
        api: IPCAPI;
    }
}
export { };
