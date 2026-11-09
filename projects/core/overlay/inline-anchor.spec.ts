import { svInlineAnchor } from './anchored-position';

/**
 * `svInlineAnchor` — the edge-pinned inline placement the form overlays share
 * (`FL-J3-FI-01`, `X-7`). LTR results are pinned to the arithmetic the eleven
 * hand-rolled copies used, so adopting it moved no panel; RTL is the fix.
 */
describe('svInlineAnchor', () => {
  const vw = 400;

  it('LTR: lines up on the trigger’s left edge when the panel fits', () => {
    const a = svInlineAnchor({ anchor: { left: 40, width: 200 }, panelWidth: 220, viewportWidth: vw });
    expect(a).toEqual({ alignEnd: false, edge: 'left', offset: 40, maxWidth: 400 - 40 - 8, left: 40 });
  });

  it('LTR: falls back to the right edge when start would overflow (left + width > vw)', () => {
    const a = svInlineAnchor({ anchor: { left: 300, width: 80 }, panelWidth: 220, viewportWidth: vw });
    expect(a.alignEnd).toBe(true);
    expect(a.edge).toBe('right');
    expect(a.offset).toBe(400 - 380);
    expect(a.maxWidth).toBe(400 - 20 - 8);
    expect(a.left).toBe(380 - 220);
  });

  it('LTR: a trigger hanging off the NEAR edge keeps start alignment, clamped by the margin', () => {
    const a = svInlineAnchor({ anchor: { left: 0, width: 200 }, panelWidth: 220, viewportWidth: 1024 });
    expect(a.alignEnd).toBe(false);
    expect(a.offset).toBe(8);
    expect(a.left).toBe(8);
  });

  it('RTL: lines up on the trigger’s RIGHT edge — the start edge in right-to-left text', () => {
    const a = svInlineAnchor({ anchor: { left: 160, width: 200 }, panelWidth: 300, viewportWidth: vw, rtl: true });
    expect(a.alignEnd).toBe(false);
    expect(a.edge).toBe('right');
    expect(a.offset).toBe(400 - 360);
    expect(a.left).toBe(360 - 300);
  });

  it('RTL: falls back to the left edge when the start edge would run the panel off the left', () => {
    const a = svInlineAnchor({ anchor: { left: 20, width: 80 }, panelWidth: 220, viewportWidth: vw, rtl: true });
    expect(a.alignEnd).toBe(true);
    expect(a.edge).toBe('left');
    expect(a.offset).toBe(20);
    expect(a.left).toBe(20);
  });

  it('a width-matching panel never needs the fallback', () => {
    for (const rtl of [false, true]) {
      const a = svInlineAnchor({ anchor: { left: 100, width: 200 }, panelWidth: 200, viewportWidth: vw, rtl });
      expect(a.alignEnd).toBe(false);
      expect(a.left).toBe(100);
    }
  });

  it('clamps the single `left` coordinate with the caller’s margin', () => {
    const a = svInlineAnchor({ anchor: { left: 10, width: 40 }, panelWidth: 300, viewportWidth: 300, margin: 6 });
    // 10 + 300 > 300 → end-aligned at 50 - 300 = -250, clamped to the margin.
    expect(a.alignEnd).toBe(true);
    expect(a.left).toBe(6);
  });
});
