import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { SvRevealFocusDirective, svUniqueId } from '@styloviz/core/a11y';
import { injectSvLabels, svFormatLabel, svLocale } from '@styloviz/core/i18n';
import { svIsSafeUrl } from '@styloviz/core/security';
import { SvIconComponent } from '@styloviz/icons/core';
import { SV_COMMERCE_LABELS, type SvCommerceLabels } from '@styloviz/commerce/labels';
import {
  svAnnualMonthly,
  svAnnualSaving,
  svAnnualSavingPercent,
  svAnnualTotal,
  svClampDiscount,
  svFormatPlanPrice,
  svPricingHeadlineSaving,
  type SvPricingAmount,
} from './pricing-math';

import { registerPricingTableIcons } from './pricing-table.component.icons';
// ─── Types ────────────────────────────────────────────────────────────────────

/** How the plans are being paid for. */
export type SvPricingBilling = 'monthly' | 'annual';

/** `cards` (one card per plan, stacked on phones) or `table` (a feature-by-plan comparison). */
export type SvPricingTableLayout = 'cards' | 'table';

/** Heading level for each plan's name in the cards layout. */
export type SvPricingHeadingLevel = 2 | 3 | 4;

/** A plan's call to action. */
export interface SvPricingCta {
  /** The button or link text. Defaults to the `pricingChoose` label ("Choose Growth"). */
  readonly label?: string;
  /**
   * Where it goes. Relative paths, `http(s):`, `mailto:` and `tel:` are kept;
   * anything else (`javascript:`, `data:`) is dropped and a button renders instead.
   */
  readonly href?: string;
}

/** One plan — a card in the cards layout, a column in the table. */
export interface SvPricingPlan {
  /** Stable identity — the key of each feature's `values`, and what `planSelect` hands back. */
  readonly id: string;
  /** What the plan is called. */
  readonly name: string;
  /** One line on who it is for. */
  readonly description?: string;
  /**
   * The price — `{ monthly, annual? }` in major units, `annual` derived from
   * the table's `annualDiscount` when left out — or a text in place of a price
   * for a plan you quote ("Custom", "Let's talk").
   */
  readonly price: SvPricingAmount | string;
  /** ISO 4217 code for this plan, overriding the table's `currency`. */
  readonly currency?: string;
  /** The call to action. */
  readonly cta?: SvPricingCta;
  /**
   * The recommended plan: emphasised, and badged with `badge` or "Most popular"
   * in text — never colour alone. Only the first highlighted plan counts.
   */
  readonly highlighted?: boolean;
  /** A short badge ("New", "Best value"). On the highlighted plan it replaces "Most popular". */
  readonly badge?: string;
  /**
   * The bullet list on the plan's card. Leave it out and the card lists the
   * `features` rows this plan includes.
   */
  readonly features?: readonly string[];
}

/** One row of the comparison: a feature and what each plan gets. */
export interface SvPricingFeature {
  /** Stable identity. */
  readonly id: string;
  /** What the feature is called — the row header. */
  readonly label: string;
  /** Rows sharing a group are shown under one group heading, in first-seen order. */
  readonly group?: string;
  /**
   * Keyed by plan id: `true` (included), `false` or missing (not included), or
   * a text ("10 seats", "Unlimited").
   */
  readonly values: Readonly<Record<string, boolean | string>>;
}

/** What `planSelect` emits: the plan, and the billing period it was chosen under. */
export interface SvPricingPlanSelect {
  readonly plan: SvPricingPlan;
  readonly billing: SvPricingBilling;
}

/** The labels this component reads — a subset of the `commerce` namespace. */
export type SvPricingTableLabels = Pick<
  SvCommerceLabels,
  | 'pricingBillingLegend'
  | 'pricingMonthly'
  | 'pricingAnnual'
  | 'pricingAnnualSaving'
  | 'pricingPerMonth'
  | 'pricingPerMonthShort'
  | 'pricingBilledMonthly'
  | 'pricingBilledAnnually'
  | 'pricingSaving'
  | 'pricingSavingPercent'
  | 'pricingFree'
  | 'pricingCustom'
  | 'pricingPopular'
  | 'pricingChoose'
  | 'pricingSelected'
  | 'pricingIncluded'
  | 'pricingNotIncluded'
  | 'pricingCaption'
  | 'pricingFeatureHeader'
  | 'pricingPriceRow'
>;

/** A plan as the template draws it. */
interface PlanView {
  readonly plan: SvPricingPlan;
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Badge text, or null. */
  readonly badge: string | null;
  readonly highlighted: boolean;
  readonly selected: boolean;
  /** The text in place of a price, or null for a priced plan. */
  readonly custom: string | null;
  /** A zero price — shown as "Free". */
  readonly free: boolean;
  /** The headline figure, per month. */
  readonly amount: string;
  /** "$1,428 billed once a year" — what is actually charged, and when. */
  readonly billed: string;
  /** "Save $360 a year · 20% off", or ''. */
  readonly saving: string;
  /** The safe CTA link, or null for a button. */
  readonly href: string | null;
  readonly ctaLabel: string;
  /** Classes for the CTA — solid on the highlighted plan, outlined otherwise. */
  readonly ctaClass: string;
  readonly nameId: string;
  /** The card's bullet list. */
  readonly bullets: readonly string[];
}

/** One comparison cell. */
interface CellView {
  readonly planId: string;
  /** The cell is in the highlighted plan's column. */
  readonly highlighted: boolean;
  /** `true` / `false` render an icon with sr-only text; a string renders as text. */
  readonly value: boolean | string;
}

interface RowView {
  readonly id: string;
  readonly label: string;
  readonly cells: readonly CellView[];
}

interface GroupView {
  readonly key: string;
  /** Null for rows with no group. */
  readonly label: string | null;
  readonly rows: readonly RowView[];
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * `sv-pricing-table` — plans with a monthly / annual toggle, as cards or a
 * feature comparison table.
 *
 * Features:
 * - Native-radio billing toggle; the annual price, invoice, saving and the
 *   "save at least N %" are derived from the monthly price and one discount
 * - Highlighted plan carries a text badge, announced in its column header
 * - `cards` (stacked on phones) or a real `<table>` with `<caption>` and
 *   `<th scope>` row, column and group headers
 * - Included / not included as icons with screen-reader text
 * - Quote-only plans ("Contact sales"), free plans, safe CTA links
 * - `Intl.NumberFormat` currency formatting per plan
 *
 * ```html
 * <sv-pricing-table [plans]="plans" [annualDiscount]="0.2" [(billing)]="billing" (planSelect)="start($event)" />
 * ```
 */
@Component({
  selector: 'sv-pricing-table',
  standalone: true,
  imports: [SvIconComponent, SvRevealFocusDirective],
  templateUrl: './pricing-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvPricingTableComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerPricingTableIcons();

  private readonly registryText = injectSvLabels('commerce', SV_COMMERCE_LABELS);
  /** @internal Prefix for the ids the headers and descriptions point at. */
  protected readonly baseId = svUniqueId('sv-pricing-table');

  // ── Data ──────────────────────────────────────────────────────────────────

  /**
   * The plans, cheapest first. Plans with an empty or duplicate `id` are
   * skipped. @default []
   */
  readonly plans = input<readonly SvPricingPlan[]>([]);

  /**
   * The comparison rows, shown as the table in the `table` layout and as each
   * card's bullet list when a plan has no `features` of its own. @default []
   */
  readonly features = input<readonly SvPricingFeature[]>([]);

  // ── Billing ───────────────────────────────────────────────────────────────

  /** Which period the prices are shown for. Two-way: `[(billing)]`; emits `billingChange`. @default 'monthly' */
  readonly billing = model<SvPricingBilling>('monthly');

  /**
   * The annual discount as a fraction (`0.2` = 20 % off), used for every plan
   * whose price has no `annual`. Outside `[0, 1)` it counts as none. @default 0
   */
  readonly annualDiscount = input<number>(0);

  /** Show the monthly / annual toggle. It is hidden anyway when no plan has a price. @default true */
  readonly showBillingToggle = input<boolean>(true);

  // ── Formatting ────────────────────────────────────────────────────────────

  /** ISO 4217 currency code, unless a plan sets its own. @default 'USD' */
  readonly currency = input<string>('USD');

  /** BCP-47 locale for prices and numbers. @default the kit's locale (`SV_LOCALE`) */
  readonly locale = input<string>(svLocale());

  // ── Appearance ────────────────────────────────────────────────────────────

  /** `cards` — one card per plan, stacked on phones — or a `table` comparing features. @default 'cards' */
  readonly layout = input<SvPricingTableLayout>('cards');

  /** The plan whose CTA reads "Selected" — the one your sign-up form is set to. @default null */
  readonly selectedPlanId = input<string | null>(null);

  /** The comparison table's `<caption>`. Null uses the `pricingCaption` label ("Compare plans"). @default null */
  readonly caption = input<string | null>(null);

  /** Heading level for each plan's name in the cards layout — match the page outline. @default 3 */
  readonly headingLevel = input<SvPricingHeadingLevel>(3);

  /** Per-instance text, merged over the registry's `commerce` labels. @default {} */
  readonly labels = input<Partial<SvPricingTableLabels>>({});

  // ── Events ────────────────────────────────────────────────────────────────

  /** A plan's call to action was activated — its button, or its link (which also navigates). */
  readonly planSelect = output<SvPricingPlanSelect>();

  // ── Derived state ─────────────────────────────────────────────────────────

  /** @internal The labels in effect. */
  protected readonly text = computed<SvPricingTableLabels>(() => ({ ...this.registryText, ...this.labels() }));

  /** @internal */
  protected readonly isAnnual = computed(() => this.billing() === 'annual');

  /** @internal */
  private readonly discount = computed(() => svClampDiscount(this.annualDiscount()));

  /** @internal Plans with a usable, unique id, in order. */
  private readonly validPlans = computed<readonly SvPricingPlan[]>(() => {
    const given = this.plans();
    const list = Array.isArray(given) ? given : [];
    const seen = new Set<string>();
    return list.filter((plan) => {
      const id = typeof plan?.id === 'string' ? plan.id.trim() : '';
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  });

  /** @internal The plan id that gets the emphasis — the first highlighted one. */
  private readonly highlightedId = computed(() => this.validPlans().find((p) => p.highlighted === true)?.id.trim() ?? null);

  /** @internal Validated feature rows. */
  private readonly validFeatures = computed<readonly SvPricingFeature[]>(() => {
    const given = this.features();
    const list = Array.isArray(given) ? given : [];
    const seen = new Set<string>();
    return list.filter((row) => {
      const id = typeof row?.id === 'string' ? row.id.trim() : '';
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  });

  /** @internal The plans as drawn. */
  protected readonly views = computed<readonly PlanView[]>(() => {
    const text = this.text();
    const annual = this.isAnnual();
    const discount = this.discount();
    const locale = this.locale();
    const fallbackCurrency = this.currency();
    const highlighted = this.highlightedId();
    const selected = this.selectedPlanId();
    const features = this.validFeatures();

    return this.validPlans().map((plan, n) => {
      const id = plan.id.trim();
      const name = typeof plan.name === 'string' && plan.name.trim() ? plan.name : id;
      const currency = typeof plan.currency === 'string' && plan.currency.trim() ? plan.currency.trim() : fallbackCurrency;
      const fmt = (value: number) => svFormatPlanPrice(value, currency, locale);
      const price = priceOf(plan.price);

      let custom: string | null = null;
      let free = false;
      let amount = '';
      let billed = '';
      let saving = '';
      if (price === null) {
        custom = typeof plan.price === 'string' && plan.price.trim() ? plan.price.trim() : text.pricingCustom;
      } else {
        const perMonth = annual ? svAnnualMonthly(price, discount) : price.monthly;
        free = price.monthly === 0 && perMonth === 0;
        amount = fmt(perMonth);
        if (!free) {
          billed = annual
            ? svFormatLabel(text.pricingBilledAnnually, { amount: fmt(svAnnualTotal(price, discount)) }, locale)
            : svFormatLabel(text.pricingBilledMonthly, { amount: fmt(price.monthly) }, locale);
          const saved = svAnnualSaving(price, discount);
          if (annual && saved > 0) {
            saving = `${svFormatLabel(text.pricingSaving, { amount: fmt(saved) }, locale)} · ${svFormatLabel(
              text.pricingSavingPercent,
              { pct: svAnnualSavingPercent(price, discount) },
              locale,
            )}`;
          }
        }
      }

      const isHighlighted = id === highlighted;
      const ownBadge = typeof plan.badge === 'string' && plan.badge.trim() ? plan.badge.trim() : null;
      const rawHref = typeof plan.cta?.href === 'string' ? plan.cta.href.trim() : '';
      const ownCta = typeof plan.cta?.label === 'string' && plan.cta.label.trim() ? plan.cta.label : null;
      const isSelected = selected !== null && selected === id;

      return {
        plan,
        id,
        name,
        description: typeof plan.description === 'string' ? plan.description : '',
        badge: ownBadge ?? (isHighlighted ? text.pricingPopular : null),
        highlighted: isHighlighted,
        selected: isSelected,
        custom,
        free,
        amount,
        billed,
        saving,
        href: rawHref && svIsSafeUrl(rawHref, false) ? rawHref : null,
        ctaLabel: isSelected ? text.pricingSelected : (ownCta ?? svFormatLabel(text.pricingChoose, { plan: name }, locale)),
        ctaClass: isHighlighted ? CTA_SOLID : CTA_OUTLINE,
        nameId: `${this.baseId}-plan-${n}`,
        bullets: bulletsFor(plan, id, features),
      };
    });
  });

  /** @internal "Save at least 20%", or '' when no paid plan saves anything. */
  protected readonly headlineSaving = computed(() => {
    const prices = this.validPlans()
      .map((p) => priceOf(p.price))
      .filter((p): p is SvPricingAmount => p !== null);
    const pct = svPricingHeadlineSaving(prices, this.discount());
    return pct > 0 ? svFormatLabel(this.text().pricingAnnualSaving, { pct }, this.locale()) : '';
  });

  /** @internal The toggle is shown — asked for, and some plan has a price to toggle. */
  protected readonly toggleVisible = computed(
    () => this.showBillingToggle() && this.views().some((v) => v.custom === null && !v.free),
  );

  /** @internal The two billing options. */
  protected readonly billingOptions = computed(() => [
    { value: 'monthly' as const, label: this.text().pricingMonthly },
    { value: 'annual' as const, label: this.text().pricingAnnual },
  ]);

  /** @internal The comparison rows, grouped in first-seen order. */
  protected readonly groups = computed<readonly GroupView[]>(() => {
    const planIds = this.views().map((v) => v.id);
    const highlighted = this.highlightedId();
    const order: string[] = [];
    const byKey = new Map<string, { label: string | null; rows: RowView[] }>();
    for (const row of this.validFeatures()) {
      const label = typeof row.group === 'string' && row.group.trim() ? row.group.trim() : null;
      const key = label ?? '';
      if (!byKey.has(key)) {
        byKey.set(key, { label, rows: [] });
        order.push(key);
      }
      const values = row.values && typeof row.values === 'object' ? row.values : {};
      byKey.get(key)!.rows.push({
        id: row.id.trim(),
        label: typeof row.label === 'string' && row.label.trim() ? row.label : row.id,
        cells: planIds.map((planId) => ({ planId, highlighted: planId === highlighted, value: cellValue(values[planId]) })),
      });
    }
    return order.map((key) => ({ key: key || '__ungrouped', ...byKey.get(key)! }));
  });

  /** @internal The caption in effect. */
  protected readonly captionText = computed(() => {
    const given = this.caption();
    return typeof given === 'string' && given.trim() ? given : this.text().pricingCaption;
  });

  /** @internal Column count of the comparison, for group header rows. */
  protected readonly columnCount = computed(() => this.views().length + 1);

  /** @internal The cards grid, sized to the number of plans. */
  protected readonly gridClass = computed(() => {
    const n = this.views().length;
    if (n <= 1) return 'mx-auto grid max-w-md grid-cols-1 gap-6';
    if (n === 2) return 'mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2';
    if (n === 3) return 'grid grid-cols-1 gap-6 lg:grid-cols-3';
    return 'grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4';
  });

  /** @internal */
  protected readonly billingName = `${this.baseId}-billing`;
  /** @internal */
  protected readonly savingId = `${this.baseId}-saving`;
  /** @internal */
  protected readonly captionId = `${this.baseId}-caption`;

  /** @internal Classes for a billing option (the span after its visually hidden radio). */
  protected readonly billingPillClass =
    'flex min-h-9 cursor-pointer items-center rounded-full px-4 text-sm font-semibold text-gray-700 transition-colors ' +
    'hover:text-gray-900 peer-checked:bg-white peer-checked:text-gray-900 peer-checked:shadow-sm ' +
    'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2 ' +
    'dark:text-gray-300 dark:hover:text-white dark:peer-checked:bg-gray-700 dark:peer-checked:text-white ' +
    'dark:peer-focus-visible:ring-offset-gray-900 forced-colors:peer-checked:outline-2 forced-colors:peer-checked:outline-solid'; // sv-i18n-ignore: CSS classes

  /** @internal The tint on the highlighted plan's column in the table. */
  protected readonly highlightClass = 'bg-primary-50 dark:bg-primary-500/10';

  // ── Template handlers ─────────────────────────────────────────────────────

  /** @internal A billing radio changed. */
  protected setBilling(value: SvPricingBilling): void {
    if (value !== this.billing()) this.billing.set(value);
  }

  /** @internal A plan's CTA was activated. */
  protected select(view: PlanView): void {
    this.planSelect.emit({ plan: view.plan, billing: this.billing() });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CTA_BASE =
  'inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ' +
  'dark:focus-visible:ring-offset-gray-900 ';

/** The highlighted plan's call to action. */
const CTA_SOLID =
  CTA_BASE + 'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:text-gray-950 dark:hover:bg-primary-400';

/** Every other plan's call to action. */
const CTA_OUTLINE =
  CTA_BASE +
  'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800';

/** The plan's price object, or null for a quoted plan or an unusable price. */
function priceOf(price: SvPricingPlan['price'] | undefined): SvPricingAmount | null {
  if (!price || typeof price !== 'object') return null;
  const monthly = price.monthly;
  return typeof monthly === 'number' && Number.isFinite(monthly) && monthly >= 0 ? price : null;
}

/** A cell value: `true`, a non-empty text, or `false`. */
function cellValue(value: unknown): boolean | string {
  if (value === true) return true;
  if (typeof value === 'string' && value.trim()) return value;
  return false;
}

/** The plan's own bullets, or the feature rows it includes ("Seats: 10" for a text value). */
function bulletsFor(plan: SvPricingPlan, id: string, rows: readonly SvPricingFeature[]): readonly string[] {
  if (Array.isArray(plan.features) && plan.features.length > 0) {
    return plan.features.filter((f): f is string => typeof f === 'string' && f.trim() !== '');
  }
  const out: string[] = [];
  for (const row of rows) {
    const value = cellValue(row.values?.[id]);
    const label = typeof row.label === 'string' && row.label.trim() ? row.label : row.id;
    if (value === true) out.push(label);
    else if (typeof value === 'string') out.push(`${label}: ${value}`);
  }
  return out;
}
