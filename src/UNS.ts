// noinspection ExceptionCaughtLocallyJS

import { CachedValue } from "./CachedValue";

function _calculateExclusions(): string[] {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  return excludedNames.map(name => UNS.reduce(name) )
}

const DEFAULT_XLAT1 = `
# Combining diacritical marks, see https://en.wikipedia.org/wiki/Combining_Diacritical_Marks

U+0300:U+033C
U+033D          x
U+033E:U+0362
U+0363          a
U+0364          e
U+0365          i
U+0366          o
U+0367          u
U+0368          c
U+0369          d
U+036A          h
U+036B          m
U+036C          r
U+036D          t
U+036E          v
U+036F          x

#
# replacing ligatures ------------------------
#

ꜳ           aa
æ            ae
ꜵ           ao
ꜷ           au
ꜹ           av
ꜻ           av
ꜽ           ay
U+1F670     et
ﬀ           ff
ﬃ          ffi
ﬄ          ffl
ﬁ           phi
ﬂ           fl
œ           oe
ꝏ          oo
ß           ss
ﬆ           st
ﬅ           st
ꜩ           tz
ᵫ           ue
ꝡ           vy
`

const DEFAULT_XLAT2 = ` 
#
# Glyph archetypes
#

# Cyrillic letters

а a
б b

в b  # May be similar in uppercase

г 2  # In some fonts. RFC!
д
е e
ж x
з 3
и u
к k
л n
м m
н h
о o
п n
р p
с c
т t
у y
ф
х x
ц u
ч 4
ш
щ ш
ьъ b
ы bi
э 3
ю io
я 9

# Other national languages for characters that will not be
# normalized with NFKD to latin set. Do not put here any
# characters with diacritic modifications removed by NFKD normalization.
`
const DEFAULT_XLAT2_FINALIZER = `
#
# Final similarity corrections table
#
# English correcting similar-looking glyphs. This section MUST be the last
# AND should alter XLAT 2 table the following way:
#
# foreach ch in final
# - if xlat2[*] =

  # first init all with self, for simplicity:
a:z
0:9

# Now replace similar glyphs to archetypes:

il1|!  1
o0øº   0
u      v
w      vv
$s     5
b      6

# Punctuation placeholder:
_

# Cluster delimiter
.
`;

const excludedNames = [
  "sergeych",
  "sergeych2",
  "real_sergeych",
  "real sergeych",
  "sergey chernov",
  "chernov sergey",
  "sergey s. chernov",
  "universa",
  "uni",
  "myo",
  "myonly",
  "myonly.cloud",
  "myonlycloud",
  "myonly.cloud",
  "myonly.cloud",
  "myonly.cloud"
];

const reSpaceDelimiter = /\s+/;
const reRange = /^(.+):(.+)$/;
const reNotUchar = /^(?!U\+)/;
const rePunctuation = /([-_=+()*&^%#@±§~`<,>\\/?'";:{}[\]]|\s)+/g;


/**
 * Decode __single__ character from XLAT table definition (e.g. U+code | <char>). Does not detects
 * ranges, etc.
 * @param characterDefinition
 * @return a pair [character_code,character]
 */
function decode(characterDefinition: string): [number, string] {
  const ch = characterDefinition.trim();
  if (ch.startsWith("U+")) {
    const code = parseInt(ch.substring(2), 16);
    return [code, String.fromCharCode(code)]
  }
  return [ch.charCodeAt(0), ch[0]];
}


function readXlat(xlat: string, missing?: string): Map<string, string> {
  const all = new Map<string, string>();
  for (const l of xlat.split(/\r\n|\r|\n/)) {
    const line = l.split('#', 2)[0].trim();
    try {
      if (line.length > 0) {
        const parts = line.split(reSpaceDelimiter);
        const left = parts[0];
        const right = parts[1];
        const it = left.match(reRange);
        if (it) {
          // we got the start:stop range:
          const start = decode(it[1])[0];
          const stop = decode(it[2])[0];
          for (let code = start; code <= stop; code++) {
            const ch = String.fromCharCode(code);
            // replace each with supplied char, default from args, or the source character:
            all.set(ch, (right ?? missing ?? ch));
          }
        } else {
          const it = left.match(reNotUchar);
          if (it) {
            // 1+ regular characters in xlat, each is matching the same result:
            for (const ch of left) {
              // replace each with supplied char, default from args, or the source character:
              const result = right ?? missing ?? ch;
              all.set(ch, result);
            }
          } else {
            // single U+code, must have replacement
            if (!right && !!missing) throw new Error("reduce internal error: replacement should not be empty")
            all.set(decode(left)[1], right ?? left);
          }
        }
      }
    } catch (e) {
      console.error("error in line: $line");
      throw e;
    }
  }
  return all;
}

const xlat2: Map<string, string> = (() => {
  const result = readXlat(DEFAULT_XLAT2);
  for (const [finalKey, finalValue] of readXlat(DEFAULT_XLAT2_FINALIZER)) {
    // finalizer algorithm: if it overrides result's value, alter it
    // not effective at build time, but more effective when processing strings
    // update all existing values according to final update table
    const affectedKeys = new Set<string>();
    for (const [k, v] of result) {
      if (v == finalKey) affectedKeys.add(k)
    }
    for (const k of affectedKeys) result.set(k, finalValue);
    result.set(finalKey, finalValue);
  }
  return result;
})();

const xlat1 = readXlat(DEFAULT_XLAT1, "");

// noinspection JSUnusedGlobalSymbols
/**
 * The supset of Universa UNS to work with names.
 */
export class UNS {

  /**
   * Exception thrown on invalid (non-reducible) character in name.
   */
  static Exception = class extends Error {}

  /**
   * Calculate UNS2-reduced name for a given source. The reduce algorithm tries to repel "look-alike" attacks trying
   * to reduce any name to some supertype same for all look-alike other words.
   * @param source to reduce
   * @throws UNS.Exception if some characters are not yet supported.
   */
  static reduce(source: string): string {
    // step 1: remove space and punctuation
    const name = source.toLowerCase().trim().replace(rePunctuation,"_")
    // step 2: NFKD
    const name2 = name.normalize("NFKD");
    // step 3: XLAT1: removing composing characters and ligatures
    let name3 = "";
    for( const it of name2) {
      name3 += xlat1.get(it) ?? it
    }
    // step 4: reduce to glyph archetype
    let result = "";
    for( const it of name3) {
      const x = xlat2.get(it);
      if( !x ) throw new this.Exception(`illegal character '${it}' in ${name3}`)
      result += x;
    }
    return result;
  }

  private static cachedExcludes = new CachedValue<Set<string>>(()=> new Set(_calculateExclusions()));
  /**
   * Reduced names that are often rejected by services when used for registration
   */
  static reducedRegistrationExcludedNames: Set<string> = UNS.cachedExcludes.value;
}

