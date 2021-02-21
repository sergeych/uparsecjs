import { ParsecSessionStorage } from "./Parsec";

/**
 * @deprecated use web Storage directly: [[ParsecSessionStorage]] is a subset of web [[Storage]]
 * interface, so it is recommended direct useage of `localStorage` of `sessionStorage`.
 *
 *
 * This class is left for compatibility reasons and will be removed in future releases.
 */
class LocalSessionStorage implements ParsecSessionStorage {
  private ls: Storage = localStorage

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



