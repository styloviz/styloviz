declare const ngDevMode: boolean | undefined;

/**
 * ============================================================================
 *  A hierarchy that cannot be walked (audit items DD-45-I4, DD-45-M3)
 * ============================================================================
 *
 * Every tree component in the kit walks `children` recursively — to flatten the
 * visible rows, to seed expansion, to roll a checkbox up to its ancestors, to
 * find a node before moving it. All of that is correct for a tree and none of it
 * terminates on a graph.
 *
 * A cycle is not an exotic input. It is what a host produces the ordinary way:
 * rows arrive flat with a `parentId`, the host builds `children` by looking each
 * parent up in a map, and one row's `parentId` points at its own descendant —
 * because someone dragged a folder into itself in another client, or a migration
 * reparented a row, or the id is a slug two rows share. The tree then recurses
 * until the stack ends and the whole tab dies. There is no error boundary in
 * front of that and nothing in the type system that could have said so.
 *
 * So the tree does not walk what it was given. It walks the result of this
 * function: the same tree with every back-edge cut, plus the list of nodes whose
 * children were dropped. Rendering a truncated branch and saying so is strictly
 * better than rendering nothing and taking the page with it.
 * ============================================================================
 */

/** The shape this walks: an identified node with optional nested children. */
export interface SvHierarchyNode {
  readonly id: string;
  children?: SvHierarchyNode[];
}

/**
 * How to read a node that is not shaped like {@link SvHierarchyNode}.
 *
 * The treemap is the second consumer of this walk and its nodes carry a `label`
 * rather than an `id`, with a `readonly` child array. Rather than a second
 * cycle-cutter that could disagree with this one about what a cycle is, the walk
 * takes accessors and there stays exactly one answer.
 */
export interface SvHierarchyAccessors<T> {
  /** Names the node in the cycle report and in the dev warning. */
  readonly label: (node: T) => string;
  /** The node's children, if it has any. */
  readonly children: (node: T) => readonly T[] | undefined;
  /** Rebuilds a node around a new child list. Only called on a branch that was cut. */
  readonly withChildren: (node: T, children: readonly T[]) => T;
}

const DEFAULT_ACCESSORS: SvHierarchyAccessors<SvHierarchyNode> = {
  label: node => node.id,
  children: node => node.children,
  withChildren: (node, children) => ({ ...node, children: [...children] }),
};

/** One node that was its own ancestor. */
export interface SvHierarchyCycle {
  /** The repeated node's id. */
  readonly id: string;
  /** Ids from the root down to the repeat, so the loop can be found in the data. */
  readonly path: readonly string[];
}

/** A tree that is safe to recurse into, and what had to be cut to make it one. */
export interface SvAcyclicHierarchy<T> {
  /**
   * The tree with each back-edge removed. The very same arrays and objects when
   * there was no cycle, so the common case allocates nothing and a host's
   * `[nodes]` identity survives for change detection.
   */
  readonly nodes: readonly T[];
  /** Empty when the input was already a tree. */
  readonly cycles: readonly SvHierarchyCycle[];
}

/** One warning per selector, so a 5,000-node tree logs once rather than per row. */
const warned = new Set<string>();

/**
 * The tree with every cycle cut, and the cuts that were made.
 *
 * Detection is by node **identity**, not by id: a repeated object reference is
 * what makes the recursion infinite, and it is the only thing that does. Two
 * distinct objects sharing an id nest finitely — that is a duplicate-key defect,
 * which {@link warnOnDuplicateItemKeys} already reports, and cutting it here
 * would silently drop a branch a host meant to render twice.
 *
 * A cut node keeps its place and its label and loses only its children, which is
 * the honest rendering: the loop means its subtree is not a subtree.
 *
 * @param nodes    Root nodes, as supplied by the host.
 * @param selector Component selector, used to name the source in the warning.
 */
export function svCutHierarchyCycles<T extends SvHierarchyNode>(
  nodes: readonly T[],
  selector: string,
): SvAcyclicHierarchy<T>;
export function svCutHierarchyCycles<T>(
  nodes: readonly T[],
  selector: string,
  accessors: SvHierarchyAccessors<T>,
): SvAcyclicHierarchy<T>;
export function svCutHierarchyCycles<T>(
  nodes: readonly T[],
  selector: string,
  accessors?: SvHierarchyAccessors<T>,
): SvAcyclicHierarchy<T> {
  const read = (accessors ??
    (DEFAULT_ACCESSORS as unknown as SvHierarchyAccessors<T>));
  const cycles: SvHierarchyCycle[] = [];
  const onPath = new Set<T>();
  const labels: string[] = [];

  /** Returns the rebuilt level, or `null` when nothing at or below it changed. */
  const walk = (level: readonly T[]): T[] | null => {
    let changed = false;
    const out: T[] = [];

    for (const node of level) {
      if (onPath.has(node)) {
        cycles.push({ id: read.label(node), path: [...labels] });
        // Drop the repeat entirely rather than keeping it childless: it is the
        // SAME node already on screen higher up, and a second copy of a row the
        // user is looking at reads as two things that exist.
        changed = true;
        continue;
      }

      const children = read.children(node);
      if (!children?.length) {
        out.push(node);
        continue;
      }

      onPath.add(node);
      labels.push(read.label(node));
      const next = walk(children);
      labels.pop();
      onPath.delete(node);

      if (next === null) {
        out.push(node);
      } else {
        out.push(read.withChildren(node, next));
        changed = true;
      }
    }

    return changed ? out : null;
  };

  const safe = walk(nodes) ?? nodes;

  if (cycles.length && typeof ngDevMode !== 'undefined' && ngDevMode && !warned.has(selector)) {
    warned.add(selector);
    const first = cycles[0];
    console.warn(
      `[styloviz] ${selector}: [nodes] contains ${cycles.length} cycle(s) — ` +
        `"${first.id}" is its own descendant, reached via ${first.path.join(' → ')}. ` +
        'Those branches are cut so the tree can be rendered; walking them would ' +
        'recurse until the stack ends. This is almost always a parentId that points ' +
        'at a descendant, or two rows sharing an id.',
    );
  }

  return { nodes: safe, cycles };
}
