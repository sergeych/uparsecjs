/**
 * The Promise that could explicitly be resolved or rejected by calling
 * its methods. Could be used as a regular promise.
 *
 * Note that "modified" system promise under V8 is much less effective than unaltered
 * promise, that's why consider using {@link Completable} that perform better on frequent calls but
 * can't be im-place replacement where the Promise is required or used.
 */
export class CompletablePromise<T> implements Promise<T> {

  #resolver: any;
  #rejecter: any;
  #promise: Promise<T>
  #isCompleted = false
  #result: T | undefined;
  #isResolved = false;

  constructor() {
    this.#promise = new Promise((resolve, reject) => {
      this.#resolver = resolve;
      this.#rejecter = reject;
    });
  }

  [Symbol.toStringTag]: string = "CompletablePromise";

  finally(onfinally?: () => void): Promise<T> {
    return this.#promise.finally(onfinally);
  }

  /**
   * Set promise to resolved state.
   * @param result
   * @throws Error if already completed
   */
  resolve(result?: T) {
    if( this.#isCompleted ) throw "already completed";
    this.#isCompleted = true;
    this.#result = result;
    this.#isResolved = true;
    this.#resolver(result)
  }

  /**
   * Set promise to rejected state.
   * @param result
   * @throws Error if already completed
   */
  reject(error?: any) {
    if( this.#isCompleted ) throw "already completed";
    this.#isCompleted = true;
    this.#rejecter(error)
  }

  catch<TResult = never>(onrejected?: ((reason: any) => (PromiseLike<TResult> | TResult)) | undefined | null): Promise<T | TResult> {
    return this.#promise.catch(onrejected);
  }

  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => (PromiseLike<TResult1> | TResult1)) | undefined | null, onrejected?: ((reason: any) => (PromiseLike<TResult2> | TResult2)) | undefined | null): Promise<TResult1 | TResult2> {
    return this.#promise.then(onfulfilled);
  }

  get isCompleted(): boolean { return this.#isCompleted; }

  /**
   * For the completed promise, return its result. Throws error if it is not completed or was rejected,
   * so check it state first.
   */
  get result(): T {
    if( !this.#isCompleted )
      throw "not completed";
    if( !this.#isResolved )
      throw "promise rejected";
    return this.#result;
  }

  /**
   * returns true if the promise is resolved. False if it is rejected.
   */
  get isResolved(): boolean {
    if( !this.#isCompleted ) return false;
    return this.#isResolved;
  }

  /**
   * returns true if this promise was rejected.
   */
  get isRejected(): boolean {
    if( !this.#isCompleted ) return false;
    return !this.#isResolved;
  }
}