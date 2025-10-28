declare module '@react-native-async-storage/async-storage' {
  export interface AsyncStorageStatic {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    multiGet(keys: readonly string[]): Promise<[string, string | null][]>;
    multiSet(entries: readonly [string, string][]): Promise<void>;
    getAllKeys(): Promise<string[]>;
  }
  const AsyncStorage: AsyncStorageStatic;
  export default AsyncStorage;
}
