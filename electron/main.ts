import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as cosmosService from './services/cosmosService';
import { store } from './store';
import type { FavoriteKey } from '../src/shared/types';
import { CosmosConnectionProfile, normalizeFavoriteKey, parseFavoriteKey } from '../src/shared/types';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

function readNormalizedFavorites(): FavoriteKey[] {
    const favorites = store.get('favourites') as string[];
    const normalized = favorites
        .map(normalizeFavoriteKey)
        .filter((favorite): favorite is FavoriteKey => Boolean(favorite));
    const deduped = Array.from(new Set(normalized));

    if (deduped.length !== favorites.length || deduped.some((favorite, index) => favorite !== favorites[index])) {
        store.set('favourites', deduped);
    }

    return deduped;
}

function removeFavoritesForConnection(connectionId: string) {
    const favorites = readNormalizedFavorites();
    const filtered = favorites.filter(favorite => parseFavoriteKey(favorite)?.connId !== connectionId);

    if (filtered.length !== favorites.length) {
        store.set('favourites', filtered);
    }
}

// IPC Handler for Milestone 2
ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
});

// IPC Handler for Milestone 4 (Connections)
ipcMain.handle('connections:get', () => {
    return store.get('connections') as CosmosConnectionProfile[];
});

ipcMain.handle('connections:add', (_, profile: CosmosConnectionProfile) => {
    const connections = store.get('connections') as CosmosConnectionProfile[];
    connections.push(profile);
    store.set('connections', connections);
    return connections;
});

ipcMain.handle('connections:update', (_, profile: CosmosConnectionProfile) => {
    const connections = store.get('connections') as CosmosConnectionProfile[];
    const index = connections.findIndex((c: CosmosConnectionProfile) => c.id === profile.id);
    if (index >= 0) {
        connections[index] = profile;
        store.set('connections', connections);
    }
    return connections;
});

ipcMain.handle('connections:delete', (_, id: string) => {
    let connections = store.get('connections') as CosmosConnectionProfile[];
    connections = connections.filter((c: CosmosConnectionProfile) => c.id !== id);
    store.set('connections', connections);
    removeFavoritesForConnection(id);
    return connections;
});

// IPC Handler for Milestone 5 (Cosmos)
ipcMain.handle('cosmos:testConnection', async (_, endpoint: string, key: string) => {
    return await cosmosService.testConnection(endpoint, key);
});

// Milestone 6 Cosmos Service Handlers
ipcMain.handle('cosmos:listDatabases', async (_, connId: string) => cosmosService.listDatabases(connId));
ipcMain.handle('cosmos:listContainers', async (_, connId: string, dbId: string) => cosmosService.listContainers(connId, dbId));
ipcMain.handle('cosmos:listDocuments', async (_, connId: string, dbId: string, contId: string, max: number, token?: string) => cosmosService.listDocuments(connId, dbId, contId, max, token));
ipcMain.handle('cosmos:queryDocuments', async (_, connId: string, dbId: string, contId: string, query: string, max: number, token?: string) => cosmosService.queryDocuments(connId, dbId, contId, query, max, token));
ipcMain.handle('cosmos:createDocument', async (_, connId: string, dbId: string, contId: string, doc: any) => cosmosService.createDocument(connId, dbId, contId, doc));
ipcMain.handle('cosmos:replaceDocument', async (_, connId: string, dbId: string, contId: string, doc: any, pk?: any) => cosmosService.replaceDocument(connId, dbId, contId, doc, pk));
ipcMain.handle('cosmos:deleteDocument', async (_, connId: string, dbId: string, contId: string, docId: string, pk?: any) => cosmosService.deleteDocument(connId, dbId, contId, docId, pk));

// Import / Export
ipcMain.handle('cosmos:exportContainer', async (event, connId: string, dbId: string, contId: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(window!, {
        title: 'Export Container',
        defaultPath: `${contId}-export.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (canceled || !filePath) return null;
    return await cosmosService.exportContainer(connId, dbId, contId, filePath);
});

ipcMain.handle('cosmos:importContainer', async (event, connId: string, dbId: string, contId: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(window!, {
        title: 'Import to Container',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile']
    });
    if (canceled || filePaths.length === 0) return null;
    return await cosmosService.importContainer(connId, dbId, contId, filePaths[0]);
});

// Favourites handlers
ipcMain.handle('favourites:get', () => {
    return readNormalizedFavorites();
});

ipcMain.handle('favourites:toggle', (_, key: string) => {
    const normalizedKey = normalizeFavoriteKey(key);
    if (!normalizedKey) {
        throw new Error('Invalid favourite key');
    }

    const favourites = readNormalizedFavorites();
    const idx = favourites.indexOf(normalizedKey);
    if (idx >= 0) {
        favourites.splice(idx, 1);
    } else {
        favourites.push(normalizedKey);
    }
    store.set('favourites', favourites);
    return favourites;
});
