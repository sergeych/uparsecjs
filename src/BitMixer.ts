import { SHA, CryptoWorker } from "unicrypto";

/**
 * Bit manipulation routines (used for example in Parsec POW)
 */
export class BitMixer {
  private static SHA = SHA;

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
    while (true) {
      if (mask >= 128) {
        if (pos < bytes.length) {
          value = bytes[pos++];
          mask = 1;
        } else break;
      } else mask <<= 1;
      if ((value & mask) == 0) length++;
      else break;
    }
    return length;
  }

  static SolvePOW1Worker(source: Uint8Array, length: number): Promise<Uint8Array> {
    function exec(resolve, reject) {
      const { length, source } = this.data;

      this.SolvePOW1(source, length).then(resolve, reject);
    }

    return CryptoWorker.run(exec, {
      data: { source, length },
      functions: {
        countZeroes: BitMixer.countZeroes,
        SolvePOW1: BitMixer.SolvePOW1
      }
    });
  }

  /**
   * Find solution for type 1 parsec POW task.
   *
   * @param source
   * @param length
   */
  static SolvePOW1(source: Uint8Array, length: number): Promise<Uint8Array> {
    const { SHA, countZeroes } = this;
    const buffer = Uint32Array.from([0, 0]);
    let index = 0;
    const result = new Uint8Array(buffer.buffer);

    function tryToSolve() {
      return getHash().then(hash => {
        if (countZeroes(hash) == length) return result;
        if (buffer[index]++ == 0xFFFFffff) index++;
        if (index < 2) return tryToSolve();
        throw Error("failed to solve POW1 of length " + length);
      });
    }

    function getHash() {
      const sha = new SHA("sha3_384");
      return sha.put(result)
              .then(() => sha.put(source))
              .then(() => sha.get('bin'));
    }

    return tryToSolve();
  }
}
