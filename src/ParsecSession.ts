import { decode64, encode64, PrivateKey, SHA, SignedRecord } from "unicrypto";
import { bossLoad } from "./SimpleBoss";
import { randomBytes } from "crypto";
import { equalArrays } from "./tools";
import { ParsecAuthenticationException } from "./ParsecExceptions";
import { BitMixer } from "./BitMixer";
import { Endpoint, ParsecSessionStorage, PConnection, RemoteException } from "./Parsec";
import { CachedStoredValue } from "./CachedStoredValue";
import { StoredSerializedValue } from "./StoredSerializedValue";
import { AsyncStoredSerializedValue } from "./AsyncStoredSerializedValue";
import { CachedValue } from "./CachedValue";

const storageKeySCK = ".p1.SCK";
const storageKeyTSK = ".p1.TSK";
const storageKeySessionId = ".p1.SID";

export interface POWTask1 {
  type: number,
  length: number,
  source: Uint8Array
}

export type POWTask = POWTask1;

/**
 * The async callback that should obtain and return, or refresh and return list of known service addresses.
 * The real addresses could be, for example, extracted from some Universa contract or obtained from UNS2
 * network-stored contract, provided by the service itself and so on. This is becaise parsec 1.x allows
 * 3 ways of checking service address: pre-shared address, pre-shared serivce contract origin or UNS2 name, and
 * this library should work with all 3. See parsec papers in kb for more.
 *
 * @param refresh callers sets it to true to request refreshing known addresses from external srouces where
 *                applicable. Generally it means that the reported addresses do not match and the service
 *                might have published updated serivce contract
 */
type ServiceKeyAddressesProvider = (refresh: boolean) => Promise<Uint8Array[]>;

class KeyAddressProvider {

  private cached: undefined | Promise<Uint8Array[]>;
  private requestRefresh = false;

  constructor(private provider: ServiceKeyAddressesProvider) {
  }

  get value(): Promise<Uint8Array[]> {
    if (!this.cached) {
      this.cached = this.provider(this.requestRefresh);
      this.requestRefresh = false;
    }
    return this.cached;
  }

  refresh() {
    this.cached = undefined;
    this.requestRefresh = true;
  }
}

/**
 * Parsec POW tools
 */
export class POW {
  /**
   * Solve valid POW task and return result.
   *
   * @param task
   */
  static async solve(task: POWTask): Promise<Uint8Array> {
    switch (task.type) {
      case 1:
        return await BitMixer.SolvePOW1(task.source, task.length);
      default:
        throw new ParsecAuthenticationException("unsupported POW task type: " + task.type);
    }
  }

  /**
   * Check POW solution. This is by orders of magnitude faster than solving it. The result could
   * be obtained by {@link solve}
   *
   * @param task that expected to be solved
   * @param solution solution to check.
   */
  static async check(task: POWTask, solution: Uint8Array): Promise<Boolean> {
    switch (task.type) {
      case 1:
        const sha = new SHA("sha3_384");
        await sha.put(solution);
        await sha.put(task.source);
        const s = await sha.get();
        return BitMixer.countZeroes(s) == task.length;
      default:
        throw new ParsecAuthenticationException("unsupported POW task type: " + task.type);
    }
  }
}

/**
 * Parsec.1 family session client processor. It also implements PConnection and can be used as a connection
 * for session-level commands. Session consumes [[PConnection]] and constructs parsec.1 protocol over it,
 * by implementing same [[PConnection]] interface.
 *
 * Usage sample:
 *
 * ```typescript
 * import { ParsecSessionStorage, RootConnection } from "./Parsec";
 *
 *  // First, we construct connection. Connection could use any transport, but
 * // this module provides only http as for now:
 * const rootConnection = new RootConnection("http://parsec.your.host/api/p1");
 *
 * // Implement parsec session storage to safely keep parsec session information
 * // between restarts. It should be encrypted and protected with password, or
 * // should doscard data on application exit, though it will cause to session re-
 * // establishing that takes a lot of time without stored parameters:
 * const storage: ParsecSessionStorage = new SomeProtectedStorage()
 *
 *  // Let session known the list of available addresses of the serivce, as for 1.1:
 *  const addressProvider = (refresh: boolean) => {
 *   // in real life we might respect refresh value and provide more than one
 *   // address.
 *   return [
 *     decode64("EMbhPh0J22t0EfITdXOhHnB2HKW9oBqxsIbWU7iBzGO4/N20x833lL527PBvV/ZSUnROnqs=")
 *   ];
 * }
 *
 *  // With connection, we can build se
 *  const session = new Session(storage, rootConnection, addressProvider);
 *
 *  // Now we can execute parsec commands:
 *  const result = await session.call("myCommand", {foo: 'bar', buzz: 42});
 *
 * ```
 */
export class Session implements PConnection {
  private readonly connection: PConnection;
  private sessionEndpoint: Promise<Endpoint>;
  private sessionExpiresAt: null | Date;
  private readonly keyStrength: number;
  private readonly testMode: boolean;
  private readonly cachedSessionId: CachedStoredValue;
  private readonly TSK: StoredSerializedValue<Uint8Array>;
  private readonly SCK: AsyncStoredSerializedValue<PrivateKey | null>;
  private readonly serviceKeyAddresses: KeyAddressProvider;

  // debugging parameters
  tskGenerationCount = 0;
  sckGenerationCount = 0;

  /**
   * Construct a session over a given root connection and using a given storage to keep session persistent.
   * As soon as sessino instance is constructed, it begin session establishing and could be used immediately
   * as a {@link PConnection} instance or to await {@link endpoint}.
   *
   * @param storage to get/store session parameters
   * @param connection root connection to a parsec host
   * @param serviceKeyAddressesProvider async callback that returns array of _long_ key addresses of known ServiceKeys
   *        (obtained outside using some parsec version negotiation). Its only boolean parameter is set to true
   *        to signal to try to refresh and obtain most recent list of service keys (e.g. when the parsec.1 protocol
   *        can't find service key).
   * @param testMode test session: functionality could be limited to unit testing only
   * @param keyStrength CSK strength for newly generated keys.
   */
  constructor(storage: ParsecSessionStorage,
              connection: PConnection,
              serviceKeyAddressesProvider: ServiceKeyAddressesProvider,
              testMode = false,
              keyStrength = 4096) {
    this.keyStrength = keyStrength;
    this.connection = connection;
    this.testMode = testMode;
    this.cachedSessionId = new CachedStoredValue(storage, storageKeySessionId);

    this.serviceKeyAddresses = new KeyAddressProvider(serviceKeyAddressesProvider);

    this.TSK = new StoredSerializedValue<Uint8Array>(
      storage,
      storageKeyTSK,
      {
        serialize(object: Uint8Array): string {
          return encode64(object);
        },
        deserialize(serialized: string): Uint8Array {
          return decode64(serialized);
        }
      }
    )

    this.SCK = new AsyncStoredSerializedValue<PrivateKey | null>(
      storage,
      storageKeySCK,
      {
        async serialize(object: PrivateKey | null): Promise<string> {
          return encode64(await object!.pack())
        },
        deserialize(serialized: string): Promise<PrivateKey | null> {
          return PrivateKey.unpack(decode64(serialized));
        }
      }
    )
    this.sessionEndpoint = this.connect();
  }

  /**
   * Get the current TSK value, it is defined at the moment. TSK could be used and us actually used in parsec
   * enabled services as a secure per-session nonce/temporary id value that is dropped on logout, knwon at the
   * moment to both server and client without any additional data exchange.
   */
  get currentTSK(): Uint8Array | null {
    return this.TSK.value;
  }


  /**
   * Call parsec command over session endpoint waiting it to be established or reestablished. See {@link PConnection}.
   *
   * @param method
   * @param params
   */
  async call(method: string, params: any = {}): Promise<any> {
    try {
      return await (await this.sessionEndpoint).call(method, params);
    } catch (e) {
      if (e instanceof RemoteException) {
        switch (e.code) {
          case "parsec_missing_tsk":
          case "parsec_session_not_found":
            await this.refreshSessionKey()
            return await this.call(method, params);
          case 'unknown_exception':
            if (e.text.includes("HMAC")) {
              // this ought to be bad or missing TSK:
              await this.refreshSessionKey();
              return this.call(method, params);
            }
        }
        throw e;
      }
    }
  }

  /**
   * Await connection. This is rarely need as using it as {@link PConnection} instance, e.g. with {@link call}
   * automatically awaits for connection to be established.
   */
  public async ready(): Promise<void> {
    await this.sessionEndpoint
  }

  /**
   * Promise to connected session id. Therefore, it will not resolve until the session is established.
   */
  public get id(): Promise<string> {
    return this.sessionEndpoint.then(() => {
      return this.cachedSessionId.value!
    });
  }

  /**
   * Clear current TSK if any and get new one.
   * @return endpoint promise using new TSK key.
   */
  async refreshSessionKey(): Promise<Endpoint> {
    this.TSK.clear();
    this.sessionEndpoint = this.connect();
    return this.sessionEndpoint;
  }

  /**
   * Delete current session from the server and locally and start connecting new one.
   * It also tries to delete the session of connected server. See {@link kill}.
   * @return new session's endpoint.
   */
  async reset(): Promise<Endpoint> {
    await this.kill();
    this.sessionEndpoint = this.connect();
    return this.sessionEndpoint;
  }

  /**
   * Kill session on the server and destroy it locally. Does not start reconnection.
   * @return true if the session was successfully deleted also from the service
   */
  async kill(): Promise<boolean> {
    try {
      try {
        await this.call("destroySession", {})
      } catch {
      }
      this.cachedSessionId.value = null;
      this.SCK.clear();
      this.TSK.clear();
      return true;
    } catch (e) {
      console.warn("failed to destroy session on server, only local cleanup performed. Reason: " + e.message);
    }
    return false;
  }

  private async connect(): Promise<Endpoint> {
    if (this.TSK.value) {
      const sid = this.cachedSessionId.value;
      if (!sid) {
        console.debug("inconsistent TSK: no session id, dropping");
      } else {
        // we may be ok:
        const ep = new Endpoint(this.connection, { sessionKey: this.TSK.value!, authToken: sid })
        try {
          const result = await ep.call("getSessionInfo");
          console.debug("session info", result);
          this.sessionExpiresAt = result.expiresAt;
          // success: we got an endpoint!
          return ep;
        } catch (e) {
          if (e instanceof RemoteException) {
            console.debug(`session can't be connected: ${e.message}, dropping`);
            // fallback will clear TSK
          } else {
            console.warn("network error, failing");
            throw e;
          }
        }
      }
      this.TSK.clear();
    }
    return this.startSession();
  }

  private async startSession(): Promise<Endpoint> {
    if (await this.SCK.get()) {
      const ep = await this.connectWithSCK();
      if (ep) return ep;
      console.debug("session SCK is invalid, dropping it");
      this.SCK.clear();
    }
    console.debug("creating new SCK");
    return this.generateNewSCK();
  }

  private async connectWithSCK(): Promise<Endpoint | null> {
    // request and save new TSK
    const clientNonce = randomBytes(32);
    try {
      console.log("create tsk for " + this.cachedSessionId.value);
      const result = await this.connection.call("createTSK", {
        signedRecord: await SignedRecord.packWithKey(
          (await this.SCK.get())!,
          {
            clientNonce: clientNonce,
            sessionId: this.cachedSessionId.value,
            knownServiceKeys: await this.serviceKeyAddresses.value
          },
          clientNonce
        )
      });
      const signedResult = result.signedEncryptedResult;
      if (!signedResult) throw "invalid createTSK answer: " + JSON.stringify(result);

      const sr = await SignedRecord.unpack(signedResult);

      if (!equalArrays(sr.payload.clientNonce, clientNonce))
        throw new ParsecAuthenticationException("TSK creation failed: server has returned a wrong nonce");

      const signedAddress = sr.key.longAddress.bytes;
      this.tskGenerationCount++;
      for (const a of await this.serviceKeyAddresses.value) {
        if (equalArrays(signedAddress, a)) {
          console.debug("key service address found, decrypting TSK");
          // now we have to decrypt payload:
          const plainResult = bossLoad<any>(await (await this.SCK.get())!.decrypt(sr.payload.encryptedResult));
          this.TSK.value = plainResult.TSK;
          this.sessionExpiresAt = plainResult.TSKExpiresAt;
          console.debug("got a TSK, restarting session for it");
          return this.connect();
        }
      }
      if (this.tskGenerationCount < 3) {
        console.debug("no known ServiceKey found, trying to refresh.")
      } else
        console.warn("provided ServiceKey is not known, need to rescan knwonn keys");

    } catch (e) {
      if (e instanceof RemoteException) {
        console.debug("service rejected our SCK->TSK request: " + e.message + ", will reset SCK");
        this.SCK.clear();
        return this.generateNewSCK();
      } else throw e;
    }
    return null;
  }

  private async generateNewSCK(): Promise<Endpoint> {
    // clear old SCK & cache
    this.SCK.clear();
    // generate and try to register new
    while (true) {
      // this will be a new SCK:
      const sck = await PrivateKey.generate({ strength: this.keyStrength });
      try {
        let result = await this.connection.call("requestSCK", {
          SCKAddress: sck.publicKey.longAddress.bytes,
          testMode: this.testMode
        });
        // prepare POW solution:
        console.debug("got SCK POWTask, calculating solution for length " + result.POWTask.length);
        const sr: Uint8Array = await SignedRecord.packWithKey(sck, {
          POWResult: await POW.solve(result.POWTask)
        });
        console.debug("Registering new SCK key with solved POW")
        result = await this.connection.call("registerSCK", {
          context: result.context,
          signedRecord: sr
        });
        // if we get there then everything is OK, but we need to check the signature
        // check passed, we can use new key, save and use it
        this.sckGenerationCount++;
        await this.SCK.set(sck);
        this.cachedSessionId.value = result.sessionId;
        // actually, we can even fail connecting with fresh new sck, so lets restart the procedure:
        return this.startSession();
      } catch (e) {
        if (e instanceof RemoteException)
          console.warn("service has rejected our key: " + e.message);
        else
          throw e;
      }
    }
  }
}