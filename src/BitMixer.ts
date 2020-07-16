import { sha3_384 } from "./index";
import { SHA } from "unicrypto";

const masks = [
  1,2,4,8,16,32,64,128
]

/**
 * Bit manipulation routines (used for example in Parsec POW)
 */
export class BitMixer {
  /**
   * Count number of leading zero bits assuming Big Endian conversion in the provided binary data.
   *
   * @param bytes to check.
   * @return number of leading zero bits.
   */
  static countZeroes(bytes: Uint8Array): number {
    let mask = 128;
    let pos = 0;
    let value = 0;
    let length = 0;
    while(true) {
      if (mask >= 128) {
        if( pos < bytes.length ) {
          value = bytes[pos++];
          mask = 1;
        }
        else break;
      } else mask <<= 1;
      if( (value & mask) == 0 ) length++;
      else break;
    }
    return length;
  }

  /**
   * Find solution for type 1 parsec POW task.
   *
   * @param source
   * @param length
   */
  static async SolvePOW1(source: Uint8Array, length: number): Promise<Uint8Array> {
    const buffer = Uint32Array.from([0,0]);
    let index = 0;
    const result = new Uint8Array(buffer.buffer);
    while(index < 2) {
      const sha = new SHA("sha3_384");
      await sha.put(result);
      await sha.put(source);
      const s = await sha.get("bin");
      if( this.countZeroes(s) == length )
        return result;
      if( buffer[index]++ == 0xFFFFffff )
        index++;
    }
    return result;
  }
}