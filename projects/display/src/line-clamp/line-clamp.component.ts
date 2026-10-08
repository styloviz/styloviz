import {
  Component,
  input,
  model,
  signal,
  computed,
  viewChild,
  ElementRef,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  NgZone,
  inject,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';
import { svUniqueId } from '@styloviz/core';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SvLineClampComponent — Text truncation with expand/collapse toggle.
 *
 * Features:
 * - CSS `-webkit-line-clamp` for native truncation
 * - ResizeObserver detects real overflow before showing toggle
 * - Instant expand/collapse (a line clamp cannot be height-animated; the colour
 *   transition that remains is stilled under prefers-reduced-motion)
 * - Gradient fade at truncation edge
 * - Accessible: aria-expanded on toggle button
 */
@Component({
  selector: 'sv-line-clamp',
  standalone: true,
  imports: [NgClass, SvIconComponent],
  templateUrl: './line-clamp.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  /**
   * ★★ PAPER HAS NO "SHOW MORE". A clamped block printed exactly as it was on
   *    screen — three lines and a fade — and the rest of the text was simply
   *    not on the page. Nothing warned anyone: the print preview looked
   *    deliberate, and a printed contract clause or incident note that stops
   *    mid-sentence is indistinguishable from one that ended there.
   *
   *    `!important` is doing real work here rather than papering over
   *    specificity: the clamp is applied through inline `[style]` bindings, and
   *    a stylesheet rule cannot beat an inline style any other way. The fade and
   *    the toggle go too — a gradient over full text is just a smudge, and
   *    "Show more" printed on paper is an instruction nobody can follow.
   */
  styles: [`
    @media print {
      .sv-clamp-content {
        display: block !important;
        -webkit-line-clamp: unset !important;
        overflow: visible !important;
        max-height: none !important;
      }
      .sv-clamp-fade,
      .sv-clamp-toggle { display: none !important; }
    }
  `],
})
export class SvLineClampComponent implements OnInit, OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Number of lines to clamp to. @default 3 */
  lines = input<number>(3);

  /** Label for the expand button. @default 'Show more' */
  expandLabel = input<string>('Show more');

  /** Label for the collapse button. @default 'Show less' */
  collapseLabel = input<string>('Show less');

  /** Show the toggle button when overflowing. @default true */
  showToggle = input<boolean>(true);

  /** Show a gradient fade at the truncation edge. @default true */
  fadeOut = input<boolean>(true);

  /**
   * Expand when focus reaches something clipped out of view. @default true
   *
   * ★ `-webkit-line-clamp` CLIPS; it does not remove. A link on line eight of a
   * three-line clamp is still in the tab order, so a keyboard user tabs to it,
   * the focus ring is drawn somewhere they cannot see, and the page appears to
   * have swallowed their focus. Expanding is the fix rather than `inert`,
   * because there is no element boundary between the shown lines and the
   * clipped ones — `inert` on the box would take the VISIBLE text out of the
   * accessibility tree as well, which trades a focus bug for a content bug.
   *
   * A block expanded this way collapses again when focus leaves, unless the
   * reader took it over by pressing the toggle themselves.
   */
  expandOnFocus = input<boolean>(true);

  // ── Two-way state ───────────────────────────────────────────────────────────

  /**
   * Expanded state. Two-way bindable (`[(expanded)]`) so the host can read or
   * drive it; the matching `expandedChange` output fires on every toggle.
   * @default false
   */
  readonly expanded = model<boolean>(false);

  // ── View ──────────────────────────────────────────────────────────────────

  readonly contentRef = viewChild<ElementRef<HTMLDivElement>>('content');

  // ── State ─────────────────────────────────────────────────────────────────

  readonly isClamped  = signal(false);

  /** Stable id linking the toggle button to the clamped content region. */
  readonly contentId = svUniqueId('sv-line-clamp');

  // ── Computed ──────────────────────────────────────────────────────────────

  readonly clampStyle = computed(() => ({
    '-webkit-line-clamp': `${this.lines()}`,
    'display': '-webkit-box',
    '-webkit-box-orient': 'vertical',
    'overflow': 'hidden',
  }));

  readonly toggleLabel = computed(() =>
    this.expanded() ? this.collapseLabel() : this.expandLabel()
  );

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  private resizeObserver: ResizeObserver | null = null;

  ngOnInit(): void {
    // `ResizeObserver` does not exist on the server, and this runs during a
    // lifecycle hook that does. Everything it drives here is an enhancement on
    // top of a layout that is already correct, so it is guarded rather than
    // required — the same way number-ticker, rich-editor and tag-input do it.
    if (typeof ResizeObserver !== 'undefined') {
      this.zone.runOutsideAngular(() => {
        this.resizeObserver = new ResizeObserver(() => {
          this.checkOverflow();
        });
        const el = this.contentRef()?.nativeElement;
        if (el) this.resizeObserver.observe(el);
      });
    }

    // Also check on next tick so content is rendered
    setTimeout(() => this.checkOverflow(), 0);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  toggle(): void {
    // An explicit press takes ownership: the block stops being something focus
    // borrowed and starts being something the reader chose.
    this._expandedByFocus = false;
    this.expanded.set(!this.expanded());   // model.set emits expandedChange
  }

  // ── Focus reaching what the clamp cut off ─────────────────────────────────

  /** Whether the current expansion was caused by focus rather than a press. */
  private _expandedByFocus = false;

  /**
   * Something inside the text took focus. If it is below the clamp line, open
   * the block so the focus ring is drawn somewhere the user can see.
   */
  onContentFocusIn(event: FocusEvent): void {
    if (!this.expandOnFocus() || this.expanded()) return;
    const box = this.contentRef()?.nativeElement;
    const target = event.target as HTMLElement | null;
    if (!box || !target || typeof target.getBoundingClientRect !== 'function') return;

    // ★ Only what is actually cut off. A link on line one is perfectly visible,
    // and expanding the block under the reader because they tabbed to it would
    // be the component moving the page for no reason.
    const clipped = target.getBoundingClientRect().bottom > box.getBoundingClientRect().bottom + 1;
    if (!clipped) return;

    this._expandedByFocus = true;
    this.expanded.set(true);
  }

  /** Focus left the text. Put back what focus borrowed, and nothing else. */
  onContentFocusOut(event: FocusEvent): void {
    if (!this._expandedByFocus) return;
    const next = event.relatedTarget as Node | null;
    // A null `relatedTarget` is also what a removed element reports, so only an
    // explicit move to something outside counts as leaving.
    if (!next) return;
    // ★ Measured against the whole COMPONENT, not the text box — the toggle
    // sits outside the text. Clicking it moves focus out of the box first, so a
    // box-scoped check collapsed the block a beat before `toggle()` ran and
    // then re-opened it: the reader pressed "Show less" and it stayed open.
    if (this.host.nativeElement.contains(next)) return;
    this._expandedByFocus = false;
    this.expanded.set(false);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private checkOverflow(): void {
    const el = this.contentRef()?.nativeElement;
    if (!el) return;

    // Snapshot inline styles so we can safely measure without flicker.
    const prevStyle = el.style.cssText;

    // 1) Measure the *unclamped* height (true content height).
    el.style.webkitLineClamp = 'unset';
    el.style.display = 'block';
    el.style.webkitBoxOrient = '';
    const fullHeight = el.scrollHeight;

    // 2) Measure what the height *would be* if clamped — independent of
    //    the current expanded state, so the toggle stays visible after
    //    the user expands the content.
    el.style.display = '-webkit-box';
    el.style.webkitBoxOrient = 'vertical';
    el.style.webkitLineClamp = String(this.lines());
    const clampedHeight = el.clientHeight;

    // Restore the original inline style — Angular bindings will re-apply
    // theirs on the next CD pass.
    el.style.cssText = prevStyle;

    const isClamped = fullHeight > clampedHeight + 2; // 2px tolerance
    if (isClamped !== this.isClamped()) {
      this.zone.run(() => this.isClamped.set(isClamped));
    }
  }
}
