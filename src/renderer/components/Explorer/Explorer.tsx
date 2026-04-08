import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Database, FolderCode, RefreshCw, Server, Star } from 'lucide-react';
import type { CosmosConnectionProfile, FavoriteKey } from '../../../shared/types';
import {
    buildContainerFavoriteKey,
    buildDatabaseFavoriteKey,
    parseFavoriteKey,
} from '../../../shared/types';

interface ExplorerProps {
    onSelectContainer: (connId: string, dbId: string, contId: string) => void;
}

export function Explorer({ onSelectContainer }: ExplorerProps) {
    const [connections, setConnections] = useState<CosmosConnectionProfile[]>([]);
    const [expandedConns, setExpandedConns] = useState<Record<string, boolean>>({});
    const [expandedDbs, setExpandedDbs] = useState<Record<string, boolean>>({});
    const [expandedFavouriteConns, setExpandedFavouriteConns] = useState<Record<string, boolean>>({});
    const [expandedFavouriteDbs, setExpandedFavouriteDbs] = useState<Record<string, boolean>>({});
    const [databases, setDatabases] = useState<Record<string, { id: string }[]>>({});
    const [containers, setContainers] = useState<Record<string, { id: string }[]>>({});
    const [loadingObj, setLoading] = useState<Record<string, boolean>>({});
    const [favourites, setFavourites] = useState<Set<string>>(new Set());

    const loadConnections = useCallback(async () => {
        const conns = await window.api.getConnections();
        setConnections(conns);
    }, []);

    const loadFavourites = useCallback(async () => {
        const favs = await window.api.getFavourites();
        setFavourites(new Set(favs));
    }, []);

    const refreshExplorerData = useCallback(async () => {
        await Promise.all([loadConnections(), loadFavourites()]);
    }, [loadConnections, loadFavourites]);

    const ensureDatabasesLoaded = useCallback(
        async (connId: string) => {
            if (databases[connId]) {
                return;
            }

            setLoading(p => ({ ...p, [connId]: true }));
            try {
                const dbs = await window.api.listDatabases(connId);
                setDatabases(prev => ({ ...prev, [connId]: dbs }));
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                alert('Failed to load DBs: ' + message);
            } finally {
                setLoading(p => ({ ...p, [connId]: false }));
            }
        },
        [databases]
    );

    const ensureContainersLoaded = useCallback(
        async (connId: string, dbId: string) => {
            const key = `${connId}-${dbId}`;
            if (containers[key]) {
                return;
            }

            setLoading(p => ({ ...p, [key]: true }));
            try {
                const conts = await window.api.listContainers(connId, dbId);
                setContainers(prev => ({ ...prev, [key]: conts }));
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                alert('Failed to load containers: ' + message);
            } finally {
                setLoading(p => ({ ...p, [key]: false }));
            }
        },
        [containers]
    );

    useEffect(() => {
        const handleConnectionsChanged = () => {
            void refreshExplorerData();
        };

        void refreshExplorerData();
        window.addEventListener('cosmos:connections-changed', handleConnectionsChanged);

        return () => {
            window.removeEventListener('cosmos:connections-changed', handleConnectionsChanged);
        };
    }, [refreshExplorerData]);

    useEffect(() => {
        void (async () => {
            const favouriteConnectionIds = new Set<string>();

            for (const favourite of favourites) {
                const parsed = parseFavoriteKey(favourite);
                if (parsed?.type === 'database') {
                    favouriteConnectionIds.add(parsed.connId);
                }
            }

            await Promise.all(
                [...favouriteConnectionIds].map(async connId => {
                    if (databases[connId] || loadingObj[connId] || !connections.some(conn => conn.id === connId)) {
                        return;
                    }

                    setLoading(prev => ({ ...prev, [connId]: true }));
                    try {
                        const dbs = await window.api.listDatabases(connId);
                        setDatabases(prev => ({ ...prev, [connId]: dbs }));
                    } catch (error) {
                        console.error(`Failed to prefetch databases for ${connId}:`, error);
                    } finally {
                        setLoading(prev => ({ ...prev, [connId]: false }));
                    }
                })
            );
        })();
    }, [connections, databases, favourites, loadingObj]);

    const toggleConnection = async (connId: string) => {
        const isExpanded = !expandedConns[connId];
        setExpandedConns(prev => ({ ...prev, [connId]: isExpanded }));

        if (isExpanded) {
            await ensureDatabasesLoaded(connId);
        }
    };

    const toggleFavouriteConnection = async (connId: string) => {
        const isExpanded = !expandedFavouriteConns[connId];
        setExpandedFavouriteConns(prev => ({ ...prev, [connId]: isExpanded }));

        if (isExpanded) {
            await ensureDatabasesLoaded(connId);
        }
    };

    const toggleDatabase = async (connId: string, dbId: string) => {
        const key = `${connId}-${dbId}`;
        const isExpanded = !expandedDbs[key];
        setExpandedDbs(prev => ({ ...prev, [key]: isExpanded }));

        if (isExpanded) {
            await ensureContainersLoaded(connId, dbId);
        }
    };

    const toggleFavouriteDatabase = async (connId: string, dbId: string) => {
        const key = `${connId}-${dbId}`;
        const isExpanded = !expandedFavouriteDbs[key];
        setExpandedFavouriteDbs(prev => ({ ...prev, [key]: isExpanded }));

        if (isExpanded) {
            await ensureContainersLoaded(connId, dbId);
        }
    };

    const toggleContainerFavourite = (e: React.MouseEvent, connId: string, dbId: string, contId: string) => {
        void toggleFavourite(e, buildContainerFavoriteKey(connId, dbId, contId));
    };

    const toggleDatabaseFavourite = (e: React.MouseEvent, connId: string, dbId: string) => {
        void toggleFavourite(e, buildDatabaseFavoriteKey(connId, dbId));
    };

    const isDatabaseFavourite = (connId: string, dbId: string) => favourites.has(buildDatabaseFavoriteKey(connId, dbId));

    const isContainerFavourite = (connId: string, dbId: string, contId: string) =>
        favourites.has(buildContainerFavoriteKey(connId, dbId, contId));

    const sortedDatabases = (connId: string, dbs: { id: string }[]) => {
        return [...dbs].sort((a, b) => {
            const aFav = isDatabaseFavourite(connId, a.id);
            const bFav = isDatabaseFavourite(connId, b.id);
            if (aFav === bFav) return a.id.localeCompare(b.id);
            return aFav ? -1 : 1;
        });
    };

    const sortedContainers = (connId: string, dbId: string, conts: { id: string }[]) => {
        return [...conts].sort((a, b) => {
            const aFav = isContainerFavourite(connId, dbId, a.id);
            const bFav = isContainerFavourite(connId, dbId, b.id);
            if (aFav === bFav) return a.id.localeCompare(b.id);
            return aFav ? -1 : 1;
        });
    };

    const favouriteDbGroups = connections
        .map(conn => {
            const favouriteDbIds = new Set<string>();

            for (const favourite of favourites) {
                const parsed = parseFavoriteKey(favourite);
                if (parsed?.type === 'database' && parsed.connId === conn.id) {
                    favouriteDbIds.add(parsed.dbId);
                }
            }

            if (favouriteDbIds.size === 0) {
                return null;
            }

            return {
                conn,
                favouriteDbIds,
                resolvedDatabases: databases[conn.id]?.filter(db => favouriteDbIds.has(db.id)) ?? [],
            };
        })
        .filter((group): group is {
            conn: CosmosConnectionProfile;
            favouriteDbIds: Set<string>;
            resolvedDatabases: { id: string }[];
        } => Boolean(group));
    const toggleFavourite = async (e: React.MouseEvent, key: FavoriteKey) => {
        e.stopPropagation();
        const updated = await window.api.toggleFavourite(key);
        setFavourites(new Set(updated));
    };

    return (
        <div className="flex flex-col h-full bg-card/50 text-foreground w-full">
            <div className="flex items-center justify-between p-2 border-b border-border/50 shrink-0">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-1">Profiles</span>
                <button
                    onClick={() => void refreshExplorerData()}
                    className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {favouriteDbGroups.length > 0 && (
                    <div className="mb-2 rounded-lg border border-border/60 bg-background/60 shadow-sm">
                        <div className="flex items-center gap-2 px-2.5 py-2 border-b border-border/50">
                            <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Favorites</span>
                        </div>
                        <div className="p-2 space-y-2">
                            {favouriteDbGroups.map(({ conn, favouriteDbIds, resolvedDatabases }) => {
                                const isConnExpanded = expandedFavouriteConns[conn.id];
                                const loadingDatabases = loadingObj[conn.id] && resolvedDatabases.length === 0;

                                return (
                                    <div key={conn.id} className="rounded-md border border-border/40 bg-card/60">
                                        <div
                                            onClick={() => void toggleFavouriteConnection(conn.id)}
                                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted group transition-colors"
                                        >
                                            {isConnExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                            <Server className="h-4 w-4 text-primary opacity-80" />
                                            <span className="text-sm font-medium truncate flex-1">{conn.name}</span>
                                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{favouriteDbIds.size}</span>
                                        </div>

                                        {isConnExpanded && (
                                            <div className="pl-4 pb-1 space-y-0.5 border-l border-border/50 ml-[11px]">
                                                {loadingDatabases && (
                                                    <div className="px-6 py-1 text-xs text-muted-foreground animate-pulse">Loading...</div>
                                                )}

                                                {resolvedDatabases.map(db => {
                                                    const dbKey = `${conn.id}-${db.id}`;
                                                    const isDbExpanded = expandedFavouriteDbs[dbKey];
                                                    const sorted = sortedContainers(conn.id, db.id, containers[dbKey] ?? []);
                                                    return (
                                                        <div key={db.id}>
                                                            <div
                                                                onClick={() => void toggleFavouriteDatabase(conn.id, db.id)}
                                                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted group transition-colors"
                                                            >
                                                                {isDbExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                                                <Database className="h-4 w-4 text-blue-400 opacity-80" />
                                                                <span className="text-sm text-foreground/90 truncate flex-1">{db.id}</span>
                                                                <button
                                                                    onClick={e => toggleDatabaseFavourite(e, conn.id, db.id)}
                                                                    className="shrink-0 p-0.5 rounded transition-all opacity-80 hover:opacity-100"
                                                                    title="Remove from favourites"
                                                                >
                                                                    <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                                                                </button>
                                                            </div>

                                                            {isDbExpanded && (
                                                                <div className="pl-4 mt-0.5 space-y-0.5 border-l border-border/50 ml-[11px]">
                                                                    {loadingObj[dbKey] && <div className="px-6 py-1 text-xs text-muted-foreground animate-pulse">Loading...</div>}

                                                                    {sorted.map(cont => {
                                                                        const favKey = buildContainerFavoriteKey(conn.id, db.id, cont.id);
                                                                        const isFav = favourites.has(favKey);
                                                                        return (
                                                                            <div
                                                                                key={cont.id}
                                                                                onClick={() => onSelectContainer(conn.id, db.id, cont.id)}
                                                                                className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground group transition-colors ml-1"
                                                                            >
                                                                                <FolderCode className="h-3.5 w-3.5 text-yellow-500/80 shrink-0" />
                                                                                <span className="text-sm truncate flex-1">{cont.id}</span>
                                                                                <button
                                                                                    onClick={e => toggleContainerFavourite(e, conn.id, db.id, cont.id)}
                                                                                    className={`shrink-0 p-0.5 rounded transition-all ${isFav ? 'opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'}`}
                                                                                    title={isFav ? 'Remove from favourites' : 'Add to favourites'}
                                                                                >
                                                                                    <Star
                                                                                        className={`h-3.5 w-3.5 transition-colors ${isFav ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`}
                                                                                    />
                                                                                </button>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    {(!containers[dbKey] || containers[dbKey].length === 0) && !loadingObj[dbKey] && (
                                                                        <div className="pl-8 py-1 text-xs text-muted-foreground italic">No containers found</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {connections.map(conn => {
                    const isConnExpanded = expandedConns[conn.id];
                    return (
                        <div key={conn.id} className="select-none">
                            <div
                                onClick={() => void toggleConnection(conn.id)}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted group transition-colors"
                            >
                                {isConnExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                <Server className="h-4 w-4 text-primary opacity-80" />
                                <span className="text-sm font-medium truncate">{conn.name}</span>
                            </div>

                            {isConnExpanded && (
                                <div className="pl-4 mt-0.5 space-y-0.5">
                                    {loadingObj[conn.id] && <div className="px-6 py-1 text-xs text-muted-foreground animate-pulse">Loading...</div>}

                                    {sortedDatabases(conn.id, databases[conn.id] ?? []).map(db => {
                                        const dbKey = `${conn.id}-${db.id}`;
                                        const isDbExpanded = expandedDbs[dbKey];
                                        const sorted = sortedContainers(conn.id, db.id, containers[dbKey] ?? []);
                                        return (
                                            <div key={db.id}>
                                                <div
                                                    onClick={() => void toggleDatabase(conn.id, db.id)}
                                                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted group transition-colors"
                                                >
                                                    {isDbExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                                    <Database className="h-4 w-4 text-blue-400 opacity-80" />
                                                    <span className="text-sm text-foreground/90 truncate flex-1">{db.id}</span>
                                                    <button
                                                        onClick={e => toggleDatabaseFavourite(e, conn.id, db.id)}
                                                        className={`shrink-0 p-0.5 rounded transition-all ${isDatabaseFavourite(conn.id, db.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'}`}
                                                        title={isDatabaseFavourite(conn.id, db.id) ? 'Remove from favourites' : 'Add to favourites'}
                                                    >
                                                        <Star
                                                            className={`h-3.5 w-3.5 transition-colors ${isDatabaseFavourite(conn.id, db.id) ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`}
                                                        />
                                                    </button>
                                                </div>

                                                {isDbExpanded && (
                                                    <div className="pl-4 mt-0.5 space-y-0.5 border-l border-border/50 ml-[11px]">
                                                        {loadingObj[dbKey] && <div className="px-6 py-1 text-xs text-muted-foreground animate-pulse">Loading...</div>}

                                                        {sorted.map(cont => {
                                                            const favKey = buildContainerFavoriteKey(conn.id, db.id, cont.id);
                                                            const isFav = favourites.has(favKey);
                                                            return (
                                                                <div
                                                                    key={cont.id}
                                                                    onClick={() => onSelectContainer(conn.id, db.id, cont.id)}
                                                                    className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground group transition-colors ml-1"
                                                                >
                                                                    <FolderCode className="h-3.5 w-3.5 text-yellow-500/80 shrink-0" />
                                                                    <span className="text-sm truncate flex-1">{cont.id}</span>
                                                                    <button
                                                                        onClick={e => toggleContainerFavourite(e, conn.id, db.id, cont.id)}
                                                                        className={`shrink-0 p-0.5 rounded transition-all ${isFav ? 'opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'}`}
                                                                        title={isFav ? 'Remove from favourites' : 'Add to favourites'}
                                                                    >
                                                                        <Star
                                                                            className={`h-3.5 w-3.5 transition-colors ${isFav ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`}
                                                                        />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                        {(!containers[dbKey] || containers[dbKey].length === 0) && !loadingObj[dbKey] && (
                                                            <div className="pl-8 py-1 text-xs text-muted-foreground italic">No containers found</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {(!databases[conn.id] || databases[conn.id].length === 0) && !loadingObj[conn.id] && (
                                        <div className="pl-8 py-1 text-xs text-muted-foreground italic">No databases found</div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
                {connections.length === 0 && (
                    <div className="px-3 py-4 text-center text-sm text-muted-foreground border border-dashed border-border/50 rounded-lg mt-2 mx-1">
                        No connections found.<br />Add one to begin.
                    </div>
                )}
            </div>
        </div>
    );
}
