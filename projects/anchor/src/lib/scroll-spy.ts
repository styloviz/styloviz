import { DestroyRef, computed, effect, inject, signal, untracked, type Signal } from '@angular/core';
import {
  svActivationThresholds,
  svPickActiveSection,
  svSectionSnapshot,
  type AnchorActivation,
  type SvSectionSnapshot,
  type SvVerticalRect,
} from './activation-strategy';

/**
 * One trackable section: a stable `id` and the element whose visibility
 * decides whether that id is "current."
 */
export interface ScrollSpySection {
  readonly id: string;
  readonly el: HTMLElement;
}

export interface ScrollSpyOptions {
  /** The sections to track, in the order they should win ties (document order). */
  readonly sections: Signal<readonly ScrollSpySection[]>;
  /** Scroll container to measure intersection against. `null` = the viewport. @default null */
  readonly root?: Signal<HTMLElement | null>;
  /**
   * Shrinks the observed viewport from its edges — the classic scrollspy
   * trick. The default biases the "active" band toward the top ~32% of the
   * root, so a section is marked current as soon as its heading crosses that
   * line, not only once it fills the whole viewport.
   *
   * ⚠️ This shapes **when the observer wakes up**, and for `'first-visible'` it
   * also shapes the answer. For every other strategy the answer comes from the
   * geometry re-measured in the callback, and `offset` is what positions the
   * activation line.
   * @default '0px 0px -68% 0px'
   */
  readonly rootMargin?: Signal<string>;
  /**
   * Which reading of "current" to apply — see {@link AnchorActivation} for the
   * table of what each one survives.
   * @default 'last-passed'
   */
  readonly strategy?: Signal<AnchorActivation>;
  /**
   * Pixels between the top of the root and the **activation line** — the height
   * of a sticky header the reader cannot see through. Geometry is measured
   * relative to that line, not to the top of the container.
   * @default 0
   */
  readonly offset?: Signal<number>;
}

export interface ScrollSpy {
  /** The section currently considered "in view," or `null` before anything has been observed. */
  readonly activeId: Signal<string | null>;
  /** Disconnect the observer. Called automatically on the owning component's destroy. */
  destroy(): void;
}

const DEFAULT_ROOT: Signal<HTMLElement | null> = computed(() => null);
const DEFAULT_ROOT_MARGIN: Signal<string> = computed(() => '0px 0px -68% 0px');
const DEFAULT_STRATEGY: Signal<AnchorActivation> = computed(() => 'last-passed');
const DEFAULT_OFFSET: Signal<number> = computed(() => 0);

/**
 * The IntersectionObserver mechanic behind "on this page" navigation,
 * extracted from the showcase's own `sv-showcase-quick-nav` floating menu so
 * a second, third… Nth scrollspy doesn't re-derive it by hand. Deliberately
 * does NOT discover sections itself — the showcase menu finds its variants by
 * a bespoke `data-variant-title` DOM query, `SvAnchorComponent` (this
 * package) finds them by element id, and a third consumer might track
 * `IntersectionObserver`-visible `<h2>`s directly. All three only need to
 * supply `{ id, el }[]`; this owns turning that into "which one is active."
 *
 * ★ **The observer is the trigger; `activation-strategy.ts` is the answer.**
 * This file measures and knows nothing about what "current" means; that file
 * decides and touches no DOM. The split is what makes the four strategies
 * testable on a platform with no layout — see `activation-strategy.spec.ts`.
 *
 * ⚠️ **`strategy` defaults to `'last-passed'`, which is a change of behaviour**
 * from the fixed `threshold: 0` rule this used to hard-code. See
 * {@link AnchorActivation} and `docs/anchor-activation-adr.md`; pass
 * `'first-visible'` for the old answer.
 *
 * Call it from a component field initializer (or pass an explicit injection
 * context) — it needs one for `effect()` and automatic cleanup via
 * `DestroyRef`, the same requirement `svDataController` and `createStreamOverlay`
 * document for the same reason.
 *
 * ```ts
 * class TableOfContents {
 *   private readonly sections = computed(() => this.headings().map(h => ({ id: h.id, el: h.el })));
 *   protected readonly spy = createScrollSpy({ sections: this.sections });
 *   // spy.activeId() is the heading the reader most recently scrolled past.
 * }
 * ```
 */
export function createScrollSpy(options: ScrollSpyOptions): ScrollSpy {
  const root = options.root ?? DEFAULT_ROOT;
  const rootMargin = options.rootMargin ?? DEFAULT_ROOT_MARGIN;
  const strategy = options.strategy ?? DEFAULT_STRATEGY;
  const offset = options.offset ?? DEFAULT_OFFSET;

  const activeId = signal<string | null>(null);
  /** The observer's last verdict per id. Survives with no layout; see the strategy file. */
  const visible = new Map<string, boolean>();
  let observer: IntersectionObserver | null = null;

  const teardown = (): void => {
    observer?.disconnect();
    observer = null;
    visible.clear();
  };

  /**
   * The band the geometry is relative to: from the activation line (root top
   * plus the sticky-header offset) to the bottom of the root.
   *
   * ⚠️ Measured from the element, not from `entry.rootBounds`. `rootBounds` is
   * the root already shrunk by `rootMargin`, so a `-68%` bottom margin would
   * make "most visible" mean "most visible in the top third of the screen" —
   * the trigger configuration silently redefining the answer.
   */
  const measureBand = (): SvVerticalRect => {
    const el = untracked(root);
    const pad = untracked(offset);
    const rect = el?.getBoundingClientRect();
    const viewport = typeof window === 'undefined' ? 0 : window.innerHeight;
    return { top: (rect?.top ?? 0) + pad, height: (rect?.height ?? viewport) - pad };
  };

  /**
   * Re-measure every section and let the strategy choose.
   *
   * `null` from the strategy means "no opinion", and the previous id is kept —
   * a reader between two sections, or at an edge of the page, should not see the
   * rail go blank.
   */
  const recompute = (sections: readonly ScrollSpySection[]): void => {
    const band = measureBand();
    const snapshots = new Map<string, SvSectionSnapshot>();
    for (const s of sections) {
      snapshots.set(
        s.id,
        svSectionSnapshot(s.el.getBoundingClientRect(), band, visible.get(s.id) === true),
      );
    }

    const next = svPickActiveSection(
      sections.map((s) => s.id),
      snapshots,
      untracked(strategy),
    );
    if (next !== null) activeId.set(next);
  };

  const setup = (sections: readonly ScrollSpySection[]): void => {
    teardown();
    if (typeof IntersectionObserver === 'undefined' || sections.length === 0) {
      activeId.set(null);
      return;
    }

    const idByEl = new Map<HTMLElement, string>(sections.map((s) => [s.el, s.id]));
    const thresholds = svActivationThresholds(untracked(strategy));

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = idByEl.get(entry.target as HTMLElement);
          if (id !== undefined) visible.set(id, entry.isIntersecting);
        }
        recompute(sections);
      },
      {
        root: untracked(root),
        rootMargin: untracked(rootMargin),
        threshold: typeof thresholds === 'number' ? thresholds : [...thresholds],
      },
    );
    for (const s of sections) observer.observe(s.el);

    // An observer's first callback is asynchronous, and a rail with nothing
    // highlighted for a frame is a visible flicker on every page load. The
    // geometry is already there to be read, so it is read now.
    recompute(sections);
  };

  const watcher = effect(() => {
    // Re-observe from scratch whenever the section list, root, rootMargin or
    // strategy changes — an IntersectionObserver's options are immutable after
    // construction, so there is no cheaper way to react to a new root, and the
    // thresholds depend on the strategy.
    const sections = options.sections();
    root();
    rootMargin();
    strategy();
    offset();
    setup(sections);
  });

  inject(DestroyRef, { optional: true })?.onDestroy(() => {
    watcher.destroy();
    teardown();
  });

  return {
    activeId: activeId.asReadonly(),
    destroy: () => {
      watcher.destroy();
      teardown();
    },
  };
}
