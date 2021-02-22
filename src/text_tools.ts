/**
 * Universa text objects allow ti embed universa objects into text focuments, e.g. markdown,
 * plain text, html, whatever, detect such objects presence and extract them. I allows create
 * free form human readable documents with embedding necessary objects directly into the text.
 * @module text_tools
 */c
import { decode64, encode64, PrivateKey, PublicKey } from "unicrypto";
import { bossLoad, bytesToUtf8, sha256 } from "./index";

export type PackedObjectType = "unknown" | "unencrypted private key" | "encrypted private key" |
  "public key" | "contract";

/**
 * Interface describing universa binary object for embedded text format
 */
export interface PackedTextObject {
  /**
   * Object binary data
   */
  packed: Uint8Array,
  /**
   * Object type string
   */
  type: string,
  /**
   * Optional name of the file the object was imported from (or intended to be exported to)
   */
  fileName?: string,
  /**
   * this field is used by formatter and set by the parser, detected sparator line width or
   * desired block with when formatting an object.
   */
  width?: number
}

/**
 * Parsed entry describing embedded text object inside some text document.
 */
export interface EmbeddedTextObject {
  /** index of the first line of the entry (beginning separator string) in the text
   */
  firstLine: number,
  /** index if the last line of the entry (ending separator string) in the text, so the
   *  text entry takes range from first to last line, inclusive.
   */
  lastLine: number,
  /** Parsed object data. Exists only if parsed with no errors, e.g. `errors.length == 0`.
   */
  packedObject?: PackedTextObject,
  /** possibly empty list of errors found. If it is empty, then `packedObject` contains valid parsed object,
   *  and vice versa.
   */
  errors: string[]
}

/**
 * 2 way padding. Attempts to pad some string with padding string by repeatedly adding it to the beginning then to the
 * end until the desired width is achieved.
 *
 * @param source string to pad.
 * @param padding pattern to pad with
 * @param width the minimal required result string width
 * @return padded string. if padding is wider than one character, it could be wider than width.
 */
export function symmetricPad(source: string, padding: string, width: number): string {
  let cnt = 0;
  while (source.length < width) {
    if ((cnt++ & 1) == 1) source = '=' + source;
    else source += '='
  }
  return source;
}

/**
 * Break string to array of strings with desired width. All strings except the last one will have specified
 * width, last one could be also shorter, but not enpty.
 * @param source to break
 * @param width desired width
 */
export function breakString(source: string, width: number): string[] {
  const parts = new Array<string>();
  let pos = 0;
  const length = source.length;
  while (pos < length) {
    let n = pos + width;
    if (n > length) n = length;
    parts.push(source.slice(pos, n));
    pos = n;
  }
  return parts;
}

/**
 * Tools to convert universa objects to embeddable text representation.
 */
export class UniversaTextObjectFormatter {
  /**
   * Convert some binary object with metadata to universa embeddable text object record. Important
   * is that params can contain more fields than required minimum, all extra fields will be saved in
   * as `fields` in the text block.
   *
   * @param params object description.
   */
  static async format<T extends PackedTextObject>(params: T): Promise<string> {
    const width = params.width ?? 80;

    const body: string[] = [];
    for (const k in params) {
      if (k != "width" && k != "packed")
        body.push(`${k}: ${params[k]}`.trim());
    }
    body.push("");
    body.push(...breakString(encode64(params.packed), width));
    body.push("");

    const hash = encode64(await sha256(body.join("")));
    const output: string[] = [];
    output.push(symmetricPad(`==== Begin Universa Object: ${hash} ====`, '=', width));
    output.push(...body);
    output.push(symmetricPad(`==== End Universa Object: ${hash} ====`, '=', width) + "\n");
    return output.join("\n")
  }
}

/**
 * Escape string to use inside the regexp pattern
 * @param source string to escape
 */
export function regExpEscape(source: string): string {
  return source.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&');
}

/** Universa embedded text object format parser. Takes a text and detects and parses all
 * the embedded objects
 */
export class UniversaTextObjectParser {

  private readonly lines: string[];
  private readonly scannedObjects: Promise<EmbeddedTextObject[]>;

  /**
   * Create parser for a given source. Asynchronous parsing starts immediately. Use {@link objects} (await it)
   * @param source
   */
  constructor(public source: string) {
    this.lines = source.split("\n");
    this.scannedObjects = this.scan();
  }

  private async scan(): Promise<EmbeddedTextObject[]> {
    const entries = new Array<EmbeddedTextObject>();
    let entryEnd: RegExp | null = null;
    let hash: string | null = null;
    let entryStart = -1;
    for (const [index, line] of this.lines.entries()) {
      if (entryEnd == null) {
        // we did not find object entry beginning
        const m = line.match(/^\s*===+ Begin Universa Object: (\S{44}) ===+\s*$/);
        if (m != null && m.length == 2) {
          entryStart = index;
          hash = m[1];
          entryEnd = new RegExp(`^\\s*===+ End Universa Object: ${regExpEscape(hash)} ===+\\s*$`);
        }
      } else {
        // we are scanning
        if (line.match(entryEnd)) {
          entries.push(await this.analyseObject(entryStart!, index, hash!));
          entryEnd = null;
        }
      }
    }
    Object.freeze(entries);
    return entries;
  }

  /**
   * Get promise to array of parsed objects.
   */
  get objects(): Promise<EmbeddedTextObject[]> {
    return this.scannedObjects;
  }

  private extractLines(start: number, end: number): string[] {
    const result = new Array<string>();
    for (const s of this.lines.slice(start + 1, end)) result.push(s.trim());
    return result;
  }

  private async analyseObject(start: number, end: number, hash: string): Promise<EmbeddedTextObject> {
    const width = this.lines[start].trim().length;
    const source = this.extractLines(start, end);
    const o: EmbeddedTextObject = { firstLine: start, lastLine: end, errors: [] };

    if (hash != encode64(await sha256(source.join("")))) {
      o.errors.push("invalid hash");
      return o;
    }

    let i = 0;
    const fields = {};
    while (true) {
      const line = source[i++].trim();
      if (line.length == 0) break;
      const [name, value] = line.split(":", 2);
      fields[name.trim()] = value.trim();
    }
    if (!fields["type"]) {
      o.errors.push("missing type field");
      return o;
    }

    let packedText = "";
    while (i < source.length) {
      packedText += source[i++].trim();
    }
    if (packedText.length < 4) {
      o.errors.push("empty packed object");
      return o;
    }
    try {
      o.packedObject = { ...fields, width, packed: decode64(packedText), type: fields["type"] }
    } catch (e) {
      o.errors.push("failed to decode base64")
    }
    return o;
  }
}

/**
 * Tries to determine type of the packed universa binary object by investigating its contents.
 *
 * @param packed, see {@link PackedObjectType}
 */
export async function guessUniversaObjectType(packed: Uint8Array): Promise<PackedObjectType> {
  try {
    const data: any = bossLoad(packed);
    if (data instanceof Array) {
      // array mean we should have magic number:
      const magick = data[0];
      switch (magick) {
        case 0:
          await PrivateKey.unpack(packed);
          return "unencrypted private key";
        case 1:
          await PublicKey.unpack(packed);
          return "public key";
        case 2:
          // not that easy... we can't unpack it
          if (data.length >= 6 && typeof (data[3]) == 'string' && data[3].toString().startsWith('HMAC_'))
            return "encrypted private key";
      }
    } else if (data instanceof Object) {
      switch (data.__type) {
        case 'TransactionPack':
          return 'contract';
      }
    }
  } catch (e) {
    console.debug("failed to guess packed object type: " + e);
  }
  return "unknown";
}