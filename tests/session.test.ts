import { ParsecSessionStorage, RootConnection } from "../src/Parsec";

import 'isomorphic-fetch'
import { decode64, PrivateKey } from "unicrypto";
import { POW, Session } from "../src/ParsecSession";
import exp = require("constants");
window.fetch = require('node-fetch');
window.FormData = require('form-data');

class TestSessionStorage implements ParsecSessionStorage {
  private data = new Map<string,string>();

  getItem(key: string): string | null {
    return this.data.get(key);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key,value);
  }
}

const testServiceKeyAddress = decode64("EMbhPh0J22t0EfITdXOhHnB2HKW9oBqxsIbWU7iBzGO4/N20x833lL527PBvV/ZSUnROnqs=");
const rc = new RootConnection("http://localhost:8094/api/p1");

const tk = (async()=>{return PrivateKey.generate({strength: 2048})})();
const tkAddress = tk.then((k) => k.publicKey.longAddress)

it("test service contains 1.1 in test mode",async () => {
  const info = await rc.call("info")
  expect(info.parsecVersions).toContain("1.1")
  // TODO: check service know test key address and support test mode
})

it("requests SCK", async () => {

  const info = await rc.call("info")
  expect(info.parsecVersions).toContain("1.1")

  let r = await rc.call("requestSCK", {SCKAddress: await tkAddress, testMode: true});
  console.log(r);
  let solution = await POW.solve(r.POWTask);
  console.log(solution);
});

it("connects new session", async () => {
  const session = new Session(new TestSessionStorage(),rc, [testServiceKeyAddress], true, 2048);
  const ep = await session.ready()
});

