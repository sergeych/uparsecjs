import { ParsecSessionStorage } from "./Parsec";

export class CachedStoredValue {
  private cachedValue: string | null | undefined;
  private readonly key: string;
  private storage: ParsecSessionStorage;

  constructor(storage: ParsecSessionStorage, key: string) {
    this.key = key;
    this.storage = storage;
  }

  get value(): string | null {
    if( this.cachedValue == undefined )
      this.cachedValue = this.storage.getItem(this.key);
    return this.cachedValue;
  }

  set value(value: string | null) {
    this.cachedValue = value;
    if( value != null )
      this.storage.setItem(this.key, value);
    else
      this.storage.removeItem(this.key);
  }
}