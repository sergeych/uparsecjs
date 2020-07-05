/*eslint no-constant-condition: ["error", { "checkLoops": false }]*/

import { encode64, decode64 } from 'unicrypto'

/**
 * Awaitable timeout (yeah, again, reinventing the wheel every day).
 * @param millis to wait for.
 */
export async function timeout(millis: number): Promise<void> {
  return new Promise((resolve, _) => setTimeout(resolve, millis));
}

/**
 * Execute some function up to `times` times until it return. Catches any exception it may
 * throw and retry specified number ot `times` thed throws the last exception. The function
 * can be async, then it will be awaited. The retry() is always async despite the function type
 * as it may wait for a timeout between attempts.
 *
 * @param times how many retry attempts to perform
 * @param intervalMills interval between anntemps
 * @param f function to execute. Could be async.
 */
export async function retry<T>(
  times: number,
  timeoutInMillis: number,
  f: () => T
): Promise<T> {
  let attempt = 1;
  while (true) {
    try {
      const result = f();
      if (result instanceof Promise) await result;
      return result;
    } catch (e) {
      if (attempt++ >= times) throw e;
      await timeout(timeoutInMillis);
    }
  }
}

// nodejs polyfill
/* istanbul ignore next */
if (!window.TextDecoder || !window.TextEncoder) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {
    TextEncoder,
    TextDecoder
  } = require("fastestsmallesttextencoderdecoder");
  window.TextEncoder = TextEncoder;
  window.TextDecoder = TextDecoder;
}

const te = new TextEncoder();
const td = new TextDecoder("utf-8");

/**
 * Utf8 encode string returning byte array. Nodejs and browser compatible.
 * @param str string to convert
 */
export function utf8ToBytes(str: string): Uint8Array {
  // the polyfill fastestsmallest... is buggy, returns buffer actually, this is a fix
  return new Uint8Array(te.encode(str));
}

/**
 * Utf8 decodes byte sequence into a string. Browser and nodejs compatible.
 * @param bytes to restore to string.
 */
export function bytesToUtf8(bytes: Uint8Array): string {
  return td.decode(bytes);
}

/**
 * Convert an unsigned number (possibly long one) into array of bytes MSB first (big endian), the same byte order used
 * by Java/Scala BigIntegers so they are mutually interoperable. The length of the array is autmatic just to hold the
 * specified number. If some specific minimal length is needed, _prepend it with zeroes_. See also
 * {@linkcode byteArrayToLong}.
 *
 * @param longNumber number to convert
 * @return array of bytes, MSB first, LSB last.
 */
export function longToByteArray(longNumber: number): Uint8Array {
  if (longNumber == 0) return Uint8Array.of(0);
  const byteArray = Array<number>();
  while (longNumber > 0) {
    const byte = longNumber & 0xff;
    byteArray.push(byte);
    // We need floor as for big number js uses floats. Otherwise we have to ise bug number here
    longNumber = Math.floor((longNumber - byte) / 256);
  }
  return Uint8Array.from(byteArray.reverse());
}

/**
 * Convert byte array of various length, MSB first and LSB last (big endian) into unsigned number.
 * This byte order and variable length matchers java/scala BigInteger format. See {@linkcode longToByteArray} for
 * reverse operation.
 *
 * @param byteArray to convert
 * @return converted number.
 */
export function byteArrayToLong(byteArray: Uint8Array): number {
  let value = 0;
  for (let i = 0; i <= byteArray.length - 1; i++) {
    value = value * 256 + byteArray[i];
  }
  return value;
}

/**
 * encode binary data with the alternative base64 alphabet to be used in the URL/query without escaping
 * @param data to encode
 * @return encoded data as string
 */
export function encode64url(data: Uint8Array): string {
  let result = encode64(data)
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  while (result[result.length - 1] === "=")
    result = result.substring(0, result.length - 1);
  return result;
}

/**
 * Decode urlencoded data, see {@link encode64url}.
 * @param encodedString encoded data taken from URL (path or query)
 * @return decoded binary data
 */
export function decode64url(encodedString: string): Uint8Array {
  const result = encodedString.replace(/-/g, "+").replace(/_/g, "/");
  // padding with = is actually not needed:
  // while(result.length % 4 != 0 ) result += '=';
  return decode64(result);
}

export function equalArrays<T>(a: ArrayLike<T>, b: ArrayLike<T>): boolean {
  if (a.length != b.length) return false;
  for(let i=0; i<a.length; i++)
    if (a[i] != b[i]) return false;
  return true;
}
