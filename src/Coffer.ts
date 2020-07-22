import { PasswordKeyTag, UniversalKey, UniversalKeyTag, UniversalPasswordKey } from "./UnversalKeys";

import { Boss, bytesToHex, randomBytes, SymmetricKey, textToBytes } from "unicrypto";
import { bytesToUtf8 } from "./tools";
import { bossDump, bossLoad } from "./SimpleBoss";

interface InnerKeyRecord {
  tag: UniversalKeyTag,
  encryptedKey: Uint8Array
}

export interface SerializedCoffer {
  innerKeyRecords: InnerKeyRecord[],
  payload: Uint8Array
}

export class CofferException extends Error {
  constructor(text: string) {
    super(text);
  }
}

/**
 * Coffer: cryptocontainer locked by any of some set of keys (at least one, no "open" coffers could exist).
 * Variant of Universa Capsule, simplified and enhanced in the same time. Primarly to exchange data among multiple
 * parties in end-to-end environment, safe cloud stores, etc.
 *
 * # Use cases
 *
 * ## New safebox from scratch
 *
 * Create new safebox, add/replace content, add/remove keys
 *
 * ~~~
 *   const box = await Coffer.create();
 *   box.payload = "foo bar beyond all recognition!";
 *   await box.addKeys(someKey);
 *   const packedBytes = await box.pack();
 * ~~~
 *
 * ## Open existing coffeer using one known key
 *
 * If at least one key is known, it is possible to open a packed sandbox. With the open coffer it is possoble
 * to change data and keys and repack it.
 *
 * ~~~
 * const box = await Coffer.unpack(packedBytes, keys)
 * // change payload
 * box.payload += "; and please be forewarned: shit happens.";
 * // add one more key
 * await box.addKeys(newKey);
 * // now pack to store updated coffer
 * const newPackedBytes = await box.pack();
 * ~~~
 *
 * ## No way to remove key
 *
 * Inner key is still the same. So no use to remove a key without repacking.
 *
 * ## Check the coffer can be unlocked with a password
 *
 * ~~~
 *  if( Coffer.hasPassword(packedCoffer) ) {
 *    // hypotetic code
 *    const password: string = prompt("enter password:");
 *    await Coffer.unpack(packedCoffer, password);
 *  }
 *  else {
 *    // use some other key
 *  }
 * ~~~
 *
 * ## Change inner key
 *
 * This procedure is only needed if one of keys ever used with it is compromised. To perform it,
 * __create new Coffer with only needed keys only__. There is no way to do it somehow else without
 * seriously compromising content.
 */
export class Coffer {
  private packedInnerKey: Uint8Array | undefined;

  /**
   * true means keys or payload has been changed and updated packed coffer mist likely has to be
   * stored.
   */
  get isDirty(): Boolean {
    return this._isDirty;
  }

  /**
   * Get coffer payload as binary data
   */
  get payload(): Uint8Array | null {
    return this._payload;
  }

  setPayload(payload: object | Uint8Array ): Coffer {
    this.payload = payload instanceof Uint8Array ? payload : bossDump(payload);
    return this;
  }

  set payload(value: Uint8Array | null) {
    if (!this._payload && !value) return;
    this._payload = value;
    this._preparedPayload = undefined;
    this._isDirty = true;
  }

  get payloadString(): string | null {
    return this._payload ? bytesToUtf8(this._payload) : null;
  }

  get payloadObject(): any | null {
    return this._payload ? bossLoad(this._payload) : null;
  }

  /**
   * Set string as a payload.
   *
   * @param value
   */
  set payloadString(value: null | string) {
    this.payload = value ? textToBytes(value) : null;
  }

  private innerKey: SymmetricKey | undefined;
  private _payload: Uint8Array | null;
  private _isDirty = false;
  private innerKeyRecords = new Map<string, InnerKeyRecord>();

  /**
   * Check that serialized or packed coffer could be opened with a password. It does not construct and
   * unpack it, just check it could be unlocked with a password.
   *
   * @param source packed ot serialized coffer
   * @return true if it can. It does not mean that the coffer is only password-locked, there could be many keys and even
   *         several passwords.
   */
  static hasPassword(source: SerializedCoffer | Uint8Array): Boolean {
    const s: SerializedCoffer = source instanceof Uint8Array ? bossLoad(source) : source;
    for (let kr of s.innerKeyRecords) if (kr.tag.type == 'password') return true;
    return false;
  }

  private constructor() {
    // do not create it directly
  }

  /**
   * After construction, coffer is not ready, it should await setup prior to be exposed to
   * public and used.
   * @param serialized coffer
   * @param keys tpo try to open it
   */
  private async setup(serialized?: SerializedCoffer, ...keys: (UniversalKey | string)[]): Promise<Coffer> {
    if (serialized) {
      // deserialize
      if (keys.length == 0)
        throw "at least one key is required to unpack";
      if (serialized.innerKeyRecords.length < 1)
        throw "illegal coffer (no keys)";
      // we want to search it fast, so lets make a hashtable
      for (let ikr of serialized.innerKeyRecords) {
        this.innerKeyRecords.set(bytesToHex(ikr.tag.id), ikr);
      }
      let keyRecord: InnerKeyRecord | undefined;
      let key: UniversalKey | undefined;

      // Scan to find a key that will open this coofer:
      for (let k of keys) {
        if (k instanceof UniversalKey) {
          // its a key, not password
          keyRecord = this.innerKeyRecords.get(bytesToHex(k.tag.id));
          if (keyRecord) {
            // matching record found
            key = k;
            break;
          }
        } else {
          // string key means match the password. this is enough effective as UniversalPasswordKey
          // internally caches PBKDF runs, so we only can pre-scan innerKeyRecords for password tags.
          // but it is not a big deal as we rarely have more than one password.
          for (let ir of this.innerKeyRecords.values()) {
            if (ir.tag.type == 'password') {
              let passwordKey = await UniversalPasswordKey.deriveFrom(k, (ir.tag as PasswordKeyTag).pkdOptions);
              keyRecord = this.innerKeyRecords.get(bytesToHex(passwordKey.tag.id));
              if (keyRecord) {
                key = passwordKey;
                break;
              }
            }
          }
        }
      }
      if (!keyRecord || !key)
        throw new CofferException("no matcing key");

      this.innerKey = new SymmetricKey({ keyBytes: await key.decrypt(keyRecord.encryptedKey) });
      this._preparedPayload = serialized.payload;
      const data = Boss.load(await this.innerKey.decrypt(serialized.payload)) as any[];
      this._payload = data[0] == 0 ? null : data[1] as Uint8Array;
    } else {
      // new Coffer, generating random key
      this.innerKey = new SymmetricKey();
      this._payload = null;
    }
    this.packedInnerKey = this.innerKey.pack();
    return this;
  }

  private _preparedPayload: Uint8Array | undefined;

  /**
   * Get serialized coffer as an object. This object contains binary data so serializing it with bare JSON
   * might ve ineffective or even buggy. BOSS serialization is OK. Good to store inside other structures
   * to be later serialized with BOSS to get most of its caching data.
   */
  async serialize(): Promise<SerializedCoffer> {
    if (!this._preparedPayload) {
      // there should be keys!
      if (this.innerKeyRecords.size < 1)
        throw "Coffer: add at least once key first";
      // if the payload is empty, we should imitate it
      let data = this._payload ?
        [1, this._payload, randomBytes(Math.random() * 17)] :
        [0, randomBytes(Math.random() * 37)];
      this._preparedPayload = await this.innerKey!.etaEncrypt(Boss.dump(data));
    }
    return {
      innerKeyRecords: Array.from(this.innerKeyRecords.values()),
      payload: this._preparedPayload
    };
  }

  /**
   * Add one or more keys that will unlock this coffer. The coffer becomes dirty.
   *
   * @param keys to add. Technically, it is possible to add one key several times but it will be logged
   *        to the console.
   */
  async addKeys(...keys: UniversalKey[]) {
    for (let k of keys) {
      const key = bytesToHex(k.tag.id);
      if (this.innerKeyRecords.has(key))
        console.warn("key already exist in the safebox, ingnoring");
      else {
        this.innerKeyRecords.set(key, {
          tag: k.tag,
          encryptedKey: await k.encrypt(this.packedInnerKey!)
        });
        this._isDirty = true;
      }
    }
  }

  private cachedPack: Uint8Array | undefined;

  /**
   * Get the packed binary representation of the coffer. It uses bits-effective BOSS serialization. See {{SimpleBoss}} for details.
   */
  async pack(): Promise<Uint8Array> {
    if (!this.cachedPack || this._isDirty) {
      this.cachedPack = Boss.dump(await this.serialize());
      this._isDirty = false;
    }
    return this.cachedPack;
  }

  /**
   * Unpack using some keys amd raw passwords. Passwords, will be used to try to derive
   * keys using stored key derivation configuration from before added password keys.
   *
   * @param serialized coffer
   * @param keys and/or passwords in any combination
   */
  static async load(serialized: SerializedCoffer, ...keys: (UniversalKey | string)[]): Promise<Coffer> {
    return await new Coffer().setup(serialized, ...keys);
  }

  /**
   * Create empty coffer. Please add at least one key to it before {@link pack} or {@link serialize}.
   */
  static async create(...keys: UniversalKey[]): Promise<Coffer> {
    const c = await new Coffer().setup();
    await c.addKeys(...keys);
    return c;
  }

  /**
   * Unpack using some keys amd raw passwords. Passwords, will be used to try to derive
   * keys using stored key derivation configuration from before added password keys.
   *
   * @param packed coffer
   * @param keys and/or passwords in any combination
   * @throws CofferException if the coffer could not be unpacked with presented keys, is broken and so on.
   */
  static async unpack(packed: Uint8Array, ...keys: (UniversalKey | string)[]): Promise<Coffer> {
    return await new Coffer().setup(Boss.load(packed) as SerializedCoffer, ...keys);
  }

  /**
   * Return true if this coffer contain at least one password key, e.g. could be opened with the password.
   */
  hasPassword() {
    for (const kr of this.innerKeyRecords.values()) {
      if (kr.tag.type == 'password')
        return true;
    }
    return false;
  }
}
