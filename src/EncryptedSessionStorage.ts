import { ParsecSessionStorage } from "./Parsec";
import { MemorySessionStorage } from "./MemorySessionStorage";
import { decode64, encode64, SHA, SymmetricKey } from "unicrypto";
import { bytesToUtf8, concatenateBinary, utf8ToBytes } from "./tools";
import { bossDump, bossLoad, BossObject } from "./SimpleBoss";
import { randomBytes } from "crypto";

interface Initializer extends BossObject{
  keyPrefix: Uint8Array;
  keyPostfix: Uint8Array;
  version: number;
}

const plainPrefix = "._$EnCsT$._";
const inirializerKey= plainPrefix + "li3u45hfd7d91GJg"
/**
 * Storage that encrypts its contents on the fly.
 * It is pessimistic and paranoid so it encrypts also keys and therefore it can b etime consuming,
 * so it caches ecerything in memory to not to reencrypt keys and redecrypt values.
 *
 * __Important__. It uses synchronous unicrypto interfaces and needs to habe unicrypto library be
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

  #key: SymmetricKey;
  #prefix: Uint8Array;
  #postfix: Uint8Array;
  #cachedKeys = new Map<string,string>();
  #cachedValues = new Map<string,string>();

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
   * @param key to encrypt with.
   *
   * @throws Error if the storage already has data for encrypted session storage but the key is wrong
   */
  constructor(private storage: ParsecSessionStorage | Storage,key: SymmetricKey) {
    this.#key = key;
    const packedInitializer = this.storage.getItem(inirializerKey);
    let initializer: Initializer;
    if( packedInitializer )
      initializer = bossLoad(key.etaDecryptSync(decode64(packedInitializer)));
    else {
      initializer = {
        version: 1,
        keyPrefix: randomBytes(32),
        keyPostfix: randomBytes(32)
      };
      this.storage.setItem(inirializerKey, encode64(key.etaEncryptSync(bossDump(initializer))));
    }
    // initialize key encryption subsystem
    this.#prefix = initializer.keyPrefix;
    this.#postfix = initializer.keyPostfix;
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

  getItem(key: string): string | null {
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
    this.#cachedValues.delete(key);
    this.storage.removeItem(this.transformKey(key));
  }

  setItem(key: string, value: string): void {
    this.#cachedValues.set(key,value);
    this.storage.setItem(this.transformKey(key),
      encode64(this.#key.etaEncryptSync(utf8ToBytes(value)))
    );
  }

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
    return storage.getItem(inirializerKey) !== null;
  }

}