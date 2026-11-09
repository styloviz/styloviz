import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import {
  SvPageHeaderBackDirective,
  SvPageHeaderBreadcrumbDirective,
  SvPageHeaderComponent,
  SvPageHeaderMetaDirective,
  SvPageHeaderTabsDirective,
  type PageHeaderAction,
} from './page-header.component';

/**
 * ============================================================================
 *  Page header slots and the responsive actions row — FL-J3-NV-09 (`N-9`)
 * ============================================================================
 *
 * Additive: title / subtitle / the projected actions slot are unchanged, and a
 * plain header renders no landmark. With a breadcrumb, back/up or tabs slot the
 * header is ONE region landmark named by its title (ADR Decision 2), and
 * `actions` render through `sv-toolbar` with `overflow="menu"` — the kit's own
 * overflow menu.
 */

const ACTIONS: PageHeaderAction[] = [
  { id: 'export', label: 'Export', icon: 'download' },
  { id: 'share', label: 'Share', icon: 'share' },
];

@Component({
  imports: [
    SvPageHeaderComponent,
    SvPageHeaderBackDirective,
    SvPageHeaderBreadcrumbDirective,
    SvPageHeaderMetaDirective,
    SvPageHeaderTabsDirective,
  ],
  template: `
    <sv-page-header title="Order #1042" subtitle="Placed 3 March" [actions]="actions()" (actionClick)="clicked.push($event)">
      <a svPageHeaderBack href="/orders">Up to Orders</a>
      <nav svPageHeaderBreadcrumb aria-label="Breadcrumb"><a href="/orders">Orders</a></nav>
      <span svPageHeaderMeta data-status>Paid</span>
      <button type="button">Refund</button>
      <div svPageHeaderTabs role="tablist" aria-label="Order sections"><button type="button" role="tab">Items</button></div>
    </sv-page-header>
  `,
})
class ComposedHost {
  readonly actions = signal<readonly PageHeaderAction[]>(ACTIONS);
  readonly clicked: string[] = [];
}

const slot = (root: Element, name: string) => root.querySelector<HTMLElement>(`[data-sv-page-header-${name}]`)!;

describe('SvPageHeaderComponent — slots (FL-J3-NV-09)', () => {
  it('a plain header is unchanged: no landmark, empty slot wrappers hidden', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvPageHeaderComponent, { inputs: { title: 'Analytics' } });
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[role="region"]')).toBeNull();
    expect(slot(root, 'trail').children).toHaveLength(0);
    expect(slot(root, 'trail').className).toContain('empty:hidden');
    expect(slot(root, 'tabs').className).toContain('empty:hidden');
    expect(slot(root, 'meta').className).toContain('empty:hidden');
    expect(root.querySelector('sv-toolbar')).toBeNull();
  });

  it('each slot lands in its place: back + trail above, meta beside the title, actions, tabs below', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(ComposedHost);
    const root = fixture.nativeElement as HTMLElement;
    const trail = slot(root, 'trail');
    expect(trail.querySelector('[svpageheaderback]')!.textContent).toContain('Up to Orders');
    expect(trail.querySelector('nav[aria-label="Breadcrumb"]')).toBeTruthy();
    // Back comes before the breadcrumb.
    expect(trail.firstElementChild!.hasAttribute('svpageheaderback')).toBe(true);
    expect(slot(root, 'meta').querySelector('[data-status]')!.textContent).toBe('Paid');
    expect(slot(root, 'actions').textContent).toContain('Refund');
    expect(slot(root, 'tabs').querySelector('[role="tablist"]')).toBeTruthy();
    // The title is still the page's h1.
    expect(screen.getByRole('heading', { level: 1, name: 'Order #1042' })).toBeTruthy();
  });

  it('with navigation slots the header is ONE region landmark named by its title', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(ComposedHost);
    const root = fixture.nativeElement as HTMLElement;
    const regions = root.querySelectorAll('[role="region"]');
    expect(regions).toHaveLength(1);
    const h1 = root.querySelector('h1')!;
    expect(regions[0].getAttribute('aria-labelledby')).toBe(h1.id);
    expect(screen.getByRole('region', { name: 'Order #1042' })).toBeTruthy();
    for (const name of ['trail', 'actions', 'tabs']) expect(regions[0].contains(slot(root, name))).toBe(true);
  });

  it('actions render through sv-toolbar with the overflow menu, named, and emit their id', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(ComposedHost);
    const root = fixture.nativeElement as HTMLElement;
    const toolbar = root.querySelector('sv-toolbar')!;
    expect(toolbar).toBeTruthy();
    expect(root.querySelector('[role="toolbar"]')!.getAttribute('aria-label')).toBe('Page actions');
    const exportBtn = root.querySelector<HTMLButtonElement>('[role="toolbar"] button[aria-label="Export"]')!;
    exportBtn.click();
    expect(fixture.componentInstance.clicked).toEqual(['export']);
  });

  it('the toolbar is asked to fold overflow into its More menu', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(ComposedHost);
    const toolbar = fixture.debugElement.query((d) => d.name === 'sv-toolbar').componentInstance as { overflow(): string; actions(): readonly PageHeaderAction[] };
    expect(toolbar.overflow()).toBe('menu');
    expect(toolbar.actions().map((a) => a.id)).toEqual(['export', 'share']);
  });

  it('two headers on one page get distinct title ids', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(
      '<sv-page-header title="One"><nav svPageHeaderBreadcrumb aria-label="a"></nav></sv-page-header>' +
        '<sv-page-header title="Two"><nav svPageHeaderBreadcrumb aria-label="b"></nav></sv-page-header>',
      { imports: [SvPageHeaderComponent, SvPageHeaderBreadcrumbDirective] },
    );
    const ids = [...(fixture.nativeElement as HTMLElement).querySelectorAll('h1')].map((h) => h.id);
    expect(new Set(ids).size).toBe(2);
    expect(screen.getByRole('region', { name: 'Two' })).toBeTruthy();
  });

});
