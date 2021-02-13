import { Boss, decode64 } from "unicrypto";


export type BossPrimitive = string | null | undefined | number | Date | boolean | BossArray | BossObject
  | Uint8Array | Map<BossPrimitive, BossPrimitive>;

/*eslint @typescript-eslint/no-empty-interface: "off" */
export interface BossArray extends Array<BossPrimitive> {
}

export interface BossObject extends Record<string, BossPrimitive> {
}

/**
 * Unpack boss object from the base64 encoded string or binary array.
 * @param data to unpack
 */
export function bossLoad<T>(data: Uint8Array | string): T {
  const src = data instanceof Uint8Array ? data : decode64(data);
  return (Boss.load(src)) as T;
}

/**
 * Strongly typed Boss Unpack, recommended boss object from the base64 encoded string or binary array.
 * @param data to unpack
 */
export function bossUnpack<T extends BossPrimitive>(data: Uint8Array | string): T {
  const src = data instanceof Uint8Array ? data : decode64(data);
  return (Boss.load(src)) as T;
}

export function bossUnpackObject(data: Uint8Array | string): BossObject {
  return bossUnpack(data);
}

/**
 * Pack any source object to boss binary binary notation
 * @param data
 */
export function bossDump(data: BossPrimitive): Uint8Array {
  return Boss.dump(data)
}

