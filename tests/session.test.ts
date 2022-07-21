import { CachedStoredValue, ParsecSessionStorage, POW, POWTask, RootConnection, Session, utf8ToBytes } from "../src";

import {
  decode64,
  encode64,
  KeyAddress,
  PrivateKey,
  randomBytes,
  SignedRecord
} from "unicrypto";
import { MemorySessionStorage } from "../src";

jest.setTimeout(15000);

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
const testServiceKeyAddress2 = new KeyAddress("J1VHgsR6coVpG4HVEDmR9y2fX9x6gz7M1p6sAK5Byok9wWp54bKsZxHMMezmQG3W9PgrKQRf").asBinary;

//If you don't have any parsec 1.x started locally, one can use some real public service:
// const rc = new RootConnection("https://api.myonly.cloud/api/p1");
const rc = new RootConnection("http://localhost:8080/api/p1");

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
  // console.log(">>r", r)
  const result = await POW.solve(r.POWTask);
  // console.log("-result", result)
});

it("test SR", async () => {
  const packed = decode64("JgDECQEeCBwBAAHEAAGabj+Tgffaj7mVHEmQ/n8G2G7UK2zsoRvUUlul1skm2VDHyCPqQXWXqVFOtt4hlXxdzaWexEENBuHTHzJgUnkOCfgLwe2jDRK6X3jvbfYhk/HTv8AGzwkCaB6DoYHG0azCUC17bMQ1ivbO0rZ/8C+QAiSWi/bw3kNHe5e+TgqnkDarh1MGneHLfDJuz9WJIoRgztC/+Vf+R9KwFX5+dx3+/cRo+BVzfrkZ0dbqzLh6TJ++dFMPT55QQX1EDgHnbGfH/fLh6VeXe9N/TDzfNvx4v8TI+JlUS0jGzU8/8Dx/QTNNE53eQN6hMOzXR1xP44nKJoOnA9mnPMJFOvcti8rZxAABNUmLkXJkn3i6fVGhivxCOQc5zec9kiSEcMLMKT5ud3Rb0d7g/Gkccv3T6BScJnv71Q5hKp2WoehV8fV4Bee3hQA/PcO8vB6WvxAhdjabhuAPfKP8p9P0QEsFHQVTE/bR3sOnZ/0+04zT5w3sqyuif4tdLg+OZ5CcnLUinUQDvyQPs7Dwd3L4qtuzc0q9+tO7iecdnTqwY0qM3V8Me4I2TFW3xG++bp7mgs3KYU2jF/UYEBCGnsV2JyYzukkDDJpoEqG2LqJM2gr6k+tjopy19H7Y36ObvdBMBUK/gDSiydKqA4HOXxwQXbUkzAK7QZd2318592+HNONXDxLZ8rmJYbQWBQ9LUE9XUmVzdWx0RCwHAAAAAAAA\n")
  const sr = await SignedRecord.unpack(packed)
  console.log(sr.payload)
})

it("re/connects", async() => {
  const sessionStorage = new TestSessionStorage();

  const skaProvider = async (refresh: Boolean) => {
    return [testServiceKeyAddress, testServiceKeyAddress2];
  }

  const session1 = new Session(sessionStorage, rc, skaProvider, true, 2048);
  let info = await session1.call("getSessionInfo");
  console.log("session ingo",info);
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
