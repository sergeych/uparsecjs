import { ParsecSessionStorage } from "./Parsec";

/**
 * Implements [[ParsecSessionStorage]] backed by `Window.localStorage`, to be used in browsers
 * or where such storage exists. Stores parsec data unencrypted.
 */
class LocalSessionStorage implements ParsecSessionStorage {
  private ls: Storage = localStorage

  /**
   * Construct a storage using a prefix to avoid nam e conflicts. See [[ParsecSessionStorage]] for more.
   * @param prefix prefix is added to all values parsesc stores in the session.
   */
  constructor(readonly prefix = "_pss_") {
    if( !this.ls) throw new Error("No local storage found")
  }

  getItem(key: string): string | null {
    return this.ls.getItem(this.prefix+key);
  }

  removeItem(key: string): void {
    this.ls.removeItem(this.prefix+key)
  }

  setItem(key: string, value: string): void {
    this.ls.setItem(this.prefix+key, value);
  }
}



