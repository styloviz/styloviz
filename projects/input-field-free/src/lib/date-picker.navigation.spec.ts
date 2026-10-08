import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvDatePickerComponent } from './date-picker.component';

/**
 * Moving around the calendar without picking anything: the three view modes,
 * the prev/next control that means a different thing in each of them, and the
 * four "is this reachable" predicates that grey cells out.
 *
 * Every one of those predicates has a `min` arm and a `max` arm, and only the
 * `min` arm had ever run.
 */

async function setup(inputs: Partial<ComponentInput<SvDatePickerComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvDatePickerComponent, {
    inputs: inputs as ComponentInput<SvDatePickerComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const trigger = (f: { nativeElement: unknown }) =>
  el(f).querySelector<HTMLButtonElement>('.sv-dp-trigger')!;
const panel = () => document.querySelector<HTMLElement>('.sv-dp-portal');
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

type Fixture = { nativeElement: unknown; detectChanges(): void };

async function open(f: Fixture) {
  await userEvent.click(trigger(f));
  f.detectChanges();
  await tick();
}

/** Buttons in the panel whose trimmed text matches exactly. */
const panelButton = (text: string) =>
  [...panel()!.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;

const MID = '2024-03-15';

describe('SvDatePickerComponent — cycling the view mode', () => {
  it('walks days → months → years → days from the header button', async () => {
    const { fixture } = await setup({ value: MID });
    await open(fixture);
    const c = fixture.componentInstance;

    expect(c.viewMode()).toBe('days');
    expect(c.headerLabel()).toBe('March 2024');

    await userEvent.click(panelButton('March 2024'));
    fixture.detectChanges();
    expect(c.viewMode()).toBe('months');
    expect(c.headerLabel()).toBe('2024');

    await userEvent.click(panelButton('2024'));
    fixture.detectChanges();
    expect(c.viewMode()).toBe('years');
    // The decade grid is 20 wide, starting five years before the decade.
    expect(c.yearRange()[0]).toBe(2015);
    expect(c.yearRange().at(-1)).toBe(2034);
    expect(c.headerLabel()).toBe('2015 – 2034');

    await userEvent.click(panelButton('2015 – 2034'));
    fixture.detectChanges();
    expect(c.viewMode()).toBe('days');
  });

  it('renders twelve months and twenty years in their own views', async () => {
    const { fixture } = await setup({ value: MID });
    await open(fixture);

    fixture.componentInstance.viewMode.set('months');
    fixture.detectChanges();
    expect(panel()!.querySelectorAll('.sv-dp-body button').length).toBe(12);

    fixture.componentInstance.viewMode.set('years');
    fixture.detectChanges();
    expect(panel()!.querySelectorAll('.sv-dp-body button').length).toBe(20);
  });

  it('drills years → months → days, keeping what was picked on the way', async () => {
    const { fixture } = await setup({ value: MID });
    await open(fixture);
    const c = fixture.componentInstance;

    c.selectYear(2026);
    expect([c.viewYear(), c.viewMode()]).toEqual([2026, 'months']);

    c.selectMonth(8);
    expect([c.viewYear(), c.viewMonth(), c.viewMode()]).toEqual([2026, 8, 'days']);
    fixture.detectChanges();
    expect(c.headerLabel()).toBe('September 2026');
  });

  it('goes back to the day view when the panel closes, not on the mode it was left in', async () => {
    const { fixture } = await setup({ value: MID });
    await open(fixture);
    fixture.componentInstance.viewMode.set('years');
    fixture.componentInstance.close();
    expect(fixture.componentInstance.viewMode()).toBe('days');
  });
});

describe('SvDatePickerComponent — prev / next mean three different things', () => {
  it('steps one month in the day view, wrapping the year at both ends', async () => {
    const { fixture } = await setup({ value: '2024-01-15' });
    await open(fixture);
    const c = fixture.componentInstance;

    c.prevPeriod();
    expect([c.viewYear(), c.viewMonth()]).toEqual([2023, 11]); // Jan → Dec of last year

    c.nextPeriod();
    expect([c.viewYear(), c.viewMonth()]).toEqual([2024, 0]);

    c.viewMonth.set(11);
    c.nextPeriod();
    expect([c.viewYear(), c.viewMonth()]).toEqual([2025, 0]); // Dec → Jan of next year
  });

  it('steps one year in the month view', async () => {
    const { fixture } = await setup({ value: MID });
    await open(fixture);
    const c = fixture.componentInstance;
    c.viewMode.set('months');

    c.prevPeriod();
    expect(c.viewYear()).toBe(2023);
    c.nextPeriod();
    c.nextPeriod();
    expect(c.viewYear()).toBe(2025);
    // The month stays put — only the year moved.
    expect(c.viewMonth()).toBe(2);
  });

  it('steps a whole decade block in the year view', async () => {
    const { fixture } = await setup({ value: MID });
    await open(fixture);
    const c = fixture.componentInstance;
    c.viewMode.set('years');

    c.prevPeriod();
    expect(c.viewYear()).toBe(2004);
    c.nextPeriod();
    c.nextPeriod();
    expect(c.viewYear()).toBe(2044);
  });

  it('moves the calendar from the header arrows, not only from the API', async () => {
    const { fixture } = await setup({ value: MID });
    await open(fixture);

    await userEvent.click(panel()!.querySelector<HTMLButtonElement>('[aria-label="Previous"]')!);
    fixture.detectChanges();
    expect(fixture.componentInstance.headerLabel()).toBe('February 2024');

    await userEvent.click(panel()!.querySelector<HTMLButtonElement>('[aria-label="Next"]')!);
    fixture.detectChanges();
    expect(fixture.componentInstance.headerLabel()).toBe('March 2024');
  });
});

describe('SvDatePickerComponent — which months are reachable', () => {
  it('greys a month out only when the whole month is before min', async () => {
    // `min` falls mid-March, so March itself is still partly reachable and must
    // stay enabled — the boundary case a naive "first of month < min" gets wrong.
    const { fixture } = await setup({ value: MID, minDate: MID });
    await open(fixture);
    const c = fixture.componentInstance;

    expect(c.isMonthDisabled(1)).toBe(true);  // all of February is before min
    expect(c.isMonthDisabled(2)).toBe(false); // March contains min
    expect(c.isMonthDisabled(3)).toBe(false);
  });

  it('greys a month out only when the whole month is after max', async () => {
    const { fixture } = await setup({ value: MID, maxDate: MID });
    await open(fixture);
    const c = fixture.componentInstance;

    expect(c.isMonthDisabled(2)).toBe(false); // March contains max
    expect(c.isMonthDisabled(3)).toBe(true);  // all of April is after max
  });

  it('leaves every month reachable with no window at all', async () => {
    const { fixture } = await setup({ value: MID });
    await open(fixture);
    const c = fixture.componentInstance;
    expect([...Array(12).keys()].some((i) => c.isMonthDisabled(i))).toBe(false);
  });

  it('actually disables the month buttons it says are unreachable', async () => {
    const { fixture } = await setup({ value: MID, minDate: MID, maxDate: MID });
    await open(fixture);
    fixture.componentInstance.viewMode.set('months');
    fixture.detectChanges();

    const buttons = [...panel()!.querySelectorAll<HTMLButtonElement>('.sv-dp-body button')];
    expect(buttons.filter((b) => !b.disabled).map((b) => b.textContent?.trim())).toEqual(['Mar']);
  });

  it('marks the month holding the selected date as selected', async () => {
    const { fixture } = await setup({ value: MID });
    await open(fixture);
    const c = fixture.componentInstance;
    expect(c.isViewMonthSelected(2)).toBe(true);
    expect(c.isViewMonthSelected(3)).toBe(false);

    // A different year on show — the same month index is no longer the selection.
    c.viewYear.set(2025);
    expect(c.isViewMonthSelected(2)).toBe(false);
  });

  it('marks no month when nothing is selected', async () => {
    const { fixture } = await setup({});
    await open(fixture);
    const c = fixture.componentInstance;
    expect([...Array(12).keys()].some((i) => c.isViewMonthSelected(i))).toBe(false);
  });
});

describe('SvDatePickerComponent — which years are reachable', () => {
  it('greys a year out only when the whole year is outside the window', async () => {
    const { fixture } = await setup({ value: MID, minDate: MID, maxDate: '2025-06-01' });
    await open(fixture);
    const c = fixture.componentInstance;

    expect(c.isYearDisabled(2023)).toBe(true);  // ends before min
    expect(c.isYearDisabled(2024)).toBe(false); // straddles min
    expect(c.isYearDisabled(2025)).toBe(false); // straddles max
    expect(c.isYearDisabled(2026)).toBe(true);  // starts after max
  });

  it('leaves every year reachable with no window', async () => {
    const { fixture } = await setup({ value: MID });
    await open(fixture);
    const c = fixture.componentInstance;
    expect(c.yearRange().some((y) => c.isYearDisabled(y))).toBe(false);
  });

  it('marks the year holding the selected date, and none when empty', async () => {
    const withValue = await setup({ value: MID });
    await open(withValue.fixture);
    expect(withValue.fixture.componentInstance.isViewYearSelected(2024)).toBe(true);
    expect(withValue.fixture.componentInstance.isViewYearSelected(2025)).toBe(false);

    const empty = await setup({});
    await open(empty.fixture);
    const c = empty.fixture.componentInstance;
    expect(c.yearRange().some((y) => c.isViewYearSelected(y))).toBe(false);
  });
});

describe('SvDatePickerComponent — where it differs from the Pro twin', () => {
  /**
   * ★ DIVERGENCE, pinned deliberately. The Pro day buttons also carry
   * `aria-pressed`; these carry only the cell's `aria-selected`. Both are
   * announced, so nothing is lost — but the pair must not drift silently.
   */
  it('marks the chosen day on the cell only, with no aria-pressed on the button', async () => {
    const { fixture } = await setup({ value: MID });
    await open(fixture);

    const chosen = panel()!.querySelector<HTMLButtonElement>(`[data-day="${MID}"]`)!;
    expect(chosen.hasAttribute('aria-pressed')).toBe(false);
    expect(chosen.closest('[role="gridcell"]')?.getAttribute('aria-selected')).toBe('true');
  });
});

describe('SvDatePickerComponent — the trigger', () => {
  it('names itself with the field name and the current selection', async () => {
    const chosen = await setup({ label: 'Start date', value: MID });
    expect(trigger(chosen.fixture).getAttribute('aria-label')).toBe('Start date: Mar 15, 2024');

    const empty = await setup({ label: 'Start date', placeholder: 'Pick a day' });
    expect(trigger(empty.fixture).getAttribute('aria-label')).toBe('Start date: Pick a day');
  });

  it('prefers an explicit ariaLabel over the visible label', async () => {
    const { fixture } = await setup({ label: 'Start', ariaLabel: 'Booking start', value: MID });
    expect(trigger(fixture).getAttribute('aria-label')).toBe('Booking start: Mar 15, 2024');
  });

  it('has no computed name at all when there is nothing to name it with', async () => {
    const { fixture } = await setup({ value: MID });
    expect(fixture.componentInstance.triggerAriaLabel()).toBeNull();
    expect(trigger(fixture).getAttribute('aria-label')).toBeNull();
  });

  it('shows the placeholder until there is a value, and the asterisk only when required', async () => {
    const empty = await setup({ placeholder: 'Choose', label: 'When', required: true });
    expect(el(empty.fixture).textContent).toContain('Choose');
    expect(el(empty.fixture).querySelector('.text-danger-500')?.textContent).toBe('*');
    expect(empty.fixture.componentInstance.displayValue()).toBe('');

    const filled = await setup({ value: MID, label: 'When' });
    expect(el(filled.fixture).textContent).toContain('Mar 15, 2024');
    expect(el(filled.fixture).querySelector('.text-danger-500')).toBeNull();
  });

  it('offers no clear button without a value, or while disabled', async () => {
    const clear = (f: { nativeElement: unknown }) =>
      el(f).querySelector('[aria-label="Clear date"]');

    expect(clear((await setup({})).fixture)).toBeNull();
    expect(clear((await setup({ value: MID, disabled: true })).fixture)).toBeNull();
    expect(clear((await setup({ value: MID })).fixture)).not.toBeNull();
  });

  it('will not open while disabled, and emits nothing', async () => {
    const { fixture } = await setup({ disabled: true, value: MID });
    const seen: string[] = [];
    fixture.componentInstance.opened.subscribe(() => seen.push('opened'));

    fixture.componentInstance.toggle();
    fixture.detectChanges();
    expect(panel()).toBeNull();
    expect(seen).toEqual([]);
  });

  it('closes on a second click of the trigger', async () => {
    const { fixture } = await setup({ value: MID });
    const seen: string[] = [];
    fixture.componentInstance.opened.subscribe(() => seen.push('opened'));
    fixture.componentInstance.closed.subscribe(() => seen.push('closed'));

    await open(fixture);
    expect(panel()).not.toBeNull();
    await userEvent.click(trigger(fixture));
    fixture.detectChanges();

    expect(panel()).toBeNull();
    expect(seen).toEqual(['opened', 'closed']);
  });

  it('ignores close() and Escape when nothing is open', async () => {
    const { fixture } = await setup({ value: MID });
    const seen: string[] = [];
    fixture.componentInstance.closed.subscribe(() => seen.push('closed'));

    fixture.componentInstance.close();
    fixture.componentInstance.onEscape();
    expect(seen).toEqual([]);
  });

  it('stays open for a click inside the portal panel', async () => {
    // The panel lives in <body>, so the host `contains()` check can never see
    // it — the portal check is the only thing keeping the calendar open while
    // the user clicks the month header.
    const { fixture } = await setup({ value: MID });
    await open(fixture);

    await userEvent.click(panel()!.querySelector<HTMLElement>('.sv-dp-header')!);
    fixture.detectChanges();
    expect(panel()).not.toBeNull();
  });
});
