import { encode64, PrivateKey, PublicKey } from "unicrypto";

type levelType = "log" | "warn" | "error"

/**
 * Log entry is used in [[Citr]] to keep original message and its metadata
 */
interface LogEntry {
  level: levelType;
  timestamp: Date;
  data: string[];
  stack?: string;
}

function convert(object: any): string {
  return JSON.stringify(object, (key: string, value: any) => {
    if (value instanceof Uint8Array)
      return { __type: "binary", base64: encode64(value) };
    if (value instanceof Uint32Array)
      return { __type: "binary32", base64: encode64(new Uint8Array(value.buffer)) };
    if (value instanceof PrivateKey)
      return { __type: "PrivateKey", note: "filtered" };
    if (value instanceof PublicKey)
      return { __type: "PublicKey", longAddress: value.longAddress.base58 };
    else return value;
  });
}

/**
 * Catcher In The Ryan - CITR. Catches console logs, stores in the sliding-window buffer
 * and process them to make easy support cases. CITR installs in the chain so there could be
 * several instances (e.g. in library modules) working simultaneously, which is not that effective as the
 * log buffers are not shared.
 *
 * Important! Catcher create copies of logged objects to prevent its state change by the
 * time the log is extracted.
 *
 */
export class Citr {
  #buffer: LogEntry[] = [];
  readonly maxSize: number;

  private readonly c = {
    log: console.log,
    warn: console.warn,
    error: console.error
  };

  /**
   * Immediately intercepts console.log/warn/error and put a copy in
   * own log buffer. The console continues to work as usual.
   *
   * @param maxSize number of log entries to keep. CITR holds only the last `maxSize` records.
   */
  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    this.c.log = console.log;
    this.c.warn = console.warn;
    this.c.error = console.error;
    console.log = (...data: any[]) => this.addLog(this.c.log, "log", data);
    console.warn = (...data: any[]) => this.addLog(this.c.warn, "warn", data);
    console.error = (...data: any[]) => this.addLog(this.c.error, "log", data);
  }

  /**
   * After this call the logging chain will be restored as it was before construction,
   * no more logs will appear in the [[log]].
   */
  stop() {
    console.log = this.c.log;
    console.warn = this.c.warn;
    console.error = this.c.error;
  }

  /**
   * Get a SHALLOW COPY of the log by the time of invocation. E.g. it is safe to modify it
   * and it will not grow by itself as more logs will be caught.
   */
  get log(): LogEntry[] {
    return [...this.#buffer];
  }

  private addLog(logger: (message?: any, ...optionalParams: any[]) => void, level: levelType, data: any[]) {
    logger(...data);
    let stackTrace: string | undefined;
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      data: data.map((value) => {
        let v: string
        let stack: string | undefined
        try {
          v = JSON.parse(convert(value));
          if (value instanceof Error)
            stackTrace = value.stack;
        } catch (e) {
          v = "! " + e
          stackTrace = e.stack
        }
        return v;
      })
    };
    entry.stack = stackTrace;
    if( this.#buffer.length >= this.maxSize )
      this.#buffer.shift();
    this.#buffer.push(entry);
  }

  /**
   * Open the crypstie site with the current log buffer as content (simple way to
   * send bugs information
   */
  createCrypstie() {
    const data = JSON.stringify(
      {
        __type: "CITR_log",
        version: 1,
        log: this.log
      },
      undefined, 4);
    const form = document.createElement("form") as HTMLFormElement;
    form.action = window.location.host.startsWith("localhost") ? "http://localhost:3000" : "https://crypstie.com";
    form.method = "POST";
    const i = document.createElement("input");
    i.type = "hidden";
    i.name = "default_content";
    i.value = data;
    form.appendChild(i);
    document.body.appendChild(form);
    form.submit();
    document.removeChild(form);
  }

}
