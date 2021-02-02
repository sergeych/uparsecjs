import { Boss, decode64 } from "unicrypto";


export type BossPrimitive = string | null | undefined | number | Date | boolean | BossArray | BossObject | Uint8Array;

/*eslint @typescript-eslint/no-empty-interface: "off" */
export interface BossArray extends Array<BossPrimitive> {
}

export interface BossObject extends Record<string, BossPrimitive> {
}

/**
 * Unpack boss object from the base64 encoded string or binary array.
 * @param data to unpack
 */
export function bossLoad<T>(data: Uint8Array | string) {
  const src = data instanceof Uint8Array ? data : decode64(data);
  return (Boss.load(src)) as T;
}

/**
 * Pack any source object to boss binary binary notation
 * @param data
 */
export function bossDump(data: BossPrimitive): Uint8Array {
  return Boss.dump(data)
}

