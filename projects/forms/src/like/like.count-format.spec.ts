import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';

import { SvLikeComponent } from './like.component';

/** FL-J3-DD-20 — compact, locale-aware count on screen; the full number in the accessible name. */
async function setup(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvLikeComponent, { inputs: { locale: 'en-US', ...inputs } });
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, button: el.querySelector('button')!, shown: () => el.querySelector('button span.tabular-nums')!.textContent?.trim() };
}

describe('SvLikeComponent — count formatting (DD-22-M4)', () => {
  it.each([
    [999, '999', '999'],
    [1234, '1.2K', '1,234'],
    [12_345, '12K', '12,345'],
    [1_250_000, '1.3M', '1,250,000'],
  ])('%i shows %s and is named with %s', async (count, visible, spoken) => {
    const { button, shown } = await setup({ count });
    expect(shown()).toBe(visible);
    expect(button.getAttribute('aria-label')).toBe(`Like, ${spoken}`);
  });

  it('writes the compact form the locale\'s own way', async () => {
    const ja = await setup({ count: 12_345, locale: 'ja' });
    expect(ja.shown()).toBe('1.2万');
    expect(ja.button.getAttribute('aria-label')).toBe('Like, 12,345');
    // German abbreviates nothing below a million in short form, so the full grouped number shows.
    const de = await setup({ count: 12_345, locale: 'de-DE' });
    expect(de.shown()).toBe('12.345');
    expect(de.button.getAttribute('aria-label')).toBe('Like, 12.345');
  });

  it('can write the full number instead', async () => {
    const { shown } = await setup({ count: 12_345, countNotation: 'standard' });
    expect(shown()).toBe('12,345');
  });

  it('hides the visible digits from the accessibility tree (the name already has the full count)', async () => {
    const { button } = await setup({ count: 1234 });
    expect(button.querySelector('span.tabular-nums [aria-hidden="true"]')?.textContent).toBe('1.2K');
  });
});
