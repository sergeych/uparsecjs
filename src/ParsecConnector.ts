// import { Endpoint, PConnection, RootConnection } from "./Parsec";
// import { ParsecNotIdentifiedException } from "./ParsecExceptions";
// import { CompletablePromise } from "./CompletablePromise";
//
// module Parsec;
//
// /**
//  * Connection status. Regular state change diagram:
//  *
//  * ```
//  * connecting -> network_failure    // can't connect
//  * connecting -> not_logged_in      // connected, but not logged in
//  * connecting -> logging_in         // connected saved login session found, attempting to restore
//  *
//  * // conrrect registration
//  * not_logged_in -> registering -> logging_in
//  * // failed registration
//  * not_logged_in -> registering - registration_failed // see reason
//  * not_logged_in -> registering -> network_failure
//  *
//  * // login  started
//  * not_logged_in -> logging_in
//  *
//  * logging_in -> network_failure
//  * logging_in -> login_failed
//  * logging_in -> logged_in
//  * ```
//  *
//  */
//
// interface PCFailure {
//   type: "failure",
//   reason: string
// }
//
//
// export type ParsecConnectionStatusCode =
//   "not_logged_in"
//   | "login_failed"
//   | "registering"
//   | "connecting"
//   | "logging_in"
//   | "network_failure";
//
// interface PCSNotLoggedIn {
//   code: ParsecConnectionStatusCode,
//   reason?: string
// }
//
// export type ParsecConnectionStatus = {
//   code: ParsecConnectionStatusCode
// }
//
// export abstract class ParsecConnection {
//   async anonymousCall(command: string, params: any): Promise<any> {
//     return this.rootConnection.call(command, params);
//   }
//
//   async identifiedCall(command: string, params: any): Promise<any> {
//     if (this.identifiedConnection)
//       return this.identifiedConnection.call(command, params);
//     else
//       throw ParsecNotIdentifiedException;
//   }
//
//   abstract get version(): string;
//
//   abstract async getStatus(): Promise<ParsecConnectionStatus>;
//
//   private readonly _rootConnection: PConnection;
//   get rootConnection() {
//     return this._rootConnection;
//   }
//
//   protected identifiedConnection: PConnection | null;
//
//   abstract async waitConnectionStatusChanged(): Promise<ParsecConnectionStatus>;
//
//   protected constructor(rootConnection: PConnection) {
//     this._rootConnection = rootConnection;
//   }
// }
//
// /*
// typical lifecycle:
//
// S1. create, wait state change. it fires when gets some staionary state, like connected,
// logged in or failed.
//
// S2. If login is requiried, but state is "not_logged_in", then request login, password
// and authenticate, and wait for state change.
//
//  */
//
// class ParsecConnectionV1 extends ParsecConnection {
//   private sessionStorage: ParsecSessionStorage;
//   private statusPromise: CompletablePromise<ParsecConnectionStatus>;
//
//   constructor(rootUrl: string, sessionStorage: ParsecSessionStorage) {
//     super(new RootConnection(rootUrl))
//     this.sessionStorage = sessionStorage;
//     this.statusPromise = new CompletablePromise<ParsecConnectionStatus>();
//   }
//
//   get version(): string {
//     return "1.5";
//   }
//
//   async getStatus(): Promise<ParsecConnectionStatus> {
//     return Promise.resolve({ code: "network_failure" });
//   }
//
//   async waitConnectionStatusChanged(): Promise<ParsecConnectionStatus> {
//     return Promise.resolve(undefined);
//   }
//
//
// }
//
//
// export class ParsecConnector {
//   private static sessionStorage: ParsecSessionStorage;
//
//   static async initConnecionV1(rootUrl: string, sessionStorage?: ParsecSessionStorage): Promise<ParsecConnection> {
//     const pc = new ParsecConnectionV1(rootUrl, sessionStorage);
//     return pc;
//   }
//
// }