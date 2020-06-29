import { CachedValue } from "./CachedValue";
import { decode64, encode64, PrivateKey, SignedRecord } from "unicrypto";
import { bossDump, bossLoad } from "./SimpleBoss";
import { randomBytes } from "crypto";
import { equalArrays } from "./tools";
import { ParsecAuthenticationException } from "./ParsecExceptions";
import { BitMixer } from "./BitMixer";
import { Endpoint, ParsecSessionStorage, PConnection, RemoteException } from "./Parsec";

const storageKeySCK = ".p1.SCK";
const storageKeyTSK = ".p1.TSK";
const storageKeySessionId = ".p1.SID";

export interface POWTask1 {
  type: 1 | 2,
  length: number,
  salt: Uint8Array
}

export type POWTask = POWTask1;

export class POW {
  static async solve(task: POWTask): Promise<any> {
    switch (task.type) {
      case 1:
        return { POWResult: await BitMixer.SolvePOW1(task.salt, task.length) };
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
  private readonly serviceKeyAddresses: Uint8Array[];
  private readonly storage: ParsecSessionStorage;
  private sessionEndpoint: Promise<Endpoint>;
  private sessionExpiresAt: null | Date;
  private readonly keyStrength: number;

  /**
   * Construct a session over a given root connection and using a given storage to keep session persistent.
   * As soon as sessino instance is constructed, it begin session establishing and could be used immediately
   * as a {@link PConnection} instance or to await {@link endpoint}.
   *
   * @param storage to get/store session parameters
   * @param connection root connection to a parsec host
   * @param serviceKeyAddresses array of _long_ key addresses of known ServiceKeys (obtained outside using some parsec version negotiation
   * @param keyStrength CSK strength for newly generated keys.
   */
  constructor(storage: ParsecSessionStorage, connection: PConnection,
              serviceKeyAddresses: Uint8Array[], keyStrength = 4096) {
    if (serviceKeyAddresses.length < 1) throw "need at least one service key address";
    this.keyStrength = keyStrength;
    this.serviceKeyAddresses = serviceKeyAddresses;
    this.connection = connection;
    this.storage = storage;
    this.sessionEndpoint = this.connect();
  }

  /**
   * Call parsec command over session endpoint waiting it to be established or reestablished. See {@link PConnection}.
   *
   * @param method
   * @param params
   */
  async call(method: string, params: any): Promise<any> {
    return (await this.sessionEndpoint).call(method, params);
  }

  /**
   * Get endpoint promise. The Session processor will automatically use necessary logic to get a session,
   * existing or new one unless there will be a network problem.
   */
  get endpoint(): Promise<Endpoint> {
    return this.sessionEndpoint
  }

  /**
   * Clear current TSK if any and get new one.
   * @return endpoint promise using new TSK key.
   */
  async refreshSessionKey(): Promise<Endpoint> {
    this.TSK.clear();
    this.storage.removeItem(storageKeyTSK);
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
      await this.call("destroySession", {});
      this.storage.removeItem(storageKeyTSK);
      this.storage.removeItem(storageKeySCK);
      this.storage.removeItem(storageKeySessionId);
      this.SCK.clear();
      this.TSK.clear();
      return true;
    } catch (e) {
      console.warn("failed to destroy session on server, only local cleanup performed. Reason: " + e.message);
    }
    return false;
  }

  private SCK: CachedValue<Promise<PrivateKey>> = new CachedValue(() => {
    const sk = this.storage.getItem(storageKeySCK);
    return sk ? PrivateKey.unpack(bossLoad(decode64(sk))) : null;
  });


  private TSK: CachedValue<Uint8Array> = new CachedValue(() => {
    const sk = this.storage.getItem(storageKeyTSK);
    return sk ? bossLoad(decode64(sk)) : null;
  });

  private async connect(): Promise<Endpoint> {
    if (this.TSK.isDefined()) {
      const sid = this.storage.getItem(storageKeySessionId);
      if (sid) {
        console.debug("inconsistent TSK: no session id, dropping");
      } else {
        // we may be ok:
        const ep = new Endpoint(this.connection, { sessionKey: this.TSK.value, authToken: sid })
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
      this.storage.removeItem(storageKeyTSK);
    }
    return this.startSession();
  }

  private async startSession(): Promise<Endpoint> {
    if (this.SCK.isDefined()) {
      const ep = await this.connectWithSCK();
      if (ep) return ep;
      console.debug("session SCK is invalid, dropping it");
      this.SCK.clear();
      this.storage.removeItem(storageKeySCK);
    }
    console.debug("creating new SCK");
    return this.generateNewSCK();
  }

  private async connectWithSCK(): Promise<Endpoint | null> {
    // request and save new TSK
    const clientNonce = randomBytes(32);
    try {
      const result = await this.connection.call("createTSK", {
        signedRecord: SignedRecord.packWithKey(
          await this.SCK.value,
          {},
          clientNonce
        )
      });
      const esr = result.encryptedSignedRecord;
      if (!esr) throw "invalid createTSK answer: " + JSON.stringify(result);
      const sr = await SignedRecord.unpack(await (await this.SCK.value).decrypt(esr));
      if (!equalArrays(sr.payload.clientNonce, clientNonce))
        throw new ParsecAuthenticationException("TSK creation failed: server has returned a wrong nonce");
      this.TSK.clear();
      this.storage.setItem(storageKeyTSK, encode64(sr.payload.TSK));
      this.sessionExpiresAt = sr.payload.expiresAt;
      console.debug("got a TSK, getting session for it");
      return this.connect();
    } catch (e) {
      if (e instanceof RemoteException) {
        console.debug("service rejected our SCK->TSK request: " + e.message + ", will reset SCK");
        this.storage.removeItem(storageKeySCK);
      } else throw e;
    }
    return null;
  }

  private async generateNewSCK(): Promise<Endpoint> {
    // clear old SCK & cache
    this.storage.removeItem(storageKeySCK);
    this.SCK.clear();
    // generate and try to register new
    while (true) {
      const sck = await PrivateKey.generate({ strength: this.keyStrength });
      try {
        let result = await this.connection.call("requestSCK", { SCKAddress: sck.publicKey.longAddress });
        const sr: Uint8Array = await SignedRecord.packWithKey(await this.SCK.value, {
          POWResult: {
            ...await POW.solve(result.POWTask),
            serviceKeyAddresses: this.serviceKeyAddresses,
          }
        });
        result = await this.connection.call("registerSCK", {
          context: result.context,
          signedRecord: sr
        }) as { clientKeyAddress: Uint8Array, signedRecord: Uint8Array };
        // if we get there then everything is OK, but we need to check the signature
        const answer = (await SignedRecord.unpack(result.signedRecord))
        if (!equalArrays(answer.payload.clientKeyAddress, sck.publicKey.longAddress))
          throw new ParsecAuthenticationException("bad answer")
        const signedAddress = answer.key.publicKey.longAddress;
        for (const a of this.serviceKeyAddresses) {
          if (equalArrays(signedAddress, a)) {
            // check passed, we can use new key, save and use it
            this.storage.setItem(storageKeySCK, encode64(bossDump(await sck.pack())));
            this.SCK.clear();
            return this.connectWithSCK();
          }
        }
        throw new ParsecAuthenticationException("can't authenticate the service");
      } catch (e) {
        if (e instanceof RemoteException)
          console.warn("service has rejected our key: " + e.message);
        else
          throw e;
      }
    }
  }
}