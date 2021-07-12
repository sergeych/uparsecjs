// function decode1(binString: Uint8Array): string {
//   const ua = new Uint8Array(binString.length);
//   Array.prototype.forEach.call(binString, (ch, i) => ua[i] = ch.charCodeAt(0));
//   return ua;
// }

import { BitMixer } from "../src/BitMixer";
import { sha3_384 } from "../src";

describe("BitMixer", () => {
  it("count zeroes", async () => {
    expect(BitMixer.countZeroes(Uint8Array.of(0))).toBe(8);
    expect(BitMixer.countZeroes(Uint8Array.of(1))).toBe(0);
    expect(BitMixer.countZeroes(Uint8Array.of(2))).toBe(1);
    expect(BitMixer.countZeroes(Uint8Array.of(4))).toBe(2);
    expect(BitMixer.countZeroes(Uint8Array.of(8))).toBe(3);
    expect(BitMixer.countZeroes(Uint8Array.of(16))).toBe(4);
    expect(BitMixer.countZeroes(Uint8Array.of(32))).toBe(5);
    expect(BitMixer.countZeroes(Uint8Array.of(64))).toBe(6);
    expect(BitMixer.countZeroes(Uint8Array.of(128))).toBe(7);
    expect(BitMixer.countZeroes(Uint8Array.of(130))).toBe(1);
    expect(BitMixer.countZeroes(Uint8Array.of(0, 0))).toBe(16);
    expect(BitMixer.countZeroes(Uint8Array.of(0, 1))).toBe(8);
    expect(BitMixer.countZeroes(Uint8Array.of(0, 2))).toBe(9);
    expect(BitMixer.countZeroes(Uint8Array.of(0, 4))).toBe(10);
    expect(BitMixer.countZeroes(Uint8Array.of(0, 8))).toBe(11);
    expect(BitMixer.countZeroes(Uint8Array.of(0, 16))).toBe(12);
    expect(BitMixer.countZeroes(Uint8Array.of(0, 32))).toBe(13);
    expect(BitMixer.countZeroes(Uint8Array.of(0, 64))).toBe(14);
    expect(BitMixer.countZeroes(Uint8Array.of(0, 128))).toBe(15);
    expect(BitMixer.countZeroes(Uint8Array.of(0, 130))).toBe(9);
  });


  it("perform POW", async () => {
    const bitLength = 11;
    const src = new Uint8Array([1,2,3]);
    const res = await BitMixer.SolvePOW1(src, bitLength);
    expect(BitMixer.countZeroes(await sha3_384(new Uint8Array([...res,...src]))))
      .toBe(bitLength);
  });

});
