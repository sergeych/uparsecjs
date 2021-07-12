/**
 * Convert integer number to hex form filling with insignificant zeroes to specified with,
 * if shorter. Longer numbers are left  intact (e.g. wider than requested).
 *
 * @param value to convert.
 * @param width desired with
 */
export function hexNumber(value: number, width: number): string {
  let result = value.toString(16);
  while(result.length < width) result = "0"+result;
  return result;
}

/**
 * Create a text dump, 16 bytes in line, showing byte codes and ASCII
 * symbols, starting with address.
 *
 * @param data binary data to dump
 * @return array of dump lines.
 */
export function binaryDumpLines(data: Uint8Array): string[] {
  const lines: string[] = [];
  let address = 0;
  let offset = 0;
  let hexPart = "";
  let asciiPart = ""
  const  addressWidth = data.length.toString(16).length

  while(address < data.length) {
    const index = address + offset;
    if( index < data.length ) {
      const b = data[index];
      hexPart += hexNumber(b, 2) + " ";
      if( b >= 32 && b < 127 ) asciiPart += String.fromCharCode(b);
      else asciiPart += ".";
    }
    else {
      hexPart += "   ";
      asciiPart += " ";
    }
    if( ++offset == 16) {
      lines.push(`${hexNumber(address,addressWidth)}: ${hexPart} |${asciiPart}|`);
      asciiPart = "";
      hexPart = "";
      offset = 0;
      address += 16;
    }
  }
  return lines;
}

/**
 * Create text dump of binary data, as a string with line breaks. See [[binaryDumpLines]] for
 * format description.
 *
 * @param data binary data to dump
 * @return dump as a string
 */
export function binaryDump(data: Uint8Array): string {
  return binaryDumpLines(data).join("\n");
}
