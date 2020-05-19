import {
  encode64,
  pbkdf2,
  PrivateKey,
  PublicKey,
  PublicKeyEncryptOpts,
  randomBytes,
  SymmetricKey
} from "universa-wasm";
import { bossDump, bossLoad } from "./SimpleBoss";
import { sha256 } from "./index";

/* istanbul ignore next */
export class UniversalKeyException extends Error {
  constructor(text: string) {
    super(text);
  }
}

/**
 * Basic universal key identification structure. Could be extended by particular key. Contains key type
 * that should be unique for each key type in use, and binary id array, which could be not unique, so
 * application code must check all different keys that might occasionally have same id.
 */
export interface UniversalKeyTag {
  /**
   * Unique key type, e.g. 'private', 'symmetric', 'password' - latter means some KDF in extended attributes.
   */
  type: string;
  /**
   * ID array, usually some sort of hash, that could be same for different keys, and should be random or at least
   * derived in the way that will not weaken the key. For example, it could be a public key fingerprint (address),
   * or additional bits produced by KDF from the same password - but _not a hash from the secret or symmetric key!_.
   */
  id: Uint8Array;
}

/**
 * Password key derivation configuration.
 *
 * This structure describes one key and one ID in the random-length password-derived area. The KDF can provide
 * any sized derived key area, and it is used to include at least one ID and one key. the must not overlap!
 *
 * So, the lower part os always reserved for key ID. It usually occupy 9-16 bytes. Keys are situated after it,
 * one by one. This structure describes only one key in that space, providing all necessary data to generate
 * the space and pick id and key from it. Note that could be more that one options instance that share same KDF
 * parameters. As long as the [[kdfLength]] and [[idLength]] match, the generated area could be shared without
 * re-calculation expensive KDF every time. This is a good idea to derive several keys at once. Together with
 * an ID options can denote any of keys that share same space. Such keys, produced by single KDF invocation,
 * are completely isolated as long as they do not overlap with each other and ID. Isolated mean knowing any of them
 * couldn't help to find other, unless the password is brute forced.
 *
 * The placements of a key in the KDF generated space could be shown as:
 *
 * <table>
 * <tr><th>offset</th><th>length</th><th>description</th><tr>
 *     <tr>
 *         <td> 0 </td>
 *         <td> <code>idLength</code> </td>
 *         <td> <code>tag.id</code>, the ID of e key (group of keys) </td>
 *     <tr>
 *         <td colspan=3 style="text-align: center;">...space for other keys...</td>
 *     </tr><tr>
 *         <td> <code>keyOffset</code> </td>
 *         <td> <code>keyLength</code> </td>
 *         <td> Some symmetric key </td>
 *     </tr><tr>
 *         <td colspan=3 style="text-align: center;">...space for other keys...</td>
 *     </tr>
 * </table>
 *
 * This actually means that the following should be true:
 *
 * ~~~
 *    keyLength + keyOffset > = kdfLength && keyOffset >= idLength
 * ~~~
 *
 * otherwise the structure should be considered broken and not usable.
 *
 */
export interface PKDOptions {
  /**
   * by default PBKDF2
   */
  readonly kdfAlgorithm: string;
  /**
   * KDF rounds
   */
  readonly rounds: number;
  /**
   * KDF salt
   */
  readonly salt: Uint8Array;
  /**
   * KDF hash algorithm
   */
  readonly hashAlgorithm:
    | "sha1"
    | "sha256"
    | "sha384"
    | "sha512"
    | "sha512/256"
    | "sha3_256"
    | "sha3_384"
    | "sha3_512";
  /**
   * Length of this key in bytes, e.g. 32 for AES256
   */
  readonly keyLength: number;
  /**
   * Offset in the keySpace
   */
  readonly keyOffset: number;
  /**
   * The space that KDF generates, it should be enough for at least 1 key and id tag, e.g.
   * `kdfLength >= keyOffset + keyLength && idLength <= keyOffset`. Of it is not true, the
   * structure is broken.
   */
  readonly kdfLength: number;
  /**
   * Length of the tag.id
   */
  readonly idLength: number;
  /**
   * Optional password hint to be displayed at the user prompt where applicable.
   */
  readonly passwordHint?: string;
}

/**
 * The keytag used also to produce a UniversalKey from a password using KDF with specified parameters. Unlike
 * other UniversalKeys, the password and its id are _derived_ from a password using extended  parameters specified in
 * the tag.
 *
 * To restore key from the password, apply specified KDF to the password in question to get
 * keyByteLength + idByteLength long derived bytes, lowest part (0...keyByteLength) should be used to create symmetric
 * key and the rest (keyByteLength...idByteLength) should match the tag.id if the password is OK. Selecting short id
 * length will help to protect against brute force as matching tag will not give high probability of matching the key
 * (e.g. use 2 bytes for id will provide too many false matches). Longer ids reduces ID conflict probability  without
 * compromising the key itself but also making brute force attempt somewhat more straightforward by checking id.
 */
export interface PasswordKeyTag extends UniversalKeyTag {
  type: "password";
  pkdOptions: PKDOptions;
}

export const defaultPKDOptions: PKDOptions = {
  kdfAlgorithm: "PBKDF2",
  rounds: 50000,
  salt: randomBytes(32),
  hashAlgorithm: "sha256",
  idLength: 9,
  keyLength: 32,
  keyOffset: 9,
  kdfLength: 9 + 32
};

// inner constant. Some byte padding for RSA OAEP that we can use, but won't
// for extra security against some poisoning with chosen-ciphertext attacks (considered ineffective,
// but we aren't taking chances)
const MIN_PADDING = 3;

/**
 * Basic form of hash-serialized UniversalKey.
 */
export interface SerializedUniversalKey {
  /**
   * tag part used to identify the key (also not reconstructed when it comes to passwords)
   */
  tag: UniversalKeyTag;
  /**
   * Packed data of the key
   */
  packedKey: Uint8Array;
  /**
   * optional algorithm name, e.g. 'RSA' or 'AES'. Empty means universa default for the `type`.
   */
  algorithm?: string;
  /**
   * Optional algorithm parameters, for example, chaining mode, ETA algorithm, whatever. Empty means
   * Universa defaults.
   */
  options?: any;
}

/* istanbul ignore next */

/**
 * Abstract UniversalKey
 */
export abstract class UniversalKey {
  /**
   * Encrypt with the key using some sort of ETA algorithm. Note that not all keys support
   * both encryption and decryption, though most of them should.
   *
   * @param plaintext
   */
  async encrypt(plaintext: Uint8Array): Promise<Uint8Array> {
    this.notApplicable();
  }

  /**
   * Decrypt with this key checking ETA used with [[encrypt]]. Note that not all keys support
   * both encryption and decryption, though most of them should.
   *
   * @param plaintext
   */
  async decrypt(plaintext: Uint8Array): Promise<Uint8Array> {
    this.notApplicable();
  }

  async sign(_message: Uint8Array): Promise<Uint8Array> {
    this.notApplicable();
  }

  async verify(_message: Uint8Array, _signature: Uint8Array): Promise<boolean> {
    this.notApplicable();
  }

  abstract tag: UniversalKeyTag;

  /**
   * Serialize key and tag into object (key-values) that could be later deserialized with
   * {@link UniversalKeys.loadFrom}.
   */
  abstract async serialize(): Promise<SerializedUniversalKey>;

  protected notApplicable(): never {
    throw new UniversalKeyException("operation is not applicable");
  }
}

/**
 * Universal symmetric key. Should be used with random tags, not derivable from the symmetric key. When
 * generating random, separate random value is used for a tag.
 */
export class UniversalSymmetricKey extends UniversalKey {
  /**
   * Create a random key with a random tag. Because tags are serialized with keys, its a good solution
   * as good as the inner symmetric key is not used separately and the tag.id is not lost.
   */
  static createRandom(): UniversalSymmetricKey {
    return new UniversalSymmetricKey(new SymmetricKey(), randomBytes(32));
  }

  constructor(symmetricKey: SymmetricKey, tag: Uint8Array) {
    super();
    this.key = symmetricKey;
    this.tag = { type: "symmetric", id: tag };
  }

  private readonly key: SymmetricKey;

  readonly tag: UniversalKeyTag;

  get keyBytes(): Uint8Array {
    return this.key.pack();
  }

  async decrypt(ciphertext: Uint8Array) {
    return await this.key.etaDecrypt(ciphertext);
  }

  async encrypt(plaintext: Uint8Array) {
    return await this.key.etaEncrypt(plaintext);
  }

  async serialize() {
    return {
      tag: this.tag,
      packedKey: this.key.pack()
    };
  }

  static deserialize(serialized: any): UniversalSymmetricKey {
    return new UniversalSymmetricKey(
      new SymmetricKey({ keyBytes: serialized.packedKey }),
      serialized.tag.id
    );
  }

  /**
   * Create a key from a binary key (in sense of AES) itself and a tag to associate with. Note that there is no
   * way to create cryptographically strong, e.g. independent, tag from key bytes so we do not try. The most (though
   * not ideally) safe approach is to derive a tag using KDF with many rounds, but it is slow, and not absolutely safe.
   *
   * @param keyBytes
   * @param keyTag if not specified, random tag will be assigned. This is potentially bad situation.
   */
  static fromKey(keyBytes: Uint8Array, keyTag?: Uint8Array) {
    return new UniversalSymmetricKey(new SymmetricKey({keyBytes:keyBytes}), keyTag ?? randomBytes(32));
  }
}

const rsaAlgorithm = "RSA-OAEP";

export class UniversalPrivateKey extends UniversalKey {
  readonly privateKey: PrivateKey;
  readonly publicKey: PublicKey;

  static readonly defaultOptions: PublicKeyEncryptOpts = {
    mgf1Hash: "sha256",
    oaepHash: "sha256",
    pssHash: "sha3_384"
  };

  private readonly options = { ...UniversalPrivateKey.defaultOptions };

  private constructor(privateKey: PrivateKey, options = {}) {
    super();
    this.privateKey = privateKey;
    this.options = { ...this.options, ...options };
    this.publicKey = this.privateKey.publicKey;
    this.tag = { type: "private", id: this.publicKey.longAddress };
  }

  readonly tag: UniversalKeyTag;

  async serialize(): Promise<SerializedUniversalKey> {
    return {
      tag: this.tag,
      packedKey: await this.privateKey.pack(),
      algorithm: rsaAlgorithm,
      options: this.options
    };
  }

  static async deserialize(source: SerializedUniversalKey): Promise<UniversalPrivateKey> {
    /* istanbul ignore next */
    if ((source?.algorithm ?? rsaAlgorithm) != rsaAlgorithm)
      throw new UniversalKeyException("can't deserialize algorithm: " + source.algorithm);
    const key = await PrivateKey.unpack(source.packedKey);
    return new UniversalPrivateKey(key, { ...UniversalPrivateKey.defaultOptions, ...source?.options });
  }

  /**
   * How many bytes we can put inside PK encryption (depends on padding and key size)
   */
  protected async maxDataSize(): Promise<number> {
    return await this.privateKey.publicKey.encryptionMaxLength(this.options);
  }

  async decrypt(ciphertext: Uint8Array) {
    const packed = bossLoad<any>(ciphertext);
    switch (packed[0]) {
      case 0:
        return await this.privateKey.decrypt(packed[1] as Uint8Array, this.options);
      case 1: {
        const [ptk, chunk1] = bossLoad<Uint8Array[]>(
          await this.privateKey.decrypt(packed[1], this.options)
        );
        const tk = new SymmetricKey({ keyBytes: ptk });
        const chunk2 = await tk.etaDecrypt(packed[2]);
        const result = new Uint8Array(chunk1.length + chunk2.length);
        result.set(chunk1, 0);
        result.set(chunk2, chunk1.length);
        return result;
      }
      default:
        /* istanbul ignore next */
        throw new UniversalKeyException(
          "unknown encrypted record type" + packed[0]
        );
    }
  }

  async encrypt(plaintext: Uint8Array) {
    // we suppose some padding should always be
    const maxDataSize = await this.maxDataSize();
    if (plaintext.length + MIN_PADDING < maxDataSize)
      // short and simple
      return bossDump([0, await this.publicKey.encrypt(plaintext, this.options)]);
    else {
      // long plaintext: encrypted temporary key
      const tk = new SymmetricKey();
      const packedTk = tk.pack();
      const chunk1Size = maxDataSize - packedTk.length - MIN_PADDING - 3;
      const chunk1 = plaintext.slice(0, chunk1Size);
      const chunk2 = plaintext.slice(chunk1Size);
      return bossDump([
        1,
        await this.publicKey.encrypt(bossDump([packedTk, chunk1]), this.options),
        await tk.etaEncrypt(chunk2)
      ]);
    }
  }

  /**
   * Asynchronously generate new private key in the worker thread.
   *
   * @param strength in bits, e.g. 2048
   */
  static async generate(strength = 4096): Promise<UniversalPrivateKey> {
    return new UniversalPrivateKey(
      await PrivateKey.generate({ strength: strength })
    );
  }
}

const kdfSpaces = new Map<string, Uint8Array>();
let kdfCacheHits = 0;
let kdfCacheMisses = 0;

/**
 * Strong delete caches. First fill the spaces with 0, then with 1, then release buffers.
 */
export function clearKdfCache() {
  for (const v of kdfSpaces.values()) {
    for (let i = 0; i < v.length; i++) v[i] = 0;
    for (let i = 0; i < v.length; i++) v[i] = 255;
  }
  kdfCacheHits = 0;
  kdfCacheMisses = 0;
  kdfSpaces.clear();
}

export function getKdfCacheHits() {
  return kdfCacheHits;
}

export function getKdfCacheMisses() {
  return kdfCacheMisses;
}

/**
 * Checks params sanity, generates KDF space and caches it for multi-key scenario. Does not generate
 * KDF bytes it there are cached one.
 *
 * @param password to derive from
 * @param params to generate from
 * @return KDF generated bytes
 */
async function getKDFData(password: string, params: PKDOptions): Promise<Uint8Array> {
  // we need password for cache key but we dont want to use it:
  const scrambledPwd = encode64(await sha256(password));
  const key = `${params.kdfAlgorithm}:${params.rounds}:${params.kdfLength}:${params.hashAlgorithm}:${encode64(params.salt)}:${scrambledPwd}`;
  let data = kdfSpaces.get(key);

  if (!data) {
    /* istanbul ignore next */
    if (params.kdfAlgorithm != "PBKDF2")
      throw new Error("unsupported KDF function " + params.kdfAlgorithm);
    /* istanbul ignore next */
    if (params.keyOffset < params.idLength)
      throw new Error("inconsistent KDF data: key overlaps the id");
    /* istanbul ignore next */
    if (params.keyOffset + params.kdfLength < params.kdfLength)
      throw new Error(
        "inconsistent KDF data: key is not contained in the kdfSpace"
      );
    /* istanbul ignore next */
    if (params.idLength < 1 || params.keyLength < 4)
      throw new Error("illegal length parameters");

    // "regular" hash constants are like "sha256" but SHA constructor needs not the prefix
    // otherwise uses same notation:
    data = await pbkdf2(params.hashAlgorithm, {
      rounds: params.rounds, // number of iterations
      keyLength: params.kdfLength, // first key, then tag
      password: password,
      salt: params.salt
    });
    kdfSpaces.set(key, data);
    kdfCacheMisses++;
  } else kdfCacheHits++;
  return data;
}

export interface PasswordKeyOptions {
  password?: string;
  pkdOptions?: Partial<PKDOptions>;
  serialized?: SerializedUniversalKey;
}

export class UniversalPasswordKey extends UniversalKey {
  // private readonly keyBytes: Uint8Array;
  private key?: Promise<SymmetricKey>;
  tag: PasswordKeyTag;

  /**
   * Derive a key from a password optionally using KD options. Automatically uses cached KDF
   * space if it was already calculated.
   *
   * @param password
   * @param pkdOptions
   */
  static async deriveFrom(
    password: string,
    pkdOptions?: Partial<PKDOptions>
  ): Promise<UniversalPasswordKey> {
    const key = new UniversalPasswordKey({ password, pkdOptions });
    await key.waitDerived()
    return key;
  }

  /**
   * Construct a password key either from a password and optional pkdOptions or by deserialize it.
   * We recommend using class-methods for clarity.
   *
   * @param options
   */
  constructor(options: PasswordKeyOptions) {
    super();
    this.key = this.deriveKey(options);
  }

  private async deriveKey(options: PasswordKeyOptions) {
    if (options.password) {
      const params = { ...defaultPKDOptions, ...options.pkdOptions };
      /* istanbul ignore next */
      if (params.kdfAlgorithm != "PBKDF2")
        throw new Error("unsupported KDF function " + params.kdfAlgorithm);
      const bytes = await getKDFData(options.password, params);
      this.tag = {
        type: "password",
        id: bytes.slice(0, params.idLength),
        pkdOptions: { ...params }
      };
      return new SymmetricKey({
        keyBytes: bytes.slice(
          params.keyOffset,
          params.keyOffset + params.keyLength
        )
      });
    } else if (options.serialized) {
      this.tag = options.serialized.tag as PasswordKeyTag;
      return new SymmetricKey({ keyBytes: options.serialized.packedKey });
    } else {
      throw new UniversalKeyException(
        "not consistent password key constructor"
      );
    }
  }


  async decrypt(ciphertext: Uint8Array) {
    return await (await this.key).etaDecrypt(ciphertext);
  }

  get symmetricKey(): Promise<SymmetricKey> {
    return this.key;
  }

  async encrypt(plaintext: Uint8Array) {
    return await (await this.key).etaEncrypt(plaintext);
  }

  async waitDerived() {
    await this.symmetricKey;
  }

  async serialize() {
    // ensure it is derived
    await this.waitDerived();
    return {
      tag: this.tag,
      packedKey: (await this.key).pack()
    };
  }

  /**
   * Create seceral keys derived from the same password using wide outout from the single KDF invocation.
   * Keys are placed adjacent to the id area. The KDF function when using any of these keys is calculated
   * only once.
   *
   * @param password to derive from
   * @param count how many keys to create
   * @param options optional options.
   */
  static async deriveMiltiple(
    password: string,
    count: number,
    options?: Partial<PKDOptions>
  ): Promise<UniversalPasswordKey[]> {
    const o = { ...defaultPKDOptions, ...options, keySize: 32 };
    const opts = { ...o, kdfLength: 32 * count + o.idLength };
    const keys = [];
    for (let i = 0; i < count; i++) {
      // we want to avoid unneccessary recalculations in parallel threads. to make cache
      // work we should not start KDF in parallel (what constructor actually does). So
      // constructor start derivation:
      const k = await UniversalPasswordKey.deriveFrom(password, {
        ...opts,
        keyOffset: opts.idLength + i * opts.keyLength
      });
      // forcing await derivation done and cache warmed:
      // then save it and go further
      keys.push(k);
    }
    return keys;
  }
}

/**
 * Universal keys utilities
 */
export class UniversalKeys {
  /**
   * Load from serialized object. {@linkcode UniversalKey.serialize}
   *
   * @param serialized object (key-value) holding serialized key or boss-packedb inary.
   */
  static async loadFrom(source: Uint8Array | SerializedUniversalKey): Promise<UniversalKey> {
    const serialized: SerializedUniversalKey =
      source instanceof Uint8Array ? bossLoad(source) : source;
    switch (serialized.tag.type) {
      case "symmetric":
        return UniversalSymmetricKey.deserialize(serialized);
      case "private":
        return UniversalPrivateKey.deserialize(serialized);
      case "password":
        return new UniversalPasswordKey({ serialized: serialized });
      default:
        throw new UniversalKeyException(
          "unsupported serialized key type: " + serialized.tag.type
        );
    }
  }
}
