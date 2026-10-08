/**
 * password-strength.ts — dependency-free password *guidance*.
 *
 * ★ THIS IS ADVICE, NOT A MEASUREMENT, and the naming here says so on purpose.
 *
 *   The previous version called its output a `score` and handed back a number
 *   from 0 to 4. Two things went wrong with that. A number reads as a
 *   measurement of how hard the password is to crack, which no client-side
 *   heuristic can know — the answer depends on the attacker's wordlist, not on
 *   the characters. And a score built out of character classes pushes hosts
 *   into composition rules, which is the one thing the evidence is clear about:
 *   demanding an uppercase, a digit and a symbol produces `Password1!` and
 *   measurably weaker passwords than asking for length (NIST SP 800-63B §5.1.1
 *   recommends against composition rules, and against the periodic rotation
 *   they usually travel with).
 *
 *   So: length dominates the band, variety can add one point and only after the
 *   length minimum is met, and the suggestions lead with "make it longer" rather
 *   than a list of character classes to satisfy. The band is a hint about
 *   *guessability patterns this code can actually see* — common passwords,
 *   sequential runs, repeated runs, and shortness.
 *
 * Not a port of zxcvbn (a large statistical, dictionary-backed library — the
 * kind of dependency this kit avoids). And not a breach check: the only signal
 * here that is real evidence comes from the host, via
 * {@link PasswordBreachStatus}, because that requires a server.
 */

/**
 * How the guidance reads, 0 (weakest patterns) – 4. Deliberately a *band*, not a
 * score: it names a range of advice, and no arithmetic should be done with it.
 */
export type PasswordStrengthBand = 0 | 1 | 2 | 3 | 4;

/**
 * What the host's breach check knows. An enum rather than a boolean, and
 * `unavailable` is why.
 *
 * A breach lookup is a network call to a third party that times out,
 * rate-limits and 500s. A boolean forces every outage to be read as one of the
 * two real answers — and "we could not check" read as "breached" locks people
 * out of their own sign-up, while read as "safe" quietly claims a check that
 * never happened.
 */
export type PasswordBreachStatus =
  /** Nothing has been checked; the host is not offering the signal. */
  | 'unknown'
  /** A check is in flight. */
  | 'checking'
  /** Checked, and this password is not in the corpus the host consulted. */
  | 'safe'
  /** Checked, and it appeared. The one signal here that is evidence. */
  | 'breached'
  /** The check could not be completed. Not a verdict, and never a blocker. */
  | 'unavailable';

export interface PasswordGuidance {
  /** How the advice reads. See {@link PasswordStrengthBand}. */
  readonly band: PasswordStrengthBand;
  /** Human wording for the band, e.g. 'Fair'. */
  readonly label: string;
  /** Up to three short, actionable hints, most important first. */
  readonly suggestions: readonly string[];
  /**
   * True when the guidance is driven by the host's breach signal rather than by
   * the local heuristic — i.e. the one case where it rests on evidence.
   */
  readonly fromBreachCheck: boolean;
}

export interface PasswordGuidanceOptions {
  /** The host's own minimum length. Advice is measured against this. @default 12 */
  readonly minLength?: number;
  /** What the host's breach check knows, if it runs one. @default 'unknown' */
  readonly breach?: PasswordBreachStatus;
}

export const PASSWORD_STRENGTH_LABELS: readonly string[] = [
  'Very weak',
  'Weak',
  'Fair',
  'Good',
  'Strong',
];

/** A short list of the most commonly reused/breached passwords. Matched case-insensitively. */
const COMMON_PASSWORDS = new Set<string>([
  'password', 'password1', 'password123', '123456', '123456789', '12345678',
  '12345', '1234567', 'qwerty', 'qwerty123', 'letmein', 'welcome', 'admin',
  'iloveyou', 'monkey', 'dragon', 'sunshine', 'princess', 'football',
  'abc123', '111111', '000000', 'passw0rd', 'trustno1', 'login', 'starwars',
]);

/** Keyboard/alphabet/digit runs checked (forward and reverse) for sequential patterns. */
const SEQUENCES = [
  'abcdefghijklmnopqrstuvwxyz',
  '0123456789',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
];

/**
 * The one hint worth leading with. Length is the lever that actually moves
 * guessability, and a passphrase is how people reach length without a
 * password manager.
 */
const LENGTHEN = 'Longer is stronger — four or five unrelated words beat a short, complicated password.';

function hasSequentialRun(lower: string, runLength = 4): boolean {
  for (const seq of SEQUENCES) {
    for (let i = 0; i <= seq.length - runLength; i++) {
      const forward = seq.slice(i, i + runLength);
      const reverse = [...forward].reverse().join('');
      if (lower.includes(forward) || lower.includes(reverse)) return true;
    }
  }
  return false;
}

function hasRepeatedRun(s: string, runLength = 4): boolean {
  let run = 1;
  for (let i = 1; i < s.length; i++) {
    run = s[i] === s[i - 1] ? run + 1 : 1;
    if (run >= runLength) return true;
  }
  return false;
}

function guidance(
  band: PasswordStrengthBand,
  suggestions: readonly string[],
  fromBreachCheck = false,
): PasswordGuidance {
  return {
    band,
    label: PASSWORD_STRENGTH_LABELS[band],
    suggestions: [...new Set(suggestions)].slice(0, 3),
    fromBreachCheck,
  };
}

/**
 * Turns a password into advice. Dependency-free, runs entirely client-side, and
 * says nothing about how long the password would survive an attack.
 *
 * ★ A `breached` status overrides the heuristic entirely. Length and variety are
 *   guesses about guessability; "this exact string is in a breach corpus" is a
 *   fact, and it is the only thing here worth overriding everything else.
 */
export function evaluatePassword(
  password: string,
  options: PasswordGuidanceOptions = {},
): PasswordGuidance {
  const minLength = options.minLength ?? 12;
  const breach = options.breach ?? 'unknown';

  if (breach === 'breached') {
    return guidance(0, ['This password has appeared in a data breach. Choose a different one.'], true);
  }

  if (!password) {
    return guidance(0, ['Enter a password']);
  }

  const suggestions: string[] = [];
  let points = 0;

  // ★ Length carries the band. Three of the four points available come from
  //   here, so no amount of punctuation rescues a six-character password.
  if (password.length >= minLength) points += 1;
  else suggestions.push(`Use at least ${minLength} characters`);
  if (password.length >= minLength + 4) points += 1;
  if (password.length >= minLength + 8) points += 1;

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(password)).length;
  // One point, and only once the length minimum is met. Variety on a short
  // password is what composition rules reward and attackers already expect.
  if (points >= 1 && classes >= 3) points += 1;

  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) {
    points = 0;
    suggestions.unshift('This is one of the most-guessed passwords. Pick something else.');
  } else {
    if (hasSequentialRun(lower)) {
      points -= 1;
      suggestions.push('Avoid runs like "abcd" or "1234" — they are the first thing guessed.');
    }
    if (hasRepeatedRun(lower)) {
      points -= 1;
      suggestions.push('Avoid repeated characters like "aaaa".');
    }
  }

  if (password.length < minLength + 8) suggestions.push(LENGTHEN);

  if (breach === 'unavailable') {
    suggestions.push('We could not check this against known breaches right now.');
  }

  const band = Math.max(0, Math.min(4, points)) as PasswordStrengthBand;
  return guidance(band, suggestions);
}
