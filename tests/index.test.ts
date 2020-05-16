import { compareVersions, CORE_VERSION, sha256 } from "../src";

it("has right version and compare",()=> {
  expect(compareVersions("0.1.0", "0.1.0")).toBe(0);
  expect(compareVersions("0.1", "0.1.0")).toBe(0);
  expect(compareVersions("0.2", "0.1.0")).toBe(1);
  expect(compareVersions("0.1.0", "0.1.1")).toBe(-1);
  expect(compareVersions("0.1.2", "0.1.1")).toBe(+1);
  expect(compareVersions("0.1.2", "2.1.1")).toBe(-1);
})

it("has simple sha", async () => {
  const result = await sha256("hello");
  console.log(result);
});

