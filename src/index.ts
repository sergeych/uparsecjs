
// version 0.1* were minicrypto-js based, e,g, sync and sometimes too blocking
// library based in forge which uses not trusty in some cases browser crypto extensions
// that tends to generate weak keys.
import { utf8ToBytes } from "./tools";

export const CORE_VERSION = "0.2.0";

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

import {SHA} from 'universa-wasm';

export async function sha256(data: Uint8Array | string) {
  if( !(data instanceof Uint8Array) )
    data = utf8ToBytes(data)
  return await SHA.getDigest("sha256", data);
}