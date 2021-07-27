export * from "./AsyncStoredSerializedValue";
export * from "./CachedMemoryStorage";
export * from "./CachedStoredValue";
export * from "./CachedValue";
export * from "./Citr";
export * from "./Coffer";
export * from "./CompletablePromise";
export * from "./dumps";
export * from "./Emitter";
export * from "./EncryptedSessionStorage";
export * from "./Estimator";
export * from "./Parsec";
export * from "./LocalSessionStorage"
export * from "./MemorySessionStorage"
export * from "./Parsec"
export * from "./ParsecExceptions"
export * from "./ParsecSession";
export * from "./Passwords";
export * from "./PrefixedSessionStorage";
export * from "./SimpleBoss";
export * from "./StoredSerializedValue";
export * from "./text_tools";
export * from "./tools";
export * from "./UNS";
export * from "./UnversalKeys";
export * from "./Zedentials";

import { utf8ToBytes } from "./tools";

// we will add it to unicrypto instead
// export type BossPrimitive = string | null | number | Date | boolean | BossArray | BossObject | Uint8Array;
// /*eslint @typescript-eslint/no-empty-interface: "off" */
// export interface BossArray extends Array<BossPrimitive> {}
// export interface BossObject extends Record<string,BossPrimitive> {}

/**
 * Simple compare semver version strings.
 * @param v1
 * @param v2
 */
export function compareVersions(v1: string,v2: string) {
  const parts1 = v1.split('.').map(x => +x);
  const parts2 = v2.split('.').map(x => +x);
  const n = parts1.length < parts2.length ? parts2.length : parts1.length;
  for (let i = 0; i < n; i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return +1;
  }
  return 0;
}

import {SHA} from 'unicrypto';

export async function sha256(data: Uint8Array | string) {
  if( !(data instanceof Uint8Array) )
    data = utf8ToBytes(data)
  return await SHA.getDigest("sha256", data);
}

export async function sha3_384(data: Uint8Array | string) {
  if( !(data instanceof Uint8Array) )
    data = utf8ToBytes(data)
  return await SHA.getDigest("sha3_384", data);
}