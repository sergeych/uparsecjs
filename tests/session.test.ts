import { ParsecSessionStorage, RootConnection } from "../src/Parsec";

import 'isomorphic-fetch'
import { decode64, PrivateKey } from "unicrypto";
import { POW, Session } from "../src/ParsecSession";
import { CachedStoredValue } from "../src/CachedStoredValue";
window.fetch = require('node-fetch');
window.FormData = require('form-data');

class TestSessionStorage implements ParsecSessionStorage {

  constructor(private data= new Map<string,string>()) {
  }


  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key,value);
  }

  clone(): TestSessionStorage {
    return new TestSessionStorage(this.data);
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

it("re/connects", async() => {
  const sessionStorage = new TestSessionStorage();

  const skaProvider = async (refresh: Boolean) => {
    return [testServiceKeyAddress];
  }

  const session1 = new Session(sessionStorage, rc, skaProvider, true, 2048);
  let info = await session1.call("getSessionInfo");
  console.log("info", info, `sessionid: ${await session1.id}`);
  console.log("-------------------------------------------------",sessionStorage)
  expect(session1.sckGenerationCount).toBe(1);
  expect(session1.tskGenerationCount).toBe(1);

  const x = new CachedStoredValue(sessionStorage,".p1.SID");
  expect(x.value).not.toBeNull();

  const session2 = new Session(sessionStorage, rc, skaProvider, true, 2048);
  expect(await session2.id).toBe(await session1.id);
  // session 2 reuses TSK
  expect(session2.sckGenerationCount).toBe(0);
  expect(session2.tskGenerationCount).toBe(0);

  // drop the TSK, session should regenerate ot
  // session 3 reuses SCK only
  const storage3 = sessionStorage.clone();
  storage3.removeItem(".p1.TSK");
  const session3 = new Session(storage3, rc, skaProvider, true, 2048);
  expect(await session3.id).toBe(await session1.id);
  expect(session3.sckGenerationCount).toBe(0);
  expect(session3.tskGenerationCount).toBe(1);

  console.log(await session3.call("info"));
});

