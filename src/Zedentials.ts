/**
 * Zedentials. ZEro Dis Exposition creDENTIALS.
 *
 * The main idea is to provide a set of tools to create heavily encrypted configuration file
 * containig set of fields and keys that are generated on the fly, in RAM, never touching a disk.
 *
 * The usual method of generating keys and saving configuration files on the local disk then encrypting
 * it to the "vault" or like to be deployed and decrypted on the target server just does not work in nowadays
 * when ransomware agents could be in any developer or server computer being integrated into "valid" applications
 * NPM packages and even core libraries (especially in windows).
 *
 *
 */
import { Boss, PrivateKey, randomBytes, SignedRecord, SymmetricKey } from "unicrypto";
import { BossObject, BossPrimitive } from "./SimpleBoss";
import { equalArrays } from "./tools";

export type ZLKeyAlgorithm = "RSA/2048" | "RSA/4096" | "RSA/8192" | "AES256";

export interface ZLKeyMeta {
  id: Uint8Array;
  algorithm: ZLKeyAlgorithm;
  tags: string[];
}

interface ZLKeyRecord extends ZLKeyMeta {
  packed: Uint8Array;
}

export class ZLPrivateKey implements ZLKeyMeta {
  algorithm: ZLKeyAlgorithm;
  id: Uint8Array;
  tags: string[];

  constructor(public key: PrivateKey, ...tags: string[]) {
    this.tags = tags;
    this.id = key.publicKey.longAddress.asBinary;
    switch(key.publicKey.getBitStrength()) {
      case 2048: this.algorithm = "RSA/2048"; break;
      case 4096: this.algorithm = "RSA/4096"; break;
      case 8192: this.algorithm = "RSA/8192"; break;
      default:
        throw new Error("unsupported key strength");
    }
  }

}

export class ZLSymmetricKey implements ZLKeyMeta {
  algorithm: ZLKeyAlgorithm = "AES256";
  tags: string[];

  constructor(public key: SymmetricKey, public id: Uint8Array, ...tags: string[]) {
    this.tags = tags;
  }
}

export type ZLKey = ZLPrivateKey | ZLSymmetricKey;

async function packKeyRecord(key: ZLKey): Promise<ZLKeyRecord> {
  return {
    id: key.id,
    algorithm: key.algorithm,
    tags: key.tags,
    packed: await key.key.pack()
  };
}

async function unpackKeyRecord(kr: ZLKeyRecord): Promise<ZLKey> {
  switch (kr.algorithm) {
    case "RSA/2048":
    case "RSA/8192":
    case "RSA/4096":
      return new ZLPrivateKey(await PrivateKey.unpack(kr.packed), ...kr.tags);
    case "AES256":
      return new ZLSymmetricKey(new SymmetricKey({ keyBytes: kr.packed }), kr.id, ...kr.tags);
    default:
      throw new Error(`ZLKeyRecord:${kr.algorithm} is not yet supported`);
  }
}

interface ZLPayload {
  version: number;
  authorityAddress: Uint8Array;
  keyRecords: ZLKeyRecord[];
  fields: BossObject;
}

export class ZedentialsError extends Error {
}

export class Zedentials {

  constructor(public creatorKey?: PrivateKey,
              private _keys: ZLKey[] = [],
              readonly fields: BossObject = {},
              readonly version = 1,
              private selfEncryptionKey?: SymmetricKey
  ) {
  }

  static magick = "ZEDLS";

  /**
   * Get stored field. Stored field _can_ hold null, so check for `undefined` to ensure the field is missing.
   * @param key
   * @return key value or undefined
   */
  getField<T extends BossPrimitive>(key: string): T | undefined {
    return this.fields[key] as T;
  }

  /**
   * Set stored field value. Storing `undefined` removes the field.
   * @param key to alter
   * @param value new value or undefined to remove.
   */
  setField<T extends BossPrimitive>(key: string, value: T | undefined): void {
    if (value === undefined)
      delete this.fields[key];
    else
      this.fields[key] = value;
  }

  /**
   * Check that there is a field with a given name
   */
  contains(key: string): boolean {
    return key in this.fields;
  }

  /**
   * Remove a named field. Same as set its value tu `undefined`.
   * @param key
   */
  removeField(key: string): void {
    delete this.fields[key];
  }

  /**
   * Check the instance has creator key which is needed to sign the updated instance with {@link toSignedRecord} to
   * send it to the consumer. There is no way to supply the key, it is generated with {@link generate} or decrypted
   * with {@link decrypt}. The reason behind it is that only creator or owner can sign the changes and provide it
   * to the consumer. See {@link toSignedRecord}.
   */
  get hasCreatorKey(): boolean {
    return !!this.creatorKey;
  }

  /**
   * Generate new private key and store it in the instance.
   * @param strength desired key strength
   * @param tags to associate with this key.
   */
  async createPrivateKey(strength = 4096, ...tags: string[]): Promise<void> {
    const key = await PrivateKey.generate({ strength });
    this._keys.push(new ZLPrivateKey(key, ...tags));
  }

  /**
   * Generate and store new symmetric key
   * @param tags
   */
  createSymmetricKey(...tags: string[]): void {
    this._keys.push(new ZLSymmetricKey(new SymmetricKey(), randomBytes(32), ...tags));
  }

  /**
   * @return stored keys with meta information.
   */
  get keys(): ZLKey[] {
    return [...this._keys];
  }

  keysWithAllTags(...tags: string[]): ZLKey[] {
    return this._keys.filter(k => tags.every(t => k.tags.includes(t)))
  }

  keysWithAnyTag(...tags: string[]): ZLKey[] {
    return this._keys.filter(k => tags.some(t => k.tags.includes(t)));
  }

  /**
   * @return true if encryption key is stored inside the instance
   */
  get hasEncryptionKey(): boolean {
    return !!this.keyPromise && !!this.rounds && !!this.salt;
  }

  private keyPromise?: Promise<SymmetricKey>;
  private rounds?: number;
  private salt?: Uint8Array;

  /**
   * Encrypt with password using specified PBKDF2 derivation rounds. It generates new random PBKDF2 salt on each
   * invocation. Derived key and derivation parameters are stored internally, so it is possible to call {@link encrypt}
   * later without storing and the password or re-deriving the key.
   *
   * The encrypted Zedentials could be decrypted using the password with {@link Zedentials.decrypt}.
   *
   * @param password
   * @param rounds
   */
  async encryptWith(password: string, rounds = 100000): Promise<Uint8Array> {
    const salt = randomBytes(32);
    this.setKeyParams(rounds, salt, SymmetricKey.fromPassword(password, rounds, salt));
    return this.encrypt();
  }

  private setKeyParams(rounds: number, salt: Uint8Array, keyPromise: Promise<SymmetricKey>): void {
    this.rounds = rounds;
    this.salt = salt;
    this.keyPromise = keyPromise;
  }

  /**
   * Clears previously stored encryption key. The encryption key is stored automatically when calling
   * {@link Zedentials.decrypt} or {@link encryptWith}.
   */
  clearEncryptionKey(): void {
    this.keyPromise = undefined;
    this.salt = undefined;
    this.rounds = undefined;
  }

  /**
   * Encrypt with previously supplied key, either by {@link encryptWith} or {@link Zedentials.decrypt}.
   * It also stores PBKDF that allow re-encrypt without storing the password. Encrypted data uses new
   * IV and random data inserts so it is not possible to tell that newly encrypted data are same as previous
   * copy.
   *
   * @throws ZedentialsError if key is not set.
   */
  async encrypt(): Promise<Uint8Array> {
    if (!this.creatorKey) throw new ZedentialsError("missing creator key");
    if (!this.keyPromise || !this.rounds || !this.salt) throw new ZedentialsError("missing encryption key");
    const keyRecords = await Promise.all(this._keys.map(k => packKeyRecord(k)));
    const tailSize = ~~(Math.random()*17);
    const encryptedData = await (await this.keyPromise).etaEncrypt(
      Boss.dump([this.version, await this.creatorKey.pack(), keyRecords, this.fields, randomBytes(tailSize)])
    );
    const bw = new Boss.Writer();
    bw.write(Zedentials.magick);
    bw.write([this.rounds, this.salt, encryptedData]);
    return bw.get();
  }

  static async decrypt(password: string, ciphertext: Uint8Array): Promise<Zedentials> {
    try {
      const br = new Boss.Reader(ciphertext);
      const magick = br.read();
      if (magick != Zedentials.magick) throw new ZedentialsError("invalid magick label: "+magick);
      const [rounds, salt, encryptedData] = br.read();
      if (rounds < 1) throw new ZedentialsError("invalid rounds value");
      const key = await SymmetricKey.fromPassword(password, rounds, salt);
      const plaintext = await key.etaDecrypt(encryptedData);
      const [version, packedCreatorKey, keyRecords, fields, ] = Boss.load(plaintext);
      if (version != 1) throw new ZedentialsError("invalid version: " + version);
      const keys = await Promise.all((keyRecords as ZLKeyRecord[]).map(kr => unpackKeyRecord(kr as ZLKeyRecord)));
      const result = new Zedentials(
        await PrivateKey.unpack(packedCreatorKey),
        keys,
        fields,
        version
      );
      result.setKeyParams(rounds, salt, Promise.resolve(key));
      return result;
    } catch (e) {
      if( e instanceof ZedentialsError ) throw e;
      throw new ZedentialsError("wrong password or invalid file");
    }
  }

  get authorityAddress(): string | undefined {
    return this.creatorKey?.publicKey.longAddress.asString;
  }

  private async packPayload(): Promise<ZLPayload> {
    return {
      version: this.version,
      authorityAddress: this.creatorKey!.publicKey.longAddress.asBinary,
      keyRecords: await Promise.all(this._keys.map(k => packKeyRecord(k))),
      fields: this.fields
    };
  }

  async toSignedRecord(nonce?: Uint8Array): Promise<Uint8Array> {
    if (!this.creatorKey) throw new ZedentialsError("can't sign, creator key is not set");
    return await SignedRecord.packWithKey(this.creatorKey, await this.packPayload(), nonce);
  }

  static async fromSignedRecord(packed: Uint8Array, expectedNonce?: Uint8Array): Promise<Zedentials> {
    const sr = await SignedRecord.unpack(packed);
    if (expectedNonce && (sr.nonce == null || !equalArrays(expectedNonce, sr.nonce)))
      throw new ZedentialsError("nonce does not match");

    const payload = sr.payload as ZLPayload;
    const keys = await Promise.all(payload.keyRecords.map(kr => unpackKeyRecord(kr)))

    return new Zedentials(undefined, keys, payload.fields)
  }

  static async generate(strength = 2048): Promise<Zedentials> {
    return new Zedentials(await PrivateKey.generate({ strength }));
  }

}



