import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen } from '@testing-library/angular';
import { SvRatingComponent, type SvRatingChange } from './rating.component';

/**
 * `X-6` — the pending / revert / error contract, on a rating.
 *
 * A rating on a product page or a ticket is saved the moment it is clicked.
 * `X-6` named it beside the toggle switch; only the switch and inplace edit had
 * adopted the contract, so a failed save left the stars showing a score the
 * server never recorded.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvRatingComponent, { inputs: { label: 'Your rating', ...inputs } });
  return fixture;
}

const slider = () => screen.getByRole('slider');
const star = (host: HTMLElement, i: number) =>
  host.querySelectorAll<HTMLElement>('[role="slider"] > span')[i - 1];

describe('SvRatingComponent — the write, and the way back', () => {
  it('emits a write alongside the plain change, in that order, with the previous value', async () => {
    const order: string[] = [];
    let seen: SvRatingChange | null = null;
    const f = await setup({ value: 2 });
    f.componentInstance.changed.subscribe(() => order.push('changed'));
    f.componentInstance.changeRequest.subscribe((e: SvRatingChange) => {
      order.push('request');
      seen = e;
      expect(f.componentInstance.value()).toBe(4);
    });

    fireEvent.click(star(f.nativeElement, 4));

    expect(order).toEqual(['changed', 'request']);
    expect(seen!.value).toBe(4);
    expect(seen!.previous).toBe(2);
    expect(seen!.requestKey).toBeTruthy();
  });

  it('writes from the keyboard path too', async () => {
    const seen: SvRatingChange[] = [];
    const f = await setup({ value: 3 });
    f.componentInstance.changeRequest.subscribe((e: SvRatingChange) => seen.push(e));

    fireEvent.keyDown(slider(), { key: 'ArrowRight' });

    expect(seen.map((e) => [e.previous, e.value])).toEqual([[3, 4]]);
  });

  it('puts the value back — in the DOM and the form model — when the write fails', async () => {
    let latest: SvRatingChange | null = null;
    const written: number[] = [];
    const f = await setup({ value: 2 });
    f.componentInstance.registerOnChange((v) => written.push(v));
    f.componentInstance.changeRequest.subscribe((e: SvRatingChange) => (latest = e));

    fireEvent.click(star(f.nativeElement, 5));
    f.detectChanges();
    expect(slider().getAttribute('aria-valuenow')).toBe('5');

    latest!.rollback();
    f.detectChanges();

    expect(slider().getAttribute('aria-valuenow')).toBe('2');
    expect(written).toEqual([5, 2]);
  });

  it('refuses a stale rollback rather than discarding a newer choice', async () => {
    const handles: SvRatingChange[] = [];
    const f = await setup({ value: 1 });
    f.componentInstance.changeRequest.subscribe((e: SvRatingChange) => handles.push(e));

    fireEvent.click(star(f.nativeElement, 3));
    fireEvent.click(star(f.nativeElement, 5));
    handles[0].rollback();
    f.detectChanges();

    expect(f.componentInstance.value()).toBe(5);
  });
});

describe('SvRatingComponent — pending', () => {
  it('holds the value while the write is out, and stays focusable', async () => {
    const seen: SvRatingChange[] = [];
    const f = await setup({ value: 3, pending: true });
    f.componentInstance.changeRequest.subscribe((e: SvRatingChange) => seen.push(e));

    fireEvent.click(star(f.nativeElement, 5));
    fireEvent.keyDown(slider(), { key: 'ArrowRight' });

    expect(seen).toHaveLength(0);
    expect(f.componentInstance.value()).toBe(3);
    expect(slider().getAttribute('tabindex')).toBe('0');
    expect(slider().getAttribute('aria-busy')).toBe('true');
    expect(slider().getAttribute('aria-disabled')).toBeNull();
  });

  it('says nothing about being busy when it is not', async () => {
    await setup({ value: 3 });
    expect(slider().getAttribute('aria-busy')).toBeNull();
  });
});

describe('SvRatingComponent — a failed write', () => {
  it('renders the failure as an alert and describes the slider by it', async () => {
    await setup({ value: 3, error: 'Your rating was not saved.' });
    const alert = screen.getByRole('alert');
    expect(alert.textContent?.trim()).toBe('Your rating was not saved.');
    expect(slider().getAttribute('aria-describedby')?.split(' ')).toContain(alert.id);
  });

  it('accepts an SvDataError', async () => {
    await setup({ value: 3, error: { message: 'Service unavailable.', status: 503 } });
    expect(screen.getByRole('alert').textContent?.trim()).toBe('Service unavailable.');
  });

  it('renders no alert and no description when nothing failed', async () => {
    await setup({ value: 3 });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(slider().getAttribute('aria-describedby')).toBeNull();
  });
});
