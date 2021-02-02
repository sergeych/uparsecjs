// import { textToBytes } from "universa-minicrypto";


import {
  clearKdfCache,
  defaultPKDOptions,
  getKdfCacheHits,
  getKdfCacheMisses,
  UniversalKey,
  UniversalKeys,
  UniversalPasswordKey,
  UniversalPrivateKey,
  UniversalSymmetricKey
} from '../src/UnversalKeys';

// import { Coffer, CofferException, SerializedCoffer } from "@/sergecych.uni3/Coffer";
import { bytesToUtf8, utf8ToBytes } from "../src/tools";
import { PrivateKey } from "unicrypto";

async function testUniversalKey(key: UniversalKey) {
  try {
    const key1 = await UniversalKeys.loadFrom(await key.serialize());
    testDeEncrypt(key1);
    const src = utf8ToBytes("foobar");
    // console.log(key.serialize());
    // console.log(key1.serialize());
    expect(await key1.decrypt(await key.encrypt(src))).toStrictEqual(src);
    // expect(key1.match(key));
  }
  catch(e) {
    console.error("testuniveralKey failed:", e);
    fail("unexpected error: "+e);
  }
}

async function testDeEncrypt(key: UniversalKey) {
  let longText = "";
  for (let i = 0; i < 3000; i++) {
    longText += `${i} single line of a long text`;
  }
  const shortData = utf8ToBytes("fucked up beyond all recognition");
  const longData = utf8ToBytes(longText);
  let result = await key.encrypt(shortData);
  let decrypted = await key.decrypt(result);
  expect(decrypted).toStrictEqual(shortData);
  result = await key.encrypt(longData);
  // console.log(`sizes: ${longData.length} -> ${result.length}, delta ${result.length - longData.length}`);
  decrypted = await key.decrypt(result);
  expect(decrypted).toStrictEqual(longData);
}

describe("UniversalKeys", () => {

  it("de/encrypts shorts and longs with private keys", async () => {
    await testUniversalKey(await UniversalPrivateKey.generate(2048));
  });

  it("de/encrypts shorts and longs with constructed private keys", async () => {
    const pk = await PrivateKey.generate({strength:2048});
    await testUniversalKey(new UniversalPrivateKey(pk));
  });

  it("de/encrypts shorts and longs with symmetric keys", async () => {
    await testUniversalKey(UniversalSymmetricKey.createRandom());
    const k1 = UniversalSymmetricKey.createRandom();
    const k2 = UniversalSymmetricKey.fromKey(k1.keyBytes);
    expect(k1.keyBytes).toBe(k2.keyBytes);
    expect(k1.tag.id).not.toBe(k2.tag.id);
  });

  it("de/encrypts shorts and longs with password keys", async () => {
    // We will make different keys from the same password:
    const opts1 = {
      ...defaultPKDOptions,
      idLength: 4,
      kdfLength: 4 + 32 + 32,
      keyLength: 32,
      keyOffset: 4,
      rounds: 10
    };
    const opts2 = { ...opts1, keyOffset: opts1.keyOffset + 32 };

    const k1 = new UniversalPasswordKey({
      password: "123123",
      pkdOptions: opts1
    });
    await testUniversalKey(k1);

    const k2 = new UniversalPasswordKey({
      password: "123123",
      pkdOptions: opts2
    });
    testUniversalKey(k2);

    const k3 = new UniversalPasswordKey({
      password: "otherpassword",
      pkdOptions: opts2
    });
    const k4 = await UniversalPasswordKey.deriveFrom(
      "otherpassword",
      { rounds: 10 }
    );
    await testUniversalKey(k3);
    await testUniversalKey(k4);

    // password are different cache should not be used:
    expect((await k3.symmetricKey).pack()).not.toStrictEqual((await k2.symmetricKey).pack());
    expect((await k3.symmetricKey).pack()).not.toStrictEqual((await k4.symmetricKey).pack());

  });

  it("provides password multikeys", async () => {
    clearKdfCache();
    let password = "superpassowrd";
    const [k1, k2, k3] = await UniversalPasswordKey.deriveMultiple(password, 3, { rounds: 17 });

    expect(getKdfCacheHits()).toBe(2);
    expect(getKdfCacheMisses()).toBe(1);

    expect((await k1.symmetricKey).pack()).not.toBe((await k2.symmetricKey).pack());
    expect((await k2.symmetricKey).pack()).not.toBe((await k3.symmetricKey).pack());
    expect((await k1.symmetricKey).pack()).not.toBe((await k3.symmetricKey).pack());
    expect((await k2.symmetricKey).pack()).toBe((await k2.symmetricKey).pack());

    const k21 = await UniversalPasswordKey.deriveFrom(password, k2.tag.pkdOptions);
    expect((await k2.symmetricKey).pack()).toStrictEqual((await k21.symmetricKey).pack());
    expect(getKdfCacheHits()).toBe(3);
    expect(getKdfCacheMisses()).toBe(1);

    clearKdfCache();

    const k31 = await UniversalPasswordKey.deriveFrom(password, k3.tag.pkdOptions);
    expect((await k3.symmetricKey).pack()).toStrictEqual((await k31.symmetricKey).pack());
    expect(getKdfCacheHits()).toBe(0);
    expect(getKdfCacheMisses()).toBe(1);
  });
});


