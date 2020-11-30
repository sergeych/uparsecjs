import { bossDump, bossLoad } from "./SimpleBoss";
import { SymmetricKey } from "unicrypto";

const isNode = typeof module !== 'undefined' && module.exports;
const isBrowser = !isNode;

export class ErrorCode extends Error {
  readonly text: string;
  readonly code: string;

  constructor(code: string, text?: string) {
    super(text ? `${code}: ${text}` : `error executing API command: ${code}`);
    this.code = code;
    this.text = text!;
  }
}

export class RemoteException extends ErrorCode {
  constructor(code: string, text?: string) {
    super(code, text);
  }
}

if( !window.fetch)
  window.fetch = require('node-fetch');

/**
 * Some minimal subset of Storage (like window.sessionStorage/localStorage
 * needed to keep and manage permanent Parsec sessions. Window.localStorage and Window.sessionStorage
 * comply.
 */
export interface ParsecSessionStorage {
  /**
   * Return item with the specifed key name or null.
   * @param key
   */
  getItem(key: string): string | null;

  /**
   * Removes the key/value pair with the given key f  rom the list associated with the object, if a key/value pair with the given key exists.
   */
  removeItem(key: string): void;

  /**
   * Sets the value of the pair identified by key to value, creating a new key/value pair if none existed for key previously.
   *
   * Throws a "QuotaExceededError" DOMException exception if the new value couldn't be set. (Setting could fail if, e.g., the user has disabled storage for the site, or if the quota has been exceeded.)
   */
  setItem(key: string, value: string): void;
}


/**
 * Basic Parsec command and result utilities.
 */
export class Command {

  /**
   * Pack parsec command using method name and key-value arguments.
   * @param method name
   * @param args method arguments
   * @return inary parsec command block
   */

  static pack(method: string, args = {}): Uint8Array {
    return bossDump({ cmd: method, args: args });
  }

  /**
   * Unpack remote binary command result (parsec) and extract the returned value (or empty object {}) or throw
   * {@link RemoteException} if the execution result is an error.
   *
   * @param packed
   * @throws RemoteException
   */
  static unpack(packed: Uint8Array): any {
    const data = bossLoad<any>(packed);
    if (data.error) throw new RemoteException(data.error.code, data.error.text);
    return data.result ?? {};
  }
}

/**
 * Interface to any parsec connection level, it is always the same despite of protection level.
 */
// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface PConnection {
  /**
   * Execute remote api function
   * @param method name of the remote method to execute, e.g. 'requestLogin', 'version', etc.
   * @param params any parameters to be passed to the remote method
   * @return promise containing answer object (key-value). It can be empty (.e.g. {}) but can't be null or
   *         undefined.
   * @throws RemoteException if remote sends error result
   */
  call(method: string, params: any): Promise<any>;
}

/**
 * Level 0 parsec connection, used to execute authentication and registration commands, which
 * in turn should provide credentials to connect a secure {@linkt Endpoint}. Usually, this type of
 * connection is used to access API root, what explains the name.
 */
export class RootConnection implements PConnection {

  readonly rootUri: string;

  /**
   * Construct anonumous parsec connection gate using a given root URL, which is
   * typical "https://acme.com/api/p0" or "https://parsec.acme.com/p0" - p0 means it
   * accepts and executes level 0 commands that come without extra authentication and
   * encryption. See {@link Endpoint}.
   *
   * @param rootUri URI to connect to.
   */
  constructor(rootUri: string) {
    if (!rootUri) throw "root URI is undefined"
    this.rootUri = rootUri;
  }

  static traceCommands = false;

  async call(method: string, params: any = {}): Promise<any> {
    if (RootConnection.traceCommands) console.info(`>> ${method}:`, params);
    const packedResult = await this.request(Command.pack(method, params));
    const result = Command.unpack(packedResult);
    if (RootConnection.traceCommands) console.info(`<< ${method}:`, result);
    return result;
  }

  private request(packed: Uint8Array): Promise<Uint8Array> {
    // nodejs roaches
    const fd = isBrowser ? FormData : require('form-data');
    const formData = new fd();
    // noinspection TypeScriptUnresolvedVariable
    formData.append(
      "cmd",
      // nodejs has more roaches:
      isBrowser ? new Blob([packed], { type: "application/octet-stream" }) : Buffer.from(packed),
      new Date().toJSON() + ".bin"
    );
    return fetch(this.rootUri, {
      method: "POST",
      body: formData
    }).then(function (resp) {
      return resp.blob();
    }).then(function (blob) {
      // return new Response(blob).arrayBuffer()
      // return fileReader.readAsArrayBuffer(blob)
      return (blob as any).arrayBuffer();
    }).then(function (ab) {
      return new Uint8Array(ab);
    });
  }
}

/**
 * The adapter for encrypted/authenticated commands. Basically endpoint is created during registration/login
 * or host authentication procedures. There could be nested endpoints too. Basically, Endpoint is just a
 * encrypted and authenticated version of {@link RootConnection}.
 */
export class Endpoint implements PConnection {
  #authToken: string;
  #sessionKey: SymmetricKey;
  connection: PConnection;

  constructor(connection: PConnection, params: { sessionKey: Uint8Array, authToken: string }) {
    this.#authToken = params.authToken;
    this.#sessionKey = new SymmetricKey({ keyBytes: params.sessionKey });
    this.connection = connection;
  }

  serialize(): any {
    return { sessionKey: this.#sessionKey.pack(), authToken: this.#authToken }
  }

  async call(method: string, params: any = {}): Promise<any> {
    const answer = await this.connection.call("cmd", {
      authToken: this.#authToken,
      params: await this.#sessionKey.etaEncrypt(Command.pack(method, params))
    });
    return Command.unpack(await this.#sessionKey.etaDecrypt(answer.result))
  }
}

