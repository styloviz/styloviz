import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core/dev';
import { afterEach, beforeEach, vi } from 'vitest';
import { provideSvIcons } from '@styloviz/icons';
import { bellIcon } from '@styloviz/icons/glyph/bell';
import { starIcon } from '@styloviz/icons/glyph/star';
import { SvBadgeComponent } from './badge.component';

/** The glyphs this spec names — registered here, never globally. */
const HOST_ICONS = provideSvIcons([starIcon, bellIcon]);

/** FL-J3-DD-31 — an icon-only badge must have an accessible name; dev mode says so when it does not. */
let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  svResetWarnOnce();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  warn.mockRestore();
  svResetWarnOnce();
});

async function setup(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvBadgeComponent, { inputs, providers: [HOST_ICONS] });
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector(':scope > span') as HTMLElement;
}

describe('SvBadgeComponent — icon-only needs a name (DD-03-V1)', () => {
  it('warns once when an icon-only badge has no ariaLabel, naming the glyph', async () => {
    const badge = await setup({ icon: 'star' });
    expect(badge.hasAttribute('data-sv-badge-unnamed')).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('icon-only badge ("star") has no accessible name');
    await setup({ icon: 'star' });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('warns for a dot-only badge too', async () => {
    await setup({ dot: true });
    expect(String(warn.mock.calls[0][0])).toContain('("dot")');
  });

  it('is named, and silent in the console, with ariaLabel', async () => {
    const badge = await setup({ icon: 'star', ariaLabel: 'Featured' });
    expect(badge.getAttribute('role')).toBe('img');
    expect(badge.getAttribute('aria-label')).toBe('Featured');
    expect(badge.hasAttribute('data-sv-badge-unnamed')).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn when the visible label or a count names it', async () => {
    await setup({ icon: 'star', label: 'Featured' });
    await setup({ icon: 'bell', count: 3 });
    expect(warn).not.toHaveBeenCalled();
  });
});
