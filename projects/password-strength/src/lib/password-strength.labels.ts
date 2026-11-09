/**
 * The English text `sv-password-strength` renders. Override any of it with
 * `provideSvLabels({ passwordStrength: { … } })` from `@styloviz/core`.
 */
export interface SvPasswordStrengthLabels {
  /** The meter's group name, which also opens the announcement. */
  readonly group: string;
  /** The band text while the field is empty. */
  readonly noPasswordEntered: string;
  /** The band names, weakest first (`PASSWORD_STRENGTH_LABELS`). */
  readonly bandVeryWeak: string;
  readonly bandWeak: string;
  readonly bandFair: string;
  readonly bandGood: string;
  readonly bandStrong: string;
  /** Suggestion while the field is empty. */
  readonly enterPassword: string;
  /** Suggestion below the minimum. `{minLength}` is the host's minimum length. */
  readonly useAtLeast: string;
  readonly commonPassword: string;
  readonly avoidSequences: string;
  readonly avoidRepeats: string;
  /** The lead hint: length beats complexity. */
  readonly lengthen: string;
  /** Breach notice while the host's check runs. */
  readonly breachChecking: string;
  /** Breach notice when the password was not found. */
  readonly breachSafe: string;
  /** Breach notice — and the only suggestion — when the password was found. */
  readonly breachBreached: string;
  /** Breach notice — and a suggestion — when the check could not run. */
  readonly breachUnavailable: string;
}

export const SV_PASSWORD_STRENGTH_LABELS: SvPasswordStrengthLabels = {
  group: 'Password strength',
  noPasswordEntered: 'No password entered',
  bandVeryWeak: 'Very weak',
  bandWeak: 'Weak',
  bandFair: 'Fair',
  bandGood: 'Good',
  bandStrong: 'Strong',
  enterPassword: 'Enter a password',
  useAtLeast: 'Use at least {minLength} characters',
  commonPassword: 'This is one of the most-guessed passwords. Pick something else.',
  avoidSequences: 'Avoid runs like "abcd" or "1234" — they are the first thing guessed.',
  avoidRepeats: 'Avoid repeated characters like "aaaa".',
  lengthen: 'Longer is stronger — four or five unrelated words beat a short, complicated password.',
  breachChecking: 'Checking this against known breaches…',
  breachSafe: 'Not found in the breach list we checked.',
  breachBreached: 'This password has appeared in a data breach. Choose a different one.',
  breachUnavailable: 'We could not check this against known breaches right now.',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    passwordStrength: SvPasswordStrengthLabels;
  }
}
