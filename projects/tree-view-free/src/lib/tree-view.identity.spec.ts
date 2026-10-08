import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvTreeViewComponent, type TreeNode } from './tree-view.component';

/**
 * Node identity and state ownership (audit item X-6), free tier.
 *
 * The Pro twin shares no code with this one, so its `tree-view.identity.spec.ts`
 * asserts the same two promises separately: a host binding beats `node.expanded`,
 * and a duplicate id is reported before `@for` empties the tree with NG0955.
 *
 * ⚠ One warning per context, ever (module-level memo in `@styloviz/core`).
 */

const TREE: TreeNode[] = [
  { id: 'src', label: 'src', children: [{ id: 'util', label: 'util.ts' }] },
  { id: 'readme', label: 'README.md' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvTreeViewComponent, {
    inputs: { nodes: TREE, ...inputs },
  });
  return fixture;
}

const ids = (set: Set<string>) => [...set].sort();

describe('SvTreeViewComponent — who owns the expansion', () => {
  it('lets a host binding win over node.expanded', async () => {
    const flagged: TreeNode[] = [{ ...TREE[0], expanded: true }, TREE[1]];
    const f = await setup({ nodes: flagged, expandedIds: new Set(['readme']) });
    expect(ids(f.componentInstance.expandedIds())).toEqual(['readme']);
    expect(f.nativeElement.textContent).not.toContain('util.ts');
  });

  it('still honours node.expanded when the host binds nothing', async () => {
    const flagged: TreeNode[] = [{ ...TREE[0], expanded: true }, TREE[1]];
    const f = await setup({ nodes: flagged });
    expect(ids(f.componentInstance.expandedIds())).toEqual(['src']);
    expect(f.nativeElement.textContent).toContain('util.ts');
  });
});

describe('SvTreeViewComponent — duplicate ids', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('catches ids that only collide once the tree is flattened', async () => {
    await setup({
      expandedIds: new Set(['a', 'b']),
      nodes: [
        { id: 'a', label: 'A', children: [{ id: 'dup', label: 'A child' }] },
        { id: 'b', label: 'B', children: [{ id: 'dup', label: 'B child' }] },
      ],
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sv-tree-view [nodes]'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"dup"'));
  });

  it('says nothing about a well-formed tree', async () => {
    await setup({ expandedIds: new Set(['src']), ariaLabel: 'Files' });
    expect(warn).not.toHaveBeenCalled();
  });
});
