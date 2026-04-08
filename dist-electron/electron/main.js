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
const electron_1 = require("electron");
const path = __importStar(require("path"));
const cosmosService = __importStar(require("./services/cosmosService"));
const store_1 = require("./store");
const types_1 = require("../src/shared/types");
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
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
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
function readNormalizedFavorites() {
    const favorites = store_1.store.get('favourites');
    const normalized = favorites
        .map(types_1.normalizeFavoriteKey)
        .filter((favorite) => Boolean(favorite));
    const deduped = Array.from(new Set(normalized));
    if (deduped.length !== favorites.length || deduped.some((favorite, index) => favorite !== favorites[index])) {
        store_1.store.set('favourites', deduped);
    }
    return deduped;
}
function removeFavoritesForConnection(connectionId) {
    const favorites = readNormalizedFavorites();
    const filtered = favorites.filter(favorite => (0, types_1.parseFavoriteKey)(favorite)?.connId !== connectionId);
    if (filtered.length !== favorites.length) {
        store_1.store.set('favourites', filtered);
    }
}
// IPC Handler for Milestone 2
electron_1.ipcMain.handle('app:getVersion', () => {
    return electron_1.app.getVersion();
});
// IPC Handler for Milestone 4 (Connections)
electron_1.ipcMain.handle('connections:get', () => {
    return store_1.store.get('connections');
});
electron_1.ipcMain.handle('connections:add', (_, profile) => {
    const connections = store_1.store.get('connections');
    connections.push(profile);
    store_1.store.set('connections', connections);
    return connections;
});
electron_1.ipcMain.handle('connections:update', (_, profile) => {
    const connections = store_1.store.get('connections');
    const index = connections.findIndex((c) => c.id === profile.id);
    if (index >= 0) {
        connections[index] = profile;
        store_1.store.set('connections', connections);
    }
    return connections;
});
electron_1.ipcMain.handle('connections:delete', (_, id) => {
    let connections = store_1.store.get('connections');
    connections = connections.filter((c) => c.id !== id);
    store_1.store.set('connections', connections);
    removeFavoritesForConnection(id);
    return connections;
});
// IPC Handler for Milestone 5 (Cosmos)
electron_1.ipcMain.handle('cosmos:testConnection', async (_, endpoint, key) => {
    return await cosmosService.testConnection(endpoint, key);
});
// Milestone 6 Cosmos Service Handlers
electron_1.ipcMain.handle('cosmos:listDatabases', async (_, connId) => cosmosService.listDatabases(connId));
electron_1.ipcMain.handle('cosmos:listContainers', async (_, connId, dbId) => cosmosService.listContainers(connId, dbId));
electron_1.ipcMain.handle('cosmos:listDocuments', async (_, connId, dbId, contId, max, token) => cosmosService.listDocuments(connId, dbId, contId, max, token));
electron_1.ipcMain.handle('cosmos:queryDocuments', async (_, connId, dbId, contId, query, max, token) => cosmosService.queryDocuments(connId, dbId, contId, query, max, token));
electron_1.ipcMain.handle('cosmos:createDocument', async (_, connId, dbId, contId, doc) => cosmosService.createDocument(connId, dbId, contId, doc));
electron_1.ipcMain.handle('cosmos:replaceDocument', async (_, connId, dbId, contId, doc, partitionKeyOrSource) => cosmosService.replaceDocument(connId, dbId, contId, doc, partitionKeyOrSource));
electron_1.ipcMain.handle('cosmos:deleteDocument', async (_, connId, dbId, contId, docId, partitionKeyOrSource) => cosmosService.deleteDocument(connId, dbId, contId, docId, partitionKeyOrSource));
// Import / Export
electron_1.ipcMain.handle('cosmos:exportContainer', async (event, connId, dbId, contId) => {
    const window = electron_1.BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await electron_1.dialog.showSaveDialog(window, {
        title: 'Export Container',
        defaultPath: `${contId}-export.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (canceled || !filePath)
        return null;
    return await cosmosService.exportContainer(connId, dbId, contId, filePath);
});
electron_1.ipcMain.handle('cosmos:importContainer', async (event, connId, dbId, contId) => {
    const window = electron_1.BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await electron_1.dialog.showOpenDialog(window, {
        title: 'Import to Container',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile']
    });
    if (canceled || filePaths.length === 0)
        return null;
    return await cosmosService.importContainer(connId, dbId, contId, filePaths[0]);
});
// Favourites handlers
electron_1.ipcMain.handle('favourites:get', () => {
    return readNormalizedFavorites();
});
electron_1.ipcMain.handle('favourites:toggle', (_, key) => {
    const normalizedKey = (0, types_1.normalizeFavoriteKey)(key);
    if (!normalizedKey) {
        throw new Error('Invalid favourite key');
    }
    const favourites = readNormalizedFavorites();
    const idx = favourites.indexOf(normalizedKey);
    if (idx >= 0) {
        favourites.splice(idx, 1);
    }
    else {
        favourites.push(normalizedKey);
    }
    store_1.store.set('favourites', favourites);
    return favourites;
});
