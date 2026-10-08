import { Injectable, computed, signal, type Signal } from '@angular/core';

/**
 * Where a banner is pinned. `inline` banners never register — they are in the
 * document flow and cannot collide.
 */
export type SvBannerSlot = 'top-fixed' | 'bottom-fixed' | 'top-sticky';

/** What a banner tells the stack about itself. */
export interface SvBannerRegistration {
  /** Which edge it is pinned to. */
  readonly slot: SvBannerSlot;
  /**
   * Higher wins the edge. Equal priorities keep registration order.
   *
   * ★ A number rather than a `'low' | 'high'` union: an app's fourth banner is
   *   always the one that has to go between two of the first three.
   */
  readonly priority: number;
  /** Identity for suppression, or `null` to never suppress (`OF-01-M2`). */
  readonly dedupeKey: string | null;
}

export interface SvBannerHandle {
  /** Slot-relative order, 0 = against the edge. -1 while suppressed. */
  readonly index: Signal<number>;
  /** Pixels from the edge: the summed height of the banners before this one. */
  readonly offset: Signal<number>;
  /**
   * True when an identical banner (same `dedupeKey`, same slot) registered
   * first. A suppressed banner renders nothing.
   */
  readonly suppressed: Signal<boolean>;
  /** Report this banner's rendered height so the ones after it can be placed. */
  measured(height: number): void;
  /**
   * Leave the stack.
   *
   * ★ Idempotent because the removal IS a filter by id, not because anything
   *   remembers having been called. A `released` flag was written here first
   *   and no mutation could tell it from its absence — a second filter for an
   *   id nothing holds removes nothing — so it went, like the same flag in
   *   `SvOverlayRouteService`.
   */
  release(): void;
}

interface Entry {
  readonly id: number;
  readonly reg: SvBannerRegistration;
  readonly height: ReturnType<typeof signal<number>>;
}

let _seq = 0;

/** Separator for the slot-scoped dedupe key: a NUL, which no message contains. */
const KEY_SEP = '\x00';

/**
 * SvBannerStackService — who gets the edge, and how far down the next one sits
 * (`X-12`, `OF-01-I1`, `OF-01-M1`, `OF-01-M2`).
 *
 * ── The finding ─────────────────────────────────────────────────────────────
 *
 * ★★★ TWO `top-fixed` BANNERS GOT BYTE-IDENTICAL `fixed top-0 left-0 right-0
 *     z-50`, SO ONE WAS SIMPLY NEVER SEEN. Not clipped, not below the fold —
 *     painted underneath the other, in the same place, with nothing to suggest
 *     a second message existed. The dangerous shape is the ordinary one: a
 *     shell renders a maintenance notice and a route renders a trial-expiry
 *     notice, neither knowing about the other.
 *
 * ── Why a service rather than a container component ─────────────────────────
 *
 * ★★ THE BANNERS DO NOT SHARE A PARENT, and that is the whole problem. They
 *    are rendered by whoever has the message — a shell, a route, a lazily
 *    loaded panel — so a wrapper component would coordinate only the ones a
 *    single author remembered to put inside it. A root service is reachable
 *    from all of them and needs no cooperation from the tree.
 *
 * ★ Nothing registers unless it is pinned. An `inline` banner is in the
 *   document flow: it cannot overlap anything, and giving it a slot would make
 *   it push a fixed banner down for no reason.
 */
@Injectable({ providedIn: 'root' })
export class SvBannerStackService {
  private readonly _entries = signal<readonly Entry[]>([]);

  /**
   * The entries actually shown, in paint order.
   *
   * ★★ SUPPRESSION IS DECIDED HERE AND NOT BY THE BANNER, because it depends
   *    on what else is on screen. The FIRST registration with a key keeps the
   *    slot; later identical ones render nothing — first rather than last for
   *    the same reason a deduplicated toast keeps its place: the user may
   *    already be reading it, or acting on it.
   */
  private readonly _visible = computed<readonly Entry[]>(() => {
    const seen = new Set<string>();
    const kept: Entry[] = [];
    for (const entry of this._entries()) {
      const key = entry.reg.dedupeKey;
      if (key !== null) {
        const scoped = entry.reg.slot + KEY_SEP + key;
        if (seen.has(scoped)) continue;
        seen.add(scoped);
      }
      kept.push(entry);
    }
    // ★ A STABLE sort by priority, so equal priorities keep registration order
    //   — otherwise two banners of equal weight swap places whenever a third
    //   arrives, which reads as the page glitching. `Array.prototype.sort` is
    //   specified as stable, so this is the whole implementation.
    return [...kept].sort((a, b) => b.reg.priority - a.reg.priority);
  });

  /** How many banners are visible in a slot. */
  visibleCount(slot: SvBannerSlot): number {
    return this._visible().filter((e) => e.reg.slot === slot).length;
  }

  register(reg: SvBannerRegistration): SvBannerHandle {
    const entry: Entry = { id: ++_seq, reg, height: signal(0) };
    this._entries.update((list) => [...list, entry]);

    const ownSlot = computed(() => this._visible().filter((e) => e.reg.slot === reg.slot));
    const index = computed(() => ownSlot().findIndex((e) => e.id === entry.id));

    return {
      index,
      suppressed: computed(() => index() === -1),
      offset: computed(() => {
        const group = ownSlot();
        const at = index();
        if (at <= 0) return 0;
        // ★ Heights are REPORTED, not measured here. This service has no
        //   element and no business touching the DOM; a banner knows its own
        //   height and says so. An unreported height is 0, which stacks them
        //   again — honest, because the alternative is inventing a number and
        //   leaving a gap where no banner is.
        return group.slice(0, at).reduce((sum, e) => sum + e.height(), 0);
      }),
      measured: (height: number) => entry.height.set(Math.max(0, height)),
      release: () => {
        this._entries.update((list) => list.filter((e) => e.id !== entry.id));
      },
    };
  }
}
