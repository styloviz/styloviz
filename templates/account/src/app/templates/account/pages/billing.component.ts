import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { SvButtonComponent } from '@styloviz/button';
import { SvBadgeComponent } from '@styloviz/badge';
import { SvIconComponent } from '@styloviz/icons';
import { SvEmptyShellComponent } from '@styloviz/core';
import { accountRecord } from '../account.data';
import { ACCOUNT_BILLING } from '../account.config';
import { SvAccountAsyncComponent } from '../account-async.component';
import {
  ACCOUNT_PLAN_FIXTURE,
  INVOICES_FIXTURE,
  PAYMENT_METHOD_FIXTURE,
  formatCount,
  quotaPercent,
  quotaTone,
  safeBillingUrl,
  type AccountPlan,
  type Invoice,
  type InvoiceStatus,
  type PaymentMethod,
  type PlanQuota,
} from '../fixtures/billing.fixture';

/** What one payload of this page looks like. */
interface BillingPayload {
  readonly plan: AccountPlan;
  readonly paymentMethod: PaymentMethod | null;
  readonly invoices: readonly Invoice[];
}

const BILLING_FIXTURE: BillingPayload = {
  plan: ACCOUNT_PLAN_FIXTURE,
  paymentMethod: PAYMENT_METHOD_FIXTURE,
  invoices: INVOICES_FIXTURE,
};

const QUOTA_TONE: Record<'ok' | 'warn' | 'over', string> = {
  ok: 'bg-brand-500',
  warn: 'bg-amber-500',
  over: 'bg-rose-500',
};

const INVOICE_BADGE: Record<InvoiceStatus, 'success' | 'warning' | 'danger'> = {
  paid: 'success',
  open: 'warning',
  failed: 'danger',
};

/**
 * AccountBillingComponent
 *
 * Plan, usage and invoices — the third thing every account screen is asked
 * for and the one this template was missing. One payload, same
 * `accountRecord` path as the profile page, so the loading, failure and retry
 * frames are the ones the rest of the template already uses.
 */
@Component({
  selector: 'sv-account-billing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SvAccountAsyncComponent,
    SvEmptyShellComponent,
    SvButtonComponent,
    SvBadgeComponent,
    SvIconComponent,
  ],
  templateUrl: './billing.component.html',
})
export class AccountBillingComponent {
  protected readonly record = accountRecord<BillingPayload>('account/billing', BILLING_FIXTURE);

  readonly plan = computed<AccountPlan | null>(() => this.record.value()?.plan ?? null);
  readonly paymentMethod = computed<PaymentMethod | null>(() => this.record.value()?.paymentMethod ?? null);
  readonly invoices = computed<readonly Invoice[]>(() => this.record.value()?.invoices ?? []);

  readonly quotas = computed<readonly PlanQuota[]>(() => this.plan()?.quotas ?? []);

  /** `null` hides every portal action — see `ACCOUNT_BILLING`. */
  protected readonly portalUrl = safeBillingUrl(ACCOUNT_BILLING.portalUrl);
  protected readonly archiveUrl = safeBillingUrl(ACCOUNT_BILLING.invoiceArchiveUrl);

  /** Whether any invoice has a PDF, so the column exists only when it has content. */
  readonly hasPdfs = computed(() => this.invoices().some((inv) => safeBillingUrl(inv.pdfUrl) !== null));

  pdfUrl(invoice: Invoice): string | null {
    return safeBillingUrl(invoice.pdfUrl);
  }

  readonly seatsPercent = computed<number>(() => {
    const p = this.plan();
    if (!p || p.seats <= 0) return 0;
    return Math.min(100, Math.round((p.seatsUsed / p.seats) * 100));
  });

  /** `null` for an uncapped quota — see the note on `quotaPercent`. */
  percent(q: PlanQuota): number | null {
    return quotaPercent(q);
  }

  barClass(q: PlanQuota): string {
    return QUOTA_TONE[quotaTone(q)];
  }

  /** "41 / 100 GB", or just "41" when the plan does not cap it. */
  usageLabel(q: PlanQuota): string {
    const used = formatCount(q.used);
    const unit = q.unit ? ` ${q.unit}` : '';
    if (q.limit === null) return `${used}${unit}`;
    return `${used} / ${formatCount(q.limit)}${unit}`;
  }

  invoiceVariant(status: InvoiceStatus): 'success' | 'warning' | 'danger' {
    return INVOICE_BADGE[status];
  }

  formatDate(iso: string): string {
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return '—';
    return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /** `true` once a card is inside two months of expiring. */
  readonly cardExpiringSoon = computed<boolean>(() => {
    const pm = this.paymentMethod();
    if (!pm) return false;
    const expiry = new Date(pm.expYear, pm.expMonth, 1).getTime();
    return expiry - Date.now() < 1000 * 60 * 60 * 24 * 60;
  });
}
