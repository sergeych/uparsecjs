/**
 * Listener for typed [[Emitter]] events
 */
export type EmitterEventListener<T> = (eventObj: T) => void;

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
   * @return listener label that could be used to [[removeListener]]
   */
  addListener(lr: EmitterEventListener<T>): string {
    const label = "" + this.count++;
    this.strongListeners.set(label, lr)
    return label
  }

  /**
   * Remove listener by its identifier. Does nothing if it does not exist.
   * @param label listener label
   */
  removeListener(label: string): void {
    this.strongListeners.delete(label)
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