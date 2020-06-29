
export class CachedValue<T extends any | null> {

  #callback: () => T;
  #cachedValue: T | undefined;

  constructor(cb: ()=>T) {
    this.#callback = cb;
  }

  clear() {
    this.#cachedValue = undefined;
  }

  get value() : T  {
    if( this.#cachedValue == undefined )
      this.#cachedValue = this.#callback();
    return this.#cachedValue;
  }

  isDefined() { return this.#cachedValue != undefined; }

  isEmpty() { return !this.isDefined(); }
}