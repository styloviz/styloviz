import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvTreeViewComponent, type TreeNode } from './tree-view.component';

/**
 * ============================================================================
 *  The two ways the free tree stopped working (DD-45-I3, DD-45-I4)
 * ============================================================================
 *
 * Both arrive with ordinary host data, and neither is reachable from a demo:
 *
 *  1. A **cycle** in `children`, which `_flatten` and `_collectExpanded` both
 *     recursed into unconditionally — the stack ended and took the tab with it.
 *
 *  2. **The tab stop naming a row that is no longer rendered.** `activeId ??
 *     first row` falls back when `activeId` is null, not when it names a hidden
 *     node, so collapsing a parent while a descendant was active left every row
 *     at −1: a full tree Tab could not enter.
 * ============================================================================
 */

const TREE: TreeNode[] = [
  {
    id: 'src',
    label: 'src',
    children: [
      { id: 'app', label: 'app', children: [{ id: 'main', label: 'main.ts' }] },
      { id: 'util', label: 'util.ts' },
    ],
  },
  { id: 'readme', label: 'README.md' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvTreeViewComponent, {
    inputs: { nodes: TREE, ...inputs },
  });
  fixture.detectChanges();
  return fixture;
}

type Fixture = Awaited<ReturnType<typeof setup>>;

const visibleIds = (f: Fixture) => f.componentInstance.visibleNodes().map((n) => n.node.id);
const rows = (f: Fixture) => [
  ...(f.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[data-tree-id]'),
];
const tabbable = (f: Fixture) => rows(f).filter((r) => r.getAttribute('tabindex') === '0');
/** The node as the component holds it — a cut tree is a different object. */
const held = (f: Fixture, id: string): TreeNode =>
  f.componentInstance.visibleNodes().find((fn) => fn.node.id === id)!.node;

// ── Cycles ────────────────────────────────────────────────────────────────────

describe('SvTreeViewComponent — a cycle in [nodes]', () => {
  it('renders instead of recursing to death', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const root: TreeNode = { id: 'root', label: 'Root' };
    const child: TreeNode = { id: 'child', label: 'Child' };
    root.children = [child];
    child.children = [root];

    const f = await setup({ nodes: [root], expandedIds: new Set(['root', 'child']) });

    expect(visibleIds(f)).toEqual(['root', 'child']);
    expect(warn.mock.calls.some((c) => String(c[0]).includes('is its own descendant'))).toBe(true);
    warn.mockRestore();
  });

  /**
   * The seeding walk runs in the same effect, over the same data, and would have
   * hit the loop before a single row was flattened.
   */
  it('seeds expansion from node.expanded without walking the loop', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const a: TreeNode = { id: 'a', label: 'A', expanded: true };
    const b: TreeNode = { id: 'b', label: 'B', expanded: true };
    a.children = [b];
    b.children = [a];

    const f = await setup({ nodes: [a] });

    expect([...f.componentInstance.expandedIds()].sort()).toEqual(['a', 'b']);
    expect(visibleIds(f)).toEqual(['a', 'b']);
    warn.mockRestore();
  });

  it('leaves the host’s own array untouched', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const root: TreeNode = { id: 'root', label: 'Root' };
    root.children = [root];

    await setup({ nodes: [root] });

    expect(root.children).toEqual([root]);
    warn.mockRestore();
  });
});

// ── The tab stop ──────────────────────────────────────────────────────────────

describe('SvTreeViewComponent — the tab stop survives a collapse', () => {
  it('keeps exactly one tab stop when the active row is collapsed away', async () => {
    const f = await setup({ expandedIds: new Set(['src', 'app']) });
    expect(visibleIds(f)).toEqual(['src', 'app', 'main', 'util', 'readme']);

    f.componentInstance.setActive('main');
    f.detectChanges();
    expect(tabbable(f).map((r) => r.dataset['treeId'])).toEqual(['main']);

    f.componentInstance.toggle(held(f, 'src'));
    f.detectChanges();

    expect(visibleIds(f)).toEqual(['src', 'readme']);
    expect(tabbable(f).map((r) => r.dataset['treeId'])).toEqual(['src']);
  });

  it('leaves the tab stop alone while the active row is still rendered', async () => {
    const f = await setup({ expandedIds: new Set(['src']) });
    f.componentInstance.setActive('util');
    f.detectChanges();

    f.componentInstance.toggle(held(f, 'readme'));
    f.detectChanges();

    expect(tabbable(f).map((r) => r.dataset['treeId'])).toEqual(['util']);
  });

  it('has a tab stop on the first row before anything is active', async () => {
    const f = await setup();
    expect(tabbable(f).map((r) => r.dataset['treeId'])).toEqual(['src']);
  });

  it('has no tab stop, and does not throw, when the tree is empty', async () => {
    const f = await setup({ nodes: [] });
    expect(tabbable(f)).toHaveLength(0);
  });

  /** WAI-ARIA: collapsing a parent while a descendant has focus focuses the parent. */
  it('moves DOM focus to the collapsed parent', async () => {
    const f = await setup({ expandedIds: new Set(['src', 'app']) });
    const main = rows(f).find((r) => r.dataset['treeId'] === 'main')!;
    main.focus();
    f.componentInstance.setActive('main');
    f.detectChanges();

    f.componentInstance.toggle(held(f, 'src'));
    f.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 0)); // `_focus` lands after the render turn

    expect(f.componentInstance.activeId()).toBe('src');
    expect((document.activeElement as HTMLElement).dataset['treeId']).toBe('src');
  });

  /** A mouse user who clicks a chevron keeps focus on that chevron. */
  it('does not move focus when the row holding it is still rendered', async () => {
    const f = await setup({ expandedIds: new Set(['src', 'app']) });
    const srcRow = rows(f).find((r) => r.dataset['treeId'] === 'src')!;
    const chevron = srcRow.querySelector('button')!;
    chevron.focus();

    f.componentInstance.toggle(held(f, 'src'));
    f.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 0)); // `_focus` lands after the render turn

    expect(document.activeElement).toBe(chevron);
  });
});

// ── A branch wider than the engine's argument cap ─────────────────────────────

describe('SvTreeViewComponent — a branch with more children than a spread can pass', () => {
  /**
   * ★★★ `out.push(...this._flatten(children))` PASSES ONE ARGUMENT PER ROW, and
   *     past the engine's cap — ~65k in JavaScriptCore, ~124k in V8 — that is a
   *     `RangeError`, not a slow render.
   *
   * `loading` keeps the 200,000 rows out of jsdom: the defect is in the computed
   * and the row template is not what is under test.
   */
  it('flattens 200,000 rows without throwing', async () => {
    const wide: TreeNode = {
      id: 'wide',
      label: 'Wide',
      children: Array.from({ length: 200_000 }, (_, i) => ({ id: `n${i}`, label: `Item ${i}` })),
    };

    const f = await setup({ nodes: [wide], expandedIds: new Set(['wide']), loading: true });

    expect(f.componentInstance.visibleNodes()).toHaveLength(200_001);
  });
});
