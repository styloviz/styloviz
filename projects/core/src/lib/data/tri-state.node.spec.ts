import {
  svCheckableDescendants, svToggleTriState, svRollUpTriState,
  svIndeterminateKeys, svCascadeToNewChildren, type SvTriStateAdapter,
} from './tri-state';

/**
 * ============================================================================
 *  Tri-state selection over a tree  ·  `FI-05-M2` / `FI-06-V1` / `DD-45`
 * ============================================================================
 *
 * ★★★ THE BACKLOG SAYS "ONE OWNER" ABOUT THESE THREE ITEMS AND IT IS RIGHT.
 *     `sv-tree-view` already had a correct implementation, `sv-tree-select` had
 *     none, and a checkbox tree was filed a third time under Data Display.
 *     Three copies is three chances to get the `disabled` rule subtly
 *     different — and that rule is the one with teeth.
 *
 * ★★★ `sv-tree-view` SHIPPED A VERSION THAT REACHED PAST `disabled`: the box of
 *     a disabled node was correctly refused, and then its PARENT'S box ticked
 *     it anyway. A read-only row the user could not have selected arrived in
 *     the change event regardless, and the host granted, exported or deleted on
 *     that basis. This module carries the fix so nobody rediscovers it.
 */

interface N { id: string; kids?: N[]; off?: boolean }

const A: SvTriStateAdapter<N> = {
  keyOf: (n) => n.id,
  childrenOf: (n) => n.kids,
  disabledOf: (n) => !!n.off,
};

//  root
//  ├── a           (branch)
//  │   ├── a1
//  │   └── a2
//  └── b           (branch)
//      ├── b1
//      └── b2      (disabled)
const TREE = (): N[] => [
  { id: 'a', kids: [{ id: 'a1' }, { id: 'a2' }] },
  { id: 'b', kids: [{ id: 'b1' }, { id: 'b2', off: true }] },
];

const find = (roots: N[], id: string): N => {
  for (const n of roots) {
    if (n.id === id) return n;
    if (n.kids) { const hit = find(n.kids, id); if (hit) return hit; }
  }
  return undefined as unknown as N;
};

const sorted = (s: ReadonlySet<string>): string[] => [...s].sort();

describe('ticking down', () => {
  it('reaches every enabled descendant', () => {
    const t = TREE();
    expect(sorted(svToggleTriState(t, find(t, 'a'), new Set(), A))).toEqual(['a', 'a1', 'a2']);
  });

  it('does NOT reach a disabled descendant', () => {
    /**
     * ★★★ THE DEFECT THIS MODULE CARRIES THE FIX FOR. `b2` is read-only. A tick
     *     on `b` used to include it, and the host then acted on a row the user
     *     could not have selected.
     */
    const t = TREE();
    const out = svToggleTriState(t, find(t, 'b'), new Set(), A);
    expect(out.has('b1')).toBe(true);
    expect(out.has('b2')).toBe(false);
  });

  it('leaves a disabled descendant’s existing state alone when unticking', () => {
    // ⚠️ "Keeps the state it had, whichever direction the parent moved." A tick
    //    that cannot reach it must not be able to clear it either.
    const t = TREE();
    const out = svToggleTriState(t, find(t, 'b'), new Set(['b', 'b1', 'b2']), A);
    expect(out.has('b1')).toBe(false);
    expect(out.has('b2')).toBe(true);
  });

  it('refuses to toggle a disabled node itself', () => {
    const t = TREE();
    const before = new Set(['x']);
    expect(sorted(svToggleTriState(t, find(t, 'b2'), before, A))).toEqual(['x']);
  });

  it('does not descend through a disabled branch to its enabled children', () => {
    /**
     * ★★ THE SAME DEFECT ONE LEVEL DEEPER. Reaching grandchildren under a
     *    locked branch lets a parent tick something the user cannot see a path
     *    to.
     */
    const t: N[] = [{ id: 'p', kids: [{ id: 'locked', off: true, kids: [{ id: 'deep' }] }] }];
    expect(svCheckableDescendants(t[0], A)).toEqual([]);
  });

  it('returns a NEW set rather than mutating', () => {
    // ⚠️ The caller usually holds the old one in a signal, and a mutated Set is
    //    the same reference — so nothing re-renders and it looks like a
    //    template bug.
    const t = TREE();
    const before = new Set<string>();
    const after = svToggleTriState(t, find(t, 'a'), before, A);
    expect(before.size).toBe(0);
    expect(after).not.toBe(before);
  });
});

describe('rolling up', () => {
  it('ticks a branch once every enabled child is ticked', () => {
    const t = TREE();
    const checked = new Set(['a1', 'a2']);
    svRollUpTriState(t, checked, A);
    expect(checked.has('a')).toBe(true);
  });

  it('ticks a branch whose only unticked child is DISABLED', () => {
    /**
     * ★★ `b2` is read-only, so "every child the user could tick" is just `b1`.
     *    A branch that could never be completed would be a checkbox that does
     *    nothing, which is how this rule gets quietly dropped.
     */
    const t = TREE();
    const checked = new Set(['b1']);
    svRollUpTriState(t, checked, A);
    expect(checked.has('b')).toBe(true);
  });

  it('unticks a branch when a child goes', () => {
    const t = TREE();
    const checked = new Set(['a', 'a1', 'a2']);
    checked.delete('a2');
    svRollUpTriState(t, checked, A);
    expect(checked.has('a')).toBe(false);
  });

  it('leaves a branch with no enabled children to its own box', () => {
    const t: N[] = [{ id: 'p', kids: [{ id: 'c', off: true }] }];
    const checked = new Set(['p']);
    svRollUpTriState(t, checked, A);
    expect(checked.has('p')).toBe(true);
  });

  it('leaves a DISABLED branch to its own box', () => {
    const t: N[] = [{ id: 'p', off: true, kids: [{ id: 'c' }] }];
    const checked = new Set(['p']);
    svRollUpTriState(t, checked, A);
    expect(checked.has('p')).toBe(true);   // not cleared by its unticked child
  });

  it('settles grandchildren before their grandparents', () => {
    /**
     * ★★★ DEPTH FIRST, AND THIS IS THE TEST FOR IT. Rolling up in the wrong
     *     order settles a parent against children that have not been settled
     *     yet — and the result is STABLE but wrong, which is the worst kind,
     *     because re-running does not fix it.
     */
    const t: N[] = [{ id: 'gp', kids: [{ id: 'p', kids: [{ id: 'c1' }, { id: 'c2' }] }] }];
    const checked = new Set(['c1', 'c2']);
    svRollUpTriState(t, checked, A);
    expect(sorted(checked)).toEqual(['c1', 'c2', 'gp', 'p']);
  });
});

describe('what counts as partly selected', () => {
  it('marks a branch with some but not all children ticked', () => {
    const t = TREE();
    expect(sorted(svIndeterminateKeys(t, new Set(['a1']), A))).toEqual(['a']);
  });

  it('does NOT mark a fully ticked branch', () => {
    const t = TREE();
    expect(svIndeterminateKeys(t, new Set(['a1', 'a2']), A).has('a')).toBe(false);
  });

  it('marks a grandparent when only a grandchild is ticked', () => {
    /**
     * ★★★ A BRANCH IS INDETERMINATE IF ANY DESCENDANT IS CHECKED **OR
     *     INDETERMINATE**. Reading only immediate children makes a grandparent
     *     look empty while a grandchild is ticked — the user sees a blank box
     *     sitting above a half-filled one.
     */
    const t: N[] = [{ id: 'gp', kids: [{ id: 'p', kids: [{ id: 'c1' }, { id: 'c2' }] }] }];
    expect(sorted(svIndeterminateKeys(t, new Set(['c1']), A))).toEqual(['gp', 'p']);
  });

  it('ignores disabled children when deciding', () => {
    // `b2` cannot be ticked, so `b1` alone is "all of them" and `b` is full.
    const t = TREE();
    expect(svIndeterminateKeys(t, new Set(['b1']), A).has('b')).toBe(false);
  });

  it('is empty for an untouched tree', () => {
    expect(svIndeterminateKeys(TREE(), new Set(), A).size).toBe(0);
  });
});

describe('children that arrive later', () => {
  it('inherits a ticked branch’s state', () => {
    /**
     * ★★ A LAZY BRANCH HAS NO CHILDREN TO REACH WHEN IT IS TICKED, so the tick
     *    stands for a set the component cannot see. When the load lands the
     *    folder is ticked and every file in it is not — while the change event
     *    has already told the host "the whole folder", which is what the user
     *    meant.
     */
    const loaded: N[] = [{ id: 'a', kids: [{ id: 'a1' }, { id: 'a2' }] }];
    const checked = new Set(['a']);
    expect(svCascadeToNewChildren(loaded, checked, A)).toBe(true);
    expect(sorted(checked)).toEqual(['a', 'a1', 'a2']);
  });

  it('still does not reach a disabled arrival', () => {
    const loaded: N[] = [{ id: 'a', kids: [{ id: 'a1' }, { id: 'a2', off: true }] }];
    const checked = new Set(['a']);
    svCascadeToNewChildren(loaded, checked, A);
    expect(checked.has('a2')).toBe(false);
  });

  it('reports when nothing changed, so a caller can skip an emit', () => {
    const loaded: N[] = [{ id: 'a', kids: [{ id: 'a1' }] }];
    expect(svCascadeToNewChildren(loaded, new Set(['a', 'a1']), A)).toBe(false);
    expect(svCascadeToNewChildren(loaded, new Set(), A)).toBe(false);
  });

  it('does not tick children of an UNticked branch', () => {
    // ★ The control. A cascade that ran regardless would select the whole tree
    //   the first time any branch loaded.
    const loaded: N[] = [{ id: 'a', kids: [{ id: 'a1' }] }];
    const checked = new Set(['elsewhere']);
    svCascadeToNewChildren(loaded, checked, A);
    expect(checked.has('a1')).toBe(false);
  });
});
