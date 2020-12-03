import { ParsecSessionStorage } from "./Parsec";

export interface StringSerializer<T> {
  serialize(object: T): string;
  deserialize(serialized: string): T
}

export class StoredSerializedValue<T> {
  private cachedValue: T | null | undefined;

  constructor(private storage: ParsecSessionStorage, private key: string, private serializer: StringSerializer<T>) {
    this.serializer = serializer;
  }

  get value(): T | null {
    if( this.cachedValue == undefined) {
      const s = this.storage.getItem(this.key);
      this.cachedValue =  s == null ? null : this.serializer.deserialize(s);
    }
    return this.cachedValue;
  }

  set value(value: T | null) {
    if( value == null )
      this.storage.removeItem(this.key);
    else
      this.storage.setItem(this.key, this.serializer.serialize(value));
    this.cachedValue = undefined;
  }

  clear() { this.value = null; }

  refresh(): T | null {
    this.cachedValue = undefined;
    return this.value;
  }
}