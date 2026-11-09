import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvLiveAnnouncer } from '@styloviz/core/a11y';
import { SvSearchBarComponent } from './search-bar.component';

/**
 * `FL-J3-FI-13` / `FI-20-M4` — the suggestion count is announced (parity with
 * Autocomplete), through the shared `SvLiveAnnouncer` regions rather than a
 * node of the component's own.
 */
afterEach(() => document.querySelectorAll('.sv-search-portal').forEach((n) => n.remove()));

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvSearchBarComponent, {
    inputs: { suggestions: [{ id: '1', label: 'Invoices' }, { id: '2', label: 'Inventory' }], ...inputs },
  });
  const live = TestBed.inject(SvLiveAnnouncer);
  live.clearHistory();
  return { fixture, c: fixture.componentInstance, live };
}

const said = (live: SvLiveAnnouncer) => live.history().map((h) => h.message);

describe('sv-search-bar — suggestion count announced', () => {
  it('says how many suggestions there are when the list opens', async () => {
    const { fixture, c, live } = await setup();
    c.onFocus();
    fixture.detectChanges();
    TestBed.tick();
    expect(said(live)).toContain('2 suggestions');
  });

  it('uses the singular for one, and re-announces when the count changes', async () => {
    const { fixture, c } = await setup();
    c.onFocus();
    fixture.detectChanges();
    TestBed.tick();
    fixture.componentRef.setInput('suggestions', [{ id: '1', label: 'Invoices' }]);
    fixture.detectChanges();
    TestBed.tick();
    expect(c.countAnnouncement()).toBe('1 suggestion');
  });

  it('says nothing while closed, loading, or empty', async () => {
    const { fixture, c, live } = await setup({ loading: true });
    c.onFocus();
    fixture.detectChanges();
    TestBed.tick();
    expect(said(live).some((m) => /suggestion/.test(m))).toBe(false);
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('suggestions', []);
    fixture.detectChanges();
    TestBed.tick();
    expect(c.countAnnouncement()).toBe('');
  });

  it('adds no live region of its own for it', async () => {
    const { fixture, c } = await setup();
    c.onFocus();
    fixture.detectChanges();
    const own = [...(fixture.nativeElement as HTMLElement).querySelectorAll('[aria-live], [role="status"]')];
    expect(own.every((n) => !/suggestion/.test(n.textContent ?? ''))).toBe(true);
  });
});
