import { ParsecSessionStorage } from "./Parsec";
import { decode64, encode64, SHA, SymmetricKey } from "unicrypto";
import { bytesToUtf8, concatenateBinary, utf8ToBytes } from "./tools";
import { bossDump, bossLoad, BossObject } from "./SimpleBoss";
import { randomBytes } from "crypto";

interface Initializer extends BossObject{
  keyPrefix: Uint8Array;
  keyPostfix: Uint8Array;
  version: number;
  packedKey?: Uint8Array
}

const plainPrefix = "._$EnCsT$._";
const initializerKey= plainPrefix + "li3u45hfd7d91GJg"
/**
 * Storage that encrypts its contents on the fly.
 * It is pessimistic and paranoid so it encrypts also keys and therefore it can be time consuming,
 * so it caches everything in memory to not to re-encrypt keys and re-decrypt values. New version
 * storages support also changing key on the fly. V1 storages can't be upgraded to support it,
 * so it is necessary to somehow copy all its contents ot V2 storage.
 *
 * __Important__. It uses synchronous unicrypto interfaces and needs unicrypto library be
 * initialized before, e.g.
 * ```
 * import { unicryptoReady, SymmetricKey } from 'unicrypto'
 * // ...
 * // wait if need for unicrypto wasm to load:
 * await unicryptoReady;
 *
 * // for example we can get the key from password, or just create new one and then save it
 * // under the password somehow:
 * const key = new SymmetricKey();
 *
 * // create the protected storage:
 * const storage = new EncryptedSessionStorage(localStorage, key);
 * ```
 */
export class EncryptedSessionStorage implements ParsecSessionStorage{

  // the key used to encrypt/decrypt stored data
  readonly #key: SymmetricKey;

  // key transformation params
  readonly #prefix: Uint8Array;
  readonly #postfix: Uint8Array;

  // cache for transformed keys
  readonly #cachedKeys = new Map<string,string>();

  // cache for stored values
  readonly #cachedValues = new Map<string,string>();

  // this key is used to encrypt initializer only (and initializer contains data key)
  #accessKey: SymmetricKey;

  // mark to prevent any data access and/or change
  #_closed = false;

  /**
   * Current storage version. Versions have following differences:
   * - v1 does not allow [[changeKey]]
   * - v2+ can change access key on the fly
   */
  readonly version;


  /**
   * Open existing or construct new storage over web storage or paresec session storage.
   * Note that it will throw exception if there is already data of an encrypted storage created
   * with wrong password. To forcibly create new storage call [[EncryptedSessionStorage.clearIn]]
   * first.
   *
   * Important. It uses synchronous unicrypto interface, which relies on asynchronous loading of the
   * wasm module, to be sure to await for unicrypto before use (see class description).
   *
   * @param storage to construct over.
   * @param accessKey to encrypt with.
   *
   * @throws Error if the storage already has data for encrypted session storage but the key is wrong
   */
  constructor(private storage: ParsecSessionStorage | Storage,accessKey: SymmetricKey) {
    const packedInitializer = this.storage.getItem(initializerKey);
    let initializer: Initializer;
    if( packedInitializer )
      initializer = bossLoad(accessKey.etaDecryptSync(decode64(packedInitializer)));
    else {
      initializer = {
        version: 2,
        keyPrefix: randomBytes(32),
        keyPostfix: randomBytes(32),
        packedKey: new SymmetricKey().pack()
      };
      this.storage.setItem(initializerKey, encode64(accessKey.etaEncryptSync(bossDump(initializer))));
    }
    // initialize key encryption subsystem
    this.#accessKey = accessKey;
    this.#prefix = initializer.keyPrefix;
    this.#postfix = initializer.keyPostfix;
    this.#key = initializer.version == 1 ? accessKey : new SymmetricKey({keyBytes:initializer.packedKey});
    this.version = initializer.version;
  }

  /**
   * Change encryption key without altering contents of the storage. Works with storages v.1+ otherwise
   * throws an error.
   * @param newKey
   */
  changeKey(newKey: SymmetricKey) {
    const packed = this.storage.getItem(initializerKey);
    if( !packed ) throw new Error("illegal state: no initializer found in constructed encrypted ESS");
    const initializer: Initializer = bossLoad(this.#accessKey.etaDecryptSync(decode64(packed)));
    if( !initializer.packedKey ) throw new Error("old ESS version does not support key change");
    this.storage.setItem(initializerKey, encode64(newKey.etaEncryptSync(bossDump(initializer))));
    this.#accessKey = newKey;
  }

  private transformKey(key: string) {
    let result = this.#cachedKeys.get(key);
    if( !result ) {
      const data = concatenateBinary(this.#prefix, utf8ToBytes(key), this.#postfix);
      result = plainPrefix + encode64(SHA.getDigestSync("sha3_384", data));
      this.#cachedKeys.set(key,result);
    }
    return result;
  }

  private checkClosed() {
    if( this.#_closed ) throw new Error("encrypted storage is closed");
  }

  getItem(key: string): string | null {
    this.checkClosed();
    let result = this.#cachedValues.get(key) ?? null;
    if( result ) return result;
    const tk = this.transformKey(key);
    const encrypted = this.storage.getItem(tk);
    if( encrypted ) {
      result = bytesToUtf8(this.#key.etaDecryptSync(decode64(encrypted)));
      this.#cachedValues.set(key, result);
    }
    return result;
  }

  removeItem(key: string): void {
    this.checkClosed();
    this.#cachedValues.delete(key);
    this.storage.removeItem(this.transformKey(key));
  }

  setItem(key: string, value: string): void {
    this.checkClosed();
    this.#cachedValues.set(key,value);
    this.storage.setItem(this.transformKey(key),
      encode64(this.#key.etaEncryptSync(utf8ToBytes(value)))
    );
  }

  close() { this.#_closed = true; }

  get isClosed(): boolean { return this.#_closed; }

  /**
   * Wipe out all encrypted storage data from some web storage-like object. Note that parsec storages
   * usually do not implement it.
   *
   * If you are going to create new EncryptedSessionStorage over a localStorea, is is advised to call
   * this method prior to construct, otherwise it may fail if there is already encrypted storage
   * created with another key.
   *
   * @param storage web storage to clear encrypted data from.
   */
  static clearIn(storage: Storage) {
    for(let i=0; i<storage.length; i++) {
      const key = storage.key(i);
      if( key?.startsWith(plainPrefix))
        storage.removeItem(key);
    }
  }

  /**
   * Checks that in some web storage likely contains data of the EncryptedSessionStorage. In that case
   * it is possible to "open existing" by constructing new instance, or it is necessary to [[clearIn]]
   * first to construct new one.
   *
   * @param storage true if there are encrypted session storage data.
   */
  static existsIn<T extends Storage>(storage: T): boolean {
    return storage.getItem(initializerKey) !== null;
  }

}
