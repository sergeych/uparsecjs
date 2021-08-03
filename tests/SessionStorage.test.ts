import {SymmetricKey, unicryptoReady} from "unicrypto";
import {CachedSessionStorage, EncryptedSessionStorage, MemorySessionStorage, PrefixedSessionStorage} from "../src";


it("provides prefixed and memory session storages", () => {
  const ms = new MemorySessionStorage()
  const prefix = "prf_"
  const ps = new PrefixedSessionStorage(prefix, ms);

  ms.setItem("foo", "bar")
  ms.setItem("bar", "42");
  expect(ms.getItem("foo")).toBe("bar")
  expect(ms.getItem("bar")).toBe("42")

  ps.setItem("foo", "buzz")
  ps.setItem("bar", "142");
  expect(ms.getItem("foo")).toBe("bar")
  expect(ms.getItem("bar")).toBe("42")
  expect(ps.getItem("foo")).toBe("buzz")
  expect(ps.getItem("bar")).toBe("142")
  expect(ms.getItem(prefix+"foo")).toBe("buzz")
  expect(ms.getItem(prefix+"bar")).toBe("142")
});


it("provides immediately connected CachedStorage", () => {
  const ms = new MemorySessionStorage();

  ms.setItem("foo", "bar");
  ms.setItem("bar", "buzz");

  const cs = new CachedSessionStorage(ms);
  expect(cs.getItem("foo")).toEqual("bar");
  expect(cs.getItem("bar")).toEqual("buzz");
  expect(cs.getItem("reason")).toEqual(null);
  cs.setItem("reason", "42");
  expect(cs.getItem("reason")).toEqual("42");
  expect(ms.getItem("reason")).toEqual("42");
});

it("clears CachedStorage", () => {
  const cs = new CachedSessionStorage();

  cs.setItem("foo", "bar");
  cs.setItem("bar", "buzz");

  cs.clear();
  expect(cs.getItem("foo")).toBeNull();
  expect(cs.getItem("bar")).toBeNull();

  cs.connectToStorage(new MemorySessionStorage());
  cs.setItem("foo", "bar");
  cs.setItem("bar", "buzz");

  expect(()=> {
    cs.clear();
  }).toThrowError();

  expect(cs.getItem("foo")).toEqual("bar");
  expect(cs.getItem("bar")).toEqual("buzz");
});

it("connected underlying storage to CachedStorage", () => {
  // const ms = new MemorySessionStorage();
  const ms = sessionStorage;
  const cs = new CachedSessionStorage();

  cs.setItem("foo", "bar");
  cs.setItem("bar", "buzz");

  expect(cs.getItem("foo")).toEqual("bar");
  expect(cs.getItem("bar")).toEqual("buzz");
  expect(ms.getItem("foo")).toEqual(null);
  expect(ms.getItem("bar")).toEqual(null);

  cs.connectToStorage(ms);
  expect(ms.getItem("foo")).toEqual("bar");
  expect(ms.getItem("bar")).toEqual("buzz");
  expect(cs.getItem("foo")).toEqual("bar");
  expect(cs.getItem("bar")).toEqual("buzz");

  expect(cs.getItem("reason")).toEqual(null);
  cs.setItem("reason", "42");
  expect(cs.getItem("reason")).toEqual("42");
  expect(ms.getItem("reason")).toEqual("42");
});

it("provides encrypted storage", async () => {
  await unicryptoReady;

  sessionStorage.clear();
  const key = new SymmetricKey();
  const ms = sessionStorage;
  const es = new EncryptedSessionStorage(ms,key);

  es.setItem("foo", "bar");
  es.setItem("bar", "buzz");

  expect(es.getItem("foo")).toEqual("bar");
  expect(es.getItem("bar")).toEqual("buzz");


  const es2 = new EncryptedSessionStorage(ms, key);
  expect( () =>new EncryptedSessionStorage(ms, new SymmetricKey()))
    .toThrowError();
  expect(es2.getItem("foo")).toEqual("bar");
  expect(es2.getItem("bar")).toEqual("buzz");

  expect(es2.isClosed).toBe(false);
  es2.close();
  expect(es2.isClosed).toBe(true);
  expect( () => es2.getItem("foo"))
    .toThrowError();
  expect( () => es2.setItem("foo", "1"))
    .toThrowError();
  expect( () => es2.removeItem("foo"))
    .toThrowError();


  expect(ms.getItem("foo")).toEqual(null);
  expect(ms.getItem("bar")).toEqual(null);



  // for( let i=0; i< sessionStorage.length; i++) {
  //   const k = sessionStorage.key(i);
  //   console.log(`${k}: ${sessionStorage.getItem(k!)}`);
  // }
  expect(EncryptedSessionStorage.existsIn(sessionStorage)).toBeTruthy();
  EncryptedSessionStorage.clearIn(sessionStorage);
  expect(EncryptedSessionStorage.existsIn(sessionStorage)).toBeFalsy();
  const cs3 = new EncryptedSessionStorage(sessionStorage, new SymmetricKey());
  expect(cs3.getItem("foo")).toEqual(null);
  expect(cs3.getItem("bar")).toEqual(null);
})

it("changes key of the encrypted storage", async () => {
  await unicryptoReady;
  const k1 = new SymmetricKey();
  const k2 = new SymmetricKey();
  const ms = new MemorySessionStorage();
  let es = new EncryptedSessionStorage(ms, k1);
  es.setItem("foo", "bar");

  es = new EncryptedSessionStorage(ms, k1);
  expect(es.getItem("foo")).toEqual("bar");
  es.changeKey(k2);
  es.setItem("some","value");

  expect( () => es = new EncryptedSessionStorage(ms, k1))
    .toThrowError();

  es = new EncryptedSessionStorage(ms, k2);
  expect(es.getItem("foo")).toEqual("bar");
  expect(es.getItem("some")).toEqual("value");
})
