import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvTreeViewComponent, type TreeNode } from './tree-view.component';

/**
 * ============================================================================
 *  Naming the tree and its toggles (audit item X-9)
 * ============================================================================
 *
 * ★★★ THE FREE TREE NEEDS NO COMPANION SUMMARY TABLE. It renders one variant and
 *     it renders it as a proper ARIA tree — `role="treeitem"` with `aria-level`,
 *     `aria-expanded` and `aria-selected` — so the hierarchy is stated outright
 *     rather than drawn. What it lacked was identity: the region had no name, and
 *     every chevron in it was called exactly "Expand".
 * ============================================================================
 */

const NODES: TreeNode[] = [
  {
    id: 'src',
    label: 'src',
    children: [
      { id: 'app', label: 'app', children: [{ id: 'main', label: 'main.ts' }] },
      { id: 'styles', label: 'styles.css' },
    ],
  },
];

async function setup(extra: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvTreeViewComponent, {
    inputs: { nodes: NODES, ...extra },
  });
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const toggleNames = (el: HTMLElement): string[] =>
  [...el.querySelectorAll<HTMLElement>('[role="treeitem"] button')]
    .map((b) => b.getAttribute('aria-label'))
    .filter((n): n is string => !!n);

describe('SvTreeViewComponent — the tree region takes a name', () => {
  it('names the region when it is given a label', async () => {
    const { el } = await setup({ ariaLabel: 'Project files' });
    expect(el.querySelector('[role="tree"]')?.getAttribute('aria-label')).toBe('Project files');
  });

  /** ★ And invents nothing when unset — "Tree" would only repeat the role. */
  it('adds no name of its own making', async () => {
    const { el } = await setup();
    expect(el.querySelector('[role="tree"]')?.hasAttribute('aria-label')).toBe(false);
  });

  it('treats a whitespace label as no label', async () => {
    const { el } = await setup({ ariaLabel: '   ' });
    expect(el.querySelector('[role="tree"]')?.hasAttribute('aria-label')).toBe(false);
  });
});

describe('SvTreeViewComponent — every toggle says what it toggles', () => {
  /**
   * ★★★ EVERY CHEVRON WAS NAMED "EXPAND". Walking a folder tree by its buttons
   *     gave "Expand, Expand, Expand" — the one fact a listener needs from a
   *     toggle is which branch it opens, and the icon inside it is `aria-hidden`.
   */
  it('names each toggle after its own node', async () => {
    const { el } = await setup();
    expect(toggleNames(el)).toEqual(['Expand src']);
  });

  it('keeps the names distinct once a branch is open', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.toggle(NODES[0]);
    fixture.detectChanges();

    const names = toggleNames(el);
    expect(names).toContain('Collapse src');
    expect(names).toContain('Expand app');
    expect(new Set(names).size).toBe(names.length);
  });

  it('flips to Collapse for the branch that is open', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.toggle(NODES[0]);
    fixture.detectChanges();
    expect(toggleNames(el)[0]).toBe('Collapse src');
  });
});
