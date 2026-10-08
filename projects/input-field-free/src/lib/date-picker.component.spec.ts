import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { render, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvDatePickerComponent } from './date-picker.component';

/**
 * The free twin of `sv-date-picker-pro`, and the one most installs get.
 *
 * Two things are tested here that are not tested there. The first is the
 * `ControlValueAccessor`: this component can be driven by a `FormControl`
 * instead of `[(value)]`, and a CVA that forgets to report `touched` — or that
 * ignores `setDisabledState` — fails in a way the two-way binding never shows.
 *
 * The second is the calendar's grid semantics, which this component has and the
 * Pro one did not. That asymmetry is the wrong way round for a paid upgrade,
 * so it is pinned on both sides now.
 *
 * The rest is the seven defects the Pro spec turned up, every one of which was
 * in this file too, verbatim.
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
const day = (key: string) => panel()!.querySelector<HTMLButtonElement>(`[data-day="${key}"]`)!;
const footerButton = (text: string) =>
  [...panel()!.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;

type Fixture = { nativeElement: unknown; detectChanges(): void };

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

async function open(f: Fixture) {
  await userEvent.click(trigger(f));
  f.detectChanges();
  await tick();
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const shift = (from: string, deltaDays: number) => {
  const d = new Date(from + 'T00:00:00');
  d.setDate(d.getDate() + deltaDays);
  return iso(d);
};

const todayStr = () => iso(new Date());

/** Friday. Home is the 11th, End is the 17th. */
const MID = '2024-03-15';

describe('SvDatePickerComponent — as a form control', () => {
  @Component({
    standalone: true,
    imports: [SvDatePickerComponent, ReactiveFormsModule],
    template: `<sv-date-picker [formControl]="control" [minDate]="min()" />`,
  })
  class Host {
    readonly control = new FormControl('2024-03-15');
    readonly min = signal('');
  }

  async function hosted() {
    TestBed.resetTestingModule();
    return render(Host);
  }

  it('renders the value the FormControl already holds', async () => {
    const { fixture } = await hosted();
    expect(el(fixture).textContent).toContain('Mar 15, 2024');
  });

  it('writes a later value from the form into the trigger', async () => {
    const { fixture } = await hosted();
    fixture.componentInstance.control.setValue('2024-12-25');
    fixture.detectChanges();
    expect(el(fixture).textContent).toContain('Dec 25, 2024');
  });

  it('survives a form that resets to null', async () => {
    // `writeValue(null)` is what `reset()` sends, and the component stores a
    // string — coercing it is the difference between an empty field and
    // "Invalid Date" in the trigger.
    const { fixture } = await hosted();
    fixture.componentInstance.control.reset();
    fixture.detectChanges();
    expect(el(fixture).textContent).toContain('Select date');
  });

  it('reports a user choice back to the form', async () => {
    const { fixture } = await hosted();
    await open(fixture);
    await userEvent.click(day('2024-03-20'));
    fixture.detectChanges();
    expect(fixture.componentInstance.control.value).toBe('2024-03-20');
  });

  it('marks the control touched when the panel closes', async () => {
    const { fixture } = await hosted();
    expect(fixture.componentInstance.control.touched).toBe(false);

    await open(fixture);
    await userEvent.click(day('2024-03-20'));
    fixture.detectChanges();
    expect(fixture.componentInstance.control.touched).toBe(true);
  });

  it('obeys a disabled FormControl, not just the disabled input', async () => {
    const { fixture } = await hosted();
    fixture.componentInstance.control.disable();
    fixture.detectChanges();

    expect(trigger(fixture).disabled).toBe(true);
    await userEvent.click(trigger(fixture));
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it('shuts an open panel when the form disables it underneath', async () => {
    const { fixture } = await hosted();
    await open(fixture);
    expect(panel()).not.toBeNull();

    fixture.componentInstance.control.disable();
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });
});

describe('SvDatePickerComponent — the calendar is a grid', () => {
  it('exposes rows, cells and column headers, named by the month on show', async () => {
    // A bare list of 42 buttons is navigable but not orientable: nothing tells
    // an AT which column a day is in, so "is the 15th a Friday" stops being
    // answerable without counting.
    const { fixture } = await setup({ value: MID });
    await open(fixture);

    const grid = panel()!.querySelector('[role="grid"]')!;
    expect(grid.getAttribute('aria-label')).toBe('March 2024');
    expect(grid.querySelectorAll('[role="columnheader"]').length).toBe(7);
    expect(grid.querySelectorAll('[role="rowgroup"] [role="row"]').length).toBe(6);
    expect(grid.querySelectorAll('[role="gridcell"]').length).toBe(42);
  });

  it('marks the selected cell as selected', async () => {
    const { fixture } = await setup({ value: MID });
    await open(fixture);
    const selected = [...panel()!.querySelectorAll('[role="gridcell"][aria-selected="true"]')];
    expect(selected.length).toBe(1);
    expect(selected[0].querySelector('[data-day]')?.getAttribute('data-day')).toBe(MID);
  });

  it('splits the 42 days into six weeks of seven', async () => {
    const { fixture } = await setup({ value: MID });
    await open(fixture); // the view only syncs to the bound value on open
    const weeks = fixture.componentInstance.calendarWeeks();
    expect(weeks.length).toBe(6);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0][0].key).toBe('2024-02-26'); // the Monday the grid opens on
  });
});

describe('SvDatePickerComponent — naming the trigger', () => {
  it('does not point at a label it never rendered', async () => {
    const { fixture } = await setup({ value: MID });
    expect(trigger(fixture).getAttribute('aria-labelledby')).toBeNull();
  });

  it('is named by the computed label, not by the visible label span', async () => {
    // ★ `aria-labelledby` OUTRANKS `aria-label`, so pointing at the span
    // discarded the computed name — and the computed one is strictly better: it
    // carries the field name AND the current value where the span carries only
    // the field name. This used to assert the opposite; the assertion was
    // pinning the bug. Gated by `aria-label-outranked`.
    const { fixture } = await setup({ label: 'Start date' });
    expect(trigger(fixture).getAttribute('aria-labelledby')).toBeNull();
    expect(trigger(fixture).getAttribute('aria-label')).toContain('Start date');
  });

  it('gives two pickers on one page different ids', async () => {
    // Both pickers must share one application: ids are per application (svUniqueId).
    const a = await setup({ label: 'From' });
    const b = TestBed.createComponent(SvDatePickerComponent);
    b.componentRef.setInput('label', 'To');
    b.detectChanges();
    await b.whenStable();
    // The trigger is named by `aria-label`, so uniqueness is asserted on the
    // label span's own id — which is what the per-instance uid exists for.
    const idOf = (f: { nativeElement: unknown }) =>
      (f.nativeElement as HTMLElement).querySelector('[id$="-label"]')?.id;
    expect(idOf(a.fixture)).toBeTruthy();
    expect(idOf(b)).toBeTruthy();
    expect(idOf(a.fixture)).not.toBe(idOf(b));
  });
});

describe('SvDatePickerComponent — the portal', () => {
  it('mounts the calendar outside its own element', async () => {
    const { fixture } = await setup({ value: MID });
    await open(fixture);
    expect(el(fixture).contains(panel())).toBe(false);
  });

  it('closes on Escape pressed inside the panel, and hands focus back', async () => {
    const { fixture } = await setup({ value: MID });
    await open(fixture);

    day(MID).focus();
    await userEvent.keyboard('{Escape}');
    fixture.detectChanges();

    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger(fixture));
  });

  it('closes on a click outside and leaves nothing behind', async () => {
    const { fixture } = await setup({ value: MID });
    await open(fixture);

    await userEvent.click(document.body);
    fixture.detectChanges();
    expect(document.querySelectorAll('.sv-dp-portal').length).toBe(0);
  });
});

describe('SvDatePickerComponent — the window', () => {
  it('will not let Today put an unreachable date in the field', async () => {
    const { fixture } = await setup({ minDate: shift(todayStr(), 1) });
    await open(fixture);

    expect(footerButton('Today').disabled).toBe(true);
    fixture.componentInstance.goToToday();
    expect(fixture.componentInstance.value()).toBe('');
  });

  it('does not walk focus off the edge of the window', async () => {
    const { fixture } = await setup({ value: MID, minDate: MID });
    await open(fixture);

    await userEvent.keyboard('{ArrowLeft}');
    fixture.detectChanges();
    await tick();

    expect(fixture.componentInstance.activeKey()).toBe(MID);
    expect(document.activeElement).toBe(day(MID));
  });

  it('opens on a reachable day when the value is empty and today is out of range', async () => {
    const { fixture } = await setup({ minDate: shift(todayStr(), 7) });
    await open(fixture);

    expect(day(fixture.componentInstance.activeKey()).disabled).toBe(false);
    expect(document.activeElement).toBe(day(fixture.componentInstance.activeKey()));
  });

  it('refuses a day outside the window', async () => {
    const { fixture } = await setup({ value: MID, minDate: '2024-03-10' });
    await open(fixture);
    expect(day('2024-03-09').disabled).toBe(true);

    await userEvent.click(day('2024-03-09'));
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe(MID);
  });
});

describe('SvDatePickerComponent — clearing', () => {
  it('does not drop focus when the inline clear button removes itself', async () => {
    const { fixture } = await setup({ value: MID });
    const clear = el(fixture).querySelector<HTMLButtonElement>('[aria-label="Clear date"]')!;
    clear.focus();

    await userEvent.click(clear);
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBe('');
    expect(document.activeElement).toBe(trigger(fixture));
  });

  it('clears from inside the panel too', async () => {
    const { fixture } = await setup({ value: MID });
    await open(fixture);

    await userEvent.click(footerButton('Clear'));
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('');
    expect(panel()).toBeNull();
  });
});

describe('SvDatePickerComponent — the error contract', () => {
  it('points at a message that is actually on the page', async () => {
    const { fixture } = await setup({ value: MID, errorMessage: 'Pick a weekday' });
    const id = trigger(fixture).getAttribute('aria-describedby')!;
    expect(trigger(fixture).getAttribute('aria-invalid')).toBe('true');
    expect(el(fixture).querySelector(`#${id}`)?.textContent).toContain('Pick a weekday');
  });

  it('drops the server rejection once the value it was about is gone', async () => {
    const { fixture } = await setup({ value: MID, serverError: 'That day is fully booked' });
    expect(el(fixture).textContent).toContain('That day is fully booked');

    fixture.componentInstance.value.set('2024-03-16');
    fixture.detectChanges();
    expect(el(fixture).textContent).not.toContain('That day is fully booked');
  });
});
