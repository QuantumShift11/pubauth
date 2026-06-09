export interface KeyValueStore<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

export class MemoryKeyValueStore<T> implements KeyValueStore<T> {
  private readonly data = new Map<string, T>();

  async get(key: string): Promise<T | null> {
    return this.data.get(key) ?? null;
  }

  async set(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
}
