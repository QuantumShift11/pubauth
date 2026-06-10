import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export class JsonFileStore<T extends object> {
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly defaultValue: T,
  ) {}

  async read(): Promise<T> {
    return this.withLock(async () => this.readUnlocked());
  }

  async update(updater: (current: T) => T | Promise<T>): Promise<T> {
    return this.withLock(async () => {
      const current = await this.readUnlocked();
      const next = await updater(structuredClone(current));
      await this.writeUnlocked(next);
      return next;
    });
  }

  async replace(next: T): Promise<void> {
    await this.withLock(async () => {
      await this.writeUnlocked(next);
    });
  }

  private async withLock<R>(task: () => Promise<R>): Promise<R> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((resolveQueue) => {
      release = resolveQueue;
    });

    await previous;

    try {
      return await task();
    } finally {
      release();
    }
  }

  private async readUnlocked(): Promise<T> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      return JSON.parse(raw) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await this.writeUnlocked(this.defaultValue);
        return structuredClone(this.defaultValue);
      }

      throw error;
    }
  }

  private async writeUnlocked(next: T): Promise<void> {
    const target = resolve(this.filePath);
    const directory = dirname(target);
    await mkdir(directory, { recursive: true });

    const tempPath = `${target}.${process.pid}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    await rename(tempPath, target);
  }
}
