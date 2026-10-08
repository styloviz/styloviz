import {
  svIsTextEntryTarget,
  svMatchesShortcut,
  svParseShortcut,
  svShortcutId,
  svShortcutTokens,
} from './shortcut';

/**
 * `X-15` — the parsing, matching and rendering half of the shortcut contract.
 *
 * No Angular and no DOM: the event is a plain object with the five fields the
 * matcher reads, which is what lets the whole table be tested — including the
 * combinations a browser makes awkward to produce, AltGr above all.
 */

const press = (
  key: string,
  mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {},
) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe('svParseShortcut', () => {
  it('parses a bare key', () => {
    expect(svParseShortcut('k')).toEqual({
      key: 'k', mod: false, ctrl: false, meta: false, alt: false, shift: false,
    });
  });

  it('parses modifiers in any order', () => {
    expect(svParseShortcut('mod+shift+p')).toEqual(svParseShortcut('shift+mod+p'));
  });

  it('accepts the spellings people actually write', () => {
    expect(svParseShortcut('cmd+k')?.meta).toBe(true);
    expect(svParseShortcut('command+k')?.meta).toBe(true);
    expect(svParseShortcut('control+k')?.ctrl).toBe(true);
    expect(svParseShortcut('option+k')?.alt).toBe(true);
  });

  it('is case-insensitive and trims', () => {
    expect(svParseShortcut('  MOD+K ')).toEqual(svParseShortcut('mod+k'));
  });

  it('★ keeps a trailing + as the key', () => {
    // `mod++` is a real binding (zoom in), and a naive split on '+' loses it
    // as an empty segment.
    expect(svParseShortcut('mod++')).toEqual({
      key: '+', mod: true, ctrl: false, meta: false, alt: false, shift: false,
    });
  });

  it('parses named keys', () => {
    expect(svParseShortcut('mod+arrowdown')?.key).toBe('arrowdown');
    expect(svParseShortcut('escape')?.key).toBe('escape');
  });

  it.each([
    ['empty', ''],
    ['whitespace', '   '],
    ['modifiers only', 'mod+shift'],
    ['two keys', 'mod+k+j'],
    ['a repeated modifier', 'mod+mod+k'],
  ])('refuses %s', (_label, binding) => {
    expect(svParseShortcut(binding)).toBeNull();
  });
});

describe('svShortcutId', () => {
  it('★ gives two spellings of one shortcut the same id', () => {
    // Conflict detection cannot compare the strings a host wrote.
    expect(svShortcutId('shift+mod+p')).toBe(svShortcutId('mod+shift+p'));
  });

  it('orders the modifiers canonically', () => {
    expect(svShortcutId('shift+alt+mod+k')).toBe('mod+alt+shift+k');
  });

  it('leaves a bare key alone', () => {
    expect(svShortcutId('?')).toBe('?');
  });

  it('is null for an unparseable binding', () => {
    expect(svShortcutId('mod+shift')).toBeNull();
    // A trailing separator with nothing after it is a typo, not the + key:
    // `'mod+'` names no key at all. `'mod++'` is the + key (zoom in).
    expect(svShortcutId('mod+')).toBeNull();
    expect(svShortcutId('mod++')).toBe('mod++');
  });
});

describe('svMatchesShortcut — mod is the platform key', () => {
  const mod = svParseShortcut('mod+k')!;

  it('matches Cmd+K on a Mac', () => {
    expect(svMatchesShortcut(press('k', { metaKey: true }), mod, true)).toBe(true);
  });

  it('does not match Ctrl+K on a Mac', () => {
    // Ctrl+K is a system text shortcut there; a Windows binding must not fire.
    expect(svMatchesShortcut(press('k', { ctrlKey: true }), mod, true)).toBe(false);
  });

  it('matches Ctrl+K elsewhere', () => {
    expect(svMatchesShortcut(press('k', { ctrlKey: true }), mod, false)).toBe(true);
  });

  it('does not match Meta+K elsewhere', () => {
    expect(svMatchesShortcut(press('k', { metaKey: true }), mod, false)).toBe(false);
  });

  it('is case-insensitive about the pressed key', () => {
    expect(svMatchesShortcut(press('K', { metaKey: true }), mod, true)).toBe(true);
  });
});

describe('svMatchesShortcut — exact modifiers', () => {
  const mod = svParseShortcut('mod+k')!;

  it('refuses extra modifiers', () => {
    expect(svMatchesShortcut(press('k', { metaKey: true, shiftKey: true }), mod, true)).toBe(false);
  });

  it('requires the ones it asks for', () => {
    const modShift = svParseShortcut('mod+shift+p')!;
    expect(svMatchesShortcut(press('p', { metaKey: true }), modShift, true)).toBe(false);
    expect(svMatchesShortcut(press('p', { metaKey: true, shiftKey: true }), modShift, true)).toBe(true);
  });

  it('matches a bare key only with no modifiers', () => {
    const slash = svParseShortcut('/')!;
    expect(svMatchesShortcut(press('/'), slash, false)).toBe(true);
    expect(svMatchesShortcut(press('/', { ctrlKey: true }), slash, false)).toBe(false);
  });
});

describe('svMatchesShortcut — AltGr', () => {
  const mod = svParseShortcut('mod+k')!;

  it('★★★ does not fire for AltGr, which is reported as Ctrl+Alt', () => {
    // German, Polish, Turkish and Nordic layouts use AltGr for @ [ ] { } \\ €
    // and many letters. The palette used to open AND preventDefault() swallow
    // the character the user was typing.
    //
    // ★ This case is carried by the EXACT modifier comparison — `mod+k` asks
    //   for altKey false — not by the AltGr line below it. Both are tested,
    //   because deleting either one has to turn something red.
    expect(svMatchesShortcut(press('k', { ctrlKey: true, altKey: true }), mod, false)).toBe(false);
  });

  it('★★ refuses a mod+alt binding off macOS, because that IS AltGr', () => {
    // The one case exact matching cannot see: `mod+alt+k` on Windows is
    // Ctrl+Alt+K, which is AltGr+K. A binding like that can only ever fire by
    // intercepting a character key.
    const modAlt = svParseShortcut('mod+alt+k')!;
    expect(svMatchesShortcut(press('k', { ctrlKey: true, altKey: true }), modAlt, false)).toBe(false);
  });

  it('honours a mod+alt binding on macOS, where AltGr does not exist', () => {
    const modAlt = svParseShortcut('mod+alt+k')!;
    expect(svMatchesShortcut(press('k', { metaKey: true, altKey: true }), modAlt, true)).toBe(true);
  });

  it('still fires for a binding that asks for ctrl+alt explicitly', () => {
    const explicit = svParseShortcut('ctrl+alt+k')!;
    expect(svMatchesShortcut(press('k', { ctrlKey: true, altKey: true }), explicit, false)).toBe(true);
  });

  it('leaves macOS alone — AltGr does not exist there', () => {
    const explicit = svParseShortcut('ctrl+alt+k')!;
    expect(svMatchesShortcut(press('k', { ctrlKey: true, altKey: true }), explicit, true)).toBe(true);
  });
});

describe('svIsTextEntryTarget', () => {
  it('is true for an input, textarea and select', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(svIsTextEntryTarget({ tagName: tag } as unknown as EventTarget)).toBe(true);
    }
  });

  it('is false for a button or a div', () => {
    expect(svIsTextEntryTarget({ tagName: 'BUTTON' } as unknown as EventTarget)).toBe(false);
    expect(svIsTextEntryTarget({ tagName: 'DIV' } as unknown as EventTarget)).toBe(false);
  });

  it('★ is false for a disabled or readonly field', () => {
    // Not somewhere the user is typing, so a bare-key shortcut may fire.
    expect(
      svIsTextEntryTarget({ tagName: 'INPUT', disabled: true } as unknown as EventTarget),
    ).toBe(false);
    expect(
      svIsTextEntryTarget({ tagName: 'INPUT', readOnly: true } as unknown as EventTarget),
    ).toBe(false);
  });

  it('is true for a contenteditable', () => {
    expect(
      svIsTextEntryTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget),
    ).toBe(true);
  });

  it('is false for null and for a non-element target', () => {
    expect(svIsTextEntryTarget(null)).toBe(false);
    expect(svIsTextEntryTarget({} as EventTarget)).toBe(false);
  });
});

describe('svShortcutTokens', () => {
  it('renders the platform modifier', () => {
    expect(svShortcutTokens('mod+k', { isMac: true })).toEqual(['⌘', 'K']);
    expect(svShortcutTokens('mod+k', { isMac: false })).toEqual(['Ctrl', 'K']);
  });

  it('★ renders one order whatever order the binding was written in', () => {
    // A reader who sees ⇧⌘P in one menu and ⌘⇧P in another has to work out
    // that they are the same thing.
    expect(svShortcutTokens('shift+mod+p', { isMac: true })).toEqual(['⇧', '⌘', 'P']);
    expect(svShortcutTokens('mod+shift+p', { isMac: true })).toEqual(['⇧', '⌘', 'P']);
  });

  it('uses the macOS symbol order: ⌃⌥⇧⌘', () => {
    expect(svShortcutTokens('mod+ctrl+alt+shift+k', { isMac: true })).toEqual(
      ['⌃', '⌥', '⇧', '⌘', 'K'],
    );
  });

  it('spells the modifiers out off macOS', () => {
    expect(svShortcutTokens('mod+alt+shift+k', { isMac: false })).toEqual(
      ['Ctrl', 'Alt', 'Shift', 'K'],
    );
  });

  it('names the keys that are not characters', () => {
    expect(svShortcutTokens('mod+arrowdown', { isMac: true })).toEqual(['⌘', '↓']);
    expect(svShortcutTokens('escape', { isMac: false })).toEqual(['Esc']);
    expect(svShortcutTokens('mod+enter', { isMac: false })).toEqual(['Ctrl', 'Enter']);
  });

  it('is empty for an unparseable binding, rather than half a shortcut', () => {
    expect(svShortcutTokens('mod+shift', { isMac: true })).toEqual([]);
  });
});
