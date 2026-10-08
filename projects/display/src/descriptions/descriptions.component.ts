import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  Directive,
  inject,
  input,
  output,
  TemplateRef,
} from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import {
  SvEmptyShellComponent,
  SvErrorShellComponent,
  SvSkeletonShellComponent,
  type SvDataError,
  svUniqueId,
} from '@styloviz/core';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Where the label sits relative to its value.
 * - `horizontal` — label beside the value (the detail-panel default)
 * - `vertical`   — label above the value; survives long values and narrow columns
 */
export type DescriptionsLayout = 'horizontal' | 'vertical';

/**
 * Surface treatment.
 * - `plain`    — no chrome, for use inside a card that already has some
 * - `bordered` — ruled cells with a tinted label column, for a standalone block
 */
export type DescriptionsVariant = 'plain' | 'bordered';

/** Padding and type scale. */
export type DescriptionsSize = 'sm' | 'md' | 'lg';

/**
 * The width below which a horizontal pair stacks its label above its value.
 *
 * ★ `'never'` keeps them side by side at every width. Only reach for it when the
 * labels are genuinely short — a two-column pair on a 320px screen leaves the
 * value about eleven characters, and a truncated value is worse than a stacked
 * one.
 */
export type DescriptionsStackAt = 'never' | 'sm' | 'md' | 'lg';

/**
 * A per-row action slot.
 *
 * ★★★ THE RULE THIS EXISTS TO ENFORCE: a `<dd>` is the DEFINITION of its term.
 * Anything inside it is part of what a screen reader reads as the value — so a
 * bare button dropped in there turns "Order total, definition, £42.00" into
 * "Order total, definition, £42.00 Copy Edit", and a second list nested inside
 * one turns a flat sequence of pairs into a depth-first walk the reader cannot
 * predict.
 *
 * The HTML spec leaves no sibling position: inside a `<dl>`'s wrapping `<div>`,
 * only `<dt>` and `<dd>` are allowed, so an action CANNOT live beside the
 * definition. It has to live inside it — which makes the two halves of the fix
 * non-negotiable: the action is laid out as its own column so the value text
 * keeps its alignment, and the action's accessible name must carry the term
 * ("Copy order total"), because a listener who lands on it has no other way to
 * know which pair they are in.
 *
 * ```html
 * <sv-descriptions [items]="details">
 *   <ng-template svDescriptionAction let-item>
 *     <button type="button" [attr.aria-label]="'Copy ' + item.label"
 *             (click)="copy(item)">Copy</button>
 *   </ng-template>
 * </sv-descriptions>
 * ```
 */
@Directive({ selector: '[svDescriptionAction]', standalone: true })
export class SvDescriptionActionDirective {
  readonly template = inject<TemplateRef<{ $implicit: DescriptionItem; label: string }>>(
    TemplateRef,
  );
}

/**
 * How many term/value pairs sit on one row at the widest breakpoint.
 *
 * The component steps DOWN from this on narrow viewports (see `gridClasses`),
 * so a value of 3 renders 1 column on a phone, 2 on a tablet and 3 on a
 * desktop. It never steps up, so this is a maximum rather than a target.
 */
export type DescriptionsColumns = 1 | 2 | 3 | 4;

/** One term and its value. */
export interface DescriptionItem {
  /** Stable identity. Used as the `track` key and to build element ids. */
  readonly id: string;
  /** The term — rendered in a `<dt>`. */
  readonly label: string;
  /**
   * The value — rendered in a `<dd>`.
   *
   * Empty string and `null` are NOT the same thing and are not rendered the
   * same way: `null`/`undefined` means "we do not have this", and shows
   * `emptyValueText`; an empty string means "we have it and it is blank", and
   * shows nothing. A component that collapses the two tells the reader a fact
   * it does not have.
   */
  readonly value?: string | null;
  /**
   * Columns this pair should occupy. Clamped to the row width, so a `span` of
   * 4 in a 2-column layout fills the row instead of overflowing it.
   * @default 1
   */
  readonly span?: number;
  /** Extra classes for this pair's `<dd>`, e.g. `font-mono` for an ID. */
  readonly valueClass?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Descriptions — a key–value list for the detail panel of a record.
 *
 * The thing every "view order", "user profile" and "resource detail" screen
 * needs and usually rebuilds by hand out of a grid of `<span>`s.
 *
 * Features:
 * - Real `<dl>` / `<dt>` / `<dd>` semantics, not a table of divs
 * - Horizontal and vertical layouts
 * - 1–4 responsive columns, with per-item `span`
 * - Plain and bordered surfaces, three sizes
 * - Distinguishes "no value" from "blank value"
 * - Full loading / error / empty contract with `data-sv-state` hooks
 */
@Component({
  selector: 'sv-descriptions',
  standalone: true,
  imports: [
    NgClass,
    NgTemplateOutlet,
    SvSkeletonShellComponent,
    SvErrorShellComponent,
    SvEmptyShellComponent,
  ],
  templateUrl: './descriptions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvDescriptionsComponent {
  /** Instance-scoped id root, e.g. `sv-descriptions-3`. */
  protected readonly uid = svUniqueId('sv-descriptions');

  /** Id of the heading, when there is one — the `<dl>`'s accessible name. */
  protected readonly titleId = `${this.uid}-title`;

  // ── Data ──────────────────────────────────────────────────────────────────

  /** The term/value pairs to render, in order. @default [] */
  readonly items = input<readonly DescriptionItem[]>([]);

  // ── Appearance ────────────────────────────────────────────────────────────

  /** Heading above the list. Also becomes the list's accessible name. @default '' */
  readonly title = input<string>('');

  /** Where the label sits relative to its value. @default 'horizontal' */
  readonly layout = input<DescriptionsLayout>('horizontal');

  /** Surface treatment. @default 'plain' */
  readonly variant = input<DescriptionsVariant>('plain');

  /** Padding and type scale. @default 'md' */
  readonly size = input<DescriptionsSize>('md');

  /** Maximum pairs per row at the widest breakpoint. @default 1 */
  readonly columns = input<DescriptionsColumns>(1);

  /**
   * Where a `horizontal` pair stops sitting side by side and stacks. @default 'sm'
   *
   * ★★ The rule was already in the class list and nowhere in the API: the
   * horizontal layout has always been `sm:flex`, so it stacked below 640px and
   * a host had no say and no way to find out. Now it is stated, adjustable, and
   * — the part that was actually broken — a stacked pair gets vertical spacing.
   * Without it the label sat directly on top of its value with no gap, which on
   * a phone reads as one wrapped sentence rather than two things.
   */
  readonly stackAt = input<DescriptionsStackAt>('sm');

  /** Shown in place of a value that is `null` or `undefined`. @default '—' */
  readonly emptyValueText = input<string>('—');

  /** Extra classes on the root element. @default '' */
  readonly customClass = input<string>('');

  // ── Async contract ────────────────────────────────────────────────────────

  /** Replace the list with a skeleton while the record is being fetched. @default false */
  readonly loading = input<boolean>(false);

  /**
   * Load failure. Use `toSvDataError()` from `@styloviz/core` to normalise an
   * `HttpErrorResponse`. @default null
   */
  readonly error = input<SvDataError | string | null>(null);

  /** Message for the empty state. @default 'No details to show' */
  readonly emptyText = input<string>('No details to show');

  /** The host should re-run the failed load. */
  readonly retry = output<void>();

  // ── Derived state ─────────────────────────────────────────────────────────

  /** Nothing to show. Distinct from `loading`, which is not yet knowing. */
  protected readonly isEmpty = computed<boolean>(() => this.items().length === 0);

  /**
   * Per-item render model: the resolved value text, whether it is a placeholder,
   * and the clamped span.
   *
   * ★ Computed once per change-detection cycle rather than through methods
   * called from inside `@for` — the house rule, and the reason the template
   * binds plain properties.
   */
  protected readonly rows = computed(() => {
    const max = this.columns();
    const placeholder = this.emptyValueText();
    return this.items().map((item) => {
      const missing = item.value === null || item.value === undefined;
      return {
        item,
        /** `''` stays `''`; only null/undefined becomes the placeholder. */
        text: missing ? placeholder : item.value ?? '',
        missing,
        /**
         * ★ Clamped to the row width. An unclamped `span: 4` in a 2-column
         * grid produces a `col-span-4` Tailwind class the grid cannot honour,
         * and the browser silently overflows the row instead of wrapping.
         * Also floored at 1 — `span: 0` would collapse the cell entirely.
         */
        span: Math.min(Math.max(Math.trunc(item.span ?? 1), 1), max),
      };
    });
  });

  /** `true` when a heading was supplied, so the `<dl>` can be named by it. */
  protected readonly hasTitle = computed<boolean>(() => this.title().trim().length > 0);

  /** The host's per-row action template, when it supplied one. */
  private readonly actionSlot = contentChild(SvDescriptionActionDirective);

  protected readonly actionTemplate = computed(() => this.actionSlot()?.template ?? null);

  // ── Classes ───────────────────────────────────────────────────────────────

  protected readonly rootClasses = computed<string>(() =>
    [
      this.variant() === 'bordered'
        ? 'overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800'
        : '',
      this.customClass(),
    ]
      .filter(Boolean)
      .join(' '),
  );

  /**
   * ★ Every column count is spelled out, and that is deliberate: Tailwind scans
   * source for COMPLETE class strings, so a computed `` `sm:grid-cols-${n}` ``
   * produces a class that is never generated and a grid that silently stays one
   * column. The same trap applies to `col-span-*` in the template.
   */
  protected readonly gridClasses = computed<string>(() => {
    switch (this.columns()) {
      case 4: return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
      case 3: return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
      case 2: return 'grid grid-cols-1 sm:grid-cols-2';
      default: return 'grid grid-cols-1';
    }
  });

  /** Gap between pairs — only the plain variant has one; bordered cells abut. */
  protected readonly gapClasses = computed<string>(() => {
    if (this.variant() === 'bordered') return 'gap-px bg-gray-200 dark:bg-gray-800';
    switch (this.size()) {
      case 'sm': return 'gap-x-6 gap-y-2';
      case 'lg': return 'gap-x-10 gap-y-5';
      default: return 'gap-x-8 gap-y-3.5';
    }
  });

  /**
   * One term/value cell.
   *
   * ★ Every breakpoint variant is spelled out for the same Tailwind reason as
   * `gridClasses`: a class assembled from a token at runtime is never generated,
   * and the layout silently stays whatever the base class said.
   */
  protected readonly cellClasses = computed<string>(() => {
    const bordered = this.variant() === 'bordered';
    const pad =
      this.size() === 'sm' ? 'px-3 py-2' : this.size() === 'lg' ? 'px-5 py-4' : 'px-4 py-3';
    return [
      bordered ? `bg-white dark:bg-gray-900 ${pad}` : '',
      this.layout() === 'horizontal' ? this.horizontalCellClasses() : 'flex flex-col gap-1',
    ]
      .filter(Boolean)
      .join(' ');
  });

  /**
   * Stacked below the breakpoint, side by side above it.
   *
   * ★ `flex flex-col gap-1` in the stacked half is the fix, not decoration. The
   * old class list went straight from block layout to `sm:flex`, so below the
   * breakpoint the `<dt>` and `<dd>` were two block elements with no spacing
   * between them — on a phone that reads as one wrapped sentence rather than a
   * label and a value.
   */
  private horizontalCellClasses(): string {
    switch (this.stackAt()) {
      case 'never': return 'flex items-baseline gap-3';
      case 'md':    return 'flex flex-col gap-1 md:flex-row md:items-baseline md:gap-3';
      case 'lg':    return 'flex flex-col gap-1 lg:flex-row lg:items-baseline lg:gap-3';
      default:      return 'flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3';
    }
  }

  protected readonly termClasses = computed<string>(() => {
    const base = 'font-medium text-gray-500 dark:text-gray-400';
    const width = this.layout() === 'horizontal' ? this.termWidthClasses() : '';
    const scale =
      this.size() === 'sm' ? 'text-[11px]' : this.size() === 'lg' ? 'text-sm' : 'text-xs';
    return [base, width, scale].filter(Boolean).join(' ');
  });

  /** The label column's width, at whichever breakpoint the pair unstacks. */
  private termWidthClasses(): string {
    switch (this.stackAt()) {
      case 'never': return 'w-2/5 shrink-0';
      case 'md':    return 'md:w-2/5 md:shrink-0';
      case 'lg':    return 'lg:w-2/5 lg:shrink-0';
      default:      return 'sm:w-2/5 sm:shrink-0';
    }
  }

  protected readonly valueClasses = computed<string>(() => {
    const base = 'min-w-0 break-words text-gray-900 dark:text-gray-100';
    const scale =
      this.size() === 'sm' ? 'text-xs' : this.size() === 'lg' ? 'text-base' : 'text-sm';
    return [base, scale].filter(Boolean).join(' ');
  });

  /**
   * ★ Spelled out for the same Tailwind reason as `gridClasses`, and capped at
   * the four the `columns` union allows.
   */
  protected spanClass(span: number): string {
    switch (span) {
      case 4: return 'lg:col-span-4';
      case 3: return 'lg:col-span-3';
      case 2: return 'sm:col-span-2';
      default: return '';
    }
  }

  /** A value the host did not supply is dimmed, so "—" does not read as data. */
  protected missingClass(missing: boolean): string {
    return missing ? 'text-gray-500 dark:text-gray-400' : '';
  }
}
