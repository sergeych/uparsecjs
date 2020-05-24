/**
 * Simple and fast stats: mean, S2, stdev (estimated standard deviation).
 * Parsec uses it for clock synchronization which is often used in its
 * application protocols.
 *
 * It uses effective estimation algorithms that do not store the whole series
 * so could be same effective used with tiny arrays and large streams of samples.
 */
export class Estimator {
  #sx: number;
  #sx2: number;
  #n: number;

  constructor() {
    this.#sx = 0;
    this.#sx2 = 0;
    this.#n = 0;
  }

  /**
   * Current number of samples
   */
  get count() {
    return this.#n;
  }

  /**
   * current mean value
   */
  get mean() {
    return this.#sx / this.#n;
  }

  /**
   * Current Sample Variance estimation, e.g. 𝛔²(n-1)
   */
  get s2() {
    const n = this.#n;
    const m = this.mean;
    return (this.#sx2 - n * m * m) / (n - 1);
  }

  /**
   * Estimated standard deviation, √𝛔² (square root of sample variance estimation)
   */
  get stdev() {
    return Math.sqrt(this.s2);
  }

  /**
   * Add next sample to series.
   *
   * @param x value to add.
   */
  addSample(x: number) {
    this.#sx += x;
    this.#sx2 += (x * x);
    this.#n++;
  }

  /**
   * clear current series so it can restart calulation
   */
  clear() {
    this.#sx = this.#sx2 = this.#n = 0;
  }

  toString() {
    return `(${this.mean} ± ${this.stdev.toPrecision(3)})`;
  }
}