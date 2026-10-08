/**
 * What a key is called out loud.
 *
 * ★★★ A SHORTCUT NOBODY CAN HEAR IS NOT DOCUMENTATION. `⌘` is U+2318 PLACE OF
 * INTEREST SIGN; screen readers say "place of interest sign", or nothing at
 * all. `⌥` is U+2325 OPTION KEY, `⇧` is UPWARDS WHITE ARROW, `↵` is DOWNWARDS
 * ARROW WITH CORNER LEFTWARDS. None of those is the name of the key, and the
 * whole content of a shortcut hint is which keys to press.
 *
 * The second half of the problem is sighted and outside macOS: `⌘` and `⌥` are
 * not glyphs a Windows or Linux user has ever been taught. A hint that renders
 * only the symbol is unreadable to them too — which is why the spoken name is
 * data here rather than something a host remembers to pass.
 */

/** A key: what is drawn, and what is said. */
export interface SvKbdKey {
  /** The glyph or word rendered on the chip. */
  readonly glyph: string;
  /** What a screen reader announces instead. */
  readonly spoken: string;
}

/**
 * The keys this component knows by name.
 *
 * ★ `alt` and `option` are deliberately separate entries rather than aliases.
 * They are the same physical key and they are not the same word: a macOS user
 * reads `⌥` and hears "Option"; a Windows user reads `Alt` and hears "Alt".
 * Collapsing them would make one of the two populations read a key name their
 * keyboard does not have.
 */
export const SV_KBD_KEYS: Readonly<Record<string, SvKbdKey>> = {
  cmd: { glyph: '⌘', spoken: 'Command' },
  command: { glyph: '⌘', spoken: 'Command' },
  ctrl: { glyph: 'Ctrl', spoken: 'Control' },
  control: { glyph: 'Ctrl', spoken: 'Control' },
  opt: { glyph: '⌥', spoken: 'Option' },
  option: { glyph: '⌥', spoken: 'Option' },
  alt: { glyph: 'Alt', spoken: 'Alt' },
  shift: { glyph: '⇧', spoken: 'Shift' },
  win: { glyph: '⊞', spoken: 'Windows' },
  meta: { glyph: '⌘', spoken: 'Command' },
  enter: { glyph: '↵', spoken: 'Enter' },
  return: { glyph: '↵', spoken: 'Return' },
  esc: { glyph: 'Esc', spoken: 'Escape' },
  escape: { glyph: 'Esc', spoken: 'Escape' },
  tab: { glyph: '⇥', spoken: 'Tab' },
  space: { glyph: 'Space', spoken: 'Space' },
  backspace: { glyph: '⌫', spoken: 'Backspace' },
  del: { glyph: '⌦', spoken: 'Delete' },
  delete: { glyph: '⌦', spoken: 'Delete' },
  up: { glyph: '↑', spoken: 'Up arrow' },
  down: { glyph: '↓', spoken: 'Down arrow' },
  left: { glyph: '←', spoken: 'Left arrow' },
  right: { glyph: '→', spoken: 'Right arrow' },
  pageup: { glyph: 'PgUp', spoken: 'Page up' },
  pagedown: { glyph: 'PgDn', spoken: 'Page down' },
  home: { glyph: 'Home', spoken: 'Home' },
  end: { glyph: 'End', spoken: 'End' },
};

/**
 * The same map keyed by glyph, so `key="⌘"` works as well as `key="cmd"`.
 *
 * ★ Hosts already have `⌘` hard-coded in a hundred templates. Making them
 * rewrite it to a token before they can get a spoken name is how a fix ships
 * and never gets adopted.
 */
const BY_GLYPH: Readonly<Record<string, SvKbdKey>> = Object.freeze(
  Object.values(SV_KBD_KEYS).reduce<Record<string, SvKbdKey>>((acc, key) => {
    // First writer wins, so `⌘` resolves to Command rather than to whichever
    // alias happens to come last in the object above.
    if (!acc[key.glyph]) acc[key.glyph] = key;
    return acc;
  }, {}),
);

/**
 * Resolve one token to a key.
 *
 * An unknown token is returned as-is with itself as the spoken name: `K` reads
 * as "K", which is right, and an unrecognised word is better said than
 * swallowed.
 */
export function svKbdKey(token: string): SvKbdKey {
  const raw = token.trim();
  if (!raw) return { glyph: '', spoken: '' };
  return (
    SV_KBD_KEYS[raw.toLowerCase()] ??
    BY_GLYPH[raw] ?? { glyph: raw, spoken: raw }
  );
}

/**
 * Split a chord such as `"cmd+shift+K"` into its keys.
 *
 * A literal `+` is written `"++"`, so `"ctrl+++"` is Control-plus. Empty
 * segments are dropped rather than rendering an empty chip.
 */
export function svKbdChord(chord: string): SvKbdKey[] {
  const out: SvKbdKey[] = [];
  const parts = chord.split('+');
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '' && parts[i + 1] === '') {
      out.push(svKbdKey('+'));
      i++;
      continue;
    }
    const key = svKbdKey(parts[i]);
    if (key.glyph) out.push(key);
  }
  return out;
}

/**
 * What the whole chord is announced as.
 *
 * Joined with spaces rather than "plus": a screen reader reading "Command plus
 * Shift plus K" spends three of its six words on punctuation, and the pause
 * between names already carries the grouping.
 */
export function svKbdSpoken(keys: readonly SvKbdKey[]): string {
  return keys.map((k) => k.spoken).filter(Boolean).join(' ');
}
