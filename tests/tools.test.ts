import { byteArrayToLong, decode64url, encode64url, longToByteArray, retry } from "../src/tools";
import { decode64, encode64 } from "universa-wasm";

it("retry OK", async () => {
  let count = 0;
  let result = await retry(5, 10, () => {
    count++;
    if( count < 3 ) throw "too low";
    return "OK";
  });
  expect(result).toBe("OK");
  expect(count).toBe(3);
});

it("retry inner async OK", async () => {
  let count = 0;
  let result = await retry(5, 10, async () => {
    count++;
    if( count < 3 ) throw "too low";
    return "OK";
  });
  expect(result).toBe("OK");
  expect(count).toBe(3);
});

it("retry FAIL", async () => {
  let count = 0;
  await expect(retry(5, 10, () => {
      count++;
      if( count < 33 ) throw "too low";
      return "OK";
    })).rejects.toEqual("too low");
  expect(count).toBe(5);
})

it("converts longs to byte arrays", () =>{
  expect(longToByteArray(1)).toStrictEqual(Uint8Array.of(1));
  expect(longToByteArray(0xFFffFFfe)).toStrictEqual(Uint8Array.of(255, 255, 255, 254));
  expect(longToByteArray(0)).toStrictEqual(Uint8Array.of(0));
  expect(byteArrayToLong(Uint8Array.of(1,2))).toBe(258);
  expect(byteArrayToLong(Uint8Array.of(2,1))).toBe(513);
});

it("de/encodes URLs", () => {
  const source = decode64("a+b//cc=")
  expect(encode64url(source)).toBe("a-b__cc");
  expect(decode64url(encode64url(source))).toStrictEqual(source);
});
