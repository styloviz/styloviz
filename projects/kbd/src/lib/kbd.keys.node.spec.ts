import { SV_KBD_KEYS, svKbdChord, svKbdKey, svKbdSpoken } from './kbd.keys';

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
    expect(svKbdKey('cmd')).toEqual({ glyph: '⌘', spoken: 'Command' });
    expect(svKbdKey('shift')).toEqual({ glyph: '⇧', spoken: 'Shift' });
  });

  it('names a key given the glyph a host already hard-coded', () => {
    // ★ Hosts have `⌘` in a hundred templates. Requiring a rewrite before the
    // spoken name works is how a fix ships and never gets adopted.
    expect(svKbdKey('⌘').spoken).toBe('Command');
    expect(svKbdKey('↵').spoken).toBe('Enter');
    expect(svKbdKey('⇥').spoken).toBe('Tab');
  });

  it('is case-insensitive about the token', () => {
    expect(svKbdKey('Esc').spoken).toBe('Escape');
    expect(svKbdKey('CMD').glyph).toBe('⌘');
  });

  it('keeps Alt and Option apart', () => {
    // ★ Same physical key, different word. A macOS user reads ⌥ and hears
    // "Option"; a Windows user reads Alt and hears "Alt". Collapsing them makes
    // one of the two populations read a key their keyboard does not have.
    expect(svKbdKey('option')).toEqual({ glyph: '⌥', spoken: 'Option' });
    expect(svKbdKey('alt')).toEqual({ glyph: 'Alt', spoken: 'Alt' });
  });

  it('says an unknown token rather than swallowing it', () => {
    expect(svKbdKey('K')).toEqual({ glyph: 'K', spoken: 'K' });
    expect(svKbdKey('F12')).toEqual({ glyph: 'F12', spoken: 'F12' });
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
    expect(svKbdChord('cmd+shift+K').map((k) => k.glyph)).toEqual(['⌘', '⇧', 'K']);
  });

  it('says the whole thing in words', () => {
    expect(svKbdSpoken(svKbdChord('cmd+shift+K'))).toBe('Command Shift K');
  });

  it('joins with spaces rather than the word "plus"', () => {
    // Three of six words would be punctuation, and the pause between names
    // already carries the grouping.
    expect(svKbdSpoken(svKbdChord('ctrl+C'))).not.toContain('plus');
  });

  it('handles a chord whose key IS the plus sign', () => {
    expect(svKbdChord('ctrl+++').map((k) => k.glyph)).toEqual(['Ctrl', '+']);
  });

  it('drops empty segments rather than rendering a blank chip', () => {
    expect(svKbdChord('cmd+').map((k) => k.glyph)).toEqual(['⌘']);
    expect(svKbdChord('')).toEqual([]);
  });

  it('tolerates spaces around the separators', () => {
    expect(svKbdChord('cmd + shift + K').map((k) => k.spoken)).toEqual([
      'Command', 'Shift', 'K',
    ]);
  });
});
