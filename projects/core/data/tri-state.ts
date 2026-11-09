/**
 * Tri-state selection over a tree: tick down, roll up, and what "partly" means.
 *
 * ── Why this is in core (`FI-05-M2`, `FI-06-V1`, Data Display's `DD-45`) ────
 *
 * ★★★ THE BACKLOG SAYS "ONE OWNER" ABOUT THESE THREE ITEMS AND IT IS RIGHT.
 *     `sv-tree-view` already had a correct implementation, `sv-tree-select`
 *     had none, and a checkbox tree was filed a third time under Data Display.
 *     Three copies of this algorithm is three chances to get the `disabled`
 *     rule subtly different — and that rule is the one with teeth.
 *
 * ── ★★★ THE RULE THAT MATTERS: `disabled` IS THE WHOLE RULE, DOWN AND UP ───
 *
 * `sv-tree-view` shipped a version that reached past `disabled`: the box of a
 * disabled node was correctly refused, and then its PARENT'S box ticked it
 * anyway. A read-only row the user could not have selected arrived in the
 * change event regardless, and the host granted, exported or deleted on that
 * basis. This module carries that fix rather than inviting each caller to
 * rediscover it.
 *
 *   DOWN  a tick reaches every **enabled** descendant; a disabled one keeps the
 *         state it had, whichever direction the parent moved.
 *   UP    a branch is ticked when every enabled child is, **indeterminate**
 *         while only some are, and a branch whose children are all disabled
 *         follows only its own box.
 *
 * ⚠️ THESE FUNCTIONS TAKE A SHAPE, NOT A COMPONENT'S NODE TYPE.
 *    `sv-tree-view` keys on `id`, `sv-tree-select` on `value`, and the Data
 *    Display tree on neither yet. A `keyOf` accessor is the seam; a shared
 *    interface would have forced two components to rename their public fields
 *    to reuse an internal algorithm.
 */

export interface SvTriStateAdapter<T> {
  /** This node's stable identity. */
  keyOf(node: T): string;
  /** Children, or nothing for a leaf. */
  childrenOf(node: T): readonly T[] | undefined;
  /** `true` when the user cannot change this node's own box. */
  disabledOf(node: T): boolean;
}

/**
 * The keys a tick on `node` may reach.
 *
 * ★ A disabled node AND ITS WHOLE SUBTREE are skipped. Descending through a
 *   disabled branch to reach enabled grandchildren would let a parent tick
 *   something the user cannot see a path to, which is the same defect one level
 *   deeper.
 */
export function svCheckableDescendants<T>(node: T, a: SvTriStateAdapter<T>): string[] {
  return (a.childrenOf(node) ?? [])
    .filter((c) => !a.disabledOf(c))
    .flatMap((c) => [a.keyOf(c), ...svCheckableDescendants(c, a)]);
}

/**
 * Toggle `node`, cascade down, and roll every ancestor up. Returns a new Set.
 *
 * ⚠️ IT RETURNS A NEW SET rather than mutating. The caller usually holds the
 *    old one in a signal, and a mutated Set is the same reference — so nothing
 *    re-renders and the bug looks like a template problem.
 */
export function svToggleTriState<T>(
  roots: readonly T[],
  node: T,
  checked: ReadonlySet<string>,
  a: SvTriStateAdapter<T>,
): Set<string> {
  const next = new Set(checked);
  if (a.disabledOf(node)) return next;

  const key = a.keyOf(node);
  const descendants = svCheckableDescendants(node, a);

  if (next.has(key)) {
    next.delete(key);
    for (const d of descendants) next.delete(d);
  } else {
    next.add(key);
    for (const d of descendants) next.add(d);
  }

  svRollUpTriState(roots, next, a);
  return next;
}

/**
 * Bring every branch into line with its enabled children. Mutates `checked`.
 *
 * ★★ DEPTH FIRST, because a branch's own state depends on children that are
 *    themselves branches. Rolling up in the wrong order settles a parent
 *    against children that have not been settled yet, and the result is stable
 *    but wrong — which is the worst kind, since re-running does not fix it.
 */
export function svRollUpTriState<T>(
  nodes: readonly T[],
  checked: Set<string>,
  a: SvTriStateAdapter<T>,
): void {
  for (const n of nodes) {
    const kids = a.childrenOf(n);
    if (!kids?.length) continue;
    svRollUpTriState(kids, checked, a);

    // Nothing enabled below to complete the set, or the branch itself is
    // locked: its box stands for the branch alone, so a roll-up must not move
    // it. Otherwise a folder of read-only children could never be ticked, and
    // clicking its box would have looked broken.
    const rollUp = kids.filter((c) => !a.disabledOf(c));
    if (!rollUp.length || a.disabledOf(n)) continue;

    if (rollUp.every((c) => checked.has(a.keyOf(c)))) checked.add(a.keyOf(n));
    else checked.delete(a.keyOf(n));
  }
}

/**
 * The branches that are partly selected.
 *
 * ★★ A BRANCH IS INDETERMINATE IF ANY DESCENDANT IS CHECKED **OR
 *    INDETERMINATE** — which is why this walks depth first and reads its own
 *    result set as it goes. Checking only immediate children makes a
 *    grandparent look empty while a grandchild is ticked, and the user sees a
 *    blank box above a half-filled one.
 */
export function svIndeterminateKeys<T>(
  roots: readonly T[],
  checked: ReadonlySet<string>,
  a: SvTriStateAdapter<T>,
): Set<string> {
  const result = new Set<string>();

  const walk = (nodes: readonly T[]): void => {
    for (const n of nodes) {
      const kids = a.childrenOf(n);
      if (!kids?.length) continue;
      walk(kids);

      const rollUp = kids.filter((c) => !a.disabledOf(c));
      if (!rollUp.length) continue;

      const some = rollUp.some((c) => checked.has(a.keyOf(c)) || result.has(a.keyOf(c)));
      const all = rollUp.every((c) => checked.has(a.keyOf(c)));
      if (some && !all) result.add(a.keyOf(n));
    }
  };

  walk(roots);
  return result;
}

/**
 * Re-apply a ticked branch to children that have only just arrived.
 *
 * ★★ A LAZY BRANCH HAS NO CHILDREN TO REACH WHEN IT IS TICKED, so the tick
 *    stands for a set the component cannot see. When the load lands, the folder
 *    is ticked and every file in it is not — while the change event has already
 *    told the host "the whole folder", which is what the user meant. A ticked
 *    branch must cascade to whatever turns up inside it.
 *
 * @returns `true` when anything changed, so a caller can skip an emit.
 */
export function svCascadeToNewChildren<T>(
  roots: readonly T[],
  checked: Set<string>,
  a: SvTriStateAdapter<T>,
): boolean {
  if (!checked.size) return false;
  const before = checked.size;

  const cascade = (nodes: readonly T[], inherited: boolean): void => {
    for (const n of nodes) {
      const key = a.keyOf(n);
      const mine = inherited && !a.disabledOf(n);
      if (mine) checked.add(key);
      const kids = a.childrenOf(n);
      if (kids?.length) cascade(kids, mine || checked.has(key));
    }
  };

  cascade(roots, false);
  return checked.size !== before;
}
