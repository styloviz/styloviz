import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import {
  SvPricingTableComponent,
  type SvPricingBilling,
  type SvPricingFeature,
  type SvPricingPlan,
  type SvPricingPlanSelect,
} from './pricing-table.component';
import {
  svAnnualMonthly,
  svAnnualSaving,
  svAnnualSavingPercent,
  svAnnualTotal,
  svFormatPlanPrice,
  svPricingHeadlineSaving,
} from './pricing-math';
import { SV_COMMERCE_LABELS } from '../labels/commerce.labels';

const PLANS: readonly SvPricingPlan[] = [
  { id: 'starter', name: 'Starter', price: { monthly: 49 } },
  { id: 'growth', name: 'Growth', price: { monthly: 149 }, highlighted: true },
  { id: 'enterprise', name: 'Enterprise', price: 'Contact sales', cta: { label: 'Talk to sales', href: 'mailto:sales@example.com' } },
];

const FEATURES: readonly SvPricingFeature[] = [
  { id: 'seats', label: 'Seats', group: 'Team', values: { starter: '2', growth: '10', enterprise: 'Unlimited' } },
  { id: 'sso', label: 'SSO', group: 'Security', values: { starter: false, growth: false, enterprise: true } },
  { id: 'api', label: 'API access', group: 'Team', values: { growth: true, enterprise: true } },
];

async function mount(inputs: Record<string, unknown> = {}, providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const result = await render(SvPricingTableComponent, {
    inputs: { plans: PLANS, locale: 'en-US', ...inputs } as never,
    providers: providers as never[],
  });
  result.fixture.detectChanges();
  await result.fixture.whenStable();
  return result.fixture;
}

type Fixture = Awaited<ReturnType<typeof mount>>;

const el = (f: Fixture) => f.nativeElement as HTMLElement;
const plan = (f: Fixture, id: string) => el(f).querySelector<HTMLElement>(`[data-sv-pricing-plan="${id}"]`)!;
const amount = (f: Fixture, id: string) =>
  el(f).querySelector(`[data-sv-pricing-price="${id}"] [data-sv-pricing-amount]`)?.textContent?.trim();
const billed = (f: Fixture, id: string) =>
  el(f).querySelector(`[data-sv-pricing-price="${id}"] [data-sv-pricing-billed]`)?.textContent?.trim();
const radio = (f: Fixture, value: SvPricingBilling) =>
  el(f).querySelector<HTMLInputElement>(`input[data-sv-pricing-billing-option="${value}"]`)!;

async function settle(f: Fixture): Promise<void> {
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
}

describe('pricing math', () => {
  it('derives the annual month, the invoice, the saving and the percentage from the monthly price', () => {
    const price = { monthly: 149 };
    expect(svAnnualMonthly(price, 0.2)).toBe(119);
    expect(svAnnualTotal(price, 0.2)).toBe(1428);
    expect(svAnnualSaving(price, 0.2)).toBe(149 * 12 - 1428);
    // From the prices charged, not the constant: 360 / 1788 is 20.1 %.
    expect(svAnnualSavingPercent(price, 0.2)).toBe(Math.round((360 / 1788) * 100));
  });

  it('keeps cents on a price quoted in cents', () => {
    expect(svAnnualMonthly({ monthly: 9.99 }, 0.2)).toBe(7.99);
    expect(svAnnualTotal({ monthly: 9.99 }, 0.2)).toBe(95.88);
  });

  it('uses a given annual price over the discount', () => {
    expect(svAnnualMonthly({ monthly: 20, annual: 15 }, 0.5)).toBe(15);
  });

  it('survives a free plan and refuses a nonsense discount', () => {
    expect(svAnnualSavingPercent({ monthly: 0 }, 0.2)).toBe(0);
    expect(svAnnualMonthly({ monthly: 100 }, 1.5)).toBe(100);
    expect(svAnnualMonthly({ monthly: 100 }, -0.2)).toBe(100);
  });

  it('headlines the smallest saving any paid plan gives, ignoring free plans', () => {
    expect(svPricingHeadlineSaving([{ monthly: 0 }, { monthly: 49 }, { monthly: 149 }], 0.2)).toBe(
      Math.min(svAnnualSavingPercent({ monthly: 49 }, 0.2), svAnnualSavingPercent({ monthly: 149 }, 0.2)),
    );
    expect(svPricingHeadlineSaving([{ monthly: 49 }, { monthly: 20, annual: 20 }], 0.2)).toBe(0);
  });

  it('formats whole amounts without decimals and falls back on a bad currency', () => {
    expect(svFormatPlanPrice(149, 'USD', 'en-US')).toBe('$149');
    expect(svFormatPlanPrice(1428, 'USD', 'en-US')).toBe('$1,428');
    expect(svFormatPlanPrice(9.99, 'USD', 'en-US')).toBe('$9.99');
    expect(svFormatPlanPrice(5, 'NOPE!', 'en-US')).toBe('NOPE! 5');
  });
});

describe('SvPricingTableComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('billing toggle', () => {
    it('is a native radio group in a fieldset, named by its legend', async () => {
      const f = await mount();
      const fieldset = el(f).querySelector('fieldset[data-sv-pricing-billing]');
      expect(fieldset?.querySelector('legend')?.textContent?.trim()).toBe(SV_COMMERCE_LABELS.pricingBillingLegend);
      const radios = [...el(f).querySelectorAll<HTMLInputElement>('input[type="radio"]')];
      expect(radios.map((r) => r.value)).toEqual(['monthly', 'annual']);
      expect(new Set(radios.map((r) => r.name)).size).toBe(1);
      expect(radios.every((r) => r.parentElement?.tagName === 'LABEL')).toBe(true);
    });

    it('switches every price and emits billingChange', async () => {
      const f = await mount({ annualDiscount: 0.2 });
      const changes: SvPricingBilling[] = [];
      // `billing` is a model(): its subscribers are what `(billingChange)` binds to.
      f.componentInstance.billing.subscribe((b) => changes.push(b));

      expect(amount(f, 'growth')).toBe('$149');
      expect(billed(f, 'growth')).toBe('$149 billed every month');

      radio(f, 'annual').click();
      await settle(f);

      expect(changes).toEqual(['annual']);
      expect(f.componentInstance.billing()).toBe('annual');
      expect(amount(f, 'growth')).toBe('$119');
      expect(billed(f, 'growth')).toBe('$1,428 billed once a year');
      expect(amount(f, 'starter')).toBe(`$${svAnnualMonthly({ monthly: 49 }, 0.2)}`);
    });

    it('states the annual saving per plan, derived from the prices', async () => {
      const f = await mount({ annualDiscount: 0.2, billing: 'annual' });
      const saving = plan(f, 'growth').querySelector('[data-sv-pricing-saving]')?.textContent?.trim();
      expect(saving).toBe(`Save $${svAnnualSaving({ monthly: 149 }, 0.2)} a year · ${svAnnualSavingPercent({ monthly: 149 }, 0.2)}% off`);
      // Monthly billing saves nothing, so it says nothing.
      const monthly = await mount({ annualDiscount: 0.2 });
      expect(plan(monthly, 'growth').querySelector('[data-sv-pricing-saving]')).toBeNull();
    });

    it('headlines the smallest saving and ties it to the Annual radio', async () => {
      const f = await mount({ annualDiscount: 0.2 });
      const headline = el(f).querySelector('[data-sv-pricing-headline-saving]');
      const smallest = svPricingHeadlineSaving([{ monthly: 49 }, { monthly: 149 }], 0.2);
      expect(headline?.textContent?.trim()).toBe(`Save at least ${smallest}%`);
      expect(radio(f, 'annual').getAttribute('aria-describedby')).toBe(headline?.id);
      expect(radio(f, 'monthly').hasAttribute('aria-describedby')).toBe(false);
    });

    it('promises no saving when there is none, and hides the toggle when nothing is priced', async () => {
      const f = await mount();
      expect(el(f).querySelector('[data-sv-pricing-headline-saving]')).toBeNull();
      const quoted = await mount({ plans: [{ id: 'ent', name: 'Enterprise', price: 'Custom' }] });
      expect(el(quoted).querySelector('fieldset')).toBeNull();
    });
  });

  describe('highlighted plan', () => {
    it('badges it in text and reads the badge with its heading', async () => {
      const f = await mount();
      const card = plan(f, 'growth');
      expect(card.dataset['highlighted']).toBe('true');
      expect(card.querySelector('[data-sv-pricing-badge]')?.textContent?.trim()).toBe(SV_COMMERCE_LABELS.pricingPopular);
      const heading = card.querySelector('[role="heading"]')!;
      expect(heading.getAttribute('aria-level')).toBe('3');
      expect(heading.textContent?.replace(/\s+/g, ' ').trim()).toBe(`Growth, ${SV_COMMERCE_LABELS.pricingPopular}`);
      expect(card.getAttribute('aria-labelledby')).toBe(heading.id);
      expect(plan(f, 'starter').dataset['highlighted']).toBeUndefined();
    });

    it('announces it in its column header in the table', async () => {
      const f = await mount({ layout: 'table', features: FEATURES });
      const header = el(f).querySelector('thead th[data-sv-pricing-plan="growth"]')!;
      expect(header.getAttribute('scope')).toBe('col');
      expect(header.querySelector('span')?.textContent?.trim()).toBe('Growth');
      expect(header.querySelector('[data-sv-pricing-badge]')?.textContent?.trim()).toBe(SV_COMMERCE_LABELS.pricingPopular);
      // The badge is inside the header cell, so it is part of what is announced with each cell of the column.
      expect(header.textContent).toContain(SV_COMMERCE_LABELS.pricingPopular);
    });

    it('honours only the first highlighted plan, and a plan badge of its own', async () => {
      const f = await mount({
        plans: [
          { id: 'a', name: 'A', price: { monthly: 10 }, highlighted: true, badge: 'Best value' },
          { id: 'b', name: 'B', price: { monthly: 20 }, highlighted: true },
        ],
      });
      expect(plan(f, 'a').querySelector('[data-sv-pricing-badge]')?.textContent?.trim()).toBe('Best value');
      expect(plan(f, 'b').dataset['highlighted']).toBeUndefined();
    });
  });

  describe('comparison table', () => {
    it('is a real table with a caption and scoped row, column and group headers', async () => {
      const f = await mount({ layout: 'table', features: FEATURES });
      const table = el(f).querySelector('table')!;
      expect(table.querySelector('caption')?.textContent?.trim()).toBe(SV_COMMERCE_LABELS.pricingCaption);
      expect(table.querySelectorAll('thead th[scope="col"]').length).toBe(PLANS.length + 1);
      const rowHeaders = [...table.querySelectorAll('tbody th[scope="row"]')].map((th) => th.textContent?.trim());
      expect(rowHeaders).toEqual([SV_COMMERCE_LABELS.pricingPriceRow, 'Seats', 'API access', 'SSO']);
      const groups = [...table.querySelectorAll('th[scope="rowgroup"]')];
      expect(groups.map((th) => th.textContent?.trim())).toEqual(['Team', 'Security']);
      expect(groups[0].getAttribute('colspan')).toBe(String(PLANS.length + 1));
      // The scroller is reachable by keyboard and named by the caption.
      const region = el(f).querySelector('[role="region"]')!;
      expect(region.getAttribute('tabindex')).toBe('0');
      expect(region.getAttribute('aria-labelledby')).toBe(table.querySelector('caption')?.id);
    });

    it('reads a boolean cell as Included / Not included and prints a text cell as text', async () => {
      const f = await mount({ layout: 'table', features: FEATURES });
      const cells = (id: string) =>
        [...el(f).querySelectorAll(`tr[data-sv-pricing-feature="${id}"] td`)].map((td) => td.textContent?.trim());
      expect(cells('sso')).toEqual([
        SV_COMMERCE_LABELS.pricingNotIncluded,
        SV_COMMERCE_LABELS.pricingNotIncluded,
        SV_COMMERCE_LABELS.pricingIncluded,
      ]);
      // A plan missing from `values` is not included.
      expect(cells('api')[0]).toBe(SV_COMMERCE_LABELS.pricingNotIncluded);
      expect(cells('seats')).toEqual(['2', '10', 'Unlimited']);
      expect(el(f).querySelector('tr[data-sv-pricing-feature="sso"] td .sr-only')?.textContent?.trim()).toBe(
        SV_COMMERCE_LABELS.pricingNotIncluded,
      );
    });

    it('lists the included rows on a card when a plan has no bullets of its own', async () => {
      const f = await mount({ features: FEATURES });
      const bullets = [...plan(f, 'growth').querySelectorAll('li')].map((li) => li.textContent?.trim());
      expect(bullets).toEqual(['Seats: 10', 'API access']);
    });
  });

  describe('plans and calls to action', () => {
    it('prints a quoted plan as its text, with no per-month figure', async () => {
      const f = await mount();
      const card = plan(f, 'enterprise');
      expect(card.querySelector('[data-sv-pricing-amount]')).toBeNull();
      expect(card.textContent).toContain('Contact sales');
    });

    it('prints a zero price as Free and bills nothing', async () => {
      const f = await mount({ plans: [{ id: 'free', name: 'Hobby', price: { monthly: 0 } }] });
      expect(plan(f, 'free').textContent).toContain(SV_COMMERCE_LABELS.pricingFree);
      expect(plan(f, 'free').querySelector('[data-sv-pricing-billed]')).toBeNull();
    });

    it('emits planSelect with the plan and the billing period', async () => {
      const f = await mount({ billing: 'annual', annualDiscount: 0.2 });
      const out: SvPricingPlanSelect[] = [];
      f.componentInstance.planSelect.subscribe((e) => out.push(e));
      plan(f, 'growth').querySelector<HTMLButtonElement>('button[data-sv-pricing-cta]')!.click();
      expect(out).toEqual([{ plan: PLANS[1], billing: 'annual' }]);
      expect(plan(f, 'growth').querySelector('button[data-sv-pricing-cta]')?.textContent?.trim()).toBe('Choose Growth');
    });

    it('renders a safe href as a link and drops an unsafe one for a button', async () => {
      const f = await mount({
        plans: [
          { id: 'ent', name: 'Enterprise', price: 'Custom', cta: { label: 'Talk to sales', href: 'mailto:sales@example.com' } },
          { id: 'bad', name: 'Bad', price: { monthly: 5 }, cta: { href: 'javascript:alert(1)' } },
        ],
      });
      const link = plan(f, 'ent').querySelector('a[data-sv-pricing-cta]');
      expect(link?.getAttribute('href')).toBe('mailto:sales@example.com');
      expect(link?.textContent?.trim()).toBe('Talk to sales');
      expect(plan(f, 'bad').querySelector('a')).toBeNull();
      expect(plan(f, 'bad').querySelector('button[data-sv-pricing-cta]')).not.toBeNull();
    });

    it('marks the selected plan\'s CTA', async () => {
      const f = await mount({ selectedPlanId: 'starter' });
      const cta = plan(f, 'starter').querySelector('button[data-sv-pricing-cta]')!;
      expect(cta.textContent?.trim()).toBe(SV_COMMERCE_LABELS.pricingSelected);
      expect(cta.getAttribute('data-selected')).toBe('true');
      expect(cta.getAttribute('aria-describedby')).toBe(plan(f, 'starter').querySelector('[role="heading"]')?.id);
    });

    it('skips plans with an empty or duplicate id and renders nothing with no plans', async () => {
      const f = await mount({
        plans: [
          { id: 'a', name: 'A', price: { monthly: 1 } },
          { id: 'a', name: 'Again', price: { monthly: 2 } },
          { id: ' ', name: 'Blank', price: { monthly: 3 } },
        ],
      });
      expect(el(f).querySelectorAll('article').length).toBe(1);
      const empty = await mount({ plans: [] });
      expect(el(empty).querySelector('[data-sv-pricing-table]')).toBeNull();
    });
  });

  describe('labels', () => {
    it('takes an instance override over the registry', async () => {
      const f = await mount({ labels: { pricingPopular: 'Recommended', pricingMonthly: 'Per month' } });
      expect(plan(f, 'growth').querySelector('[data-sv-pricing-badge]')?.textContent?.trim()).toBe('Recommended');
      expect(radio(f, 'monthly').nextElementSibling?.textContent?.trim()).toBe('Per month');
    });

    it('takes a registry override from provideSvLabels', async () => {
      const f = await mount({}, [provideSvLabels({ commerce: { pricingChoose: 'Start {plan}' } })]);
      expect(plan(f, 'starter').querySelector('button[data-sv-pricing-cta]')?.textContent?.trim()).toBe('Start Starter');
    });
  });
});
