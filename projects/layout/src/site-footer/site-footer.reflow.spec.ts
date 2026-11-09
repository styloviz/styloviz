import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import { SvSiteFooterComponent, type FooterColumn } from './site-footer.component';

/**
 * FL-J3-LU-07 — the link columns reflow inside a narrow footer.
 *
 * The layout reflow matrix found "Sustainability" and "YouTube" cut off by the
 * footer's own `overflow-hidden` band at 320 px: the brand + columns grid had
 * an implicit `auto` track, which grows to its widest unbreakable link, so the
 * two-column link grid ran past the footer's edge. jsdom has no layout, so
 * these pin the class contract that fixes it.
 */

const COLUMNS: readonly FooterColumn[] = [
  { heading: 'Company', links: [{ label: 'Sustainability', href: '/sustainability' }] },
  { heading: 'Social', links: [{ label: 'YouTube', href: 'https://youtube.com/@acme' }] },
];

async function setup(inputs: Partial<ComponentInput<SvSiteFooterComponent>> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvSiteFooterComponent, {
    inputs: { columns: COLUMNS, ...inputs } as ComponentInput<SvSiteFooterComponent>,
  });
  return fixture.nativeElement as HTMLElement;
}

describe('SvSiteFooterComponent — reflow (FL-J3-LU-07)', () => {
  it('sizes the brand + columns grid with a minmax(0, 1fr) track, not an auto one', async () => {
    const root = await setup();
    const nav = screen.getByRole('navigation', { name: /footer/i });
    const grid = nav.parentElement as HTMLElement;
    expect(grid.classList).toContain('grid');
    expect(grid.classList).toContain('grid-cols-1');
    expect(grid.classList).toContain('lg:grid-cols-12');
    expect(root.contains(grid)).toBe(true);
  });

  it('lets a column shrink and a long label wrap inside it, rather than run past the edge', async () => {
    await setup();
    const link = screen.getByRole('link', { name: 'Sustainability' });
    expect(link.classList).toContain('max-w-full');
    const label = link.querySelector('[data-sv-footer-link-label]') as HTMLElement;
    expect(label.classList).toContain('min-w-0');
    expect(label.classList).toContain('break-words');
    expect((link.closest('li')!.parentElement!.parentElement as HTMLElement).classList).toContain('min-w-0');
  });

  it('draws the hover underline from the inline start, so it mirrors under RTL', async () => {
    await setup();
    const underline = screen.getByRole('link', { name: 'Sustainability' }).querySelector(
      '[data-sv-footer-link-label] > span',
    ) as HTMLElement;
    expect(underline.classList).toContain('start-0');
    expect(underline.classList).not.toContain('left-0');
  });
});
