import { IConnection, RootConnection } from "./Parsec";
import { Estimator } from "./Estimator";

/**
 * Detects clock offset between the host system and some parsec host.
 * it could be important for some login/registration protocols and
 * like.
 */
export class TimeService {
  readonly #connection: IConnection;
  readonly #shiftMillis: Promise<number>;

  readonly #eOffset = new Estimator();
  readonly #eLag = new Estimator();

  constructor(rootPath: string) {
    this.#connection = new RootConnection(rootPath);
    this.#shiftMillis = new Promise<number>((resolve, reject) => {
      this.measure().then(() => {
        resolve(this.#eOffset.mean - this.#eLag.mean)
      }).catch((e) => {
        reject(e)
      })
    });
  }

  get shiftMillis(): Promise<number> {
    return this.#shiftMillis;
  }

  private async measure() {
    // first 2 calls are alwaus very slow due to optimizations and network algorithms,
    // so we ignore it
    await this.step();
    await this.step();
    do {
    await this.runEstimationsRound();
    } while (this.#eOffset.stdev >= 500);
  }

  private async runEstimationsRound(total = 10) {
    this.#eLag.clear();
    this.#eOffset.clear();
    while (total-- > 0) {
      await this.step();
    }
    // console.log(`Time sync values: offset: ${this.#eOffset}ms, network lag: ${this.#eLag}ms`);
  }

  private async step() {
    const start = +new Date();
    const r = (await this.#connection.call("time", {}));
    const t = r.time * 1000;
    const lag = (+new Date() - start) / 2;
    const offset = t - start;
    this.#eOffset.  addSample(offset);
    this.#eLag.addSample(lag);
  }

  /**
   * Current timestamp at the remote stie, using currenly calculated
   * estimations.
   */
  async remoteNow(): Promise<Date> {
    const shift = await this.shiftMillis;
    return new Date(+new Date() + shift);
  }

  /**
   * Calculate remote epoch second as a float number with millisecond (most likely)
   * precision. Async to wait when measurement round is complete.
   */
  async remoteEpochSecond(): Promise<number> {
    const shift = await this.shiftMillis;
    return (+new Date() + shift)/1000.0;

  }

}