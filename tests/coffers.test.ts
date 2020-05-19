// function decode1(binString: Uint8Array): string {
//   const ua = new Uint8Array(binString.length);
//   Array.prototype.forEach.call(binString, (ch, i) => ua[i] = ch.charCodeAt(0));
//   return ua;
// }

// describe("Coffer", () => {
//   it("supports text2bytes and back", () => {
//     const src = "life happens, дерьмо случается";
//     // const src = "life happens";
//     // console.log(utf8ToBytes(src));
//     // console.log(bytesToUtf8(utf8ToBytes(src)));
//     expect(bytesToUtf8(utf8ToBytes(src))).toBe(src);
//     // expect(decode1(utf8ToBytes(src))).toBe(src);
//     // console.log(src, utf8ToBytes(src));
//     // console.log(src, textToBytes(src));
//     // expect(utf8ToBytes(src)).toStrictEqual(textToBytes(src));
//   });
//
//   function testAvailable(serialized: SerializedCoffer, payload: Uint8Array | null, ...keys: UniversalKey[]) {
//     for (let key of keys) {
//       const c = Coffer.load(serialized, key);
//       expect(c.payload).toStrictEqual(payload);
//     }
//   }
//
//   function testNotAvailable(serialized: SerializedCoffer, ...keys: UniversalKey[]) {
//     expect(() => {
//       Coffer.load(serialized, ...keys)
//     }).toThrow(CofferException)
//   }
//
//   it("coffer main functionality", async () => {
//     let coffer = Coffer.create();
//     const k1 = UniversalSymmetricKey.createRandom();
//     // const k2 = UniversalSymmetricKey.createRandom();
//     const k2 = await UniversalPrivateKey.generate(2048);
//     const k3 = UniversalPasswordKey.deriveFrom("welcome", { rounds: 10 });
//     // const k3 = UniversalSymmetricKey.createRandom();
//     const k4 = UniversalSymmetricKey.createRandom();
//     coffer.addKeys(k1, k2);
//     expect(coffer.payload).toBeNull();
//     let payload = utf8ToBytes("Foo bar beyond all recognition");
//     let payload2 = utf8ToBytes("nonostante all ovversità");
//     coffer.payload = payload;
//     testAvailable(coffer.serialize(), payload, k1, k2);
//     testNotAvailable(coffer.serialize(), k3, k4);
//     coffer = Coffer.unpack(coffer.pack(), k1);
//     testAvailable(coffer.serialize(), payload, k1, k2);
//     testNotAvailable(coffer.serialize(), k3, k4);
//     coffer.payload = payload2;
//     testAvailable(coffer.serialize(), payload2, k1, k2);
//     testNotAvailable(coffer.serialize(), k3, k4);
//
//     expect(coffer.hasPassword()).toBe(false);
//
//
//     coffer.addKeys(k3);
//     expect(Coffer.hasPassword(coffer.serialize())).toBe(true);
//     testAvailable(coffer.serialize(), payload2, k1, k2, k3);
//     testNotAvailable(coffer.serialize(), k4);
//     coffer.payload = null;
//     coffer.addKeys(k4);
//     coffer = Coffer.unpack(coffer.pack(), k4);
//     testAvailable(coffer.serialize(), null, k1, k2, k3, k4);
//
//     // open with password without knowning tags?
//     coffer.payloadString = "hidden";
//     coffer = Coffer.unpack(coffer.pack(), "welcome");
//     testAvailable(coffer.serialize(), utf8ToBytes("hidden"), k1, k2, k3, k4);
//   });
//
//   it("creates random passwords", () => {
//     const p1 = Passwords.randomId(15);
//     const p2 = Passwords.randomId();
//     const p3 = Passwords.randomId();
//     expect(p1.length).toBe(15);
//     expect(p2.length).toBe(p3.length);
//     expect(p2).not.toBe(p3);
//     expect(p2).not.toBe(p1.slice(0, p2.length));
//     expect(p2).toBe(p2);
//     expect(p2).toBe(p2.slice());
//   });
// });
//
// describe("keyAddress", () => {
//   const keyAddressVectors = JSON.parse(`
// [
//   {
//     "size": 2048,
//     "longAddressString": "JnKv298KvPgmiKfPRx8h5vVGYjPTfKs8iuwJbhwatQNgsSd4NAsuwn9kVUJ1YgvJvgWKgmBw",
//     "shortAddressString": "ZHYYuENFT9e1UTktZ1b9KPrVrqdRCoXAxRLrfKBuLarEUUzESF",
//     "packedKey": "JgAcAQABvID9CDGXtrLxsi45pqDPNUJ2TDXzRJrYcwTxjLF+9ddQvQ7ZoMFh8G43Oro2LHg2ZKiztIgi2Ygc15OmTXpEIUhvI9O3DkvnMLNvQ5NUYL7P5ktYxsd+DsBbAqlmgYrgpIVC5aer1L1LcS+5M+6ikWq+UX6aFE9eS0WoaQTSfxWSv7yA1C9VcVEi48pDFBqlJJ5lE200mP+essyKb5EwamD6L/N6Odt1rnfqJsDOzDtQKXl8wgu/aY/CmBY75yUE4ywQRw2mUCCqY1LhUQ41xwINj1dD2xzWJ7qYZ/0CFmFIkTmv4Hcr8IZQhFnvdZaW0Zk0Bx9tAiliorxy2aFuUMT+JG0="
//   },
//   {
//     "size": 4096,
//     "longAddressString": "bkmb2isfMoXFFs5wFzY3TsfJAkdrRCmNAaFU2EBAxMwoDtSAwST8eqHtesh9NW8qwLdNhVoa",
//     "shortAddressString": "26X6QPQxJvz7rWarU1KonQ5JkAU4BKKCJoUyNpnwKBn4JgAH5Sw",
//     "packedKey": "JgAcAQABxAAB3kozmthDEUUZ9YoZDQh+D/EPRS7z6AWjeNNLBCtcN/SLABaWgNhb800miZIMJpY2BNz3+SNblc3POc+Wrk5ZkPg47scxtFUkU0x6Pg9JvasoJSXQMqpO6k0kpbQtfIr32wm5XStErDCWkHzS0OAwHCeG4llqEnCM7nVXIxSEXpa3fOZHhbAd9IWM4E+HbkyPhWN1EAUp6a0a2IU09TaAgTZcUYQOhMPK6cM4CrJJ3ubs/rgxgHzh45E5BlBclRBcmNJYxDQ4AcTbnVx7xRYW9eLd609LTk3c6Ufttnrd9+koeclXolsLI/7lKWRJnpWWBgzvZBZ4WNHc3w50buAaO8QAAdRiqVxJ1cOr3+CAxxr2D3Pmf1Yt1uNE22Jq+lzWX3KohMvaEjTRH5DcuGQpjvg5rBkFQObWadhbYdPPWZQVaYmbRWKAPaX8xlQJhPf/zG3O1WjgWLutnC8F7XfcdpiaoWlmgdbbx5iMQ4+VlwixTrXbGZwTFZ94UHB6tkUt/0OBKrptkvfv3qBkE0d99M3CpTvMIpSDOUoiYvkjHyqfzodHzYqbj+i9r4TUBaUElGrv2mgifHTqbUMfFQNP/85jVgosFD28InfcwwfAl9d7DfLxqSYgELYrsEmDZxkhMvTIwZw6C59GY2gcU80RZmfndeZBPWAsvp/5IWt57dUU3dU="
//   },
//   {
//     "size": 8192,
//     "longAddressString": "sriuQrCVN3FNyH6VJEUhMD6t82duanKvBJp2ccyPGYD5gKQdofZNH7aTrQZ8aiCKuAjBRUv6",
//     "shortAddressString": "2dwybLfSX4vaeW4joP5odqvnpp2k1XiFcky5HB4NbEfchDYrSrZ",
//     "packedKey": "JgAcAQABxAAC99KCimkzv77oDlxlFN8S4VER1S+v9N2hZUnZZr43/RLIbC+9W2t9bEor4iPNo8nowZ+q7OA9wXJmfpI3ocdadhYWOyLIsCIGScvgJufDCEMkYtIt/lJBgbpKLzWWohD10pFO3CiBG55zKcuy2wD3S1Yq7Ac9fMVMzg6hNpf2wvhoqwCpBY0kJTfBTW29eq7WcDaSUb2o2JPeq1uK0pUfUcvX2UcfGk0ABDRD8F7FZ/FVudCjOLW1gGU/5UTSgyp0gjMhPFEQWfLOGzkgj3wxOldfcof6IJVbQOXrJQbdOqwr2WQ0vsWrgZWTeKF/eLjxJvqgqnTcj1JPdJL3Fz9KkEa/Tu8AhSVCmJlxp24MRC08D3zSP7D6peOltEfIi0xdrqDVCH+TkeL7JV0Ro5K1D/GZAK94Cnq3xXAX20lJ8yZYExZuj8XYuP1wHAfcRxXTwW6R/qahgUjwMPB59zH03FlBLsohuzq6UBl7YKvcQibTXMyp7Es7Zcky9zpfEJxa+XXWYVnyycWr3oee2B/5A6YGKnqzXnRkwAhOi8/fofysva/4cbihIJ0D9yjj1C2weFx/h8ngevZjlkiVRAgpQHA/2j8PjDNibM4uXPFaLW80DXjMjr64peTsXG7dt/VFEn6CVIpUwLTDTf9JQWVQRo4jtvNm7BZz10zO2PP+q4nEAALuEsSqRqYVnMv7p8uym7uY2HJU+bX2TLEGg0NYp8Pv+JCd5jtjDcoysOfyv550cxBiTyECmvwgG//6P+fJNOy6+56TPVRzM3jP3DqXMMfbAeJpWgIPf8whB/y0IbY5rE3IvitRJRDwYTSeDgDSSwyua5UmG/woF9T5q/tMnEjWMs/1zl9oPxtLwA8Ewna+mOIHVo93H3B0tZyHQkOGBi3WGt+e6+ZGzBl1HXO74W5+qCPCWxxe7Hd0sEn2YzRfRWRcU0oVJrouafwfvOnLeOl3IkDlHAFlmcHgHEM8KsKx7zrim/CFZH2HRSeS/QmcMBiV9y2yO2JS6BdV4sRnYtwBEzkXByqGXW1sMsw+KWuNfOPOsOGgMXXxfdrLL0BBfgYjOtUvxOn0Gxw1kcWyyD0DWVeyTshnR21dwZq7qS6RdiBjzDKvDffmmaanSJcDRFHiuBlo+DTnIJgai8bcHOtJfd5BLUZm/lawDAnI+jGF0H/lMbz/1VH3FTrlCgxk5RrpwoxxwIuo2P5szpFEmP3MwnN2XPZesU4VovULFzWuvkf1a9QrxDwZrdskAjhQYXsFRVjI/9kPSVA2LwT1lFgq7nvLwhYC/pHkgtTzgLFP8RnZF3qnN6WAWPUN1utca7N2zKJxI+JtV639xEG28TNCyg4lwihyGTRAuKlg9P3tmw=="
//   }
// ]
// `);
//
//   for (const data of keyAddressVectors) {
//     const key = new PrivateKey('BOSS', decode64(data.packedKey));
//     // 8192 key is not yet ready
//     it("has compatible addres " + data.size, () => {
//       if (data.size == 8192) pending("skipped 8192 keyAddress test")
//       expect(encode58(key.publicKey.longAddress())).toBe(data.longAddressString);
//       expect(encode58(key.publicKey.shortAddress())).toBe(data.shortAddressString);
//     });
//   }
// });
//
pending()