/**
 * Listener for typed [[Emitter]] events
 */
export type EmitterEventListener<T> = (eventObj: T) => void;

/**
 * Handle to unsubscribe event listener returned from [[Emitter.addListener]].
 */
export class EmitterHandle {
  constructor(readonly label: string,readonly emitter: Emitter<any>) {
  }

  /**
   * Remove the listener from its emitter. It is ok to call it more than once, after first call it does nothing.
   */
  unsubscribe() {
    this.emitter.removeListener(this.label);
  }

  /**
   * returns the label. Same as [[label]].
   */
  toString() {
    return this.label;
  }
}

/**
 * Minimalistic typed event emitter. Was initially created to support also weak listeners but
 * its support is postponed until the weak references will be widely adopted. Could be used as a compact
 * event bus implementation.
 *
 * __important__ note. This emitter could not respect the order of listener registration.
 */
export class Emitter<T> {

  private count = 0;
  private readonly strongListeners = new Map<string, EmitterEventListener<T>>();

  /**
   * Add listener. If the listener is added multiple times, it will be called multiple times
   * on event [[fire]],
   *
   * @param lr listener to add
   * @return handle that could be used to unsubscribe this listener.
   */
  addListener(lr: EmitterEventListener<T>): EmitterHandle  {
    const label = "" + this.count++;
    this.strongListeners.set(label, lr);
    return new EmitterHandle(label, this);
  }

  /**
   * Remove listener by its identifier. Does nothing if it does not exist.
   * @param handle or its label (backward compatibility) of the listener to remove
   */
  removeListener(label: string | EmitterHandle): void {
    const l = label instanceof  EmitterHandle ? label.label : label;
    this.strongListeners.delete(l);
  }

  /**
   * Fire an event. The event will be passed to all listeners. If the listener will throw an exception,
   * it will be caught and reported to the console, but won't interrupt event processing.
   *
   * __important__ note. This emitter could not respect the order of listener registration.
   * @param eventObject
   */
  fire(eventObject: T): void {
    for (const x of this.strongListeners.values())
      try {
        x(eventObject)
      } catch (e) {
        console.error("Caught exception while fire event. ignore: " + e)
      }
  }

}
