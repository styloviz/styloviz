import { ApplicationRef, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvLiveAnnouncer, svResetBodyScrollLock } from '@styloviz/core';
import { SvSpinnerComponent } from './spinner.component';

/**
 * `sv-spinner` — the label is SPOKEN once, through the shared announcer.
 *
 * ★★★ A `role="status"` inserted with its `aria-label` already set is usually
 *     silent: live regions announce what changes in them, not what they were
 *     born with. So "the spinner announces by default" is proved here by what
 *     the shared announcer actually said — `history()` — not by attributes.
 */

async function setup(inputs: Record<string, unknown> = {}, server = false) {
  TestBed.resetTestingModule();
  const view = await render(SvSpinnerComponent, {
    inputs,
    providers: server ? [{ provide: PLATFORM_ID, useValue: 'server' }] : [],
  });
  TestBed.inject(ApplicationRef).tick();
  return view;
}

const said = () => TestBed.inject(SvLiveAnnouncer).history();

afterEach(() => {
  svResetBodyScrollLock(document);
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
});

describe('sv-spinner — announcing the wait', () => {
  it('★★ says the resolved label once, politely, when it appears', async () => {
    const { fixture } = await setup({ label: 'Loading invoices', expectedMs: 25_000 });
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();

    expect(said()).toHaveLength(1);
    expect(said()[0].message).toBe('Loading invoices, about 25 seconds');
    expect(said()[0].priority).toBe('polite');
  });

  it('★ the region keeps role="status" but no longer repeats the label as content', async () => {
    const { fixture } = await setup({ label: 'Loading invoices' });
    const status = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]')!;
    expect(status.getAttribute('aria-label')).toBe('Loading invoices');
    expect(status.textContent?.trim()).toBe('');
  });

  it('says the fallback name for a blank label, never an empty string', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await setup({ label: '' });
    expect(said().map((a) => a.message)).toEqual(['Loading…']);
    warn.mockRestore();
  });

  it('★ says nothing on the server', async () => {
    await setup({ label: 'Loading invoices' }, true);
    expect(said()).toEqual([]);
  });

  it('★ leaves the portalled fullscreen surface to its focus move — one voice, not two', async () => {
    await setup({ overlay: true, label: 'Saving invoice' });
    expect(said()).toEqual([]);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Saving invoice');
  });

  it('announces the in-place overlay, which moves no focus', async () => {
    await setup({ overlay: true, portal: false, label: 'Saving invoice' });
    expect(said().map((a) => a.message)).toEqual(['Saving invoice']);
  });

  it('keeps escalation inside the region, not in the announcer', async () => {
    vi.useFakeTimers();
    try {
      const { fixture } = await setup({ label: 'Loading', slowAfterMs: 1_000 });
      vi.advanceTimersByTime(1_000);
      fixture.detectChanges();
      const status = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]')!;
      expect(status.textContent).toContain('This is taking longer than usual…');
      expect(said().map((a) => a.message)).toEqual(['Loading']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('says nothing when destroyed before it renders', async () => {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(SvSpinnerComponent);
    fixture.destroy();
    TestBed.inject(ApplicationRef).tick();
    expect(said()).toEqual([]);
  });
});
