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

  private static strongPasswordChars =
    Passwords.idChars + "!@#$%^&*()-_=+\\|<>'\"/?.>,<`~[]{}:;"

  private static limitedPasswordChars =
    Passwords.idChars + "?!$+-/.,@ˆ_"



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
  /**
   * Generate random strong password of a give size and estimated strength. It is __strongly recommended__ not to alter
   * default values which are reasonably good. Note that length should be long enough or generator will fail with error
   * after 1000 attempts.
   *
   * @param length desired password length. Password will be of this length, exactly.
   * @param minStrength minimum estimated strength, in bits.
   * @param limitedSet do not use extended set of punctuation characters to comply with some low security old services
   *                   wchich impose severe restriction on passwords (to make it breakable?)
   * @throws Error if failed to generate the password of desired length and strength after 1000 attempts.
   */
  static create(length=12, minStrength= 256,limitedSet=false): string {
    const chars = limitedSet ? Passwords.limitedPasswordChars : Passwords.strongPasswordChars
    function g() {
      const l = chars.length;
      let result = "";
      while (result.length < length) {
        result += chars[Math.floor(Math.random() * l)];
      }
      return result;
    }
    let attempt = 1000;
    while(attempt-- > 0) {
      const password = g();
      if( Passwords.estimateBitStrength(password) >= minStrength ) {
        console.log("attempts: "+(1000-attempt));
        return password;
      }
    }
    throw new Error("Can't generate password of 256+ bits strength with length "+length);
  }
}
