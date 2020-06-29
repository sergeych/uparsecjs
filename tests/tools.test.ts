import { byteArrayToLong, decode64url, encode64url, equalArrays, longToByteArray, retry } from "../src/tools";
import { decode64, encode64 } from "unicrypto";
import { CompletablePromise } from "../src/CompletablePromise";
import { Completable } from "../src/Completable";

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
  expect(() => { cf3.reject()}).toThrow("already completed");

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
  }
  catch(e) {
  }
});

it("compares arays", () => {
  expect(equalArrays(Uint8Array.of(1,2,3),Uint8Array.of(1,2,3))).toBeTruthy();
  expect(equalArrays(Uint8Array.of(1,2,3),Uint8Array.of(1,2,3,4))).toBeFalsy();
  expect(equalArrays(Uint8Array.of(1,2,3,5),Uint8Array.of(1,2,3,4))).toBeFalsy();
  expect(equalArrays(Uint8Array.of(1,2,3,4),Uint8Array.of(1,2,3,4))).toBeTruthy();
});
