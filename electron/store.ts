import Store from 'electron-store';
import type { CosmosConnectionProfile, FavoriteKey } from '../src/shared/types';

interface StoreType {
    connections: CosmosConnectionProfile[];
    favourites: FavoriteKey[];
}

interface StoreApi {
    get<Key extends keyof StoreType>(key: Key): StoreType[Key];
    set<Key extends keyof StoreType>(key: Key, value: StoreType[Key]): void;
}

export const store = new Store<StoreType>({
    defaults: {
        connections: [],
        favourites: []
    }
}) as unknown as StoreApi;
