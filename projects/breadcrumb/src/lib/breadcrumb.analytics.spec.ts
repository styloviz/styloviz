import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core/dev';
import { SV_NAV_TELEMETRY, type SvNavEvent, type SvNavTelemetry } from '@styloviz/core/nav';
import { SvBreadcrumbComponent, type BreadcrumbItem } from './breadcrumb.component';

/**
 * ============================================================================
 *  The breadcrumb on the shared navigation stream — FL-J3-NV-07
 * ============================================================================
 *
 * A crumb or a sibling page followed is `jump`; opening a crumb's sibling menu
 * or the collapsed middle is `explore`; Escape out of the menu is `escape`.
 */

const ITEMS: BreadcrumbItem[] = [
  { label: 'Home', routerLink: '/' },
  { label: 'Orders', routerLink: '/orders', menu: [{ label: 'Refunds', routerLink: '/refunds' }] },
  { label: 'Order #1042' },
];

function sink(retention = '30d', granted = true) {
  const seen: SvNavEvent[] = [];
  const provided: SvNavTelemetry = { kind: 'spec', retention, consent: () => granted, record: (e) => seen.push(e) };
  return { seen, provided };
}

async function setup(opts: { retention?: string; granted?: boolean; items?: BreadcrumbItem[]; extra?: Record<string, unknown> } = {}) {
  TestBed.resetTestingModule();
  svResetWarnOnce();
  const { seen, provided } = sink(opts.retention ?? '30d', opts.granted ?? true);
  const { fixture, container } = await render(SvBreadcrumbComponent, {
    inputs: { items: opts.items ?? ITEMS, surfaceId: 'page-trail', ...opts.extra },
    providers: [{ provide: SV_NAV_TELEMETRY, useValue: provided }],
  });
  return { fixture, c: fixture.componentInstance, seen, container };
}

afterEach(() => {
  document.querySelectorAll('.sv-breadcrumb-menu-portal').forEach((n) => n.remove());
});

describe('SvBreadcrumbComponent — SV_NAV_TELEMETRY (FL-J3-NV-07)', () => {
  it('a crumb click is a jump with its href, label, position and the surface named', async () => {
    const { c, seen } = await setup();
    c.onCrumbClick(ITEMS[1], new MouseEvent('click', { cancelable: true }));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ surface: 'breadcrumb', surfaceId: 'page-trail', intent: 'jump', key: '/orders', label: 'Orders', index: 1 });
  });

  it('opening the sibling menu is explore; picking a sibling is jump; Escape is escape', async () => {
    const { container, fixture, c, seen } = await setup();
    container.querySelector<HTMLElement>('[aria-haspopup]')!.click();
    fixture.detectChanges();
    expect(seen.at(-1)).toMatchObject({ intent: 'explore', key: '/orders', label: 'Orders' });

    const menu = document.body.querySelector<HTMLElement>('.sv-breadcrumb-menu-portal [role="menu"]')!;
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(seen.at(-1)).toMatchObject({ intent: 'escape', reason: 'escape' });
    expect(seen.filter((e) => e.intent === 'escape')).toHaveLength(1);

    c.selectMenuItem({ label: 'Refunds', routerLink: '/refunds' });
    expect(seen.at(-1)).toMatchObject({ intent: 'jump', key: '/refunds', label: 'Refunds' });
  });

  it('expanding the collapsed middle is explore', async () => {
    const many: BreadcrumbItem[] = [
      { label: 'A', routerLink: '/a' }, { label: 'B', routerLink: '/b' }, { label: 'C', routerLink: '/c' },
      { label: 'D', routerLink: '/d' }, { label: 'E' },
    ];
    const { c, seen } = await setup({ items: many, extra: { maxVisible: 3 } });
    c.toggleCollapse();
    expect(seen.map((e) => e.intent)).toEqual(['explore']);
  });

  it('retention "none" strips key and label; no consent records nothing', async () => {
    const stripped = await setup({ retention: 'none' });
    stripped.c.onCrumbClick(ITEMS[0], new MouseEvent('click', { cancelable: true }));
    expect(stripped.seen[0]).toMatchObject({ intent: 'jump', key: null, label: null, surfaceId: 'page-trail' });

    const silent = await setup({ granted: false });
    silent.c.onCrumbClick(ITEMS[0], new MouseEvent('click', { cancelable: true }));
    expect(silent.seen).toEqual([]);
  });
});
