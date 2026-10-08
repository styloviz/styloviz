import { svCutHierarchyCycles, type SvHierarchyNode } from './hierarchy';

/**
 * The premise worth stating: every assertion below that says "does not throw"
 * would be a dead tab without this function. A recursive walk of `children` has
 * no reason to stop on a graph, and a tree component is nothing but recursive
 * walks of `children`.
 */

interface Node extends SvHierarchyNode {
  readonly id: string;
  readonly label?: string;
  children?: Node[];
}

const ids = (nodes: readonly SvHierarchyNode[]): string[] => {
  const out: string[] = [];
  const walk = (level: readonly SvHierarchyNode[]): void => {
    for (const n of level) {
      out.push(n.id);
      if (n.children) walk(n.children);
    }
  };
  walk(nodes);
  return out;
};

describe('svCutHierarchyCycles — an acyclic tree is returned untouched', () => {
  it('returns the very same arrays and objects, so nothing re-renders', () => {
    const leaf: Node = { id: 'c' };
    const branch: Node = { id: 'b', children: [leaf] };
    const roots: Node[] = [{ id: 'a', children: [branch] }];

    const result = svCutHierarchyCycles(roots, 'sv-test');

    expect(result.cycles).toEqual([]);
    expect(result.nodes).toBe(roots);
    expect(result.nodes[0].children![0]).toBe(branch);
  });

  it('handles an empty tree and childless roots', () => {
    expect(svCutHierarchyCycles([], 'sv-test').nodes).toEqual([]);
    const flat: Node[] = [{ id: 'a' }, { id: 'b' }];
    expect(svCutHierarchyCycles(flat, 'sv-test').nodes).toBe(flat);
  });

  /**
   * A node reachable from two parents is a DAG, not a cycle: the walk still
   * terminates. It is a duplicate-id defect, which `warnOnDuplicateItemKeys`
   * reports — and cutting it here would drop a branch the host meant to show.
   */
  it('leaves a shared child alone — reached twice is not a loop', () => {
    const shared: Node = { id: 'shared' };
    const roots: Node[] = [
      { id: 'a', children: [shared] },
      { id: 'b', children: [shared] },
    ];

    const result = svCutHierarchyCycles(roots, 'sv-test');

    expect(result.cycles).toEqual([]);
    expect(ids(result.nodes)).toEqual(['a', 'shared', 'b', 'shared']);
  });
});

describe('svCutHierarchyCycles — the loops that end a tab', () => {
  /** The one a host writes by hand: a node listed among its own children. */
  it('cuts a self-reference', () => {
    const self: Node = { id: 'a' };
    self.children = [self];

    const result = svCutHierarchyCycles([self], 'sv-test');

    expect(result.cycles).toEqual([{ id: 'a', path: ['a'] }]);
    expect(ids(result.nodes)).toEqual(['a']);
    expect(result.nodes[0].children).toEqual([]);
  });

  /** The one a parentId map produces: a grandchild pointing back at the root. */
  it('cuts a longer loop and names the path that reached it', () => {
    const a: Node = { id: 'a' };
    const b: Node = { id: 'b' };
    const c: Node = { id: 'c' };
    a.children = [b];
    b.children = [c];
    c.children = [a];

    const result = svCutHierarchyCycles([a], 'sv-test');

    expect(result.cycles).toEqual([{ id: 'a', path: ['a', 'b', 'c'] }]);
    expect(ids(result.nodes)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the tree it was given', () => {
    const a: Node = { id: 'a' };
    a.children = [a];

    svCutHierarchyCycles([a], 'sv-test');

    expect(a.children).toHaveLength(1);
    expect(a.children![0]).toBe(a);
  });

  /**
   * ★★★ THE ASSERTION THE WHOLE FILE EXISTS FOR.
   *
   * Walking the input directly is a `RangeError: Maximum call stack size
   * exceeded` — not a caught error, not a rendered fallback, the tab.
   */
  it('terminates where a plain recursive walk does not', () => {
    const a: Node = { id: 'a' };
    const b: Node = { id: 'b' };
    a.children = [b];
    b.children = [a];

    const naive = (level: readonly Node[]): number =>
      level.reduce((n, node) => n + 1 + (node.children ? naive(node.children) : 0), 0);
    expect(() => naive([a])).toThrow(RangeError);

    const result = svCutHierarchyCycles([a], 'sv-test');
    expect(() => naive(result.nodes as Node[])).not.toThrow();
    expect(naive(result.nodes as Node[])).toBe(2);
  });

  it('cuts every loop in a tree that has several', () => {
    const a: Node = { id: 'a' };
    const b: Node = { id: 'b' };
    a.children = [a];
    b.children = [b];

    const result = svCutHierarchyCycles([a, b], 'sv-test');

    expect(result.cycles.map((c) => c.id)).toEqual(['a', 'b']);
    expect(ids(result.nodes)).toEqual(['a', 'b']);
  });

  /**
   * A loop lower down must not cost the branches beside it. The cut is per
   * back-edge, and an untouched sibling keeps its original object so change
   * detection sees no change where there was none.
   */
  it('keeps the siblings of a cut branch, by reference', () => {
    const ok: Node = { id: 'ok', children: [{ id: 'ok-child' }] };
    const loop: Node = { id: 'loop' };
    loop.children = [loop];
    const roots: Node[] = [{ id: 'root', children: [ok, loop] }];

    const result = svCutHierarchyCycles(roots, 'sv-test');

    expect(ids(result.nodes)).toEqual(['root', 'ok', 'ok-child', 'loop']);
    expect(result.nodes[0].children![0]).toBe(ok);
    expect(result.nodes).not.toBe(roots);
  });
});

describe('svCutHierarchyCycles — the warning', () => {
  it('names the node, the path and the likely cause, once per selector', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const a: Node = { id: 'team-a' };
    const b: Node = { id: 'team-b' };
    a.children = [b];
    b.children = [a];

    svCutHierarchyCycles([a], 'sv-warn-once-test');
    svCutHierarchyCycles([a], 'sv-warn-once-test');

    expect(warn).toHaveBeenCalledTimes(1);
    const message = warn.mock.calls[0][0] as string;
    expect(message).toContain('sv-warn-once-test');
    expect(message).toContain('"team-a" is its own descendant');
    expect(message).toContain('team-a → team-b');
    expect(message).toContain('parentId');
    warn.mockRestore();
  });

  it('says nothing for a tree', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    svCutHierarchyCycles([{ id: 'a', children: [{ id: 'b' }] }], 'sv-quiet-test');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

/**
 * The accessor form, added for the treemap.
 *
 * A treemap node carries a `label` rather than an `id` and a `readonly` child
 * array, so it cannot satisfy `SvHierarchyNode`. Passing accessors keeps ONE
 * definition of what a cycle is — the alternative was a second cutter in the
 * charts package, and two of those that disagree is the defect this file exists
 * to prevent.
 */
describe('svCutHierarchyCycles — reading a differently shaped node', () => {
  interface Tile {
    readonly label: string;
    readonly value: number;
    readonly children?: readonly Tile[];
  }

  const readTile = {
    label: (t: Tile) => t.label,
    children: (t: Tile) => t.children,
    withChildren: (t: Tile, children: readonly Tile[]) => ({ ...t, children }),
  };

  it('leaves a plain tree untouched, by identity', () => {
    const nodes: Tile[] = [
      { label: 'root', value: 10, children: [{ label: 'leaf', value: 4 }] },
    ];
    const cut = svCutHierarchyCycles(nodes, 'sv-treemap-chart', readTile);
    expect(cut.cycles).toEqual([]);
    expect(cut.nodes).toBe(nodes);
  });

  it('cuts a node that is its own descendant', () => {
    const parent: { label: string; value: number; children: Tile[] } = {
      label: 'Technology',
      value: 100,
      children: [],
    };
    parent.children.push({ label: 'Cloud', value: 40, children: [parent] });

    const cut = svCutHierarchyCycles<Tile>([parent], 'sv-treemap-chart', readTile);
    expect(cut.cycles).toHaveLength(1);
    expect(cut.cycles[0].id).toBe('Technology');
    expect(cut.cycles[0].path).toEqual(['Technology', 'Cloud']);
    // The branch is truncated, not dropped: Cloud is still a tile, with no children.
    const cloud = cut.nodes[0].children![0];
    expect(cloud.label).toBe('Cloud');
    expect(cloud.children).toEqual([]);
  });

  it('reports the path down to the repeat so the loop can be found', () => {
    const a: { label: string; value: number; children: Tile[] } = { label: 'a', value: 1, children: [] };
    const b: { label: string; value: number; children: Tile[] } = { label: 'b', value: 1, children: [] };
    a.children.push(b);
    b.children.push(a);

    const cut = svCutHierarchyCycles<Tile>([a], 'sv-path-test', readTile);
    expect(cut.cycles[0].path).toEqual(['a', 'b']);
  });

  it('terminates on a node that is its own direct child', () => {
    const self: { label: string; value: number; children: Tile[] } = {
      label: 'self',
      value: 5,
      children: [],
    };
    self.children.push(self);
    const cut = svCutHierarchyCycles<Tile>([self], 'sv-self-test', readTile);
    expect(cut.cycles).toHaveLength(1);
    expect(cut.nodes[0].children).toEqual([]);
  });

  it('keeps two distinct nodes that share a label', () => {
    // "Other" under two different parents is ordinary treemap data, not a cycle.
    const nodes: Tile[] = [
      { label: 'Tech', value: 10, children: [{ label: 'Other', value: 2 }] },
      { label: 'Health', value: 8, children: [{ label: 'Other', value: 1 }] },
    ];
    const cut = svCutHierarchyCycles(nodes, 'sv-dupe-label-test', readTile);
    expect(cut.cycles).toEqual([]);
    expect(cut.nodes).toBe(nodes);
  });
});
