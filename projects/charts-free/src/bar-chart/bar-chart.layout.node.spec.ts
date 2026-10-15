// `.node.spec.ts`: layout arithmetic, no DOM.
import { axisLabelRoom } from './bar-chart.layout';

describe('axisLabelRoom — the left margin a column of labels needs', () => {
  it('keeps the base margin for short labels', () => {
    expect(axisLabelRoom(['Q1', 'Q2'], 11)).toBe(56);
  });

  it('grows past 56 for "Product A" at 11px — the label CI cut off by 2.4px', () => {
    const room = axisLabelRoom(['Product A', 'Product B'], 11);
    expect(room).toBeGreaterThan(56);
    // 9 × 0.62 em × 11 + 8 gap + 4 margin, rounded up.
    expect(room).toBe(Math.ceil(9 * 0.62 * 11 + 12));
  });

  it('sizes from the widest label and counts a wide character as a full em', () => {
    expect(axisLabelRoom(['a', '売上高合計'], 10)).toBe(Math.ceil(5 * 10 + 12));
  });

  it('honours a caller minimum', () => {
    expect(axisLabelRoom([], 11, 40)).toBe(40);
  });
});
