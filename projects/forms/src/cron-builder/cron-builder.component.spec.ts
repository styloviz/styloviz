import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { render } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvCronBuilderComponent } from './cron-builder.component';
import type { SvCronError } from './cron';

async function mount(inputs: Record<string, unknown> = {}, providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const result = await render(SvCronBuilderComponent, {
    inputs: { locale: 'en-GB', timeZone: 'UTC', ...inputs } as never,
    providers: providers as never[],
  });
  result.fixture.detectChanges();
  await result.fixture.whenStable();
  return result.fixture;
}

type Fixture = Awaited<ReturnType<typeof mount>>;

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const segment = (f: Fixture, mode: string) => el(f).querySelector<HTMLButtonElement>(`[data-seg="${mode}"]`)!;
const checkedMode = (f: Fixture) => el(f).querySelector('[data-seg][aria-checked="true"]')?.getAttribute('data-seg') ?? null;
const description = (f: Fixture) => el(f).querySelector('[data-sv-cron-description]')?.textContent?.trim() ?? '';
const expressionInput = (f: Fixture) => el(f).querySelector<HTMLInputElement>('[data-sv-cron-expression]');
const alertText = (f: Fixture) => el(f).querySelector('[role="alert"]')?.textContent?.trim() ?? '';
const boxes = (f: Fixture, group: 'weekdays' | 'month-days') =>
  [...el(f).querySelectorAll<HTMLInputElement>(`[data-sv-cron-${group}] input[type="checkbox"]`)];

async function settle(f: { detectChanges(): void; whenStable(): Promise<unknown> }): Promise<void> {
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
}

/** Every value the builder writes, in order. */
function emitted(f: Fixture): string[] {
  const out: string[] = [];
  f.componentInstance.value.subscribe((v) => out.push(v));
  return out;
}

async function type(f: Fixture, text: string): Promise<void> {
  const input = expressionInput(f)!;
  input.value = text;
  input.dispatchEvent(new Event('input'));
  await settle(f);
}

async function pickSelect(f: Fixture, selector: string, value: string): Promise<void> {
  const select = el(f).querySelector<HTMLSelectElement>(selector)!;
  select.value = value;
  select.dispatchEvent(new Event('change'));
  await settle(f);
}

describe('SvCronBuilderComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('modes', () => {
    it('starts with no mode, a hint, no preview and no value written', async () => {
      const f = await mount();
      const out = emitted(f);
      expect(checkedMode(f)).toBeNull();
      expect(el(f).querySelector('[data-sv-cron-empty]')?.textContent?.trim()).toBe('Choose how often it runs.');
      expect(el(f).querySelector('[data-sv-cron-preview]')).toBeNull();
      expect(out).toEqual([]);
    });

    it('offers the six modes on a radiogroup segmented control named "Frequency"', async () => {
      const f = await mount();
      const group = el(f).querySelector('[role="radiogroup"]');
      expect(group?.getAttribute('aria-label')).toBe('Frequency');
      expect([...el(f).querySelectorAll('[data-seg]')].map((b) => b.getAttribute('data-seg'))).toEqual([
        'minutes', 'hourly', 'daily', 'weekly', 'monthly', 'custom',
      ]);
    });

    it('picking Daily writes "0 9 * * *" and describes it', async () => {
      const f = await mount();
      const out = emitted(f);
      segment(f, 'daily').click();
      await settle(f);
      expect(out).toEqual(['0 9 * * *']);
      expect(checkedMode(f)).toBe('daily');
      expect(description(f)).toBe('Every day at 09:00');
    });

    it('changing the hour writes the new time', async () => {
      const f = await mount({ value: '0 9 * * *' });
      const out = emitted(f);
      await pickSelect(f, '[data-sv-cron-hour]', '17');
      await pickSelect(f, '[data-sv-cron-minute]', '45');
      expect(out).toEqual(['0 17 * * *', '45 17 * * *']);
    });

    it('opens a weekday expression in Weekly with those days ticked', async () => {
      const f = await mount({ value: '0 9 * * MON-FRI' });
      expect(checkedMode(f)).toBe('weekly');
      // en-GB weeks start on Monday.
      expect(boxes(f, 'weekdays').map((b) => b.checked)).toEqual([true, true, true, true, true, false, false]);
      expect(description(f)).toBe('Every weekday at 09:00');
    });

    it('opens a day-of-month expression in Monthly', async () => {
      const f = await mount({ value: '30 6 1,15 * *' });
      expect(checkedMode(f)).toBe('monthly');
      const checked = boxes(f, 'month-days').flatMap((b, i) => (b.checked ? [i + 1] : []));
      expect(checked).toEqual([1, 15]);
      expect(description(f)).toBe('On the 1st and 15th of every month at 06:30');
    });

    it('opens every-N-minutes and hourly expressions in their modes', async () => {
      let f = await mount({ value: '*/15 * * * *' });
      expect(checkedMode(f)).toBe('minutes');
      expect(description(f)).toBe('Every 15 minutes');
      f = await mount({ value: '15 * * * *' });
      expect(checkedMode(f)).toBe('hourly');
      expect(description(f)).toBe('At minute 15 past every hour');
    });

    it('switching mode keeps the time and picks the closest expression', async () => {
      const f = await mount({ value: '30 7 * * 1' });
      const out = emitted(f);
      segment(f, 'monthly').click();
      await settle(f);
      segment(f, 'hourly').click();
      await settle(f);
      segment(f, 'minutes').click();
      await settle(f);
      segment(f, 'weekly').click();
      await settle(f);
      expect(out).toEqual(['30 7 1 * *', '30 * * * *', '*/15 * * * *', '30 7 * * 1']);
    });

    it('opens an expression the visual modes cannot show in Custom, as written', async () => {
      const f = await mount({ value: '*/7 * * * *' });
      expect(checkedMode(f)).toBe('custom');
      expect(expressionInput(f)?.value).toBe('*/7 * * * *');
      expect(description(f)).toBe('At minutes 0, 7, 14, 21, 28, 35, 42, 49 and 56, past every hour');
    });

    it('leaving Custom keeps what it can of the expression', async () => {
      const f = await mount({ value: '0 9,17 * * 1-5' });
      const out = emitted(f);
      segment(f, 'weekly').click();
      await settle(f);
      expect(out).toEqual(['0 9 * * 1-5']);
    });

    it('Custom shows the current expression', async () => {
      const f = await mount({ value: '0 9 * * 1-5' });
      segment(f, 'custom').click();
      await settle(f);
      expect(expressionInput(f)?.value).toBe('0 9 * * 1-5');
    });
  });

  describe('validation', () => {
    it('an invalid expression shows a labelled error, sets aria-invalid and is not written', async () => {
      const f = await mount({ value: '*/7 * * * *' });
      const out = emitted(f);
      const errors: (SvCronError | null)[] = [];
      f.componentInstance.errorChange.subscribe((e) => errors.push(e));
      await type(f, '61 * * * *');
      const input = expressionInput(f)!;
      expect(out).toEqual([]);
      expect(f.componentInstance.value()).toBe('*/7 * * * *');
      expect(input.getAttribute('aria-invalid')).toBe('true');
      const alert = el(f).querySelector('[role="alert"]')!;
      expect(alert.textContent?.trim()).toBe('In the minute field, “61” is outside 0–59.');
      expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(alert.id);
      expect(errors).toEqual([{ code: 'range', field: 'minute', token: '61', min: 0, max: 59 }]);

      await type(f, '*/5 * * * *');
      expect(out).toEqual(['*/5 * * * *']);
      expect(input.hasAttribute('aria-invalid')).toBe(false);
      expect(errors[errors.length - 1]).toBeNull();
    });

    it('the hint is always described, the error only while there is one', async () => {
      const f = await mount({ value: '*/7 * * * *' });
      const input = expressionInput(f)!;
      const hintId = input.getAttribute('aria-describedby');
      expect(document.getElementById(hintId!)?.textContent?.trim()).toContain('Five fields');
      await type(f, '* * *');
      expect(input.getAttribute('aria-describedby')?.split(' ').length).toBe(2);
      expect(alertText(f)).toContain('Enter five fields');
    });

    it('writes the normalised expression while typing and shows it on blur', async () => {
      const f = await mount({ value: '*/7 * * * *' });
      const out = emitted(f);
      await type(f, '0 9 * * MON-FRI');
      expect(out).toEqual(['0 9 * * 1-5']);
      expressionInput(f)!.dispatchEvent(new Event('blur'));
      await settle(f);
      expect(expressionInput(f)?.value).toBe('0 9 * * 1-5');
      // Still in Custom: typing an expression a visual mode could show does not yank the field away.
      expect(checkedMode(f)).toBe('custom');
    });

    it('an empty Custom field complains only once it has been left', async () => {
      const f = await mount({ value: '*/7 * * * *' });
      await type(f, '');
      expect(alertText(f)).toBe('');
      expressionInput(f)!.dispatchEvent(new Event('blur'));
      await settle(f);
      expect(alertText(f)).toBe('Enter a cron expression.');
    });

    it('unticking the last weekday asks for a day and writes nothing', async () => {
      const f = await mount({ value: '0 9 * * 1' });
      const out = emitted(f);
      const monday = boxes(f, 'weekdays')[0];
      monday.click();
      await settle(f);
      expect(out).toEqual([]);
      expect(alertText(f)).toBe('Choose at least one day.');
      const group = el(f).querySelector('[data-sv-cron-weekdays]')!;
      expect(group.getAttribute('aria-describedby')).toBe(el(f).querySelector('[role="alert"]')!.id);
      boxes(f, 'weekdays')[2].click();
      await settle(f);
      expect(out).toEqual(['0 9 * * 3']);
      expect(alertText(f)).toBe('');
    });

    it('shows the host errorMessage when it has no error of its own', async () => {
      const f = await mount({ value: '0 9 * * *', errorMessage: 'Pick a time outside office hours.' });
      expect(alertText(f)).toBe('Pick a time outside office hours.');
    });
  });

  describe('preview', () => {
    it('lists the next runs in the time zone', async () => {
      const f = await mount({ value: '0 9 * * *', timeZone: 'UTC', nextRunCount: 3 });
      const times = [...el(f).querySelectorAll('[data-sv-cron-runs] time')];
      expect(times.length).toBe(3);
      for (const t of times) expect(t.getAttribute('datetime')).toMatch(/T09:00:00\.000Z$/);
      expect(el(f).querySelector('[data-sv-cron-preview]')?.textContent).toContain('Next runs (UTC)');
    });

    it('says so when a schedule never comes round', async () => {
      const f = await mount({ value: '0 0 30 2 *' });
      expect(el(f).querySelector('[data-sv-cron-no-runs]')?.textContent?.trim()).toBe('No upcoming runs found.');
    });

    it('hides the run list with nextRunCount 0 and the whole preview with showPreview false', async () => {
      let f = await mount({ value: '0 9 * * *', nextRunCount: 0 });
      expect(el(f).querySelector('[data-sv-cron-runs]')).toBeNull();
      expect(description(f)).toBe('Every day at 09:00');
      f = await mount({ value: '0 9 * * *', showPreview: false });
      expect(el(f).querySelector('[data-sv-cron-preview]')).toBeNull();
    });

    it('takes its text from the labels registry', async () => {
      const f = await mount({ value: '0 9 * * *' }, [
        provideSvLabels({ forms: { cronLegend: 'Zeitplan', cronDescDaily: 'Jeden Tag um {time}' } }),
      ]);
      expect(el(f).querySelector('legend')?.textContent?.trim()).toBe('Zeitplan');
      expect(description(f)).toBe('Jeden Tag um 09:00');
    });
  });

  describe('forms', () => {
    @Component({
      standalone: true,
      imports: [ReactiveFormsModule, SvCronBuilderComponent],
      template: `<sv-cron-builder [formControl]="ctrl" locale="en-GB" timeZone="UTC" />`,
    })
    class Host {
      readonly ctrl = new FormControl<string>('0 9 * * 1-5', { nonNullable: true });
    }

    async function host() {
      TestBed.resetTestingModule();
      const r = await render(Host);
      await settle(r.fixture);
      return r.fixture;
    }

    it('reads the control, follows setValue and writes back', async () => {
      const f = await host();
      const ctrl = f.componentInstance.ctrl;
      const root = el(f);
      expect(root.querySelector('[data-seg][aria-checked="true"]')?.getAttribute('data-seg')).toBe('weekly');
      ctrl.setValue('*/15 * * * *');
      await settle(f);
      expect(root.querySelector('[data-seg][aria-checked="true"]')?.getAttribute('data-seg')).toBe('minutes');
      root.querySelector<HTMLButtonElement>('[data-seg="daily"]')!.click();
      await settle(f);
      expect(ctrl.value).toBe('0 9 * * *');
      expect(ctrl.dirty).toBe(true);
    });

    it('is invalid while the expression on screen is, and keeps the last good value', async () => {
      const f = await host();
      const ctrl = f.componentInstance.ctrl;
      const root = el(f);
      root.querySelector<HTMLButtonElement>('[data-seg="custom"]')!.click();
      await settle(f);
      const input = root.querySelector<HTMLInputElement>('[data-sv-cron-expression]')!;
      input.value = '0 25 * * *';
      input.dispatchEvent(new Event('input'));
      await settle(f);
      expect(ctrl.value).toBe('0 9 * * 1-5');
      expect(ctrl.invalid).toBe(true);
      expect((ctrl.errors?.['cron'] as SvCronError).code).toBe('range');
      input.value = '0 10 * * 1-5';
      input.dispatchEvent(new Event('input'));
      await settle(f);
      expect(ctrl.value).toBe('0 10 * * 1-5');
      expect(ctrl.valid).toBe(true);
    });

    it('disables every control with the form control', async () => {
      const f = await host();
      f.componentInstance.ctrl.disable();
      await settle(f);
      expect(el(f).querySelector('fieldset')?.disabled).toBe(true);
      expect(el(f).querySelector<HTMLButtonElement>('[data-seg="daily"]')?.disabled).toBe(true);
    });
  });
});
