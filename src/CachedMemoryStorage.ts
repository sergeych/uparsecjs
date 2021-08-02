import { ParsecSessionStorage } from "./Parsec";
import { MemorySessionStorage } from "./MemorySessionStorage";


/**
 * Smart cached storage with two main functions:
 *
 * - it can just cache data stored in any other storage for speed
 * - it can accumulate data _before the storage is connected_ then save it on connection.
 *
 * The latter scenario is very useful when. say, you have to connect parsec session before logging in.
 * To not to expose parsec session to browser storage, you can wait until user log in or somehow ele
 * writes a password then connect the storage to some password protected (encrypted) storage,
 * for example, [[EncryptedSessionStorage]]. To do so,
 * construct CachedSessionStorage with no parameters and call [[connectToStorage]] when ready.
 *
 */
export class CachedSessionStorage extends MemorySessionStorage {

  /**
   * Create cached storage with or without underlying parent storage. If the
   * parent storage is not set, data si kept only in memory as long as the instance
   * exists. To save data later call [[connectToStorage]] any time later.
   * @param storage underlying storage
   */
  constructor(private storage?: ParsecSessionStorage) {
    super();
  }

  getItem(key: string): string | null {
    let result: string | null | undefined = super.getItem(key);
    if( result  ) return result;
    result = this.storage?.getItem(key);
    if( result )
      super.setItem(key, result);
    return result ?? null;
  }

  removeItem(key: string): void {
    super.removeItem(key);
    this.storage?.removeItem(key);
  }

  setItem(key: string, value: string): void {
    super.setItem(key, value);
    this.storage?.setItem(key,value);
  }

  /**
   * Connect storage as underlying. All data already stored will be copied to it. After this call
   * this instance works as a cached proxy. To avoid strange bugs _do not use underlying
   * storage directly anymore_. Access it from the cached storage only.
   *
   * If the storage already connected ({@link isConnected} === true), it will throw exception unless
   * `forceReplace` is set to true.
   *
   * @param newStorage storage to connect
   * @param forceReplace do not throw error if some storage is already connected
   */
  connectToStorage(newStorage: ParsecSessionStorage,forceReplace=false) {
    if( this.storage && !forceReplace ) throw new Error("storage is already connected")
    for( let [key, value] of this.toMap() )
      newStorage.setItem(key, value);
    this.storage = newStorage;
  }

  /**
   * if the storage is connected, disconnect it and works as MemoryStorage from now on. This effectively drops
   * also any cached content, so after this call the storage is always empty.
   */
  disconnect() {
    this.storage = undefined;
  }

  clear() {
    if( this.storage )
      throw Error("can't clear connected cached storage: disconnect() it first");
    super.clear();
  }

  /**
   * check that there is already a connected underlying storage
   */
  get isConnected(): boolean { return !!this.storage; }

}
