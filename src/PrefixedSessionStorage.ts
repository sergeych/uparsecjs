import { ParsecSessionStorage } from "./Parsec";

/**
 * Implements proxy for a [[ParsecSessionStorage]] that adds prefix to all keys when storing and retreiving data.
 * Convenient to join several storages in one separating their namespaces. Use it with some existing one. Data
 * are stored in parent storage.
 *
 * like [[LocalSessionStorage]].
 */
export class PrefixedSessionStorage implements ParsecSessionStorage {

  /**
   * Create proxy storage that keeps data in the parent storage adding specified prefix to all keys.
   * @param prefix string to add to all keys
   * @param storage parent storage where the data is actually stored.
   */
  constructor(private prefix: string, private storage: ParsecSessionStorage) {
  }

  getItem(key: string): string | null {
    return this.storage.getItem(this.prefix + key);
  }

  removeItem(key: string): void {
    this.storage.removeItem(this.prefix + key)
  }

  setItem(key: string, value: string): void {
    this.storage.setItem(this.prefix + key, value);
  }
}



