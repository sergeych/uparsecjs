/**
 * Safebox: cryptocontainer accessible by 1+ Universal Keys. Variant of Universa Capsule
 * better suited the task of private storage.
 *
 * # Uge cases
 *
 * ## New safebox from scratch
 *
 * Create new safebox, add/replace content, add/remove keys
 *
 * ~~~
 *   const box = Coffer.create();
 *   box.payload = "foo bar beyond all recognition!";
 *   box.addKeys(someKey)
 *   box.pack()
 * ~~~
 *
 * ## Open existing safebox using one known key
 *
 * If at least one key is known, it is possible to open a packed sandbox. With the open sandbox it is possoble
 * to change data and keys and repack it.
 *
 * ~~~
 * const box = Coffer.unpack(packedBytes, keys)
 * if( !box ) throw "shit happens";
 * box.payload += "shit happens!";
 * box.addKeys(newKey);
 * box.pack();
 * ~~~
 *
 * ## No way to remove key
 *
 * Inner key is still the same. So no use to remove a key without repacking.
 *
 * ## Extract keyTags
 *
 * It could be necessary if for example the system could ask the password from the user if need, and needs
 * to know if there are password keys and derival parameters.
 * ~~~
 *  let pkdOptions = Safebox.extractPKDOptions(packed);
 *  // try to derive password from
 * ~~~
 *
 * ## Change inner key
 *
 * This procedure is only needed if one of keys ever used with it is compromised. To perform it, one should
 * __create new Safebox with needed keys only__. This is clear and simple procedure, in any case change
 * possibly comprimised inner key needs all sandbox keys to which it will remain available.
 */
// import {
//   PasswordKeyTag,
//   PKDOptions,
//   UniversalKey,
//   UniversalKeyTag,
//   UniversalPasswordKey
// } from "./UnversalKeys";
//
// import { Boss, bytesToHex, randomBytes, SymmetricKey, textToBytes } from "universa-wasm";
// import { bytesToUtf8 } from "./tools";
// import {bossDump, bossLoad} from "./SimpleBoss";
//
// interface InnerKeyRecord {
//   tag: UniversalKeyTag,
//   encryptedKey: Uint8Array
// }
//
// export interface SerializedCoffer {
//   innerKeyRecords: InnerKeyRecord[],
//   payload: Uint8Array
// }
//
// export class CofferException extends Error {
//   constructor(text: string) {
//     super(text);
//   }
// }
//
// export class Coffer {
//   private readonly packedInnerKey: Uint8Array;
//
//   get isDirty(): Boolean {
//     return this._isDirty;
//   }
//
//   get payload(): Uint8Array | null {
//     return this._payload;
//   }
//
//   setPayload(payload: object | Uint8Array ): Coffer {
//     const data: Uint8Array = payload instanceof Uint8Array ? payload : bossDump(payload)
//     this.payload = data;
//     return this;
//   }
//
//   set payload(value: Uint8Array | null) {
//     if (!this._payload && !value) return;
//     this._payload = value;
//     this._preparedPayload = undefined;
//     this._isDirty = true;
//   }
//
//   get payloadString(): string | null {
//     return this._payload ? bytesToUtf8(this._payload) : null;
//   }
//
//   get payloadObject(): any | null {
//     return this._payload ? bossLoad(this._payload) : null;
//   }
//
//   /**
//    * Set string as a payload.
//    *
//    * @param value
//    */
//   set payloadString(value: null | string) {
//     this.payload = value ? textToBytes(value) : null;
//   }
//
//   private readonly innerKey: Promise<SymmetricKey>;
//   private _payload: Uint8Array | null;
//   private _isDirty = false;
//   private innerKeyRecords = new Map<string, InnerKeyRecord>();
//
//   /**
//    * Check that serialized or packed coffer could be opened with a password
//    * @param source if it can
//    */
//   static hasPassword(source: SerializedCoffer | Uint8Array): Boolean {
//     const s: SerializedCoffer = source instanceof Uint8Array ? bossLoad(source) : source;
//     for (let kr of s.innerKeyRecords) if (kr.tag.type == 'password') return true;
//     return false;
//   }
//
//   private constructor() {
//   }
//
//   private async setup(serialized?: SerializedCoffer, ...keys: (UniversalKey | string)[]) {
//     if (serialized) {
//       if (keys.length == 0)
//         throw "at least one key is required to unpack";
//       if (serialized.innerKeyRecords.length < 1)
//         throw "illegal coffer (no keys)";
//       // we want to search it faset
//       for (let ikr of serialized.innerKeyRecords) {
//         this.innerKeyRecords.set(bytesToHex(ikr.tag.id), ikr);
//       }
//       let keyRecord: InnerKeyRecord | undefined;
//       let key: UniversalKey | undefined;
//
//       for (let k of keys) {
//         if (k instanceof UniversalKey) {
//           keyRecord = this.innerKeyRecords.get(bytesToHex(k.tag.id));
//           if (keyRecord) {
//             key = k;
//             break;
//           }
//         } else {
//           // string key means match the password. this is enough effective as UniversalPasswordKey
//           // internally caches PBKDF runs, so we only can pre-scan innerKeyRecords for password tags.
//           // but it is not a big deal as we rarely have more than one password.
//           for (let ir of this.innerKeyRecords.values()) {
//             if (ir.tag.type == 'password') {
//               let passwordKey = await UniversalPasswordKey.deriveFrom(k, (ir.tag as PasswordKeyTag).pkdOptions);
//               keyRecord = this.innerKeyRecords.get(bytesToHex(passwordKey.tag.id));
//               if (keyRecord) {
//                 key = passwordKey;
//                 break;
//               }
//             }
//           }
//
//         }
//       }
//       if (!keyRecord || !key) throw new CofferException("no suitable key");
//       this.innerKey = new SymmetricKey({ keyBytes: key.decrypt(keyRecord.encryptedKey) });
//       this._preparedPayload = serialized.payload;
//       const data = new Boss().load(this.innerKey.decrypt(serialized.payload)) as any[];
//       this._payload = data[0] == 0 ? null : data[1] as Uint8Array;
//     } else {
//       // random
//       this.innerKey = Promise.resolve(new SymmetricKey());
//       this._payload = null;
//     }
//     this.packedInnerKey = this.innerKey.pack();
//   }
//
//   private _preparedPayload: Uint8Array | undefined;
//
//   serialize(): SerializedCoffer {
//     if (!this._preparedPayload) {
//       // there should be keys!
//       if (this.innerKeyRecords.size < 1)
//         throw "Coffer: add at least once key first";
//       // if the payload is empty, we should imitate it
//       let data = this._payload ?
//         [1, this._payload, randomBytes(Math.random() * 17)] :
//         [0, randomBytes(Math.random() * 37)];
//       this._preparedPayload = this.innerKey.etaEncrypt(new Boss().dump(data));
//     }
//     return {
//       innerKeyRecords: Array.from(this.innerKeyRecords.values()),
//       payload: this._preparedPayload
//     };
//   }
//
//   addKeys(...keys: UniversalKey[]) {
//     for (let k of keys) {
//       const key = bytesToHex(k.tag.id);
//       if (this.innerKeyRecords.has(key))
//         console.warn("key already exist in the safebox, ingnoring");
//       else {
//         this.innerKeyRecords.set(key, {
//           tag: k.tag,
//           encryptedKey: k.encrypt(this.packedInnerKey)
//         });
//         this._isDirty = true;
//       }
//     }
//   }
//
//   private cachedPack: Uint8Array | undefined;
//
//   pack(): Uint8Array {
//     if (!this.cachedPack || this._isDirty) {
//       this.cachedPack = new Boss().dump(this.serialize());
//       this._isDirty = false;
//     }
//     return this.cachedPack;
//   }
//
//   /**
//    * Unpack using some keys amd raw passwords. Passwords, will be used to try to derive
//    * keys using stored key derivation configuration from before added password keys.
//    *
//    * @param serialized coffer
//    * @param keys and/or passwords in any combination
//    */
//   static load(serialized: SerializedCoffer, ...keys: (UniversalKey | string)[]): Coffer {
//     return new Coffer(serialized, ...keys);
//   }
//
//   /**
//    * Create empty coffer. Please add at least one key to it before {@link pack} or {@link serialize}.
//    */
//   static create(...keys: UniversalKey[]): Coffer {
//     const c = new Coffer()
//     c.addKeys(...keys);
//     return c;
//   }
//
//   /**
//    * Unpack using some keys amd raw passwords. Passwords, will be used to try to derive
//    * keys using stored key derivation configuration from before added password keys.
//    *
//    * @param packed coffer
//    * @param keys and/or passwords in any combination
//    */
//   static unpack(packed: Uint8Array, ...keys: (UniversalKey | string)[]): Coffer {
//     return new Coffer(new Boss().load(packed) as SerializedCoffer, ...keys);
//   }
//
//   /**
//    * Return true if this coffer contain at least one password key, e.g. could be opened with the password.
//    */
//   hasPassword() {
//     for (const kr of this.innerKeyRecords.values()) {
//       if (kr.tag.type == 'password')
//         return true;
//     }
//     return false;
//   }
// }
