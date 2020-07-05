import { ParsecSessionStorage } from "./Parsec";

export interface AsyncStringSerializer<T> {
  serialize(object: T): Promise<string>;
  deserialize(serialized: string): Promise<T>
}

export class AsyncStoredSerializedValue<T> {
  private cachedValue: Promise<T | null> | undefined;

  constructor(private storage: ParsecSessionStorage, private key: string, private serializer: AsyncStringSerializer<T>) {
    this.serializer = serializer;
  }

  async get(): Promise<T | null> {
    if( this.cachedValue == undefined) {
      const s = this.storage.getItem(this.key);
      this.cachedValue =  s == null ? Promise.resolve(null) : this.serializer.deserialize(s);
    }
    return this.cachedValue;
  }

  async set(value: T | null): Promise<void> {
    this.cachedValue = Promise.resolve(value);
    if( value == null )
      this.clear();
    else
      this.storage.setItem(this.key, await this.serializer.serialize(value));
  }

  clear() {
    this.cachedValue = Promise.resolve(null);
    this.storage.removeItem(this.key);
  }

  refresh(): Promise<T | null> {
    this.cachedValue = undefined;
    return this.get();
  }
}