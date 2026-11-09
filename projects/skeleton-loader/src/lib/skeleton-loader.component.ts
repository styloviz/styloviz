import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
/*
 * ⚠️ THIS IMPORT IS WHY `tsconfig.lib.json` CARRIES A `paths` OVERRIDE, and the
 *    package did not build at all without it.
 *
 * The root tsconfig maps `@styloviz/*` to library SOURCE — right for the app
 * and for specs, wrong here: ng-packagr compiles an entry point in PARTIAL
 * mode, so resolving `@styloviz/core` to `projects/core/src` drags that whole
 * tree into a partial compilation and ngc dies with
 *
 *     Cannot destructure property 'pos' of 'file.referencedFiles[index]'
 *
 * — a crash with no file, no line and no mention of this package. Every other
 * package importing `@styloviz/core` carries the same override; this one was
 * the exception, which is why it was the only one of 107 that never built and
 * why `dist/@styloviz/skeleton-loader` had never existed.
 *
 * ★ The gate that would have caught it is `build:libs`, and it did — but it
 *   stops at the first failure, so the earlier `ng build pro` collision was
 *   hiding it. Two independent causes, one symptom.
 */
import { SvLiveAnnouncer } from '@styloviz/core/a11y';
import { createDelayedVisibility, createWaitEscalation, type SvWaitStage } from '@styloviz/core/feedback';
import { injectSvLabels } from '@styloviz/core/i18n';
import { SV_SKELETON_LOADER_LABELS } from './skeleton-loader.labels';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Primitive shape rendered by a single skeleton bone.
 * - `line`   — full-width text line (variable height)
 * - `circle` — circular avatar / icon placeholder
 * - `rect`   — arbitrary rectangle (image, card, banner)
 * - `badge`  — small pill-shaped inline chip
 * - `button` — rounded-lg rectangle mimicking a CTA
 */
export type SkeletonShape = 'line' | 'circle' | 'rect' | 'badge' | 'button';

/**
 * Animation style for the shimmer effect.
 * - `pulse` — fade in/out (CSS `animate-pulse`)
 * - `wave`  — left-to-right sweep shimmer
 * - `none`  — static, no animation (reduced-motion-friendly)
 */
export type SkeletonAnimation = 'pulse' | 'wave' | 'none';

/**
 * High-level preset that renders a complete composed skeleton layout.
 * When set, all individual bone inputs are ignored.
 *
 * - `text-block`      — 3–4 lines of text
 * - `paragraph`       — avatar + multi-line text block
 * - `card`            — image placeholder + title + 2 body lines
 * - `stat-card`       — icon + big number + label + trend chip
 * - `table-row`       — one full table row (avatar + 4 cells)
 * - `table`           — 5 stacked table-rows
 * - `list-item`       — avatar + two text lines side-by-side
 * - `list`            — 5 stacked list-items
 * - `profile-header`  — large avatar + name/role text stack
 * - `form`            — label + input × 3 + button
 * - `dashboard`       — 3 stat-cards + a chart placeholder
 * - `custom`          — fall-through: renders the single bone inputs
 */
export type SkeletonPreset =
  | 'text-block'
  | 'paragraph'
  | 'card'
  | 'stat-card'
  | 'table-row'
  | 'table'
  | 'list-item'
  | 'list'
  | 'profile-header'
  | 'form'
  | 'dashboard'
  | 'custom';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SkeletonLoader — Lightweight, composable content placeholder.
 *
 * Two usage modes:
 *
 * 1. **Preset** — pass a `preset` input and get a fully composed layout
 *    (stat-card, table, form, dashboard, …) with a single tag.
 *
 * 2. **Single bone** — omit `preset` (or use `preset="custom"`) and
 *    control `shape`, `width`, `height`, `rounded`, `lines` individually
 *    to build bespoke skeletons via composition.
 *
 * Animation is driven purely by Tailwind utilities — no extra CSS file needed.
 */
@Component({
  selector: 'sv-skeleton-loader',
  standalone: true,
  templateUrl: './skeleton-loader.component.html',
  styleUrl: './skeleton-loader.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The wave's sheen per theme, read by `.skeleton-wave::after` — see the
  // stylesheet for why this cannot be a `:where(.dark)` rule there.
  host: {
    // ★ Balanced per theme (FL-J3-OF-19, `OF-17-I4`): at 0.35 the light sheen
    //   moved the bone's contrast by 1.08:1 — invisible — while the dark one
    //   was already 1.2:1. 0.5 brings light to 1.11:1, inside the same "seen,
    //   not dazzling" band (`skeleton-loader.contrast.spec.ts`).
    class: '[--sv-skeleton-sheen:rgb(255_255_255/0.5)] dark:[--sv-skeleton-sheen:rgb(255_255_255/0.06)]',
  },
})
export class SvSkeletonLoaderComponent {
  protected readonly labels = injectSvLabels('skeletonLoader', SV_SKELETON_LOADER_LABELS);

  // ── Mode ──────────────────────────────────────────────────────────────────

  /**
   * High-level composed preset.
   * Set to `'custom'` (or omit) to control individual bone inputs.
   * @default 'custom'
   */
  preset = input<SkeletonPreset>('custom');

  // ── Single-bone controls (used when preset === 'custom') ──────────────────

  /** Shape of the skeleton bone. @default 'line' */
  shape = input<SkeletonShape>('line');

  /**
   * CSS width applied to the bone element.
   * Accepts any valid CSS value: `'100%'`, `'8rem'`, `'w-1/2'` (Tailwind class).
   * @default '100%'
   */
  width = input<string>('100%');

  /**
   * CSS height applied to the bone element.
   * @default '1rem'
   */
  height = input<string>('1rem');

  /**
   * Border-radius override.
   * Accepts Tailwind rounded-* class suffix: `'none'` `'sm'` `'md'` `'lg'` `'xl'` `'full'`.
   * Shape defaults apply when left empty.
   * @default ''
   */
  rounded = input<string>('');

  /**
   * Repeat this bone N times stacked vertically.
   * Gaps between repeated lines are automatic.
   * @default 1
   */
  lines = input<number>(1);

  /**
   * When `lines > 1`, make the last line shorter (like a real paragraph ending).
   * @default true
   */
  shortLastLine = input<boolean>(true);

  // ── Appearance ────────────────────────────────────────────────────────────

  /** Shimmer animation style. @default 'wave' */
  animation = input<SkeletonAnimation>('wave');

  /**
   * Overall size multiplier that scales preset bone heights.
   * @default 'md'
   */
  size = input<'sm' | 'md' | 'lg'>('md');

  /** Additional CSS classes merged onto the root wrapper. */
  customClass = input<string>('');

  /** Accessible label announced to screen readers while content loads. @default 'Loading content…' */
  ariaLabel = input<string>(this.labels.loading);

  /**
   * Whether this skeleton announces the wait itself. @default true
   *
   * ★★ THE ANSWER TO "WHO SAYS LOADING?" (OF-17-I1). Two announcements for one
   *    wait is worse than none — the reader hears the same thing twice from
   *    two regions and neither tells them when it ended. Exactly one owner:
   *
   *      • **The skeleton** (default). It is `role="status"` with `ariaLabel`,
   *        and the host leaves its own region alone.
   *      • **The host**, when it marks its region `aria-busy` around the swap
   *        and announces the transition itself — which is the better pattern
   *        whenever the host can say what arrived. Set `announce` false and
   *        this becomes `aria-hidden` decoration.
   */
  announce = input<boolean>(true);

  // ── Escalation (OF-17-I7 / OF-17-M6) ──────────────────────────────────────

  /**
   * Say "this is taking longer than usual" after this many ms. `0` = never.
   *
   * ★★★ A STUCK SKELETON IS INDISTINGUISHABLE FROM A FAILED REQUEST, AND IT
   *     LIES IN THE EXACT PLACE THE DATA WAS GOING. It says "the shape of your
   *     content is arriving" — permanently, if the host's request failed
   *     silently. There was no timeout, no error and no retry: the placeholder
   *     simply outlived the thing it was standing in for.
   *
   * ★ Off by default, because the honest threshold depends on what is loading
   *   and because turning it on adds text to every existing layout.
   *
   * @default 0
   */
  slowAfterMs = input<number>(0);

  /**
   * Escalate to a stuck message (with a retry offer) after this many ms.
   * Measured from the same start, not from `slowAfterMs`. `0` = never.
   * @default 0
   */
  stalledAfterMs = input<number>(0);

  /** Message shown at the `slow` stage. @default 'This is taking longer than usual…' */
  slowMessage = input<string>(this.labels.slow);

  /** Message shown at the `stalled` stage. @default 'This content could not be loaded.' */
  stalledMessage = input<string>(this.labels.stalled);

  /**
   * Label for the retry offer shown once the wait is `stalled`. `null` = none.
   *
   * ★★ AN OUTPUT CANNOT BE ASKED WHETHER ANYONE IS LISTENING, so the offer is
   *    an input: a placeholder that renders "Try again" and does nothing when
   *    it is pressed is worse than one that never offered.
   *
   * @default null
   */
  retryLabel = input<string | null>(null);

  /** The user pressed the retry offer on a stalled skeleton. */
  readonly retry = output<void>();

  // ── Delayed show / minimum duration (FL-J3-OF-06, `OF-17-M4`) ──────────────

  /**
   * Whether the wait is in progress. Bind it — `[active]="loading()"` — and
   * keep the skeleton mounted when using `showAfterMs` / `minVisibleMs`: a
   * skeleton the host removes cannot stay for its minimum. @default true
   */
  active = input<boolean>(true);

  /**
   * Appear only once the wait has lasted this long, in ms, so a fast response
   * never flashes bones. `0` shows at once. @default 0
   */
  showAfterMs = input<number>(0);

  /**
   * Once shown, stay at least this long, in ms — a skeleton visible for 80 ms
   * is a flicker. `0` hides with `active`. Watch `(visibleChange)` (or use
   * `createDelayedVisibility` from `@styloviz/core`) to swap the content in at
   * the same moment. @default 0
   */
  minVisibleMs = input<number>(0);

  /** Emits whenever the skeleton appears (`true`) or leaves (`false`). */
  readonly visibleChange = output<boolean>();

  private readonly _delayed = createDelayedVisibility(() => this.active(), {
    showAfterMs: () => this.showAfterMs(),
    minVisibleMs: () => this.minVisibleMs(),
  });

  /**
   * Whether anything renders. With both delays at 0 it IS `active`, read
   * synchronously — today's behaviour exactly.
   */
  readonly shown = computed<boolean>(() =>
    this.showAfterMs() <= 0 && this.minVisibleMs() <= 0 ? this.active() : this._delayed(),
  );

  /** Set after the first browser render — see the visibility effect. */
  private _rendered = false;
  /** What `shown()` was at the last render or transition. */
  private _wasShown = false;

  /** Fires on each escalation: `'slow'`, then `'stalled'`. */
  readonly escalated = output<SvWaitStage>();

  private readonly _platformId = inject(PLATFORM_ID);

  private readonly _wait = createWaitEscalation({
    slowAfterMs: this.slowAfterMs,
    stalledAfterMs: this.stalledAfterMs,
    destroyRef: inject(DestroyRef),
  });

  /** `idle` · `waiting` · `slow` · `stalled`. */
  readonly waitStage = this._wait.stage;

  /** The message for the current stage, or `null` while the wait is normal. */
  readonly waitMessage = computed<string | null>(() => {
    switch (this._wait.stage()) {
      case 'stalled': return this.stalledMessage();
      case 'slow': return this.slowMessage();
      default: return null;
    }
  });

  /** True when the retry offer should be shown. */
  readonly retryOffered = computed<boolean>(
    () => this._wait.stalled() && this.retryLabel() !== null,
  );

  /**
   * ★★ THE SKELETON'S EXISTENCE IS THE WAIT. It has no `loading` input: a host
   *    renders it while waiting and removes it when the content arrives, so
   *    the clock starts when the component does and stops when it is
   *    destroyed. Which is why `start()` must be idempotent — this effect
   *    re-runs whenever either threshold changes.
   */
  /**
   * The shared polite announcer, scoped to this skeleton.
   *
   * ★★★ `role="status"` + `aria-label` ON INSERTION IS USUALLY SILENT. A live
   *     region announces changes to its content, and this one is born with its
   *     name and has no content — so "the skeleton announces by default" was
   *     not something the markup could actually do. The label is said once
   *     through the kit's shared announcer when the skeleton first renders;
   *     the region keeps its role for semantics and for the escalation text
   *     that appears inside it later. `[announce]="false"` says nothing, as
   *     before — the host owns the wait.
   */
  private readonly _announcer = inject(SvLiveAnnouncer).scoped();

  constructor() {
    // Browser-only and torn down with the component: a skeleton destroyed
    // before it paints says nothing. Several skeletons with the same label in
    // one tick are one announcement — the announcer de-duplicates.
    afterNextRender({
      read: () => {
        // ★ Explicit: `afterNextRender` keys off the build-time `ngServerMode`
        //   flag, not the injected PLATFORM_ID.
        if (!isPlatformBrowser(this._platformId)) return;
        this._rendered = true;
        this._wasShown = this.shown();
        if (this._wasShown && this.announce()) this._announcer.announce(this.ariaLabel(), { priority: 'polite' });
      },
    });

    // ★ A skeleton that appears LATE (`showAfterMs`) is announced when it
    //   appears, not at mount when nothing was on screen.
    effect(() => {
      const shown = this.shown();
      untracked(() => {
        if (!this._rendered || shown === this._wasShown) return;
        this._wasShown = shown;
        this.visibleChange.emit(shown);
        if (shown && this.announce()) this._announcer.announce(this.ariaLabel(), { priority: 'polite' });
      });
    });

    effect(() => {
      if (!isPlatformBrowser(this._platformId)) return;
      if (this.slowAfterMs() > 0 || this.stalledAfterMs() > 0) this._wait.start();
    });

    effect(() => {
      const stage = this._wait.stage();
      if (stage === 'slow' || stage === 'stalled') this.escalated.emit(stage);
    });
  }

  /** Bound to the retry offer. */
  requestRetry(): void {
    this.retry.emit();
  }

  // ── Computed helpers ──────────────────────────────────────────────────────

  isPreset = computed(() => this.preset() !== 'custom');

  /** Base class applied to every individual bone element. */
  boneBase = computed<string>(() => {
    const anim: Record<SkeletonAnimation, string> = {
      pulse: 'animate-pulse motion-reduce:animate-none',
      wave:  '',      // wave uses a pseudo-element driven by CSS (reduced-motion handled there)
      none:  '',
    };
    return [
      // ★ Forced colours repaint a tinted `div` as Canvas, and every bone
      //   vanished into the page. `GrayText` keeps the placeholder's shape.
      'bg-gray-200 dark:bg-gray-700 forced-colors:bg-[GrayText]',
      anim[this.animation()],
    ].filter(Boolean).join(' ');
  });

  /** Additional class added when animation === 'wave' to enable the shimmer sweep. */
  waveClass = computed<string>(() =>
    this.animation() === 'wave' ? 'skeleton-wave' : ''
  );

  /** Lines array for the repeater. Last line gets a width reduction. */
  lineItems = computed<{ width: string }[]>(() => {
    const count    = Math.max(1, this.lines());
    const baseW    = this.width();
    const shortLast = this.shortLastLine();
    return Array.from({ length: count }, (_, i) => ({
      width: shortLast && i === count - 1 && count > 1 ? '65%' : baseW,
    }));
  });

  /** Rounded class derived from shape or `rounded` override. */
  roundedClass = computed<string>(() => {
    const override = this.rounded();
    if (override) return `rounded-${override}`;
    switch (this.shape()) {
      case 'circle': return 'rounded-full';
      case 'badge':  return 'rounded-full';
      case 'button': return 'rounded-lg';
      case 'line':   return 'rounded-md';
      default:       return 'rounded-lg';
    }
  });

  // ── Preset line-height helper ─────────────────────────────────────────────

  lineH = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return '0.75rem';
      case 'lg': return '1.125rem';
      default:   return '0.875rem';
    }
  });

  avatarSz = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return '2rem';
      case 'lg': return '3rem';
      default:   return '2.5rem';
    }
  });

  iconSz = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return '2rem';
      case 'lg': return '3rem';
      default:   return '2.5rem';
    }
  });

  /**
   * The icon bone inside the `stat-card` and `dashboard` presets.
   *
   * ★★ SEPARATE FROM `iconSz` BECAUSE IT IS PINNED, NOT CHOSEN. `sv-stat-card`
   *    draws its own loading icon at 2rem, and this preset stands in for that
   *    card — so `md` has to be 2rem rather than the 2.5rem the generic icon
   *    bone uses, or the preset hands the card back a different layout than it
   *    was holding (`OF-17-I5`). `sm` and `lg` scale around the pinned middle
   *    so the `size` multiplier still means something.
   */
  statIconSz = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return '1.75rem';
      case 'lg': return '2.5rem';
      default:   return '2rem';
    }
  });
}
