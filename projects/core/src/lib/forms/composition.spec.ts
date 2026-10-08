import { createCompositionGuard } from './composition';

/**
 * `FI-14-I2` / `FI-14-M1` — whose keystrokes these are.
 *
 * ★★★ `Enter` DURING COMPOSITION MEANS "ACCEPT THIS CANDIDATE", NOT "CHOOSE THIS
 *     MENU ITEM". A Japanese or Korean user pressing it is confirming a
 *     kana→kanji conversion. A mention panel that treats it as its own inserts
 *     somebody into the document at exactly the moment the user was committing a
 *     word — and the arrows are the same story, because those move through the
 *     IME's candidate list.
 */

const key = (init: Partial<KeyboardEvent>) =>
  ({ key: 'Enter', isComposing: false, keyCode: 13, ...init }) as KeyboardEvent;

describe('createCompositionGuard', () => {
  it('starts out letting everything through', () => {
    const g = createCompositionGuard();
    expect(g.composing()).toBe(false);
    expect(g.blocks(key({}))).toBe(false);
  });

  it('blocks everything between compositionstart and compositionend', () => {
    const g = createCompositionGuard();
    g.start();
    expect(g.composing()).toBe(true);
    expect(g.blocks(key({ key: 'Enter' }))).toBe(true);
    expect(g.blocks(key({ key: 'ArrowDown' }))).toBe(true);
    expect(g.blocks(key({ key: 'Escape' }))).toBe(true);
    g.end();
    expect(g.blocks(key({ key: 'Enter' }))).toBe(false);
  });

  it('honours isComposing even without a compositionstart', () => {
    const g = createCompositionGuard();
    expect(g.blocks(key({ isComposing: true }))).toBe(true);
  });

  it('honours keyCode 229, which is the only signal on the first keystroke', () => {
    // ★★ Not legacy cruft. Browsers report 229 for a key consumed by an IME, and
    //    on several of them `isComposing` is still false during the FIRST
    //    keystroke because `compositionstart` has not fired yet — which is the
    //    keystroke that would open the panel.
    const g = createCompositionGuard();
    expect(g.blocks(key({ isComposing: false, keyCode: 229 }))).toBe(true);
  });

  it('reports from end() so the caller can re-scan the committed word', () => {
    const g = createCompositionGuard();
    g.start();
    expect(g.end()).toBe(true);
  });
});
