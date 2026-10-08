/** One metered thing this plan caps. */
export interface PlanQuota {
  readonly key: string;
  readonly label: string;
  readonly used: number;
  /** `null` means unlimited — rendered as a count, never as a 0% bar. */
  readonly limit: number | null;
  readonly unit: string;
}

export interface AccountPlan {
  readonly name: string;
  readonly priceLabel: string;
  readonly interval: string;
  /** ISO date the current period ends. */
  readonly renewsAt: string;
  readonly seats: number;
  readonly seatsUsed: number;
  readonly quotas: readonly PlanQuota[];
  /** Set when the subscription is ending rather than renewing. */
  readonly cancelAtPeriodEnd?: boolean;
}

export interface PaymentMethod {
  readonly brand: string;
  readonly last4: string;
  readonly expMonth: number;
  readonly expYear: number;
  readonly name: string;
}

export type InvoiceStatus = 'paid' | 'open' | 'failed';

export interface Invoice {
  readonly id: string;
  readonly number: string;
  readonly date: string;
  readonly amount: string;
  readonly status: InvoiceStatus;
  /** Where this invoice's PDF lives. Absent hides the download button. */
  readonly pdfUrl?: string;
}

/**
 * The billing day, `offset` months from the next one after `today`.
 *
 * ★★ RELATIVE, NOT FIXED. A plan pinned to "Renews on 18 Sep 2026" read as
 *    overdue to anyone who opened the template after that date. The next 18th
 *    after today is always ahead, and the invoices step back a month at a time
 *    from it. Local noon, not midnight UTC: `'…T00:00:00.000Z'` formats as the
 *    17th everywhere west of Greenwich.
 */
export function billingDay(today: Date, offset: number): string {
  const next = new Date(today.getFullYear(), today.getMonth(), 18, 12);
  if (next.getTime() <= today.getTime()) next.setMonth(next.getMonth() + 1);
  return new Date(next.getFullYear(), next.getMonth() + offset, 18, 12).toISOString();
}

const TODAY = new Date();

export const ACCOUNT_PLAN_FIXTURE: AccountPlan = {
  name: 'Team',
  priceLabel: '$96',
  interval: 'per month',
  renewsAt: billingDay(TODAY, 0),
  seats: 10,
  seatsUsed: 5,
  quotas: [
    { key: 'projects', label: 'Projects', used: 14, limit: 25, unit: '' },
    { key: 'storage', label: 'Storage', used: 41, limit: 100, unit: 'GB' },
    { key: 'api', label: 'API calls', used: 128_400, limit: 500_000, unit: '' },
    { key: 'members', label: 'Members', used: 5, limit: 10, unit: '' },
  ],
};

export const PAYMENT_METHOD_FIXTURE: PaymentMethod = {
  brand: 'Visa',
  last4: '4242',
  expMonth: 4,
  expYear: 2029,
  name: 'Sophie Lang',
};

export const INVOICES_FIXTURE: readonly Invoice[] = [
  { id: 'in_8', number: 'INV-2026-008', date: billingDay(TODAY, -1), amount: '$96.00', status: 'paid' },
  { id: 'in_7', number: 'INV-2026-007', date: billingDay(TODAY, -2), amount: '$96.00', status: 'paid' },
  { id: 'in_6', number: 'INV-2026-006', date: billingDay(TODAY, -3), amount: '$96.00', status: 'paid' },
  { id: 'in_5', number: 'INV-2026-005', date: billingDay(TODAY, -4), amount: '$72.00', status: 'paid' },
  { id: 'in_4', number: 'INV-2026-004', date: billingDay(TODAY, -5), amount: '$72.00', status: 'failed' },
];

/**
 * A quota as a percentage, or `null` when the plan does not cap it.
 *
 * ★★ UNLIMITED IS NOT 100%, AND IT IS NOT 0% EITHER. Both are bars, and a bar
 * is a promise that there is a ceiling to run into. `null` tells the template
 * to render the number on its own.
 *
 * ★ Clamped to 100. An over-limit quota is a real state (a plan that let you
 * past the cap and is now billing overage), and a 140%-wide bar overflows its
 * rail and paints across whatever is beside it.
 */
export function quotaPercent(q: PlanQuota): number | null {
  if (q.limit === null || q.limit <= 0) return null;
  return Math.min(100, Math.round((q.used / q.limit) * 100));
}

/** How close to the cap this is, which decides the bar's colour. */
export function quotaTone(q: PlanQuota): 'ok' | 'warn' | 'over' {
  const pct = quotaPercent(q);
  if (pct === null) return 'ok';
  if (pct >= 90) return 'over';
  if (pct >= 75) return 'warn';
  return 'ok';
}

/**
 * A billing link that is safe to put in an `href`, or `null`.
 *
 * ★ Only `https:` and same-origin paths. A portal or PDF URL arrives from
 *   config or from the API, and `javascript:` in either would run on click.
 */
export function safeBillingUrl(url: string | undefined): string | null {
  const value = (url ?? '').trim();
  if (/^https:\/\//i.test(value)) return value;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  return null;
}

/** 128400 → "128,400" — thousands separators without a pipe in the template. */
export function formatCount(n: number): string {
  return n.toLocaleString();
}
