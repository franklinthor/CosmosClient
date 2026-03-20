"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseFavoriteKey = buildDatabaseFavoriteKey;
exports.buildContainerFavoriteKey = buildContainerFavoriteKey;
exports.parseFavoriteKey = parseFavoriteKey;
exports.normalizeFavoriteKey = normalizeFavoriteKey;
function buildDatabaseFavoriteKey(connId, dbId) {
    return `database:::${connId}:::${dbId}`;
}
function buildContainerFavoriteKey(connId, dbId, contId) {
    return `container:::${connId}:::${dbId}:::${contId}`;
}
function parseFavoriteKey(key) {
    const parts = key.split(':::').map(part => part.trim());
    if (parts[0] === 'database' && parts.length === 3) {
        const [, connId, dbId] = parts;
        return { type: 'database', connId, dbId };
    }
    if (parts[0] === 'container' && parts.length === 4) {
        if (parts[1] === 'database') {
            const [, , connId, dbId] = parts;
            return { type: 'database', connId, dbId };
        }
        const [, connId, dbId, contId] = parts;
        return { type: 'container', connId, dbId, contId };
    }
    if (parts.length === 3) {
        const [connId, dbId, contId] = parts;
        return { type: 'container', connId, dbId, contId };
    }
    return null;
}
function normalizeFavoriteKey(key) {
    const parsed = parseFavoriteKey(key);
    if (!parsed) {
        return null;
    }
    return parsed.type === 'database'
        ? buildDatabaseFavoriteKey(parsed.connId, parsed.dbId)
        : buildContainerFavoriteKey(parsed.connId, parsed.dbId, parsed.contId);
}
