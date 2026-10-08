import { render } from '@testing-library/angular';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SvLiveAnnouncer, ToastService } from '@styloviz/core';
import { SvToastHostComponent } from './toast-host.component';

/**
 * Re-verification of the Toast P0/P1 items against the RENDERED host
 * (`OF-19-I2`/`M2`, `OF-19-I3`/`M3`, `OF-19-M1`, `OF-19-I5`). Every test here
 * drives real DOM events on real toast nodes; none calls the pause handlers
 * directly.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvToastHostComponent, { inputs });
  const service = TestBed.inject(ToastService);
  service.dismissAll();
  fixture.detectChanges();
  return { host: fixture.componentInstance, service, fixture };
}

const root = (f: ComponentFixture<SvToastHostComponent>) => f.nativeElement as HTMLElement;
const region = (f: ComponentFixture<SvToastHostComponent>) =>
  root(f).querySelector<HTMLElement>('[role="region"]')!;
const node = (id: string) => document.getElementById(id)!;
const messages = (f: ComponentFixture<SvToastHostComponent>) =>
  Array.from(region(f).querySelectorAll<HTMLElement>('[id^="svz-toast-"] p')).map((p) =>
    (p.textContent ?? '').trim(),
  );

describe('SvToastHostComponent — bounded stack (OF-19-I2 / OF-19-M2)', () => {
  it('★ maxVisible 0 is a cap of 1, not "no cap" (slice(-0) was the whole array)', async () => {
    const { service, fixture } = await setup({ maxVisible: 0 });
    for (const m of ['a', 'b', 'c']) service.info(m, { duration: 0 });
    fixture.detectChanges();
    expect(region(fixture).querySelectorAll('[id^="svz-toast-"]').length).toBe(1);
    expect(messages(fixture)).toEqual(['c']);
  });

  it('a negative or non-numeric cap falls back sensibly', async () => {
    const neg = await setup({ maxVisible: -3 });
    for (const m of ['a', 'b']) neg.service.info(m, { duration: 0 });
    neg.fixture.detectChanges();
    expect(neg.host.toasts().length).toBe(1);

    const nan = await setup({ maxVisible: Number.NaN });
    for (let i = 0; i < 8; i++) nan.service.info('m' + i, { duration: 0 });
    nan.fixture.detectChanges();
    expect(nan.host.toasts().length).toBe(5);
  });

  it('★ says how many are held back with a "+N more" line, and drops it when none are', async () => {
    const { service, fixture } = await setup({ maxVisible: 2 });
    const ids = ['1', '2', '3', '4'].map((m) => service.info(m, { duration: 0 }));
    fixture.detectChanges();

    const overflow = root(fixture).querySelector('[data-sv-toast-overflow]');
    expect(overflow?.textContent?.trim()).toBe('+2 more');
    expect(messages(fixture)).toEqual(['3', '4']);

    service.dismiss(ids[3]);
    service.dismiss(ids[2]);
    fixture.detectChanges();
    expect(root(fixture).querySelector('[data-sv-toast-overflow]')).toBeNull();
    expect(messages(fixture)).toEqual(['1', '2']);
  });

  it('Infinity is the explicit "never cap"', async () => {
    const { service, fixture } = await setup({ maxVisible: Infinity });
    for (let i = 0; i < 9; i++) service.info('m' + i, { duration: 0 });
    fixture.detectChanges();
    expect(region(fixture).querySelectorAll('[id^="svz-toast-"]').length).toBe(9);
  });
});

describe('SvToastHostComponent — pause covers what arrives while paused (OF-19-I3 / OF-19-M3)', () => {
  afterEach(() => vi.useRealTimers());

  it('★ a toast raised while the pointer rests on the stack does not expire under it', async () => {
    const { service, fixture } = await setup();
    vi.useFakeTimers();
    const first = service.info('Anchor', { duration: 0 });
    fixture.detectChanges();
    node(first).dispatchEvent(new MouseEvent('mouseenter'));

    service.success('Arrived while hovered', { duration: 1_000 });
    fixture.detectChanges();
    vi.advanceTimersByTime(30_000);
    expect(service.toasts().map((t) => t.message)).toContain('Arrived while hovered');

    // Leaving resumes it with the time it had — it then goes.
    region(fixture).dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(1_000);
    expect(service.toasts().map((t) => t.message)).not.toContain('Arrived while hovered');
  });

  it('★ a deduplicated repeat of a hovered toast stays paused (the service restarts its timer)', async () => {
    const { service, fixture } = await setup();
    vi.useFakeTimers();
    const id = service.error('Sync failed', { duration: 2_000 });
    fixture.detectChanges();
    node(id).dispatchEvent(new MouseEvent('mouseenter'));

    service.error('Sync failed', { duration: 2_000 });
    fixture.detectChanges();
    vi.advanceTimersByTime(60_000);
    expect(service.toasts()).toHaveLength(1);
    expect(service.toasts()[0].count).toBe(2);
  });

  it('★ dismissing the focused toast does not leave the stack paused for good', async () => {
    const { service, fixture } = await setup();
    vi.useFakeTimers();
    const id = service.info('Focus me', { duration: 0 });
    fixture.detectChanges();
    const dismiss = node(id).querySelector<HTMLButtonElement>('button[aria-label="Dismiss notification"]')!;
    dismiss.focus();
    dismiss.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(fixture.componentInstance.paused()).toBe(true);

    dismiss.click();                     // removes the focused node; no focusout
    fixture.detectChanges();
    expect(fixture.componentInstance.paused()).toBe(false);

    service.success('Later', { duration: 1_000 });
    fixture.detectChanges();
    vi.advanceTimersByTime(1_000);
    expect(service.toasts()).toHaveLength(0);
  });

  it('container mouseleave clears a hover the removed toast never reported', async () => {
    const { service, fixture } = await setup();
    const id = service.info('Hover then dismiss', { duration: 0 });
    fixture.detectChanges();
    node(id).dispatchEvent(new MouseEvent('mouseenter'));
    node(id).querySelector<HTMLButtonElement>('button[aria-label="Dismiss notification"]')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.paused()).toBe(true);   // no mouseleave from a detached node

    region(fixture).dispatchEvent(new MouseEvent('mouseleave'));
    expect(fixture.componentInstance.paused()).toBe(false);
  });
});

describe('SvToastHostComponent — keyed replacement is announced (OF-19-M1)', () => {
  it('★ "Saving…" → "Saved" on one dedupeKey is read out; an identical repeat is not', async () => {
    const { service, fixture } = await setup();
    const announcer = TestBed.inject(SvLiveAnnouncer);
    const spy = vi.spyOn(announcer, 'announce');

    const a = service.info('Saving…', { duration: 0, dedupeKey: 'record-7' });
    fixture.detectChanges();
    const b = service.success('Saved', { duration: 0, dedupeKey: 'record-7' });
    fixture.detectChanges();
    service.success('Saved', { duration: 0, dedupeKey: 'record-7' });
    fixture.detectChanges();

    expect(a).toBe(b);
    expect(spy.mock.calls.map((c) => c[0])).toEqual(['Saving…', 'Saved']);
    expect(messages(fixture)[0]).toContain('Saved');
    spy.mockRestore();
    announcer.reset();
  });
});

describe('SvToastHostComponent — route scope on the rendered stack (OF-19-I5)', () => {
  it('navigated() removes the route toast node and keeps the global one', async () => {
    const { service, fixture } = await setup();
    const keep = service.success('Saved', { duration: 0 });
    const drop = service.info('This view is filtered', { duration: 0, scope: 'route' });
    fixture.detectChanges();
    expect(document.getElementById(drop)).not.toBeNull();

    service.navigated();
    fixture.detectChanges();
    expect(document.getElementById(drop)).toBeNull();
    expect(document.getElementById(keep)).not.toBeNull();
  });
});
