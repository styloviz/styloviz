import { InjectionToken, type Provider } from '@angular/core';

/**
 * A tooltip group (SR-35) — the Radix `TooltipProvider` behaviour for a row of
 * controls: the first tooltip waits its delay, and moving to a sibling shows
 * the next one at once, because the user has already shown they are reading
 * the toolbar. Only one tooltip of a group is visible at a time.
 *
 * Provide it with `provideSvTooltipGroup()` in a component's `providers`, or
 * put `svTooltipGroup` (from `@styloviz/overlays`) on the toolbar element.
 */
export interface SvTooltipGroup {
  /** How long a member should wait before showing, given its own `delay`. */
  delayFor(ownDelay: number): number;
  /** A member became visible; `close` hides it if another one opens. */
  opened(id: string, close: () => void): void;
  /** A member hid. */
  closed(id: string): void;
}

export interface SvTooltipGroupOptions {
  /** The delay before the FIRST tooltip of the group shows, in ms. @default 600 */
  readonly delay?: number | (() => number);
  /** For this long after one hides, the next shows without a delay, in ms. @default 300 */
  readonly skipDelay?: number | (() => number);
  /** Clock seam for tests. @default Date.now */
  readonly now?: () => number;
}

export const SV_TOOLTIP_GROUP = new InjectionToken<SvTooltipGroup>('SV_TOOLTIP_GROUP');

const read = (v: number | (() => number) | undefined, fallback: number): number =>
  Math.max(0, (typeof v === 'function' ? v() : v) ?? fallback);

/** A group, without DI — for tests, or a host composing its own. */
export function createSvTooltipGroup(options: SvTooltipGroupOptions = {}): SvTooltipGroup {
  const now = options.now ?? Date.now;
  const open = new Map<string, () => void>();
  let lastClosed = Number.NEGATIVE_INFINITY;
  return {
    delayFor(ownDelay) {
      // ★ Already reading: a sibling is up, or one went down a moment ago.
      if (open.size > 0 || now() - lastClosed < read(options.skipDelay, 300)) return 0;
      return ownDelay > 0 ? ownDelay : read(options.delay, 600);
    },
    opened(id, close) {
      for (const [other, hide] of [...open]) if (other !== id) hide();
      open.set(id, close);
    },
    closed(id) {
      if (open.delete(id)) lastClosed = now();
    },
  };
}

/** Provide a tooltip group to every tooltip under this injector. */
export function provideSvTooltipGroup(options: SvTooltipGroupOptions = {}): Provider[] {
  return [{ provide: SV_TOOLTIP_GROUP, useFactory: () => createSvTooltipGroup(options) }];
}
