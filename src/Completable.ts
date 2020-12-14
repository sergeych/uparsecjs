// /**
//  * The wrapping that provides usual Promise that could explicitly be resolved or rejected by calling
//  * via Completable instance methods. Could be used as a regular promise.
//  *
//  * Unlike {@link CompletablePromise} it does not alter Promise itself so works faster when called
//  * frequently.
//  */
// export class Completable<T>  {
//
//   #resolver: any;
//   #rejecter: any;
//   #promise: Promise<T>
//   #isCompleted = false
//   #result: T | undefined;
//   #isResolved = false;
//
//   constructor() {
//     this.#promise = new Promise((resolve, reject) => {
//       this.#resolver = resolve;
//       this.#rejecter = reject;
//     });
//   }
//
//   get promise() { return this.#promise; }
//
//   /**
//    * Set promise to resolved state.
//    * @param result
//    * @throws Error if already completed
//    */
//   resolve(result?: T) {
//     if( this.#isCompleted ) throw "already completed";
//     this.#isCompleted = true;
//     this.#result = result;
//     this.#isResolved = true;
//     this.#resolver(result)
//   }
//
//   /**
//    * Set promise to rejected state.
//    * @param result
//    * @throws Error if already completed
//    */
//   reject(error?: any) {
//     if( this.#isCompleted ) throw "already completed";
//     this.#promise.catch(e => {});
//     this.#isCompleted = true;
//     this.#rejecter(error);
//   }
//
//   /**
//    * returns true if the promise is either rejected or resolved.
//    */
//   get isCompleted(): boolean { return this.#isCompleted; }
//
//   /**
//    * For the completed promise, return its result. Throws error if it is not completed or was rejected,
//    * so check it state first.
//    */
//   get result(): T {
//     if( !this.#isResolved )
//       throw "promise rejected";
//     if( !this.#isCompleted || !this.#result)
//       throw "not completed";
//     return this.#result;
//   }
//
//   /**
//    * returns true if the promise is resolved. False if it is rejected.
//    */
//   get isResolved(): boolean {
//     if( !this.#isCompleted ) return false;
//     return this.#isResolved;
//   }
//
//   /**
//    * returns true if this promise was rejected.
//    */
//   get isRejected(): boolean {
//     if( !this.#isCompleted ) return false;
//     return !this.#isResolved;
//   }
// }