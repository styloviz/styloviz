/**
 * Shared utilities for all Pie Chart variants.
 */

import type { ArcData, LabelPoint } from './pie-chart.types';

// ─── Color palette ────────────────────────────────────────────────────────────

export const PIE_COLORS: readonly string[] = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#3b82f6', // blue
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#8b5cf6', // violet
  '#14b8a6', // teal
];

// ─── Polar ↔ Cartesian ────────────────────────────────────────────────────────

export function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// ─── Slice angle span (gap-aware) ─────────────────────────────────────────────

/**
 * The `{ start, end }` angle pair for one slice, `gap` degrees narrower than
 * its full share on each side — the visual breathing room between slices.
 *
 * ★★ `gap` is a FIXED number of degrees, but a slice's own angular width
 * (`deg`) shrinks with its share of the total and is not bounded below it.
 * A slice under roughly 0.1% of the total can be narrower than the gap
 * itself, and the naive `cumDeg + gap/2` / `cumDeg + deg - gap/2` then
 * produces `end < start` — a NEGATIVE span. `buildArcPath`'s `largeArc` flag
 * is chosen from the span's sign (`span > 180 ? 1 : 0`), so a negative span
 * still picks the *minor*-arc flag while the two points it was given are
 * effectively swapped — the SVG arc command sweeps the LONG way around
 * instead of drawing nothing, and a slice too small to see explodes into one
 * that swallows most of the pie.
 *
 * The fix is to never let the gap consume more than the slice actually has:
 * clamping `gap` to `deg` guarantees `end >= start` always, degrading to a
 * zero-width (invisible) arc for a slice the gap would otherwise have eaten
 * entirely — which is the correct outcome for "too small to draw a gap
 * around", not a giant wrong slice.
 */
export function sliceAngles(cumDeg: number, deg: number, gap: number): { start: number; end: number } {
  const effectiveGap = Math.min(gap, deg);
  return {
    start: cumDeg + effectiveGap / 2,
    end:   cumDeg + deg - effectiveGap / 2,
  };
}

// ─── Arc path builder ─────────────────────────────────────────────────────────

/**
 * Returns an SVG arc path for a pie slice (no inner hole).
 * `start` and `end` are angles in degrees (0° = top).
 */
export function buildArcPath(
  cx: number,
  cy: number,
  outerR: number,
  startDeg: number,
  endDeg: number,
): string {
  // Guard: if arc spans almost 360°, nudge to avoid degenerate path
  const span = endDeg - startDeg;
  const end  = span >= 359.99 ? startDeg + 359.99 : endDeg;

  const s = polarToCartesian(cx, cy, outerR, startDeg);
  const e = polarToCartesian(cx, cy, outerR, end);
  const largeArc = span > 180 ? 1 : 0;

  return [
    `M ${cx} ${cy}`,
    `L ${s.x} ${s.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${e.x} ${e.y}`,
    'Z',
  ].join(' ');
}

// ─── Label point (outside the pie) ───────────────────────────────────────────

/**
 * Computes an anchor point for an external label given a slice mid-angle.
 * The label is placed `offset` pixels outside `outerR`.
 */
export function labelPoint(
  cx: number,
  cy: number,
  outerR: number,
  midAngleDeg: number,
  offset: number,
): LabelPoint {
  const r   = outerR + offset;
  const pos = polarToCartesian(cx, cy, r, midAngleDeg);
  // Determine text-anchor based on which side of the chart the label lands
  const normAngle = ((midAngleDeg % 360) + 360) % 360;
  const anchor: 'start' | 'middle' | 'end' =
    normAngle < 15 || normAngle > 345 ? 'middle'
    : normAngle < 180                 ? 'start'
    :                                   'end';
  return { x: pos.x, y: pos.y, anchor };
}

// ─── Arc-data builder (used by smart-labels) ──────────────────────────────────

export function buildArcData(
  cx: number,
  cy: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
): ArcData {
  const midAngle = (startAngle + endAngle) / 2;
  const path     = buildArcPath(cx, cy, outerR, startAngle, endAngle);
  return { path, startAngle, endAngle, midAngle, outerR, cx, cy };
}

// ─── Format helpers ───────────────────────────────────────────────────────────

export function formatPieValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}k`;
  return String(v);
}

export function toPercent(value: number, total: number, decimals = 1): string {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(decimals)}%`;
}

// ─── Explode transform ────────────────────────────────────────────────────────

/**
 * Returns a CSS translate() that pushes an element outward along `midAngleDeg`.
 */
export function explodeTransform(midAngleDeg: number, offsetPx: number): string {
  const rad = ((midAngleDeg - 90) * Math.PI) / 180;
  const dx  = Math.cos(rad) * offsetPx;
  const dy  = Math.sin(rad) * offsetPx;
  return `translate(${dx.toFixed(2)}, ${dy.toFixed(2)})`;
}

// ─── Smart label collision resolver ──────────────────────────────────────────

export interface RawLabel {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  midAngle: number;
  lineStart: { x: number; y: number };
  lineEnd:   { x: number; y: number };
  label: string;
  pct:   string;
  value: string;
  color: string;
  index: number;
}

/** The vertical band a label's baseline may occupy, in SVG user units. */
export interface LabelBounds {
  top: number;
  bottom: number;
}

/**
 * Given an array of raw label positions (already computed from arc geometry),
 * spread labels vertically so they don't overlap.
 * Min separation is `minGap` px.
 *
 * `bounds` keeps the spread labels on the canvas. Passing it is strongly
 * recommended: `spread` moves labels apart with no idea where the edge is, so
 * without bounds the outermost label of a crowded side is pushed off the top or
 * the bottom and clipped away — measured as a 4.8px shave off the last
 * percentage on the six-slice browser-share demo. Omitted, the behaviour is the
 * unbounded original.
 */
export function resolveSmartLabels(
  labels: RawLabel[],
  minGap = 16,
  bounds?: LabelBounds,
  maxIter = 30,
): RawLabel[] {
  // Split into left side and right side
  const left  = labels.filter(l => l.anchor === 'end').sort((a, b) => a.y - b.y);
  const right = labels.filter(l => l.anchor !== 'end' && l.anchor !== 'middle').sort((a, b) => a.y - b.y);
  const mid   = labels.filter(l => l.anchor === 'middle');

  const spread = (group: RawLabel[]): void => {
    for (let iter = 0; iter < maxIter; iter++) {
      let moved = false;
      for (let i = 1; i < group.length; i++) {
        const prev = group[i - 1];
        const curr = group[i];
        const gap  = curr.y - prev.y;
        if (gap < minGap) {
          const shift = (minGap - gap) / 2;
          prev.y -= shift;
          curr.y += shift;
          moved   = true;
        }
      }
      if (!moved) break;
    }
  };

  /**
   * Slides a spread group back onto the canvas. Shifting the whole group keeps
   * the separation `spread` just achieved; only when the group is taller than
   * the band is that impossible, and then even spacing is the better trade —
   * labels closer together than `minGap` are still readable, whereas labels
   * off the edge are not there at all.
   */
  const fit = (group: RawLabel[], { top, bottom }: LabelBounds): void => {
    if (!group.length) return;
    const first = group[0];
    const last  = group[group.length - 1];
    const span  = bottom - top;

    if (last.y - first.y > span) {
      const step = group.length > 1 ? span / (group.length - 1) : 0;
      group.forEach((l, i) => { l.y = top + step * i; });
      return;
    }

    const below = last.y - bottom;
    if (below > 0) for (const l of group) l.y -= below;
    const above = top - group[0].y;
    if (above > 0) for (const l of group) l.y += above;
  };

  spread(left);
  spread(right);

  if (bounds) {
    fit(left, bounds);
    fit(right, bounds);
  }

  return [...left, ...right, ...mid];
}
