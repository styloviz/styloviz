import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { SvTreeViewComponent, type TreeNode } from './tree-view.component';

const NODES: TreeNode[] = [
  {
    id: 'src',
    label: 'src',
    children: [
      { id: 'app', label: 'app', children: [{ id: 'main', label: 'main.ts' }] },
      { id: 'styles', label: 'styles.css' },
    ],
  },
  { id: 'readme', label: 'README.md', disabled: true },
];

async function setup(extra: Record<string, unknown> = {}) {
  const { fixture } = await render(SvTreeViewComponent, {
    inputs: { nodes: NODES, ...extra },
  });
  return fixture.componentInstance;
}

describe('SvTreeViewComponent — flattening & visibility', () => {
  it('shows only root nodes when nothing is expanded', async () => {
    const c = await setup();
    expect(c.visibleNodes().map((n) => n.node.id)).toEqual(['src', 'readme']);
  });

  it('reveals children once a node is expanded', async () => {
    const c = await setup();
    c.toggle(NODES[0]);
    expect(c.visibleNodes().map((n) => n.node.id)).toEqual(['src', 'app', 'styles', 'readme']);
  });

  it('flags nodes with children in the flattened output', async () => {
    const c = await setup();
    const root = c.visibleNodes().find((n) => n.node.id === 'src');
    expect(root?.hasChildren).toBe(true);
  });
});

describe('SvTreeViewComponent — expand/collapse events', () => {
  it('emits nodeExpand then nodeCollapse as a node toggles', async () => {
    const expand = vi.fn();
    const collapse = vi.fn();
    const c = await setup();
    c.nodeExpand.subscribe(expand);
    c.nodeCollapse.subscribe(collapse);

    c.toggle(NODES[0]);
    expect(expand).toHaveBeenCalledWith(NODES[0]);

    c.toggle(NODES[0]);
    expect(collapse).toHaveBeenCalledWith(NODES[0]);
  });

  it('does not toggle a disabled node', async () => {
    const c = await setup();
    c.toggle(NODES[1]); // README.md, disabled
    expect(c.visibleNodes().map((n) => n.node.id)).toEqual(['src', 'readme']);
  });
});

describe('SvTreeViewComponent — selection', () => {
  it('selects a node and emits nodeSelect + nodeClick', async () => {
    const select = vi.fn();
    const click = vi.fn();
    const c = await setup();
    c.nodeSelect.subscribe(select);
    c.nodeClick.subscribe(click);

    c.select(NODES[0], 0);
    expect(c.isSelected('src')).toBe(true);
    expect(select).toHaveBeenCalledWith(NODES[0]);
    expect(click).toHaveBeenCalledWith({ node: NODES[0], depth: 0 });
  });

  it('does not select a disabled node', async () => {
    const c = await setup();
    c.select(NODES[1], 0);
    expect(c.isSelected('readme')).toBe(false);
  });

  it('renders a tree role in the DOM', async () => {
    await setup();
    expect(screen.getByRole('tree')).toBeTruthy();
  });
});

// ─── Backend wiring (Phase 1) ────────────────────────────────────────────────

describe('SvTreeViewComponent — backend wiring', () => {
  const stateEl = (f: { nativeElement: HTMLElement }, n: string) =>
    f.nativeElement.querySelector(`[data-sv-state="${n}"]`);

  /** `nodes` used to be read once in ngOnInit, so an async fetch never appeared. */
  it('renders a tree that arrives after the first render', async () => {
    TestBed.resetTestingModule();
    const { fixture, rerender } = await render(SvTreeViewComponent, {
      inputs: { nodes: [] as TreeNode[] },
    });
    expect(fixture.componentInstance.visibleNodes()).toHaveLength(0);

    await rerender({ inputs: { nodes: [{ id: 'a', label: 'A' }] as TreeNode[] } });
    fixture.detectChanges();
    expect(fixture.componentInstance.visibleNodes()).toHaveLength(1);
  });

  it('does not re-apply the data’s expanded flags after the user collapses one', async () => {
    TestBed.resetTestingModule();
    const nodes: TreeNode[] = [{ id: 'a', label: 'A', expanded: true, children: [{ id: 'a1', label: 'A1' }] }];
    const { fixture, rerender } = await render(SvTreeViewComponent, { inputs: { nodes } });
    expect(fixture.componentInstance.expandedIds().has('a')).toBe(true);

    fixture.componentInstance.expandedIds.set(new Set());
    await rerender({ inputs: { nodes: [...nodes] } });
    fixture.detectChanges();
    expect(fixture.componentInstance.expandedIds().has('a')).toBe(false);
  });

  it('shows a placeholder instead of the tree while loading', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvTreeViewComponent, { inputs: { loading: true } });
    expect(stateEl(fixture, 'loading')).toBeTruthy();
  });

  it('announces a load failure and offers a retry', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvTreeViewComponent, { inputs: { error: 'Tree service down' } });
    let retried = 0;
    fixture.componentInstance.retry.subscribe(() => retried++);
    expect(stateEl(fixture, 'error')?.textContent).toContain('Tree service down');
    (stateEl(fixture, 'error')?.querySelector('button') as HTMLButtonElement).click();
    expect(retried).toBe(1);
  });

  it('shows an empty state when there is nothing to render', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvTreeViewComponent, { inputs: { nodes: [] as TreeNode[] } });
    expect(stateEl(fixture, 'empty')).toBeTruthy();
  });
});


describe('SvTreeViewComponent — the connector guides', () => {
  // ★★ `showLines` was declared, documented and defaulted to true, and drew
  // nothing at all: indentation was a `paddingLeft` on the row, so there was no
  // element for a line to hang on. An input that is read by nothing is
  // indistinguishable from a working one until somebody looks — which is what
  // the `unread-input` rule now catches, and what this pins.

  async function tree(extra: Record<string, unknown> = {}) {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvTreeViewComponent, {
      inputs: { nodes: NODES, ...extra },
    });
    // src › app › main.ts — the only path deep enough to have two ancestors.
    fixture.componentInstance.toggle(NODES[0]);
    fixture.componentInstance.toggle(NODES[0].children![0]);
    fixture.detectChanges();
    return fixture;
  }

  const row = (f: { nativeElement: unknown }, id: string) =>
    (f.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-tree-id="${id}"]`)!;
  const spacers = (f: { nativeElement: unknown }, id: string) =>
    row(f, id).querySelectorAll('span.w-5[aria-hidden="true"]');
  const guides = (f: { nativeElement: unknown }, id: string) =>
    row(f, id).querySelectorAll('span.w-px');

  it('gives one spacer per ancestor level', async () => {
    const f = await tree();
    expect(spacers(f, 'src').length).toBe(0);   // depth 0 — no ancestors
    expect(spacers(f, 'app').length).toBe(1);   // depth 1
    expect(spacers(f, 'main').length).toBe(2);  // depth 2
  });

  it('draws a guide line in every spacer by default', async () => {
    const f = await tree();
    expect(guides(f, 'main').length).toBe(2);
  });

  it('draws no line when showLines is off, and still indents', async () => {
    // The two are separable on purpose: turning the guides off must not
    // collapse the tree back to a flat list.
    const f = await tree({ showLines: false });
    expect(guides(f, 'main').length).toBe(0);
    expect(spacers(f, 'main').length).toBe(2);
  });

  it('hides the guides from assistive tech — aria-level is what carries depth', async () => {
    const f = await tree();
    expect([...spacers(f, 'main')].every((n) => n.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(row(f, 'main').getAttribute('aria-level')).toBe('3');
  });

  it('counts ancestors, not nodes', async () => {
    const c = (await tree()).componentInstance;
    expect(c.depthArray(0)).toEqual([]);
    expect(c.depthArray(1)).toEqual([0]);
    expect(c.depthArray(3)).toEqual([0, 1, 2]);
  });
});

// ─── Icons come from the library ──────────────────────────────────────────────

/**
 * The expand/collapse chevron was an inline `<svg>` with a literal `d`.
 *
 * ★ It was invisible to `check:ui` for a reason none of this sweep's earlier
 * widenings covered: this component keeps its markup in an INLINE `template:`
 * backtick string, and the rule scanned `.html` files only. So it was not
 * under-counted — it was never looked at. The Pro twin already drew
 * `<sv-icon-pro name="chevron-right">` at the same spot, making this the fifth
 * half-migration found in the sweep.
 *
 * `sv-skeleton-shell` / `sv-error-shell` / `sv-empty-shell` are other people's
 * components and are not this file's business, so the sweep uses the loaded
 * state only — which is also the only state that draws a chevron.
 */
describe('SvTreeViewComponent — icons come from the library', () => {
  const byHand = (host: HTMLElement) =>
    [...host.querySelectorAll('svg')].filter((n) => !n.closest('sv-icon'));

  it.each([
    ['collapsed', false],
    ['expanded', true],
  ])('draws no glyph by hand — %s', async (_label, expand) => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvTreeViewComponent, { inputs: { nodes: NODES } });
    if (expand) {
      fixture.componentInstance.toggle(NODES[0]);
      fixture.detectChanges();
    }
    const host = fixture.nativeElement as HTMLElement;
    // Assert something WAS drawn first — an empty tree satisfies "no hand-drawn
    // glyphs" without proving anything.
    expect(host.querySelectorAll('svg').length).toBeGreaterThan(0);
    expect(byHand(host)).toEqual([]);
  });

  it('rotates the same glyph rather than swapping to a second one', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvTreeViewComponent, { inputs: { nodes: NODES } });
    const host = fixture.nativeElement as HTMLElement;
    const chevronClass = () => host.querySelector('sv-icon svg')!.getAttribute('class') ?? '';
    expect(chevronClass()).not.toContain('rotate-90');

    fixture.componentInstance.toggle(NODES[0]);
    fixture.detectChanges();
    expect(chevronClass()).toContain('rotate-90');
  });
});
