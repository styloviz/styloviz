import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { NgClass } from '@angular/common';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PriceSize     = 'sm' | 'md' | 'lg' | 'xl';
export type PriceAlign    = 'start' | 'center' | 'end';
export type PriceDiscount = 'badge' | 'text' | 'none';

/**
 * How a figure that does not fit the printed number of decimals is resolved.
 *
 * The same nine modes `Intl.NumberFormat` accepts, named identically so there is
 * nothing to translate. `halfExpand` — 0.5 away from zero — is the default here
 * because it is also Intl's, and because it is what a shopper expects when a
 * discount lands on half a cent.
 */
export type PriceRoundingMode =
  | 'ceil'
  | 'floor'
  | 'expand'
  | 'trunc'
  | 'halfCeil'
  | 'halfFloor'
  | 'halfExpand'
  | 'halfTrunc'
  | 'halfEven';

/** Whether the printed figure includes tax, and what that tax is called. */
export type PriceTaxMode = 'unstated' | 'inclusive' | 'exclusive';

/**
 * `roundingMode` is ES2023 and this repo compiles against the ES2022 lib, so the
 * option is not on `Intl.NumberFormatOptions` yet. Declaring it here is the whole
 * of the shim: every engine the kit supports implements it, and an engine that
 * did not would ignore an unknown key rather than throw.
 */
type CurrencyFormatOptions = Intl.NumberFormatOptions & {
  roundingMode?: PriceRoundingMode;
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SvPriceComponent — Formatted money with an optional compare-at price and discount.
 *
 * Features:
 * - Locale-aware currency formatting via Intl.NumberFormat, with the currency's
 *   own number of decimals and its own minor-unit scale
 * - Explicit, auditable rounding mode
 * - Optional strike-through compare-at price
 * - Auto-calculated saving shown as a badge or inline text
 * - Range ("$49 – $79") and open-ended ("From $49") pricing
 * - A stated tax basis, because an implied one is not compliant everywhere
 * - Minor-unit (cents) or major-unit input
 * - Optional "Free" label when the amount is zero
 * - 4 sizes, 3 alignments, dark-mode ready, display-only (no interaction)
 */
@Component({
  selector: 'sv-price',
  standalone: true,
  imports: [NgClass],
  templateUrl: './price.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvPriceComponent {
  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Current price. Interpreted as minor units (cents) when `minorUnits` is true. */
  amount = input.required<number>();

  /** Original / "compare-at" price for a discount. `null` hides it. @default null */
  compareAt = input<number | null>(null);

  /** ISO 4217 currency code. @default 'USD' */
  currency = input<string>('USD');

  /** BCP-47 locale for formatting. @default 'en-US' */
  locale = input<string>('en-US');

  /**
   * Treat `amount` / `compareAt` / `amountTo` as minor units.
   *
   * ★★★ MINOR UNITS ARE NOT ALWAYS HUNDREDTHS. This used to divide by 100 no
   *     matter the currency, which put the decimal point two places out for
   *     every currency that does not have two decimals: `1000` in JPY became
   *     ¥10 instead of ¥1,000, and `1000` in KWD became 10.000 KWD instead of
   *     1.000. The scale is now read back from `Intl` for the currency in play.
   * @default false
   */
  minorUnits = input<boolean>(false);

  /** Text size. @default 'md' */
  size = input<PriceSize>('md');

  /** Horizontal alignment of the price block. @default 'start' */
  align = input<PriceAlign>('start');

  /** How to present the saving when `compareAt` is set. @default 'badge' */
  discount = input<PriceDiscount>('badge');

  /** Label shown when the amount is 0 (e.g. "Free"). Empty renders a formatted 0. @default '' */
  freeLabel = input<string>('');

  /**
   * Decimal places, or `null` for the currency's own convention.
   *
   * ★★ `null` IS THE DEFAULT AND IT IS THE RIGHT ONE FOR A SHOP. USD wants two
   *    places, JPY wants none, and `Intl` already knows which — hard-coding a
   *    number would print `¥1,200.00`, a figure that does not exist.
   *
   *    It exists because a whole class of prices are never quoted to the cent:
   *    a house at `$1,180,000.00` reads as a rounding error, and every property
   *    portal, car listing and B2B quote drops the decimals. Setting `0` is the
   *    caller saying "this is that kind of price", which is a judgement the
   *    component cannot make from the amount alone.
   *
   *    It changes only how the figure is *printed*. It says nothing about how
   *    the host *stored* it, so it never moves the `minorUnits` scale: a house
   *    price held in cents and shown without decimals is still cents.
   *
   * @default null
   */
  fractionDigits = input<number | null>(null);

  /**
   * How a figure with more precision than the printed decimals is resolved.
   *
   * ★★★ A ROUNDING RULE CHOSEN IMPLICITLY IS A ROUNDING RULE NOBODY CAN AUDIT.
   *     Two systems that agree on the amount and disagree on the mode disagree
   *     by a cent, which is a reconciliation task rather than a display bug. The
   *     default is `halfExpand` — the same rule `Intl` applies when nothing is
   *     said — so this input changes no existing output; it only makes the rule
   *     visible and overridable. Finance systems that use bankers' rounding want
   *     `halfEven`; a shop that must never quote below the real price wants
   *     `ceil`.
   * @default 'halfExpand'
   */
  roundingMode = input<PriceRoundingMode>('halfExpand');

  /**
   * Upper bound of a price range — "$49.99 – $79.99" for a product whose
   * variants are not all one price.
   *
   * Ignored unless it is above `amount`, on the same rule as `compareAt`: a
   * range that runs backwards is bad data, and printing it as given would tell
   * a shopper the cheapest option costs more than the dearest. A range
   * suppresses `compareAt` and the saving, because a percentage off a span is
   * not one number.
   * @default null
   */
  amountTo = input<number | null>(null);

  /**
   * Print `amount` as the start of an open-ended range — "From $49.99" — for a
   * product priced by configuration.
   *
   * Ignored when `amountTo` is set, since a closed range already says it.
   * @default false
   */
  from = input<boolean>(false);

  /** Wording for the open-ended range. @default 'From' */
  fromLabel = input<string>('From');

  /**
   * Whether the printed figure includes tax.
   *
   * ★★★ `unstated` IS THE DEFAULT ONLY BECAUSE THIS COMPONENT CANNOT KNOW.
   *     Whether a price must be shown with tax included is a property of the
   *     jurisdiction and the buyer, not of the number — and in the EU, the UK and
   *     Australia a consumer-facing price with no stated basis is not compliant.
   *     There is deliberately no way to state a basis *wrongly* cheaply: pick
   *     `inclusive` or `exclusive` and the component prints it beneath the price,
   *     as text, every time.
   * @default 'unstated'
   */
  taxMode = input<PriceTaxMode>('unstated');

  /**
   * What the tax is called — 'VAT', 'GST', 'sales tax'. Also the place to put a
   * rate: `'20% VAT'` prints "incl. 20% VAT". @default 'tax'
   */
  taxLabel = input<string>('tax');

  // ── Computed ────────────────────────────────────────────────────────────────

  /**
   * A formatter, or `null` when the currency code is not one `Intl` knows.
   *
   * A bad ISO code usually arrives from an API rather than from a template, and
   * an uncaught throw inside a computed blanks the whole product grid rather than
   * the one price that is wrong. `null` routes to a plain fallback instead.
   */
  private readonly formatter = computed<Intl.NumberFormat | null>(() => {
    const digits = this.fractionDigits();
    const options: CurrencyFormatOptions = {
      style: 'currency',
      currency: this.currency(),
      roundingMode: this.roundingMode(),
      // Only override when asked. Omitting the keys leaves Intl on the
      // currency's own convention, which is what `null` means here.
      ...(digits === null
        ? {}
        : { minimumFractionDigits: digits, maximumFractionDigits: digits }),
    };
    try {
      return new Intl.NumberFormat(this.locale(), options);
    } catch {
      return null;
    }
  });

  /**
   * Minor units per major unit for this currency — 100 for USD, 1 for JPY, 1000
   * for KWD. Read back from `Intl` rather than hardcoded, because hardcoding 100
   * puts the decimal point out for every zero- and three-decimal currency.
   *
   * Resolved from a formatter built *without* `fractionDigits`, so a display
   * override cannot move the scale of the stored figure.
   */
  private readonly minorScale = computed<number>(() => {
    try {
      const resolved = new Intl.NumberFormat(this.locale(), {
        style: 'currency',
        currency: this.currency(),
      }).resolvedOptions();
      return 10 ** (resolved.maximumFractionDigits ?? 2);
    } catch {
      return 100;
    }
  });

  private toMajor(value: number): number {
    return this.minorUnits() ? value / this.minorScale() : value;
  }

  /**
   * One figure, printed.
   *
   * ★★ A FIGURE THAT ROUNDED AWAY TO NOTHING MUST NOT KEEP ITS MINUS SIGN.
   *    `-0.001` formats as "-$0.00", and a minus on a zero reads as a refund.
   *    The test is "does this print the same as negative zero does" rather than a
   *    threshold, because the answer depends on both the printed precision and
   *    the rounding mode: under `floor`, -0.001 legitimately *is* -$0.01, and
   *    that sign has to survive.
   */
  private format(value: number): string {
    const major = this.toMajor(value);
    const formatter = this.formatter();
    if (formatter !== null) {
      const printed = formatter.format(major);
      return printed === formatter.format(-0) ? formatter.format(0) : printed;
    }
    const digits = this.fractionDigits() ?? 2;
    return `${this.currency()} ${(Number(major.toFixed(digits)) || 0).toFixed(digits)}`;
  }

  /** True when there is a valid upper bound to print. */
  readonly hasRange = computed<boolean>(() => {
    const upper = this.amountTo();
    return upper !== null && upper > this.amount();
  });

  /** True when the price is open-ended: a lower bound with nothing above it. */
  readonly isFrom = computed<boolean>(() => this.from() && !this.hasRange());

  /**
   * True when the amount is money owed *to* the shopper — a refund or a credit.
   *
   * Checked against what is *printed*, not against the sign of the input: a
   * figure that rounded away to nothing prints as zero, and announcing "credit"
   * over a zero would contradict the figure beside it.
   */
  readonly isCredit = computed<boolean>(
    () => this.amount() < 0 && this.formattedAmount() !== this.format(0),
  );

  /**
   * True when a valid, higher compare-at price is present.
   *
   * A range and a credit both rule it out: a saving off a span is not one
   * number, and a percentage off a negative base is not a saving at all — it
   * used to compute one anyway, so an amount of -50 against a compare-at of 100
   * advertised "150% off".
   */
  readonly hasDiscount = computed<boolean>(() => {
    if (this.hasRange() || this.isCredit()) return false;
    const compare = this.compareAt();
    return compare !== null && compare > this.amount();
  });

  /**
   * Whole-number saving percentage (0 when there is no discount).
   *
   * `hasDiscount` has already established `compare > amount >= 0`, so the
   * division cannot be by zero.
   */
  readonly discountPercent = computed<number>(() => {
    if (!this.hasDiscount()) return 0;
    const compare = this.compareAt() as number;
    return Math.round(((compare - this.amount()) / compare) * 100);
  });

  /** True when the amount is zero and a free label is provided. */
  readonly isFree = computed<boolean>(
    () => this.amount() === 0 && !this.hasRange() && !!this.freeLabel(),
  );

  readonly formattedAmount = computed<string>(() => this.format(this.amount()));

  readonly formattedCompareAt = computed<string>(() => {
    const compare = this.compareAt();
    return compare === null ? '' : this.format(compare);
  });

  readonly formattedAmountTo = computed<string>(() => {
    const upper = this.amountTo();
    return upper === null ? '' : this.format(upper);
  });

  /** The stated tax basis, or '' when there is none to state. */
  readonly taxNote = computed<string>(() => {
    switch (this.taxMode()) {
      case 'inclusive': return `incl. ${this.taxLabel()}`;
      case 'exclusive': return `excl. ${this.taxLabel()}`;
      default:          return '';
    }
  });

  readonly amountClass = computed<string>(
    () =>
      ({
        sm: 'text-sm',
        md: 'text-base',
        lg: 'text-xl',
        xl: 'text-3xl',
      })[this.size()],
  );

  readonly compareClass = computed<string>(
    () =>
      ({
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
        xl: 'text-lg',
      })[this.size()],
  );

  /**
   * Both axes, because the block is a column of two rows (the price and the tax
   * note) and the price row is itself a wrapping row. `justify-*` aligns the
   * price row's contents; `items-*` aligns the rows against each other.
   */
  readonly alignClass = computed<string>(
    () =>
      ({
        start: 'items-start justify-start text-left',
        center: 'items-center justify-center text-center',
        end: 'items-end justify-end text-right',
      })[this.align()],
  );
}
