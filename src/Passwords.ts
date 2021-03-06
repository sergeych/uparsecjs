/**
 * Utility class to weight password characters strength against a brute force attack
 * considering no dates, keyboard sequences and words are used...
 */
class CharacterClass {
  private charset = new Set<string>();
  private readonly _strength: number;

  id: string;

  constructor(source: string) {
    for (const x of source) this.charset.add(x);
    this._strength = Math.log2(this.charset.size);
    this.id = source;
  }

  get strength() {
    return this._strength;
  }

  contains(ch: string): boolean {
    return this.charset.has(ch);
  }
}

const downLetters = "qwertyuiopasdfghjklzxcvbnm";
const upLetters = downLetters.toUpperCase();
const digits = "1234567890";
const frequentPunctuation = "_-+=!@#$%^&*()?/<>,.";

const characterClasses = [
  downLetters,
  upLetters,
  digits,
  frequentPunctuation
].map((src: string) => new CharacterClass(src));

/**
 * General password manipulating utilities.
 */
export class Passwords {
  /**
   * Calculate estimated bits-length strength equivalent against the brute force. The
   * estimation is more effective if the character used are really random. It does not
   * analyze against repeating sequences, well known patterns and words and dates that
   * will not be detected and render password weak despite what this function returns.
   *
   * @param pwd
   */
  static estimateBitStrength(pwd: string): number {
    pwd = pwd.trim();
    // known characters set
    const used = new Set<CharacterClass>();
    // we may encounter characters not from known sets (emoji, national characters, etc)
    let nonClassifiedChars = false;
    for (const ch of pwd) {
      let classFound = false;
      for (const cls of characterClasses) {
        if (cls.contains(ch)) {
          used.add(cls);
          classFound = true;
          break;
        }
      }
      if (!classFound)
        // not belongs to any class - remember it
        nonClassifiedChars = true;
    }
    let totalBits = 0;
    for (const cls of used) totalBits += cls.strength;

    if (nonClassifiedChars) totalBits += 5; // we are pessimists... suppose it's single case national charset

    return totalBits * pwd.length;
  }

  private static idChars =
    "1234567890_qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM";

  /**
   * Create random string of a given length constructed from characters that are
   * ok for most ids (e.g. letters digits and _)
   * @param length
   */
  static randomId(length = 12): string {
    const l = this.idChars.length;
    let result = "";
    while (result.length < length) {
      result += this.idChars[Math.floor(Math.random() * l)];
    }
    return result;
  }
}
