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

import { SV_KBD_LABELS, type SvKbdLabels } from './kbd.labels';

/**
 * Which keyboard the shortcut is drawn for. `apple` resolves the `mod` token to
 * Command (⌘); `other` resolves it to Control.
 */
export type SvKbdPlatform = 'apple' | 'other';

/**
 * The platform this page is running on — `apple` on macOS and iOS/iPadOS,
 * `other` everywhere else.
 *
 * ★ ON THE SERVER THERE IS NO NAVIGATOR, so a prerender answers `other` and a
 *   `mod` chip prerenders as "Ctrl". That is stated rather than guessed: an
 *   Apple visitor sees it switch to ⌘ on hydration. A host that knows better
 *   (a user-agent header, a saved preference) passes `platform` explicitly.
 */
export function svKbdPlatform(): SvKbdPlatform {
  if (typeof navigator === 'undefined') return 'other';
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const name = nav.userAgentData?.platform || nav.platform || '';
  return /Mac|iPhone|iPad|iPod|macOS|iOS/i.test(name) ? 'apple' : 'other';
}

/** A key: what is drawn, and what is said. */
export interface SvKbdKey {
  /** The glyph or word rendered on the chip. */
  readonly glyph: string;
  /** What a screen reader announces instead. */
  readonly spoken: string;
}

/** The labels that hold a word drawn on a key cap. */
type SvKbdGlyphLabel = Extract<keyof SvKbdLabels, `glyph${string}`>;

/**
 * A known key: its glyph — a symbol, or the label holding the word on its cap —
 * and which label names it out loud.
 */
interface SvKbdKeyDef {
  readonly glyph: string | { readonly label: SvKbdGlyphLabel };
  readonly name: keyof SvKbdLabels;
}

/** What a known key draws, in the words `labels` gives. */
function glyphOf(def: SvKbdKeyDef, labels: SvKbdLabels): string {
  return typeof def.glyph === 'string' ? def.glyph : labels[def.glyph.label];
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
const KEY_DEFS: Readonly<Record<string, SvKbdKeyDef>> = {
  cmd: { glyph: '⌘', name: 'command' },
  command: { glyph: '⌘', name: 'command' },
  ctrl: { glyph: { label: 'glyphCtrl' }, name: 'control' },
  control: { glyph: { label: 'glyphCtrl' }, name: 'control' },
  opt: { glyph: '⌥', name: 'option' },
  option: { glyph: '⌥', name: 'option' },
  alt: { glyph: { label: 'glyphAlt' }, name: 'alt' },
  shift: { glyph: '⇧', name: 'shift' },
  win: { glyph: '⊞', name: 'windows' },
  meta: { glyph: '⌘', name: 'command' },
  enter: { glyph: '↵', name: 'enter' },
  return: { glyph: '↵', name: 'return' },
  esc: { glyph: { label: 'glyphEsc' }, name: 'escape' },
  escape: { glyph: { label: 'glyphEsc' }, name: 'escape' },
  tab: { glyph: '⇥', name: 'tab' },
  space: { glyph: { label: 'glyphSpace' }, name: 'space' },
  backspace: { glyph: '⌫', name: 'backspace' },
  del: { glyph: '⌦', name: 'delete' },
  delete: { glyph: '⌦', name: 'delete' },
  up: { glyph: '↑', name: 'upArrow' },
  down: { glyph: '↓', name: 'downArrow' },
  left: { glyph: '←', name: 'leftArrow' },
  right: { glyph: '→', name: 'rightArrow' },
  pageup: { glyph: { label: 'glyphPageUp' }, name: 'pageUp' },
  pagedown: { glyph: { label: 'glyphPageDown' }, name: 'pageDown' },
  home: { glyph: { label: 'glyphHome' }, name: 'home' },
  end: { glyph: { label: 'glyphEnd' }, name: 'end' },
};

/** The known keys with their spoken names taken from `labels`. */
export function svKbdKeys(labels: SvKbdLabels): Readonly<Record<string, SvKbdKey>> {
  const out: Record<string, SvKbdKey> = {};
  for (const [token, def] of Object.entries(KEY_DEFS)) out[token] = { glyph: glyphOf(def, labels), spoken: labels[def.name] };
  return out;
}

/** The known keys, named in English — `svKbdKeys(SV_KBD_LABELS)`. */
export const SV_KBD_KEYS: Readonly<Record<string, SvKbdKey>> = svKbdKeys(SV_KBD_LABELS);

/**
 * The same map keyed by glyph, so `key="⌘"` works as well as `key="cmd"`.
 * The English cap words (`PgUp`) are in it; a translated one (`Bild↑`) is
 * matched against the labels in `svKbdKey`.
 *
 * ★ Hosts already have `⌘` hard-coded in a hundred templates. Making them
 * rewrite it to a token before they can get a spoken name is how a fix ships
 * and never gets adopted.
 */
const BY_GLYPH: Readonly<Record<string, SvKbdKeyDef>> = Object.freeze(
  Object.values(KEY_DEFS).reduce<Record<string, SvKbdKeyDef>>((acc, key) => {
    // First writer wins, so `⌘` resolves to Command rather than to whichever
    // alias happens to come last in the object above.
    const glyph = glyphOf(key, SV_KBD_LABELS);
    if (!acc[glyph]) acc[glyph] = key;
    return acc;
  }, {}),
);

/** The known keys whose cap carries a word — searched for a translated one. */
const WORD_DEFS: readonly SvKbdKeyDef[] = Object.values(KEY_DEFS).filter((def) => typeof def.glyph !== 'string');

/**
 * Resolve one token to a key.
 *
 * An unknown token is returned as-is with itself as the spoken name: `K` reads
 * as "K", which is right, and an unrecognised word is better said than
 * swallowed. `labels` supplies the spoken names and the cap words
 * (`SV_KBD_LABELS` in English), so `ctrl` draws `Strg` in a German app.
 */
export function svKbdKey(token: string, labels: SvKbdLabels, platform: SvKbdPlatform = 'other'): SvKbdKey {
  const raw = token.trim();
  if (!raw) return { glyph: '', spoken: '' };
  // ★ `mod` is the PLATFORM's primary modifier — one declaration, drawn per OS.
  //   "⌘K" shown to a Windows user is a key their keyboard does not have.
  if (raw.toLowerCase() === 'mod') {
    const mod = platform === 'apple' ? KEY_DEFS['cmd'] : KEY_DEFS['ctrl'];
    return { glyph: glyphOf(mod, labels), spoken: labels[mod.name] };
  }
  const def =
    KEY_DEFS[raw.toLowerCase()] ??
    BY_GLYPH[raw] ??
    (labels === SV_KBD_LABELS ? undefined : WORD_DEFS.find((d) => glyphOf(d, labels) === raw));
  return def ? { glyph: glyphOf(def, labels), spoken: labels[def.name] } : { glyph: raw, spoken: raw };
}

/**
 * Split a chord such as `"cmd+shift+K"` into its keys.
 *
 * A literal `+` is written `"++"`, so `"ctrl+++"` is Control-plus. Empty
 * segments are dropped rather than rendering an empty chip.
 */
export function svKbdChord(chord: string, labels: SvKbdLabels, platform: SvKbdPlatform = 'other'): SvKbdKey[] {
  const out: SvKbdKey[] = [];
  const parts = chord.split('+');
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '' && parts[i + 1] === '') {
      out.push(svKbdKey('+', labels, platform));
      i++;
      continue;
    }
    const key = svKbdKey(parts[i], labels, platform);
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

/**
 * Split a SEQUENCE — chords pressed one after another, `"g i"` or
 * `"mod+k mod+s"` — into its steps. Steps are separated by whitespace; each
 * step is a chord in `svKbdChord`'s syntax. Empty steps are dropped.
 */
export function svKbdSequence(sequence: string, labels: SvKbdLabels, platform: SvKbdPlatform = 'other'): SvKbdKey[][] {
  return sequence
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((step) => svKbdChord(step, labels, platform))
    .filter((keys) => keys.length > 0);
}

/** What a sequence is announced as — each chord's name, joined by `then` ("G then I"). */
export function svKbdSpokenSequence(steps: readonly (readonly SvKbdKey[])[], then: string): string {
  return steps.map((keys) => svKbdSpoken(keys)).filter(Boolean).join(` ${then} `);
}
