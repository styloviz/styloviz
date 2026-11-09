/**
 * Pricing arithmetic for `sv-pricing-table` — exported so a host can show the
 * same figures elsewhere (a checkout summary, an upgrade dialog) without
 * computing them a second way.
 *
 * ★★★ EVERY ANNUAL FIGURE DERIVES FROM THE MONTHLY PRICE AND ONE DISCOUNT.
 *     The annual price, the annual invoice, the cash saved and the "save N %"
 *     are computed, never typed in beside the monthly price. A pricing page
 *     whose badge is written down next to its prices is a pricing page that
 *     eventually advertises a saving it does not give — the one error on a
 *     marketing site that costs money in both directions.
 */

/** A plan's price: per month billed monthly, and optionally per month billed annually. */
export interface SvPricingAmount {
  /** Price per month when billed monthly, in major currency units (`149`, `9.99`). */
  readonly monthly: number;
  /**
   * Price per month when billed annually. Leave it out and it is derived from
   * `monthly` and the table's `annualDiscount`.
   */
  readonly annual?: number | null;
}

/** A finite, non-negative number, or null. */
function money(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Clamp a discount to `[0, 1)`; anything else is no discount. */
export function svClampDiscount(discount: number): number {
  return Number.isFinite(discount) && discount > 0 && discount < 1 ? discount : 0;
}

/**
 * Round a derived figure to the precision its monthly price is quoted in:
 * whole units for a whole price (`$149 × 0.8` → `$119`), cents otherwise
 * (`$9.99 × 0.8` → `$7.99`). A derived price never claims more precision than
 * the price it came from.
 */
function roundLike(source: number, value: number): number {
  return Number.isInteger(source) ? Math.round(value) : Math.round(value * 100) / 100;
}

/** Cents-safe subtraction and multiplication: `9.99 × 12` is `119.88`, not `119.88000000000001`. */
function cents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Effective price per month when billed annually. */
export function svAnnualMonthly(price: SvPricingAmount, discount = 0): number {
  const monthly = money(price.monthly) ?? 0;
  const given = money(price.annual);
  if (given !== null) return given;
  return roundLike(monthly, monthly * (1 - svClampDiscount(discount)));
}

/** What the annual invoice actually says: twelve of the annual month. */
export function svAnnualTotal(price: SvPricingAmount, discount = 0): number {
  return cents(svAnnualMonthly(price, discount) * 12);
}

/** Cash saved over a year by paying annually. Never negative. */
export function svAnnualSaving(price: SvPricingAmount, discount = 0): number {
  const monthly = money(price.monthly) ?? 0;
  return Math.max(0, cents(monthly * 12 - svAnnualTotal(price, discount)));
}

/**
 * The saving as a whole percentage, computed from the rounded prices people
 * are actually charged.
 *
 * ★ Not from the discount. Rounding `monthly × 0.8` to a whole unit moves the
 * real saving by a fraction of a point, and a badge that says "save 20 %"
 * beside prices that save 19.6 % is wrong in the direction that gets noticed.
 */
export function svAnnualSavingPercent(price: SvPricingAmount, discount = 0): number {
  const full = (money(price.monthly) ?? 0) * 12;
  if (full === 0) return 0;
  return Math.round((svAnnualSaving(price, discount) / full) * 100);
}

/**
 * The headline saving for a billing toggle: the SMALLEST saving any paid plan
 * gives, so "save at least N %" is true of every plan. Free plans are left
 * out; a paid plan that saves nothing makes it 0, and the toggle then promises
 * nothing.
 */
export function svPricingHeadlineSaving(prices: readonly SvPricingAmount[], discount = 0): number {
  const paid = prices.filter((p) => (money(p.monthly) ?? 0) > 0);
  if (paid.length === 0) return 0;
  return Math.min(...paid.map((p) => svAnnualSavingPercent(p, discount)));
}

const FORMATTERS = new Map<string, Intl.NumberFormat | null>();

function formatter(locale: string, currency: string, whole: boolean): Intl.NumberFormat | null {
  const key = `${locale}|${currency}|${whole}`;
  if (FORMATTERS.has(key)) return FORMATTERS.get(key) ?? null;
  let made: Intl.NumberFormat | null = null;
  try {
    made = new Intl.NumberFormat(locale || undefined, {
      style: 'currency',
      currency,
      ...(whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
    });
  } catch {
    made = null;
  }
  FORMATTERS.set(key, made);
  return made;
}

/**
 * Format a plan price with `Intl.NumberFormat`: no decimals for a whole amount
 * (`$149`), the currency's own decimals otherwise (`$9.99`, `¥1,200`). A code
 * `Intl` rejects prints as "CODE 149" instead of throwing.
 */
export function svFormatPlanPrice(value: number, currency: string, locale: string): string {
  const whole = Number.isInteger(value);
  const fmt = formatter(locale, currency, whole);
  return fmt ? fmt.format(value) : `${currency} ${value}`;
}
