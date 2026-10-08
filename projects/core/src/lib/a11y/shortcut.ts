/**
 * shortcut.ts — parsing, matching and rendering a keyboard shortcut (`X-15`).
 *
 * ★★★ THREE FAMILIES DISPLAYED SHORTCUTS AND ONE BOUND THEM, so the kit had a
 *     display vocabulary and a matching rule that could not disagree visibly
 *     and disagreed anyway: Command Palette bound `mod+k` with a hand-written
 *     matcher, Menubar and Dropdown Menu rendered `['⌘','K']` strings the host
 *     typed out by hand, and nothing checked that the thing shown was the thing
 *     bound. One parser, one matcher, one renderer.
 *
 * Pure functions, no Angular and no DOM beyond the event object, so the whole
 * matching table can be tested without a browser.
 */

/** A modifier as written in a binding string. */
export type SvShortcutModifier = 'mod' | 'ctrl' | 'meta' | 'alt' | 'shift';

/** A parsed binding. */
export interface SvShortcut {
  /** Lower-cased key, e.g. `'k'`, `'enter'`, `'/'`, `'arrowdown'`. */
  readonly key: string;
  readonly mod: boolean;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
}

const MODIFIERS: readonly SvShortcutModifier[] = ['mod', 'ctrl', 'meta', 'alt', 'shift'];

/**
 * Parse `'mod+shift+p'`, `'ctrl+alt+delete'`, `'?'`.
 *
 * ★★ `mod` IS THE ONLY MODIFIER WORTH WRITING for an app shortcut: ⌘ on macOS
 *    and Ctrl everywhere else. Spelling it `ctrl` ships a Windows binding to
 *    Mac users, where Ctrl+K is a system text shortcut; spelling it `meta`
 *    ships a Mac binding to Windows, where the Meta key opens the Start menu.
 *    `ctrl` and `meta` are still available for the rare binding that genuinely
 *    means one physical key on both platforms.
 *
 * Returns `null` for anything unparseable, rather than a shortcut that will
 * never fire: a binding nobody can press is a bug the registry should report,
 * not silently hold.
 */
export function svParseShortcut(binding: string): SvShortcut | null {
  const raw = binding.trim().toLowerCase();
  if (!raw) return null;

  // ★ Split on '+' but keep a trailing '+' as the KEY: `'mod++'` is a real
  //   binding (zoom in), and a naive split loses it as an empty segment.
  const parts: string[] = [];
  let buffer = '';
  for (const ch of raw) {
    if (ch === '+' && buffer !== '') {
      parts.push(buffer);
      buffer = '';
    } else {
      buffer += ch;
    }
  }
  if (buffer !== '') parts.push(buffer);

  const flags = { mod: false, ctrl: false, meta: false, alt: false, shift: false };
  let key = '';
  for (const part of parts) {
    const asModifier = MODIFIERS.find((m) => m === part || ALIASES[part] === m);
    if (asModifier) {
      // ★ A modifier written twice is a typo, not an intent: `'mod+mod+k'`
      //   would otherwise parse the second `mod` as the key and produce a
      //   binding that can never fire.
      if (flags[asModifier]) return null;
      flags[asModifier] = true;
      continue;
    }
    if (key !== '') return null; // two keys is not a shortcut
    key = part;
  }
  if (key === '') return null;
  return { key, ...flags };
}

/** Accepted spellings for the modifiers. */
const ALIASES: Record<string, SvShortcutModifier> = {
  cmd: 'meta',
  command: 'meta',
  control: 'ctrl',
  option: 'alt',
  opt: 'alt',
  super: 'meta',
  win: 'meta',
};

/** Does this keyboard event press this shortcut? */
export function svMatchesShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
  shortcut: SvShortcut,
  isMac: boolean,
): boolean {
  if (event.key.toLowerCase() !== shortcut.key) return false;

  const wantCtrl  = shortcut.ctrl || (shortcut.mod && !isMac);
  const wantMeta  = shortcut.meta || (shortcut.mod && isMac);

  if (event.ctrlKey  !== wantCtrl)  return false;
  if (event.metaKey  !== wantMeta)  return false;
  if (event.altKey   !== shortcut.alt) return false;
  if (event.shiftKey !== shortcut.shift) return false;

  // ★★★ ALTGR IS REPORTED AS CTRL+ALT, and on Windows and Linux it is the key
  //     German, Polish, Turkish and Nordic layouts use for @ [ ] { } \ € and
  //     a great many letters. A `mod`-based binding must never fire for it:
  //     the palette used to open while `preventDefault()` swallowed the
  //     character the user was typing.
  //
  // ★★ MOST OF THAT PROTECTION IS THE EXACT MODIFIER COMPARISON ABOVE, not
  //    this line: `mod+k` asks for altKey false, and AltGr sets it, so it
  //    already does not match. What this line adds is the ONE case exact
  //    matching cannot see — `mod+alt+X`, which on Windows IS AltGr+X. Such a
  //    binding can only ever fire by intercepting a character key, so on
  //    those platforms it does not fire at all.
  //
  // ★ `ctrl+alt+X` spelled out explicitly is exempt, and that is the escape
  //   hatch: the host named both physical modifiers rather than asking for
  //   "the platform key", so it means them.
  if (!isMac && shortcut.mod && shortcut.alt) return false;

  return true;
}

/** Elements whose keystrokes belong to the user's text, not to a shortcut. */
const TEXT_ENTRY = /^(input|textarea|select)$/i;

/**
 * Is this event coming from somewhere the user is typing?
 *
 * ★★ A BARE-KEY SHORTCUT IS UNUSABLE WITHOUT THIS. `?` for help and `/` for
 *    search are the two commonest app shortcuts there are, and without this
 *    check they fire while the user types a question mark into a comment box —
 *    swallowing the character and opening a dialog over what they were
 *    writing. A modifier-based binding is mostly safe by construction, which
 *    is why this is only consulted for bindings that ask for it.
 */
export function svIsTextEntryTarget(target: EventTarget | null): boolean {
  if (!target || !(target as Partial<HTMLElement>).tagName) return false;
  const el = target as HTMLElement;
  if (TEXT_ENTRY.test(el.tagName)) {
    // A disabled or readonly field is not somewhere the user is typing.
    const field = el as HTMLInputElement;
    return !field.disabled && !field.readOnly;
  }
  return el.isContentEditable === true;
}

/** How a shortcut is written out for a reader. */
export interface SvShortcutTokensOptions {
  /** Render ⌘ / ⌥ / ⌃ instead of Ctrl / Alt. */
  readonly isMac: boolean;
}

const MAC_SYMBOLS: Record<string, string> = {
  mod: '⌘', meta: '⌘', ctrl: '⌃', alt: '⌥', shift: '⇧',
};
const PC_LABELS: Record<string, string> = {
  mod: 'Ctrl', meta: 'Win', ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift',
};

/** Keys whose names are read as words rather than as their character. */
const KEY_LABELS: Record<string, string> = {
  arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→',
  enter: 'Enter', escape: 'Esc', backspace: 'Backspace', delete: 'Del',
  tab: 'Tab', ' ': 'Space', space: 'Space',
};

/**
 * Render a binding as display tokens: `['⌘', 'K']` or `['Ctrl', 'K']`.
 *
 * ★★ ORDER IS FIXED AND IT IS THE PLATFORM'S ORDER, not the order the binding
 *    was written in. `'shift+mod+p'` and `'mod+shift+p'` are one shortcut, and
 *    a reader who sees ⇧⌘P in one menu and ⌘⇧P in another has to work out that
 *    they are the same thing.
 *
 * ★ Returns tokens rather than a string so a caller can render each in its own
 *   `<kbd>`, which is what makes a shortcut readable at a glance — and
 *   joining them is one `.join('')` away for the callers that want text.
 */
export function svShortcutTokens(
  binding: string,
  options: SvShortcutTokensOptions,
): readonly string[] {
  const parsed = svParseShortcut(binding);
  if (!parsed) return [];
  const symbols = options.isMac ? MAC_SYMBOLS : PC_LABELS;
  const tokens: string[] = [];
  // macOS convention: ⌃⌥⇧⌘ then the key. Windows: Ctrl, Alt, Shift, then key.
  if (options.isMac) {
    if (parsed.ctrl) tokens.push(symbols['ctrl']);
    if (parsed.alt) tokens.push(symbols['alt']);
    if (parsed.shift) tokens.push(symbols['shift']);
    if (parsed.mod || parsed.meta) tokens.push(symbols['mod']);
  } else {
    if (parsed.mod || parsed.ctrl) tokens.push(symbols['ctrl']);
    if (parsed.meta && !parsed.mod) tokens.push(symbols['meta']);
    if (parsed.alt) tokens.push(symbols['alt']);
    if (parsed.shift) tokens.push(symbols['shift']);
  }
  tokens.push(KEY_LABELS[parsed.key] ?? (parsed.key.length === 1 ? parsed.key.toUpperCase() : titleCase(parsed.key)));
  return tokens;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * The canonical form of a binding, for comparing two of them.
 *
 * ★ `'shift+mod+p'` and `'mod+shift+p'` are the same shortcut, so conflict
 *   detection cannot compare the strings a host wrote — it compares these.
 */
export function svShortcutId(binding: string): string | null {
  const parsed = svParseShortcut(binding);
  if (!parsed) return null;
  const flags = MODIFIERS.filter((m) => parsed[m]).join('+');
  return flags ? `${flags}+${parsed.key}` : parsed.key;
}
