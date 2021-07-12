import { bytesToUtf8, compareVersions, Passwords, utf8ToBytes } from "../src";

it("has right version and compare", () => {
  expect(compareVersions("0.1.0", "0.1.0")).toBe(0);
  expect(compareVersions("0.1", "0.1.0")).toBe(0);
  expect(compareVersions("0.2", "0.1.0")).toBe(1);
  expect(compareVersions("0.1.0", "0.1.1")).toBe(-1);
  expect(compareVersions("0.1.2", "0.1.1")).toBe(+1);
  expect(compareVersions("0.1.2", "2.1.1")).toBe(-1);
});

it("supports text2bytes and back", () => {
  const src = "life happens, дерьмо случается";
  expect(bytesToUtf8(utf8ToBytes(src))).toBe(src);
});

it("analyses passwords", () => {
  const random = Passwords.randomId(16);
  expect(Passwords.randomId()).toHaveLength(12);
  expect(Passwords.estimateBitStrength(random)).toBeGreaterThan(140);
  expect(Passwords.estimateBitStrength("abcabc")).toBeLessThan(30);
  expect(Passwords.estimateBitStrength("abcabcЁ")).toBeGreaterThan(30);
});
