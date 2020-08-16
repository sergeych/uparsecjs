import {
  byteArrayToLong, concatenateBinary,
  decode64url,
  encode64url,
  equalArrays,
  longToByteArray,
  retry,
  utf8ToBytes
} from "../src/tools";
import { Boss, decode64, PrivateKey } from "unicrypto";
import { Completable } from "../src/Completable";
import { guessUniversaObjectType, UniversaTextObjectFormatter, UniversaTextObjectParser } from "../src/text_tools";
import { randomBytes } from "crypto";

it("retry OK", async () => {
  let count = 0;
  let result = await retry(5, 10, () => {
    count++;
    if (count < 3) throw "too low";
    return "OK";
  });
  expect(result).toBe("OK");
  expect(count).toBe(3);
});

it("retry inner async OK", async () => {
  let count = 0;
  let result = await retry(5, 10, async () => {
    count++;
    if (count < 3) throw "too low";
    return "OK";
  });
  expect(result).toBe("OK");
  expect(count).toBe(3);
});

it("retry FAIL", async () => {
  let count = 0;
  await expect(retry(5, 10, () => {
    count++;
    if (count < 33) throw "too low";
    return "OK";
  })).rejects.toEqual("too low");
  expect(count).toBe(5);
})

it("converts longs to byte arrays", () => {
  expect(longToByteArray(1)).toStrictEqual(Uint8Array.of(1));
  expect(longToByteArray(0xFFffFFfe)).toStrictEqual(Uint8Array.of(255, 255, 255, 254));
  expect(longToByteArray(0)).toStrictEqual(Uint8Array.of(0));
  expect(byteArrayToLong(Uint8Array.of(1, 2))).toBe(258);
  expect(byteArrayToLong(Uint8Array.of(2, 1))).toBe(513);
});

it("de/encodes URLs", () => {
  const source = decode64("a+b//cc=")
  expect(encode64url(source)).toBe("a-b__cc");
  expect(decode64url(encode64url(source))).toStrictEqual(source);
});

it("runs completable promises", async () => {
  const cf1 = new Completable<string>();
  expect(cf1.isCompleted).toBeFalsy();
  expect(cf1.isResolved).toBeFalsy();
  expect(cf1.isRejected).toBeFalsy()
  cf1.resolve("foo")
  expect(await cf1.promise).toBe("foo");
  expect(cf1.isCompleted).toBeTruthy();
  expect(cf1.isResolved).toBeTruthy();
  expect(cf1.isRejected).toBeFalsy()

  const cf2 = new Completable<string>();
  cf2.reject("bar")
  let result = "bad";
  // cf2.then(() => { fail("it should not call then") } )
  cf2.promise.catch((e) => {
    result = e
  })
    .finally(() => {
      expect(result).toBe("bar");
      expect(cf2.isCompleted).toBeTruthy();
      expect(cf2.isRejected).toBeTruthy();
      expect(cf2.isResolved).toBeFalsy();
      expect(() => {
        cf2.resolve("123");
      }).toThrow("already completed");
    })
  const cf3 = new Completable();
  cf3.resolve();
  expect(() => {
    cf3.reject()
  }).toThrow("already completed");

  // strangely it does not wait
  const cf4 = new Completable();
  const waiter1 = new Completable();
  cf4.promise.finally(() => {
    waiter1.resolve();
  });
  cf4.reject(new Error("test=1"));
  await waiter1.promise;
  try {
    await cf4.promise;
    fail("it should throw exception before");
  } catch (e) {
  }
});

it("compares arays", () => {
  expect(equalArrays(Uint8Array.of(1, 2, 3), Uint8Array.of(1, 2, 3))).toBeTruthy();
  expect(equalArrays(Uint8Array.of(1, 2, 3), Uint8Array.of(1, 2, 3, 4))).toBeFalsy();
  expect(equalArrays(Uint8Array.of(1, 2, 3, 5), Uint8Array.of(1, 2, 3, 4))).toBeFalsy();
  expect(equalArrays(Uint8Array.of(1, 2, 3, 4), Uint8Array.of(1, 2, 3, 4))).toBeTruthy();
});

const key1 = PrivateKey.generate({ strength: 2048 });

it("pack to text", async () => {
  const k1 = await key1;
  // const packed = new Uint8Array(randomBytes(517));
  const packed = await k1.publicKey.pack();
  const text = await UniversaTextObjectFormatter.format({
    packed: packed,
    type: "public key",
    fileName: "testkey.public.unikey",
    comment: "lorem ipsum"
  });
  const text2 = "Foobar buzz\n" + text + "buuz bar foo";
  // console.log("packed:\n\n"+text2);

  // const objects = extractUniversaObjectText(text2)
  const parser = new UniversaTextObjectParser(text2);
  const result = await parser.objects;
  // console.log(await parser.objects);
  expect(result.length).toBe(1);
  const r = result[0];
  expect(r.firstLine).toBe(1);
  expect(r.lastLine).toBe(12);
  expect(r.errors.length).toBe(0);
  const po = r.packedObject!
  expect(po.width).toBe(80);
  expect(po.type).toBe('public key');
  expect(po.fileName).toBe('testkey.public.unikey');
  expect(po.packed.length).toBe(packed.length);
  expect(po.packed).toStrictEqual(packed);
});

it("concatenates binaries", () => {
  const a = Uint8Array.of(1,2,3);
  const b = Uint8Array.of(10,20,30,40);
  const c = Uint8Array.of(4,5);
  const abc = concatenateBinary(a,b,c);
  expect(abc).toStrictEqual(Uint8Array.of(1,2,3, 10, 20, 30, 40, 4, 5));
});


// const fs = require("fs").promises
//
// it("packs uupacks", async () => {
//   console.log("!11")
//   const w = new Boss.Writer;
//   const tag = "UCheckBook";
//   w.write(tag)
//   w.write({
//     __type: tag,
//     network: "mainnet",
//     key: {
//       __type: "UnencryptedPrivateKey",
//       packed: randomBytes(30),
//     },
//     contract: {
//       // this is U contract!
//       __type: "UniversaContract",
//       packed: randomBytes(30),
//     }
//   });
//   const result = w.get();
//   await fs.writeFile("sample.unicheck", result);
// });