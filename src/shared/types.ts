export type CosmosConnectionProfile = {
    id: string;
    name: string;
    endpoint: string;
    key: string;
    defaultDatabase?: string;
};

export type DatabaseFavoriteKey = `database:::${string}:::${string}`;
export type ContainerFavoriteKey = `container:::${string}:::${string}:::${string}`;
export type FavoriteKey = DatabaseFavoriteKey | ContainerFavoriteKey;

export type ParsedFavoriteKey =
    | {
        type: 'database';
        connId: string;
        dbId: string;
    }
    | {
        type: 'container';
        connId: string;
        dbId: string;
        contId: string;
    };

export function buildDatabaseFavoriteKey(connId: string, dbId: string): DatabaseFavoriteKey {
    return `database:::${connId}:::${dbId}`;
}

export function buildContainerFavoriteKey(connId: string, dbId: string, contId: string): ContainerFavoriteKey {
    return `container:::${connId}:::${dbId}:::${contId}`;
}

export function parseFavoriteKey(key: string): ParsedFavoriteKey | null {
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

export function normalizeFavoriteKey(key: string): FavoriteKey | null {
    const parsed = parseFavoriteKey(key);

    if (!parsed) {
        return null;
    }

    return parsed.type === 'database'
        ? buildDatabaseFavoriteKey(parsed.connId, parsed.dbId)
        : buildContainerFavoriteKey(parsed.connId, parsed.dbId, parsed.contId);
}
