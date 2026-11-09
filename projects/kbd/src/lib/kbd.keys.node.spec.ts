import { SV_KBD_KEYS, svKbdChord, svKbdKey, svKbdSpoken } from './kbd.keys';
import { SV_KBD_LABELS } from './kbd.labels';

/**
 * What a key is called out loud.
 *
 * ★★★ `⌘` is U+2318 PLACE OF INTEREST SIGN. A screen reader says "place of
 * interest sign", or nothing at all — and the entire content of a shortcut hint
 * is which keys to press, so a hint made of glyphs is documentation nobody can
 * hear. It is also unreadable to a sighted Windows user, who has never been
 * taught the symbol.
 */

describe('svKbdKey', () => {
  it('names a key given its token', () => {
    expect(svKbdKey('cmd', SV_KBD_LABELS)).toEqual({ glyph: '⌘', spoken: 'Command' });
    expect(svKbdKey('shift', SV_KBD_LABELS)).toEqual({ glyph: '⇧', spoken: 'Shift' });
  });

  it('names a key given the glyph a host already hard-coded', () => {
    // ★ Hosts have `⌘` in a hundred templates. Requiring a rewrite before the
    // spoken name works is how a fix ships and never gets adopted.
    expect(svKbdKey('⌘', SV_KBD_LABELS).spoken).toBe('Command');
    expect(svKbdKey('↵', SV_KBD_LABELS).spoken).toBe('Enter');
    expect(svKbdKey('⇥', SV_KBD_LABELS).spoken).toBe('Tab');
  });

  it('is case-insensitive about the token', () => {
    expect(svKbdKey('Esc', SV_KBD_LABELS).spoken).toBe('Escape');
    expect(svKbdKey('CMD', SV_KBD_LABELS).glyph).toBe('⌘');
  });

  it('keeps Alt and Option apart', () => {
    // ★ Same physical key, different word. A macOS user reads ⌥ and hears
    // "Option"; a Windows user reads Alt and hears "Alt". Collapsing them makes
    // one of the two populations read a key their keyboard does not have.
    expect(svKbdKey('option', SV_KBD_LABELS)).toEqual({ glyph: '⌥', spoken: 'Option' });
    expect(svKbdKey('alt', SV_KBD_LABELS)).toEqual({ glyph: 'Alt', spoken: 'Alt' });
  });

  it('says an unknown token rather than swallowing it', () => {
    expect(svKbdKey('K', SV_KBD_LABELS)).toEqual({ glyph: 'K', spoken: 'K' });
    expect(svKbdKey('F12', SV_KBD_LABELS)).toEqual({ glyph: 'F12', spoken: 'F12' });
  });

  it('draws the textual key caps from the labels, and reads a translated cap back', () => {
    const de = { ...SV_KBD_LABELS, glyphCtrl: 'Strg', glyphEnd: 'Ende', control: 'Steuerung' };
    expect(svKbdKey('ctrl', de)).toEqual({ glyph: 'Strg', spoken: 'Steuerung' });
    expect(svKbdKey('Strg', de)).toEqual({ glyph: 'Strg', spoken: 'Steuerung' });
    expect(svKbdKey('end', de).glyph).toBe('Ende');
    // A symbol is not a word, and does not change.
    expect(svKbdKey('cmd', de).glyph).toBe('⌘');
    expect(svKbdKey('pageup', SV_KBD_LABELS).glyph).toBe('PgUp');
  });

  it('has a spoken name for every entry it knows', () => {
    for (const [token, key] of Object.entries(SV_KBD_KEYS)) {
      expect(key.spoken, token).toBeTruthy();
      expect(key.glyph, token).toBeTruthy();
    }
  });
});

describe('svKbdChord', () => {
  it('splits a chord into its keys', () => {
    expect(svKbdChord('cmd+shift+K', SV_KBD_LABELS).map((k) => k.glyph)).toEqual(['⌘', '⇧', 'K']);
  });

  it('says the whole thing in words', () => {
    expect(svKbdSpoken(svKbdChord('cmd+shift+K', SV_KBD_LABELS))).toBe('Command Shift K');
  });

  it('joins with spaces rather than the word "plus"', () => {
    // Three of six words would be punctuation, and the pause between names
    // already carries the grouping.
    expect(svKbdSpoken(svKbdChord('ctrl+C', SV_KBD_LABELS))).not.toContain('plus');
  });

  it('handles a chord whose key IS the plus sign', () => {
    expect(svKbdChord('ctrl+++', SV_KBD_LABELS).map((k) => k.glyph)).toEqual(['Ctrl', '+']);
  });

  it('drops empty segments rather than rendering a blank chip', () => {
    expect(svKbdChord('cmd+', SV_KBD_LABELS).map((k) => k.glyph)).toEqual(['⌘']);
    expect(svKbdChord('', SV_KBD_LABELS)).toEqual([]);
  });

  it('tolerates spaces around the separators', () => {
    expect(svKbdChord('cmd + shift + K', SV_KBD_LABELS).map((k) => k.spoken)).toEqual([
      'Command', 'Shift', 'K',
    ]);
  });
});
