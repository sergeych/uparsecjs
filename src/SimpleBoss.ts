import { Boss, decode64 } from "universa-wasm";

/**
 * Unpack boss object from the base64 encoded string or binary array.
 * @param data to unpack
 */
export function bossLoad<T>(data: Uint8Array | string) {
  const src = data instanceof Uint8Array ? data : decode64(data);
  return (new Boss().load(src)) as T;
}

/**
 * Pack any source object to boss binary binary notation
 * @param data
 */
export function bossDump(data: any): Uint8Array {
  return new Boss().dump(data)
}