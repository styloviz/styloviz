import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvInputMaskComponent, svDateMaskFormat, svTimeMaskSeparator } from './input-mask.component';

/**
 * `FL-J3-FI-09` / `FI-13-I4` / `FI-13-M4` — the `date` and `time` presets follow
 * the locale; the US-only presets say they are US.
 */
async function setup(inputs: Partial<ComponentInput<SvInputMaskComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvInputMaskComponent, { inputs: inputs as ComponentInput<SvInputMaskComponent> });
  return r.fixture.componentInstance;
}
const typeInto = (c: SvInputMaskComponent, text: string): void =>
  c.onInput({ target: { value: text } } as unknown as Event);

describe('svDateMaskFormat / svTimeMaskSeparator', () => {
  it.each([
    ['en-US', ['m', 'd', 'y'], '/'],
    ['en-GB', ['d', 'm', 'y'], '/'],
    ['de', ['d', 'm', 'y'], '.'],
    ['ja', ['y', 'm', 'd'], '/'],
    ['nl', ['d', 'm', 'y'], '-'],
  ])('%s → %j with %s', (locale, order, separator) => {
    expect(svDateMaskFormat(locale)).toEqual({ order, separator });
  });

  it('falls back to US MM/DD/YYYY for a tag Intl cannot read', () => {
    expect(svDateMaskFormat('not a locale!')).toEqual({ order: ['m', 'd', 'y'], separator: '/' });
  });

  it('uses the colon for 24-hour time, and Finnish uses a dot', () => {
    expect(svTimeMaskSeparator('en-US')).toBe(':');
    expect(svTimeMaskSeparator('fi')).toBe('.');
  });
});

describe('sv-input-mask date preset in the locale', () => {
  it('en-US (the default kit locale) keeps MM/DD/YYYY', async () => {
    const c = await setup({ preset: 'date' });
    expect(c.activeMask()).toBe('##/##/####');
    expect(c.activePlaceholder()).toBe('MM/DD/YYYY');
    typeInto(c, '12252024');
    expect(c.value()).toBe('12/25/2024');
  });

  it('German is DD.MM.YYYY — 29.03.2026 is accepted, not refused as month 29', async () => {
    const c = await setup({ preset: 'date', locale: 'de' });
    expect(c.activeMask()).toBe('##.##.####');
    expect(c.activePlaceholder()).toBe('DD.MM.YYYY'); // English letters until a German pack is provided
    typeInto(c, '29032026');
    expect(c.value()).toBe('29.03.2026');
    expect(c.hasRejected()).toBe(false);
  });

  it('a day-first date still refuses an impossible one — 31.04 and a non-leap 29.02', async () => {
    const c = await setup({ preset: 'date', locale: 'en-GB' });
    typeInto(c, '3104');
    expect(c.value()).toBe('31/0');
    typeInto(c, '29022025');
    expect(c.value()).toBe('29/02/202');
    typeInto(c, '29022024');
    expect(c.value()).toBe('29/02/2024');
  });

  it('Japanese is year first, YYYY/MM/DD', async () => {
    const c = await setup({ preset: 'date', locale: 'ja' });
    expect(c.activeMask()).toBe('####/##/##');
    typeInto(c, '20260329');
    expect(c.value()).toBe('2026/03/29');
    typeInto(c, '20261345');
    expect(c.value()).toBe('2026/1');
  });
});

describe('sv-input-mask time preset in the locale', () => {
  it('keeps HH:MM, with the locale’s separator', async () => {
    expect((await setup({ preset: 'time' })).activeMask()).toBe('##:##');
    const fi = await setup({ preset: 'time', locale: 'fi' });
    expect(fi.activeMask()).toBe('##.##');
    typeInto(fi, '1345');
    expect(fi.value()).toBe('13.45');
  });
});

describe('US-only presets say they are US', () => {
  it.each([
    ['phone-us', 'Phone (US)'],
    ['ssn', 'SSN (US)'],
    ['zip', 'ZIP+4 (US)'],
  ] as const)('%s → “%s”', async (preset, label) => {
    expect((await setup({ preset })).activeLabel()).toBe(label);
  });
});
