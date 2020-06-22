/**
 * Some minimal subset of Storage (like window.sessionStorage/localStorage
 * needed to keep and manage permanent Parsec sessions. Window.localStorage and Window.sessionStorage
 * comply.
 */
import { Endpoint, PConnection, RootConnection } from "./Parsec";
import { ParsecNotIdentifiedException } from "./ParsecExceptions";
import { CompletablePromise } from "./CompletablePromise";

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

export type ParsecConnecctionStatus = "not_logged_in" | "registering" | "connecting" | "loggin_in" | "network_failure";

export abstract class ParsecConnection {
  async anonymousCall(command: string, params: any): Promise<any> {
    return (this.rootConnection.call(command, params);
  }

  async identifiedCall(command: string, params: any): Promise<any> {
    if (this.identifiedConnection)
      return this.identifiedConnection.call(command, params);
    else
      throw ParsecNotIdentifiedException;
  }

  abstract get version(): string;

  abstract get status(): ParsecConnecctionStatus;

  private _rootConnection: PConnection;
  get rootConnection() { return this._rootConnection; }

  protected identifiedConnection: PConnection | null;

  abstract async waitConnectionSatusChanged(): Promise<ParsecConnecctionStatus>;

  protected constructor(rootConnection: PConnection) {
    this._rootConnection = rootConnection;
  }
}

class ParsecConnectionV1 extends ParsecConnection {
  private sessionStorage: ParsecSessionStorage;
  private statusPromise: CompletablePromise<ParsecConnecctionStatus>;

  constructor(rootUrl: string, sessionStorage: ParsecSessionStorage) {
    super(new RootConnection(rootUrl))
    this.sessionStorage = sessionStorage;
    this.statusPromise = new CompletablePromise<ParsecConnecctionStatus>();
  }

  get status() {
    if( this.statusPromise.isCompleted )
      return this.statusPromise
  }

  get version(): string {
    return "1.5";
  }

  waitConnectionSatusChanged(): Promise<ParsecConnecctionStatus> {
    throw new Error("Method not implemented.");
  }


}


export class ParsecConnector {
  private static sessionStorage: ParsecSessionStorage;

  static async initConnecionV1(rootUrl: string, sessionStorage?: ParsecSessionStorage): Promise<ParsecConnection> {
    const pc = new ParsecConnectionV1(rootUrl, sessionStorage);
    pc.waitConnectionSatusChanged();
    return pc;
  }

}