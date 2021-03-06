import { CachedStoredValue, ParsecSessionStorage, POW, POWTask, RootConnection, Session, utf8ToBytes } from "../src";

import { decode64, encode64, PrivateKey, randomBytes } from "unicrypto";
import { MemorySessionStorage } from "../src/MemorySessionStorage";

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

//If you don't have any parsec 1.x started locally, one can use some real public service:
const rc = new RootConnection("https://api.myonly.cloud/api/p1");

// though I'd recommend use local one
// const rc = new RootConnection("http://localhost:8094/api/p1");

const tk = (async()=>{return PrivateKey.generate({strength: 2048})})();
const tkAddress = tk.then((k) => k.publicKey.longAddress.bytes)

it("test service contains 1.1 in test mode",async () => {
  const info = await rc.call("info")
  expect(info.parsecVersions).toContain("1.1")
  // TODO: check service know test key address and support test mode
})

it("checks POW", async () => {
  const task = {type: 1,length: 4, source: utf8ToBytes("foobar")} as POWTask;
  const solution = await POW.solve(task)
  // console.log(":: ",solution)
  expect(await POW.check(task, solution)).toBeTruthy();
  expect(await POW.check(task, solution.slice(1))).toBeFalsy();
});

it("requests SCK", async () => {

  const info = await rc.call("info")
  expect(info.parsecVersions).toContain("1.1")

  let r = await rc.call("requestSCK", {SCKAddress: await tkAddress, testMode: true});
  // console.log(r);
  let solution = await POW.solve(r.POWTask);
  // console.log(solution);
});

it("re/connects", async() => {
  const sessionStorage = new TestSessionStorage();

  const skaProvider = async (refresh: Boolean) => {
    return [testServiceKeyAddress];
  }

  const session1 = new Session(sessionStorage, rc, skaProvider, true, 2048);
  let info = await session1.call("getSessionInfo");
  // console.log("info", info, `sessionid: ${await session1.id}`);
  // console.log("-------------------------------------------------",sessionStorage)
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

  // console.log(await session3.call("info"));
});

it("reconnects on wrong TSK", async() => {
  const sessionStorage = new TestSessionStorage();

  const skaProvider = async (refresh: Boolean) => {
    return [testServiceKeyAddress];
  }

  const session1 = new Session(sessionStorage, rc, skaProvider, true, 2048);
  let info = await session1.call("getSessionInfo");
  // console.log("info", info, `sessionid: ${await session1.id}`);
  // console.log("-------------------------------------------------",sessionStorage)
  expect(session1.sckGenerationCount).toBe(1);
  expect(session1.tskGenerationCount).toBe(1);

  const x = new CachedStoredValue(sessionStorage,".p1.SID");
  expect(x.value).not.toBeNull();

  // spoil the TSK, session should regenerate ot
  // session 3 reuses SCK only
  const storage3 = sessionStorage.clone();
  storage3.setItem(".p1.TSK", encode64(randomBytes(32)));
  const session3 = new Session(storage3, rc, skaProvider, true, 2048);
  expect(await session3.id).toBe(await session1.id);
  expect(session3.sckGenerationCount).toBe(0);
  expect(session3.tskGenerationCount).toBe(1);

  // console.log(await session3.call("info"));

});

it("reconnects on bad TSK", async() => {
  const sessionStorage = new TestSessionStorage();

  const skaProvider = async (refresh: Boolean) => {
    return [testServiceKeyAddress];
  }

  const session1 = new Session(sessionStorage, rc, skaProvider, true, 2048);
  let info = await session1.call("getSessionInfo");
  // console.log("info", info, `sessionid: ${await session1.id}`);
  // console.log("-------------------------------------------------",sessionStorage)
  expect(session1.sckGenerationCount).toBe(1);
  expect(session1.tskGenerationCount).toBe(1);

  await session1.call("sessionDropTSK");
  // console.log(await session1.call("info"));

});

it("reconnects on dropped TSK on logout", async() => {
  const sessionStorage = new TestSessionStorage();

  const skaProvider = async (refresh: Boolean) => {
    return [testServiceKeyAddress];
  }

  const session1 = new Session(sessionStorage, rc, skaProvider, true, 2048);
  let info = await session1.call("getSessionInfo");
  // console.log("info", info, `sessionid: ${await session1.id}`);
  // console.log("-------------------------------------------------",sessionStorage)
  expect(session1.sckGenerationCount).toBe(1);
  expect(session1.tskGenerationCount).toBe(1);

  await session1.call("logout");
  // console.log(await session1.call("info"));

});

it("pings remote", async () => {
  const rc = new RootConnection("https://api.myonly.cloud/api/p0")
  const res = await rc.call("time")
  expect(typeof res.time).toBe("number")
});

it("handles properly invalid session connections", async() => {
  const rc = new RootConnection("http://localhost:9876/api/p1");
  try {
    const res = await rc.call("check");
    fail("it should throw exception");
  }
  catch(e) {
  }

  const session = new Session(
    new MemorySessionStorage(),
    rc,
    (r) => Promise.resolve([]),
    true,
    2048
  );
  try {
    const res = await session.call("check");
    console.log(res);
    fail("it must throw exception");
  }
  catch(e) {
    console.log(e);
  }
});
