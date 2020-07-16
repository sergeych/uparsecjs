export * from "./AsyncStoredSerializedValue";
export * from "./CachedStoredValue";
export * from "./CachedValue";
export * from "./Coffer";
export * from "./CompletablePromise";
export * from "./Estimator";
export * from "./Parsec";
export * from "./ParsecSession";
export * from "./Passwords";
export * from "./Passwords";
export * from "./SimpleBoss";
export * from "./StoredSerializedValue";
export * from "./tools";
export * from "./UnversalKeys";

import { utf8ToBytes } from "./tools";

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