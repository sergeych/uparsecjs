import { ParsecSessionStorage } from "./Parsec";

/**
 * Simple implementation of [[ParsecSessionStorage]] that does not saves data. Useful for testing
 * or single, non-repeating operation. In other cases it is recommended to use persistent implementations
 * like [[LocalSessionStorage]].
 */
export class MemorySessionStorage implements ParsecSessionStorage {

  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

}