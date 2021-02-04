/**
 * Lazy readonly value, is being calculated on first access only using constructor supplied callback.
 */
export class CachedValue<T extends any | null> {

  #callback: () => T;
  #cachedValue: T | undefined;

  /**
   * Construct cached value specifying calculation callback. Note that it is possible to cache a Promise
   * for example using async callback and it will not be started until first access.
   * @param cb
   */
  constructor(cb: ()=>T) {
    this.#callback = cb;
  }

  /**
   * Drop cached value it will be recalculated on next call to [[value]].
   */
  clear() {
    this.#cachedValue = undefined;
  }

  /**
   * Calculate if need or return cached value returned by the lambda passed to the constructor.
   */
  get value() : T  {
    if( this.#cachedValue == undefined )
      this.#cachedValue = this.#callback();
    return this.#cachedValue;
  }

}