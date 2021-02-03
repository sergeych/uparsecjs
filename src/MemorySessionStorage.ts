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

  /**
   * Create copy of the current data.
   * @return new instance with copied data
   */
  toMap(): Map<string,string> {
    return new Map(this.data);
  }

  /**
   * Merge data from a map od another MemorySessionStorage, overriding existing values.
   * @param other map or storage to merge
   * @return updated this
   */
  addAll(other: MemorySessionStorage | Map<string,string>): MemorySessionStorage {
    const m = other instanceof Map ? other : other.data;
    for( const [k, v] of m) {
      this.data.set(k, v)
    }
    return this;
  }

  clear(): void {
    this.data.clear();
  }
}