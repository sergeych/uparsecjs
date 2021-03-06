import { SymmetricKey, unicryptoReady } from "unicrypto";
import { MemorySessionStorage } from "../src/MemorySessionStorage";
import { PrefixedSessionStorage } from "../src/PrefixedSessionStorage";
import { CachedSessionStorage } from "../src/CachedMemoryStorage";
import { EncryptedSessionStorage } from "../src/EncryptedSessionStorage";


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
  const cs = new EncryptedSessionStorage(ms,key);

  cs.setItem("foo", "bar");
  cs.setItem("bar", "buzz");

  expect(cs.getItem("foo")).toEqual("bar");
  expect(cs.getItem("bar")).toEqual("buzz");

  const cs2 = new EncryptedSessionStorage(ms, key);
  expect(cs2.getItem("foo")).toEqual("bar");
  expect(cs2.getItem("bar")).toEqual("buzz");

  expect(ms.getItem("foo")).toEqual(null);
  expect(ms.getItem("bar")).toEqual(null);

  expect( () =>new EncryptedSessionStorage(ms, new SymmetricKey()))
    .toThrowError();

  for( let i=0; i< sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    console.log(`${k}: ${sessionStorage.getItem(k!)}`);
  }
  expect(EncryptedSessionStorage.existsIn(sessionStorage)).toBeTruthy();
  EncryptedSessionStorage.clearIn(sessionStorage);
  expect(EncryptedSessionStorage.existsIn(sessionStorage)).toBeFalsy();
  const cs3 = new EncryptedSessionStorage(sessionStorage, new SymmetricKey());
  expect(cs3.getItem("foo")).toEqual(null);
  expect(cs3.getItem("bar")).toEqual(null);
})
