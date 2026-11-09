import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideSvLabels } from '@styloviz/core/i18n';
import {
  SvCookieConsentComponent,
  svCookieConsentIsCurrent,
  svReadCookieConsentRecord,
  type SvCookieCategory,
  type SvCookieConsentRecord,
} from './cookie-consent.component';
import { SV_COOKIE_CONSENT_LABELS_DE } from './cookie-consent.labels.packs';

const CATEGORIES: readonly SvCookieCategory[] = [
  { id: 'necessary', label: 'Necessary', description: 'Required for the site.', required: true },
  { id: 'analytics', label: 'Analytics', description: 'Visit counts.' },
  { id: 'marketing', label: 'Marketing' },
];

async function mount(inputs: Record<string, unknown> = {}, providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const result = await render(SvCookieConsentComponent, {
    inputs: { categories: CATEGORIES, inline: true, ...inputs } as never,
    providers: providers as never[],
  });
  result.fixture.detectChanges();
  await result.fixture.whenStable();
  return result.fixture;
}

type Fixture = Awaited<ReturnType<typeof mount>>;

const el = (f: Fixture) => f.nativeElement as HTMLElement;
const action = (f: Fixture, name: string, scope: 'bar' | 'dialog' = 'bar') =>
  el(f).querySelector<HTMLButtonElement>(
    `${scope === 'bar' ? '[data-sv-cookie-consent]' : '[data-sv-cookie-dialog]'} [data-sv-cookie-action="${name}"]`,
  );
const switches = (f: Fixture) => [...el(f).querySelectorAll<HTMLInputElement>('[data-sv-cookie-switch]')];
const dialog = (f: Fixture) => el(f).querySelector<HTMLDialogElement>('[data-sv-cookie-dialog]')!;

async function settle(f: Fixture): Promise<void> {
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
}

function records(f: Fixture): SvCookieConsentRecord[] {
  const out: SvCookieConsentRecord[] = [];
  f.componentInstance.recorded.subscribe((r) => out.push(r));
  return out;
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('SvCookieConsentComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    try {
      localStorage.clear();
    } catch {
      /* storage unavailable in this environment */
    }
  });

  describe('banner', () => {
    it('is a named, non-modal region that does not take focus', async () => {
      const before = document.activeElement;
      const f = await mount();
      const region = el(f).querySelector('[data-sv-cookie-consent]')!;
      expect(region.getAttribute('role')).toBe('region');
      expect(region.getAttribute('aria-label')).toBe('Cookie consent');
      expect(region.closest('dialog')).toBeNull();
      expect(document.activeElement).toBe(before);
      expect(dialog(f).hasAttribute('open')).toBe(false);
    });

    it('gives Reject all exactly the same styling as Accept all', async () => {
      const f = await mount();
      expect(action(f, 'reject-all')!.className).toBe(action(f, 'accept-all')!.className);
    });

    it('records Accept all with every category, the version and an ISO timestamp', async () => {
      const f = await mount({ version: '2026-10' });
      const out = records(f);
      action(f, 'accept-all')!.click();
      await settle(f);
      expect(out).toHaveLength(1);
      expect(out[0].method).toBe('accept-all');
      expect(out[0].version).toBe('2026-10');
      expect(out[0].timestamp).toMatch(ISO);
      expect(out[0].categories).toEqual({ necessary: true, analytics: true, marketing: true });
      expect(f.componentInstance.consent()).toEqual(out[0].categories);
      expect(f.componentInstance.open()).toBe(false);
      expect(el(f).querySelector('[data-sv-cookie-consent]')).toBeNull();
    });

    it('records Reject all with only the required categories on', async () => {
      const f = await mount();
      const out = records(f);
      action(f, 'reject-all')!.click();
      await settle(f);
      expect(out[0].method).toBe('reject-all');
      expect(out[0].categories).toEqual({ necessary: true, analytics: false, marketing: false });
    });

    it('announces the saved choice politely once the banner is gone', async () => {
      const f = await mount();
      action(f, 'reject-all')!.click();
      await settle(f);
      const status = el(f).querySelector('[data-sv-cookie-status]')!;
      expect(status.getAttribute('role')).toBe('status');
      expect(status.textContent?.trim()).toBe('Your cookie choices have been saved.');
    });

    it('is operable from the keyboard alone', async () => {
      const f = await mount();
      const out = records(f);
      const user = userEvent.setup();
      await user.tab();
      expect(document.activeElement).toBe(action(f, 'customise'));
      await user.tab();
      expect(document.activeElement).toBe(action(f, 'reject-all'));
      await user.keyboard('{Enter}');
      await settle(f);
      expect(out.map((r) => r.method)).toEqual(['reject-all']);
    });

    it('renders the corner card variant with the same three choices', async () => {
      const f = await mount({ layout: 'corner' });
      const region = el(f).querySelector('[data-sv-cookie-consent]')!;
      expect(region.getAttribute('data-sv-cookie-layout')).toBe('corner');
      expect(action(f, 'accept-all')).toBeTruthy();
      expect(action(f, 'reject-all')).toBeTruthy();
      expect(action(f, 'customise')).toBeTruthy();
    });

    it('is fixed to the viewport unless inline', async () => {
      const fixed = await mount({ inline: false });
      expect(el(fixed).querySelector('[data-sv-cookie-consent]')!.className).toContain('fixed');
      const inline = await mount({ inline: true });
      expect(el(inline).querySelector('[data-sv-cookie-consent]')!.className).not.toContain('fixed');
    });
  });

  describe('preferences', () => {
    it('pre-ticks no optional category', async () => {
      const f = await mount();
      action(f, 'customise')!.click();
      await settle(f);
      const [necessary, analytics, marketing] = switches(f);
      expect(switches(f).every((s) => s.type === 'checkbox' && s.getAttribute('role') === 'switch')).toBe(true);
      expect(necessary.checked).toBe(true);
      expect(analytics.checked).toBe(false);
      expect(marketing.checked).toBe(false);
    });

    it('keeps the required category on and disabled, and never records it off', async () => {
      const f = await mount();
      const out = records(f);
      action(f, 'customise')!.click();
      await settle(f);
      const necessary = switches(f)[0];
      expect(necessary.disabled).toBe(true);
      expect(necessary.checked).toBe(true);
      // Even a forced change event cannot turn it off.
      necessary.checked = false;
      necessary.dispatchEvent(new Event('change'));
      await settle(f);
      expect(necessary.checked).toBe(true);
      action(f, 'save', 'dialog')!.click();
      await settle(f);
      expect(out[0].categories['necessary']).toBe(true);
    });

    it('saves exactly the switches the visitor turned on, from the keyboard', async () => {
      const f = await mount({ version: '3' });
      const out = records(f);
      action(f, 'customise')!.click();
      await settle(f);
      const analytics = switches(f)[1];
      analytics.focus();
      await userEvent.setup().keyboard(' ');
      await settle(f);
      expect(analytics.checked).toBe(true);
      // Nothing is recorded until Save.
      expect(out).toHaveLength(0);
      expect(f.componentInstance.consent()).toEqual({});
      action(f, 'save', 'dialog')!.click();
      await settle(f);
      expect(out).toHaveLength(1);
      expect(out[0].method).toBe('save');
      expect(out[0].version).toBe('3');
      expect(out[0].timestamp).toMatch(ISO);
      expect(out[0].categories).toEqual({ necessary: true, analytics: true, marketing: false });
      expect(f.componentInstance.preferencesOpen()).toBe(false);
    });

    it('offers Accept all and Reject all inside the dialog with equal styling', async () => {
      const f = await mount();
      action(f, 'customise')!.click();
      await settle(f);
      const accept = action(f, 'accept-all', 'dialog')!;
      const reject = action(f, 'reject-all', 'dialog')!;
      expect(accept.className).toBe(reject.className);
    });

    it('discards an unsaved draft when closed', async () => {
      const f = await mount();
      action(f, 'customise')!.click();
      await settle(f);
      switches(f)[2].click();
      await settle(f);
      action(f, 'close', 'dialog')!.click();
      await settle(f);
      expect(f.componentInstance.preferencesOpen()).toBe(false);
      action(f, 'customise')!.click();
      await settle(f);
      expect(switches(f)[2].checked).toBe(false);
    });

    it('labels every switch and points it at its description', async () => {
      const f = await mount();
      action(f, 'customise')!.click();
      await settle(f);
      for (const s of switches(f)) {
        const label = el(f).querySelector(`label[for="${s.id}"]`);
        expect(label?.textContent?.trim()).toBeTruthy();
      }
      const analytics = switches(f)[1];
      const desc = document.getElementById(analytics.getAttribute('aria-describedby')!);
      expect(desc?.textContent).toBe('Visit counts.');
      expect(switches(f)[2].hasAttribute('aria-describedby')).toBe(false);
    });

    it('can be reopened from the host to withdraw consent', async () => {
      const f = await mount({ open: false, consent: { analytics: true } });
      expect(el(f).querySelector('[data-sv-cookie-consent]')).toBeNull();
      f.componentInstance.openPreferences();
      await settle(f);
      expect(dialog(f).hasAttribute('open')).toBe(true);
      expect(switches(f)[1].checked).toBe(true);
    });
  });

  describe('modal layout', () => {
    it('opens the dialog up front, labelled by its heading, with focus on the heading', async () => {
      const f = await mount({ layout: 'modal' });
      const d = dialog(f);
      expect(d.hasAttribute('open')).toBe(true);
      const heading = d.querySelector<HTMLElement>('[data-sv-cookie-dialog-title]')!;
      expect(d.getAttribute('aria-labelledby')).toBe(heading.id);
      expect(document.activeElement).toBe(heading);
      expect(el(f).querySelector('[data-sv-cookie-consent]')).toBeNull();
    });

    it('returns focus to the opener when the preferences close', async () => {
      const f = await mount();
      const opener = action(f, 'customise')!;
      opener.focus();
      opener.click();
      await settle(f);
      expect(dialog(f).contains(document.activeElement)).toBe(true);
      action(f, 'close', 'dialog')!.click();
      await settle(f);
      expect(document.activeElement).toBe(opener);
    });

    it('falls back to the banner when dismissed without a choice', async () => {
      const f = await mount({ layout: 'modal' });
      const out = records(f);
      action(f, 'close', 'dialog')!.click();
      await settle(f);
      expect(dialog(f).hasAttribute('open')).toBe(false);
      expect(el(f).querySelector('[data-sv-cookie-consent]')).toBeTruthy();
      expect(out).toHaveLength(0);
      expect(f.componentInstance.open()).toBe(true);
    });

    it('closes itself on a decision', async () => {
      const f = await mount({ layout: 'modal' });
      action(f, 'accept-all', 'dialog')!.click();
      await settle(f);
      expect(dialog(f).hasAttribute('open')).toBe(false);
      expect(f.componentInstance.open()).toBe(false);
    });
  });

  describe('restoring a returning visitor', () => {
    it('[(consent)] restores the switches', async () => {
      const f = await mount({ consent: { analytics: true, marketing: false }, open: false });
      f.componentInstance.openPreferences();
      await settle(f);
      expect(switches(f).map((s) => s.checked)).toEqual([true, true, false]);
    });

    it('a current [record] restores consent and keeps the banner closed', async () => {
      const record: SvCookieConsentRecord = {
        version: '2',
        timestamp: '2026-10-01T09:00:00.000Z',
        method: 'save',
        categories: { necessary: true, analytics: true, marketing: false },
      };
      const f = await mount({ record, version: '2' });
      expect(f.componentInstance.open()).toBe(false);
      expect(f.componentInstance.consent()).toEqual(record.categories);
      expect(el(f).querySelector('[data-sv-cookie-consent]')).toBeNull();
    });

    it('an older [record] re-asks, says the policy changed and starts from the old choices', async () => {
      const record: SvCookieConsentRecord = {
        version: '1',
        timestamp: '2026-01-01T09:00:00.000Z',
        method: 'save',
        categories: { necessary: true, analytics: true, marketing: false },
      };
      const f = await mount({ record, version: '2' });
      expect(f.componentInstance.open()).toBe(true);
      expect(el(f).querySelector('[data-sv-cookie-policy-changed]')?.textContent).toContain('policy has changed');
      action(f, 'customise')!.click();
      await settle(f);
      expect(switches(f)[1].checked).toBe(true);
    });

    it('writes nothing to storage unless storageKey opts in', async () => {
      const f = await mount();
      const before = localStorage.length;
      action(f, 'accept-all')!.click();
      await settle(f);
      expect(localStorage.length).toBe(before);
    });

    it('with storageKey, keeps a versioned record and restores it on the next visit', async () => {
      const first = await mount({ storageKey: 'test-consent', version: '5' });
      action(first, 'reject-all')!.click();
      await settle(first);
      expect(JSON.parse(localStorage.getItem('test-consent')!)).toMatchObject({
        kind: 'sv-cookie-consent/record',
        version: 1,
        state: { version: '5', method: 'reject-all' },
      });

      const restored: SvCookieConsentRecord[] = [];
      TestBed.resetTestingModule();
      const { fixture } = await render(SvCookieConsentComponent, {
        inputs: { categories: CATEGORIES, inline: true, storageKey: 'test-consent', version: '5' } as never,
        on: { restored: (r: SvCookieConsentRecord) => restored.push(r) } as never,
      });
      await settle(fixture);
      expect(restored).toHaveLength(1);
      expect(fixture.componentInstance.open()).toBe(false);
      expect(fixture.componentInstance.consent()).toEqual({ necessary: true, analytics: false, marketing: false });
    });
  });

  describe('inputs', () => {
    it('drops an unsafe policy link and keeps a safe one', async () => {
      const unsafe = await mount({ privacyHref: 'javascript:alert(1)' });
      expect(el(unsafe).querySelector('[data-sv-cookie-consent] a')).toBeNull();
      const safe = await mount({ privacyHref: '/privacy' });
      expect(el(safe).querySelector('[data-sv-cookie-consent] a')?.getAttribute('href')).toBe('/privacy');
    });

    it('uses translated built-in categories when none are given', async () => {
      const f = await mount({ categories: [] }, [provideSvLabels(SV_COOKIE_CONSENT_LABELS_DE)]);
      expect(action(f, 'reject-all')!.textContent?.trim()).toBe('Alle ablehnen');
      action(f, 'customise')!.click();
      await settle(f);
      expect(switches(f)).toHaveLength(4);
      expect(switches(f)[0].disabled).toBe(true);
      expect(switches(f).slice(1).every((s) => !s.checked)).toBe(true);
    });

    it('skips categories with an empty or duplicate id', async () => {
      const f = await mount({
        categories: [
          { id: 'a', label: 'A' },
          { id: '', label: 'Empty' },
          { id: 'a', label: 'Again' },
        ],
      });
      action(f, 'customise')!.click();
      await settle(f);
      expect(switches(f)).toHaveLength(1);
    });
  });
});

describe('svReadCookieConsentRecord', () => {
  it('accepts a real record and rejects anything else', () => {
    const good = { version: '1', timestamp: '2026-10-01T00:00:00.000Z', method: 'save', categories: { a: true } };
    expect(svReadCookieConsentRecord(good)).toEqual(good);
    expect(svReadCookieConsentRecord(null)).toBeNull();
    expect(svReadCookieConsentRecord({ ...good, method: 'maybe' })).toBeNull();
    expect(svReadCookieConsentRecord({ ...good, timestamp: 'yesterday' })).toBeNull();
    expect(svReadCookieConsentRecord({ ...good, categories: { a: 'yes' } })).toBeNull();
  });

  it('svCookieConsentIsCurrent compares the policy version', () => {
    const r = { version: '2', timestamp: '2026-10-01T00:00:00.000Z', method: 'save' as const, categories: {} };
    expect(svCookieConsentIsCurrent(r, '2')).toBe(true);
    expect(svCookieConsentIsCurrent(r, '3')).toBe(false);
    expect(svCookieConsentIsCurrent(null, '1')).toBe(false);
  });
});
