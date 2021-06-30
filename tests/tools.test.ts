import {
  byteArrayToLong,
  concatenateBinary,
  decode64url,
  encode64url,
  equalArrays,
  longToByteArray,
  retry,
  utf8ToBytes
} from "../src/tools";
import { bytesToHex, decode64, PrivateKey, SHA } from "unicrypto";
import { UniversaTextObjectFormatter, UniversaTextObjectParser } from "../src/text_tools";
import { bossDump, BossObject, BossPrimitive, bossUnpack, bossUnpackObject, sha256 } from "../src";
import { MemorySessionStorage } from "../src/MemorySessionStorage";
import { PrefixedSessionStorage } from "../src/PrefixedSessionStorage";
import { Type } from "typedoc/dist/lib/models";
import { Emitter } from "../src/Emitter";

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

it("supports strong typed boss with non-js maps", () => {
  // this is the hardest case: map<object,...> which is pretty ok with all other
  // languages boss is used withm but is hardly usave in js, but we need to encode and
  // decode it properly:
  const m1 = new Map<BossPrimitive,string>();
  m1.set({foo:"bar", reason: 42}, "buzz");
  const data1 = { m1: m1, sample: true};

  const data2 = bossUnpackObject(bossDump(data1));
  console.log(data2);
  const k = [...(data2.m1 as Map<BossPrimitive,string>).keys()][0] as BossObject;
  expect(k?.foo).toEqual("bar");
  expect(k?.reason).toEqual(42);
  const v = [...(data2.m1 as Map<BossPrimitive,string>).values()][0] as string;
  expect(v).toEqual("buzz");
});

it("emits", ()=>{
  const e = new Emitter<string>();
  let lastVal = "---";
  const handle1 = e.addListener((x) => lastVal = x);
  expect(lastVal).toBe("---");
  e.fire("s1");
  expect(lastVal).toBe("s1");
  e.removeListener(handle1)
  e.fire("s2");
  expect(lastVal).toBe("s1");
  const handle2 = e.addListener((x) => lastVal = x);
  e.fire("s3");
  expect(lastVal).toBe("s3");
  handle2.unsubscribe();
  e.fire("s4");
  expect(lastVal).toBe("s3");

});

// it("runs completable promises", async () => {
//   const cf1 = new Completable<string>();
//   expect(cf1.isCompleted).toBeFalsy();
//   expect(cf1.isResolved).toBeFalsy();
//   expect(cf1.isRejected).toBeFalsy()
//   cf1.resolve("foo")
//   expect(await cf1.promise).toBe("foo");
//   expect(cf1.isCompleted).toBeTruthy();
//   expect(cf1.isResolved).toBeTruthy();
//   expect(cf1.isRejected).toBeFalsy()
//
//   const cf2 = new Completable<string>();
//   cf2.reject("bar")
//   let result = "bad";
//   // cf2.then(() => { fail("it should not call then") } )
//   cf2.promise.catch((e) => {
//     result = e
//   })
//     .finally(() => {
//       expect(result).toBe("bar");
//       expect(cf2.isCompleted).toBeTruthy();
//       expect(cf2.isRejected).toBeTruthy();
//       expect(cf2.isResolved).toBeFalsy();
//       expect(() => {
//         cf2.resolve("123");
//       }).toThrow("already completed");
//     })
//   const cf3 = new Completable();
//   cf3.resolve();
//   expect(() => {
//     cf3.reject()
//   }).toThrow("already completed");
//
//   // strangely it does not wait
//   const cf4 = new Completable();
//   const waiter1 = new Completable();
//   cf4.promise.finally(() => {
//     waiter1.resolve();
//   });
//   cf4.reject(new Error("test=10"));
//   await waiter1.promise;
//   try {
//     await cf4.promise;
//     fail("it should throw exception before");
//   } catch (e) {
//   }
// });

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

it("runs sha shortcut", async() => {
  const source = utf8ToBytes("foobarbuz");
  const d = await sha256(source)
  expect(d).toStrictEqual(await SHA.getDigest("sha256", source));
  expect(bytesToHex(d)).toBe("79b341c82b49b83fe15f37e710f64f94d77a26d8483047e993ebce326edf8d5e");
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
