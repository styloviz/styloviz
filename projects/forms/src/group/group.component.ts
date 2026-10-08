import {
  AfterViewInit,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { svDescribedBy, SvFieldErrorComponent, svUniqueId } from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GroupOrientation = 'vertical' | 'horizontal';
export type GroupVariant     = 'default' | 'bordered' | 'filled' | 'card';
export type GroupGap         = 'none' | 'xs' | 'sm' | 'md' | 'lg';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SvGroupComponent — Flexible grouping container for form fields, button groups,
 * toolbars and other visually related sets of controls.
 *
 * Features:
 * - Semantic role="group" with aria-labelledby for accessibility
 * - Vertical or horizontal child layout
 * - 4 visual variants: default, bordered, filled, card
 * - Fused mode: edge-to-edge children for button groups and input addons
 * - Optional dividers between children
 * - Optional collapsible section with smooth height animation
 */
@Component({
  selector: 'sv-group',
  standalone: true,
  imports: [SvIconComponent, SvFieldErrorComponent, NgClass],
  templateUrl: './group.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvGroupComponent implements OnInit, AfterViewInit, OnDestroy {
  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Section label shown above children. */
  label = input<string>('');

  /** Optional description text below the label. */
  description = input<string>('');

  /** Layout direction of children. @default 'vertical' */
  orientation = input<GroupOrientation>('vertical');

  /** Visual style variant. @default 'default' */
  variant = input<GroupVariant>('default');

  /** Gap between children (ignored when fused=true). @default 'md' */
  gap = input<GroupGap>('md');

  /**
   * Fuse children edge-to-edge — removes gap and unifies border-radius.
   * Use for button groups, input addons and toolbars. @default false
   */
  fused = input<boolean>(false);

  /**
   * Add dividing lines between children.
   * Direction matches orientation (divide-y vertical, divide-x horizontal). @default false
   */
  divide = input<boolean>(false);

  /** Whether the group is collapsible. @default false */
  collapsible = input<boolean>(false);

  /**
   * Desired collapsed state (requires `collapsible=true`). @default false
   *
   * Honoured on init **and** on every later change, but a collapse is refused
   * while the group has an error and `expandOnError` is on — see
   * `_requestCollapse`. `collapsedChange` always reports the group's real
   * state, so a host mirroring this input is told when its request was refused.
   */
  collapsed = input<boolean>(false);

  // ── Validation ────────────────────────────────────────────────────────────
  //
  // ★★ A GROUP IS A FIELDSET, AND A FIELDSET IS WHERE SOME ERRORS BELONG.
  //    "Select at least one" is not true of any single checkbox — it is true of
  //    the set. Hanging it on the first option (the only place there was room
  //    for it) says the first option is invalid, which it is not, and leaves
  //    every other option describing itself with nothing. `FI-06-M1`.
  //
  //    This container had no error surface at all, so a form could reject a
  //    group and have nowhere to say so.

  /**
   * A validation message about the group as a whole — "Select at least one
   * option", "These dates overlap".
   *
   * Rendered in an `role="alert"` slot, pointed at by the container's
   * `aria-describedby`, and paired with `aria-invalid` on the `role="group"`.
   *
   * **There is deliberately no `serverError` here**, unlike every field control
   * in the kit. `createFieldError` self-expires a server rejection against the
   * value it was reported about; a group owns no value and cannot see its
   * children change, so the anchor could never move. A self-expiring error that
   * never expires is worse than not offering one — a group-level rejection from
   * the server goes here, and the host clears it when it re-validates.
   */
  errorMessage = input<string>('');

  /**
   * How many fields inside this group are currently invalid.
   *
   * Rendered as a badge on the header **while the group is collapsed**, which
   * is the only time it tells the user something they cannot already see
   * (`FI-11-M1`). Expanded, the errors are on screen and a second count beside
   * the legend is noise.
   *
   * The host owns this number: the group projects arbitrary content and has no
   * business reaching into it to count `aria-invalid`.
   */
  errorCount = input<number>(0);

  /**
   * Never leave an error hidden behind a collapsed header. @default true
   *
   * Refuses a **programmatic** collapse while the group has an error, and
   * expands a collapsed group the moment one appears. A collapse the **user**
   * asked for is still honoured — see `toggleCollapse`.
   */
  expandOnError = input(true, { transform: booleanAttribute });

  // ── Outputs ───────────────────────────────────────────────────────────────

  /**
   * The group's collapsed state changed.
   *
   * Always carries the **real** state, including when that is not the state
   * that was asked for: a refused collapse emits `false`, and an auto-expand
   * emits `false` too, so a host mirroring `collapsed` is never left out of
   * sync with what is on screen.
   */
  collapsedChange = output<boolean>();

  // ── State ─────────────────────────────────────────────────────────────────

  readonly _uid = svUniqueId('sv-group');
  readonly isCollapsed = signal(false);

  /** Id of the description paragraph, so the container can point at it. */
  readonly descriptionId = `${this._uid}-desc`;
  /** Id of the group-level error slot. */
  readonly errorId = `${this._uid}-error`;
  /** Id of the collapsed-header error count. */
  readonly errorCountId = `${this._uid}-error-count`;

  /** True when the group has anything to report — a message, a child count, or both. */
  readonly hasError = computed(() => !!this.errorMessage() || this.errorCount() > 0);

  /**
   * Show the child error count on the header.
   *
   * Collapsed only: expanded, every one of those errors is already on screen
   * beside the field it belongs to.
   */
  readonly showErrorCount = computed(() => this.errorCount() > 0 && this.isCollapsed());

  /**
   * What the `role="group"` container is described by.
   *
   * The description was rendered and associated with nothing before this — a
   * paragraph under the legend that a screen reader reaching the group never
   * heard. All three parts can be present at once and `aria-describedby` takes
   * a list, so they compose rather than displace each other (`FI-27-M1`).
   */
  readonly describedBy = computed<string | null>(() =>
    svDescribedBy({
      hint: !!this.description() && this.descriptionId,
      error: !!this.errorMessage() && this.errorId,
      // `extra`, not `count`: that slot is for a live typing constraint ("35
      // characters remaining"), and this is a tally of rejections. Same
      // position in the reading order, honest about which part it is.
      extra: [this.showErrorCount() && this.errorCountId],
    }),
  );

  /** Plural-correct suffix for the count badge's screen-reader text. */
  readonly errorCountLabel = computed(() =>
    this.errorCount() === 1 ? '1 field needs attention' : `${this.errorCount()} fields need attention`,
  );

  private readonly contentRef = viewChild<ElementRef<HTMLDivElement>>('groupContent');

  /** ngOnInit owns the first value of `collapsed`; the effect below owns the rest. */
  private _initialised = false;

  constructor() {
    // A change to `collapsed` after init is a request, not a command — the
    // error guard can refuse it. Idempotent: a `collapsed` that already matches
    // the group's state does nothing, which is what the first run after
    // ngOnInit always is.
    effect(() => {
      const want = this.collapsed();
      if (!this._initialised) return;
      untracked(() => {
        if (want !== this.isCollapsed()) this._requestCollapse(want);
      });
    });

    // ★ AN ERROR INSIDE A COLLAPSED GROUP IS AN ERROR NOBODY CAN SEE. A form
    //   that rejects on submit and leaves the reason behind a chevron is a form
    //   the user cannot complete — they are told something is wrong and shown
    //   nothing wrong. `FI-11-M2`.
    effect(() => {
      if (!this.hasError() || !this.expandOnError()) return;
      untracked(() => {
        if (this.isCollapsed()) {
          this.isCollapsed.set(false);
          this.collapsedChange.emit(false);
          const el = this.contentRef()?.nativeElement;
          if (el) this._animateOpen(el);
        }
      });
    });
  }

  ngOnInit(): void {
    // Inputs are guaranteed to be set by ngOnInit, and `ngAfterViewInit` needs
    // the resolved value to decide whether to hide the region without
    // animating. A group asked to start collapsed over an error starts
    // expanded instead — the guard applies to the initial value exactly as it
    // does to a later one.
    //
    // Silent on purpose. The effect above runs next, sees a `collapsed` that
    // still disagrees with the resolved state, and emits the refusal once.
    // Reporting it here as well would emit `false` twice for one decision.
    this.isCollapsed.set(this.collapsed() && !this._collapseRefused());
    this._initialised = true;
  }

  /** Set initial display:none after view is ready, without animation. */
  ngAfterViewInit(): void {
    if (this.collapsible() && this.isCollapsed()) {
      const el = this.contentRef()?.nativeElement;
      if (el) el.style.display = 'none';
    }
  }

  readonly isExpanded = computed(() => !this.isCollapsed());

  // ── Computed class helpers ─────────────────────────────────────────────────

  readonly outerClass = computed<string>(() => {
    const base = 'w-full min-w-0';
    const map: Record<GroupVariant, string> = {
      default:  base,
      bordered: `${base} rounded-md border border-gray-200 px-4 pb-4 pt-3 dark:border-gray-700`,
      filled:   `${base} rounded-md bg-gray-50 px-4 pb-4 pt-3 dark:bg-gray-800/50`,
      card:     `${base} rounded-md border border-gray-200 bg-white px-4 pb-4 pt-3 shadow-sm dark:border-gray-700 dark:bg-gray-900`,
    };
    return map[this.variant()];
  });

  readonly innerClass = computed<string>(() => {
    const horiz = this.orientation() === 'horizontal' || this.fused();
    const dir   = horiz ? 'flex flex-wrap' : 'flex flex-col';

    const gapMap: Record<GroupGap, string> = {
      none: 'gap-0',
      xs:   'gap-2',
      sm:   'gap-3',
      md:   'gap-4',
      lg:   'gap-6',
    };
    const gap = this.fused() ? '' : gapMap[this.gap()];

    const div = this.divide()
      ? (horiz
          ? 'divide-x divide-gray-200 dark:divide-gray-700'
          : 'divide-y divide-gray-200 dark:divide-gray-700')
      : '';

    // Fused: strip child rounding and re-apply only to outer edges.
    // Avoids overflow-hidden (subpixel blur, clipped focus rings).
    // focus-within gives the whole compound control a ring when any part is focused.
    const fuse = this.fused()
      ? 'rounded-md [&>*]:!rounded-none [&>*:first-child]:!rounded-l-md [&>*:last-child]:!rounded-r-md focus-within:ring-2 focus-within:ring-primary-400/50'
      : '';

    return [dir, gap, div, fuse].filter(Boolean).join(' ');
  });

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * The header chevron.
   *
   * A collapse the **user** asked for is always honoured, even with errors
   * inside. Refusing it would mean a control that visibly does nothing when
   * clicked, and the user collapsed the section on purpose — what they must not
   * be is uninformed about what they just hid, which is what the count badge on
   * the header is for. The two halves of `FI-11` compose: `M2` stops the
   * *application* hiding an error, `M1` makes sure the user who hides one knows
   * it is there.
   */
  toggleCollapse(): void {
    this._setCollapsed(!this.isCollapsed());
  }

  /**
   * A collapse asked for by anything other than the user.
   *
   * @returns whether it was applied. A refusal is not queued: if the error
   *   clears later, the group stays open until something asks again.
   */
  private _requestCollapse(next: boolean): boolean {
    if (next && this._collapseRefused()) {
      // Report the real state so a host mirroring `collapsed` learns its
      // request did not take, rather than drifting silently out of sync.
      this.collapsedChange.emit(false);
      return false;
    }
    this._setCollapsed(next);
    return true;
  }

  private _collapseRefused(): boolean {
    return this.expandOnError() && this.hasError();
  }

  private _setCollapsed(next: boolean): void {
    this.isCollapsed.set(next);
    this.collapsedChange.emit(next);

    const el = this.contentRef()?.nativeElement;
    if (!el) return;

    if (next) {
      this._animateClose(el);
    } else {
      this._animateOpen(el);
    }
  }

  ngOnDestroy(): void {
    this._pendingCleanup?.();
  }

  private _pendingCleanup: (() => void) | null = null;

  /**
   * Run `done` when the height transition finishes — or when it is clear that
   * it never will. A zero-height transition fires no `transitionend` at all, and
   * neither does one on an element that is not being rendered, which left the
   * region stuck: `display:none` never applied, inline height never cleared.
   * The target check keeps a transition inside the projected content from
   * ending the region's animation early.
   */
  private _settle(el: HTMLElement, done: () => void): void {
    this._pendingCleanup?.();

    // eslint-disable-next-line prefer-const -- assigned below, after the closures that read it exist
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onEnd = (e: Event) => { if (e.target === el) finish(); };
    const detach = () => {
      el.removeEventListener('transitionend', onEnd);
      clearTimeout(timer);
      this._pendingCleanup = null;
    };
    const finish = () => { detach(); done(); };

    el.addEventListener('transitionend', onEnd);
    timer = setTimeout(finish, 300);
    this._pendingCleanup = detach;
  }

  private _animateOpen(el: HTMLDivElement): void {
    el.style.display    = 'block';
    el.style.overflow   = 'hidden';
    el.style.height     = '0px';
    void el.offsetHeight;                              // force reflow
    el.style.transition = 'height 250ms ease-in-out';
    el.style.height     = `${el.scrollHeight}px`;
    this._settle(el, () => {
      el.style.height     = '';
      el.style.overflow   = '';
      el.style.transition = '';
    });
  }

  private _animateClose(el: HTMLDivElement): void {
    el.style.height     = `${el.getBoundingClientRect().height}px`;
    el.style.overflow   = 'hidden';
    void el.offsetHeight;
    el.style.transition = 'height 250ms ease-in-out';
    el.style.height     = '0px';
    this._settle(el, () => {
      el.style.display    = 'none';
      el.style.height     = '';
      el.style.overflow   = '';
      el.style.transition = '';
    });
  }
}

