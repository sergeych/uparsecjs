import { decode64, encode64, PrivateKey, SignedRecord } from "unicrypto";
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
  type: 1 | 2,
  length: number,
  source: Uint8Array
}

export type POWTask = POWTask1;

class KeyAddressProvider {

  private cached: undefined | Promise<Uint8Array[]>;
  private requestRefresh = false;

  constructor( private provider: (boolean) => Promise<Uint8Array[]>) {
  }

  get value(): Promise<Uint8Array[]> {
    if( !this.cached ) {
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

export class POW {
  static async solve(task: POWTask): Promise<any> {
    switch (task.type) {
      case 1:
        return { POWResult: await BitMixer.SolvePOW1(task.source, task.length) };
      default:
        throw new ParsecAuthenticationException("unsupported POW task type: " + task.type);
    }
  }
}

/**
 * Parsec.1 family session client processor. It also implements PConnection and can be used as a connection
 * for session-level commands.
 */
export class Session implements PConnection {
  private readonly connection: PConnection;
  private sessionEndpoint: Promise<Endpoint>;
  private sessionExpiresAt: null | Date;
  private readonly keyStrength: number;
  private readonly testMode: boolean;
  private readonly cachedSessionId: CachedStoredValue;
  private readonly TSK: StoredSerializedValue<Uint8Array>;
  private readonly SCK: AsyncStoredSerializedValue<PrivateKey|null>;
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
  constructor(storage: ParsecSessionStorage, connection: PConnection,
              serviceKeyAddressesProvider: (bool) => Promise<Uint8Array[]>, testMode = false, keyStrength = 4096) {
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

    this.SCK = new AsyncStoredSerializedValue<PrivateKey|null>(
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
   * Call parsec command over session endpoint waiting it to be established or reestablished. See {@link PConnection}.
   *
   * @param method
   * @param params
   */
  async call(method: string, params: any = {}): Promise<any> {
    return (await this.sessionEndpoint).call(method, params);
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
    return this.sessionEndpoint.then( () => {
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
      try { await this.call("destroySession", {}) } catch {};
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
      console.log("create tsk for "+this.cachedSessionId.value);
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

      const signedAddress = sr.key.longAddress;
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
      if( this.tskGenerationCount < 3) {
        console.debug("no known ServiceKey found, trying to refresh.")
      }
      else
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
          SCKAddress: sck.publicKey.longAddress,
          testMode: this.testMode
        });
        // prepare POW solution:
        console.debug("got SCK POWTask, calculating solution for length " + result.POWTask.length);
        const sr: Uint8Array = await SignedRecord.packWithKey(sck, {
          ...await POW.solve(result.POWTask)
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