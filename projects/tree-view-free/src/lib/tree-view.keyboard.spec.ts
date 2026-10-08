import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { flush, until } from '@testing/async';
import { SvTreeViewComponent, type TreeNode } from './tree-view.component';

/**
 * ============================================================================
 *  Keyboard navigation — the WAI-ARIA tree pattern (free tier)
 * ============================================================================
 *
 * Adapted from `projects/tree-view/src/lib/tree-view.keyboard.spec.ts`, whose
 * Pro twin is already at 93.8%. The two implementations are NOT the same shape
 * and the differences were read out of both files rather than assumed:
 *
 *   • Pro exposes `focusedId()` and `onRowKeydown(event, flatNode)`; free
 *     exposes `activeId()` and `onKeydown(event, flatNode, index)` and drives
 *     DOM focus after the render turn (a macrotask) — hence the `flush()` calls here.
 *   • free clamps at both ends exactly as Pro does (a tree is not a carousel),
 *     and skips disabled rows on the way, which Pro's fixture never exercises
 *     because its tree has no disabled node.
 *
 * The two keys worth the most are the two that do different things depending
 * on where you are:
 *
 *   ArrowRight — on a CLOSED parent, opens it; on an OPEN one, steps into it;
 *                on a leaf, nothing.
 *   ArrowLeft  — on an OPEN parent, closes it; anywhere else, climbs to the
 *                parent row.
 *
 * Get either branch wrong and the tree still "works" for a mouse user.
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
  { id: 'docs', label: 'docs', disabled: true },
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

const el = (f: Fixture) => f.nativeElement as HTMLElement;
const visibleIds = (f: Fixture) => f.componentInstance.visibleNodes().map((n) => n.node.id);
const row = (f: Fixture, id: string) =>
  el(f).querySelector<HTMLElement>(`[data-tree-id="${id}"]`)!;

/** Press a key on the rendered row for `id`; returns whether the default was stopped. */
async function press(f: Fixture, key: string, id: string): Promise<boolean> {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  row(f, id).dispatchEvent(event);
  f.detectChanges();
  await flush(); // `_focus` moves DOM focus in a macrotask, after the render
  f.detectChanges();
  return event.defaultPrevented;
}

const active = (f: Fixture) => f.componentInstance.activeId();

describe('SvTreeViewComponent — moving between rows', () => {
  it('moves down and up the visible rows, and moves DOM focus with it', async () => {
    const f = await setup({ expandedIds: new Set(['src']) });
    expect(visibleIds(f)).toEqual(['src', 'app', 'util', 'docs', 'readme']);

    await press(f, 'ArrowDown', 'src');
    expect(active(f)).toBe('app');
    expect(document.activeElement).toBe(row(f, 'app'));

    await press(f, 'ArrowUp', 'app');
    expect(active(f)).toBe('src');
    expect(document.activeElement).toBe(row(f, 'src'));
  });

  it('steps over a disabled row in both directions', async () => {
    // `docs` sits between `util` and `readme`; arrowing must not park focus on
    // a row that cannot be selected or opened.
    const f = await setup({ expandedIds: new Set(['src']) });

    await press(f, 'ArrowDown', 'util');
    expect(active(f)).toBe('readme');

    await press(f, 'ArrowUp', 'readme');
    expect(active(f)).toBe('util');
  });

  it('clamps at the top and the bottom rather than wrapping', async () => {
    // The ends of a tree are ends. (This is the one place free and Pro agree
    // by design and the accordion deliberately differs.)
    const f = await setup();
    f.componentInstance.setActive('src');

    await press(f, 'ArrowUp', 'src');
    expect(active(f)).toBe('src');

    f.componentInstance.setActive('readme');
    await press(f, 'ArrowDown', 'readme');
    expect(active(f)).toBe('readme');
  });

  it('jumps to the first row on Home and the last on End', async () => {
    const f = await setup({ expandedIds: new Set(['src']) });

    await press(f, 'End', 'src');
    expect(active(f)).toBe('readme');

    await press(f, 'Home', 'readme');
    expect(active(f)).toBe('src');
  });

  it('lands on the nearest ENABLED row when an end is disabled', async () => {
    const f = await setup({
      nodes: [
        { id: 'first', label: 'first', disabled: true },
        { id: 'middle', label: 'middle' },
        { id: 'last', label: 'last', disabled: true },
      ] satisfies TreeNode[],
    });
    f.componentInstance.setActive('middle');

    await press(f, 'End', 'middle');
    expect(active(f)).toBe('middle');

    await press(f, 'Home', 'middle');
    expect(active(f)).toBe('middle');
  });

  it('moves nowhere at all when every row is disabled', async () => {
    const f = await setup({
      nodes: [
        { id: 'a', label: 'a', disabled: true },
        { id: 'b', label: 'b', disabled: true },
      ] satisfies TreeNode[],
    });
    f.componentInstance.setActive('a');

    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
      await press(f, key, 'a');
      expect(active(f)).toBe('a');
    }
  });
});

describe('SvTreeViewComponent — ArrowRight', () => {
  it('opens a closed parent without moving off it', async () => {
    const f = await setup();
    expect(visibleIds(f)).toEqual(['src', 'docs', 'readme']);

    await press(f, 'ArrowRight', 'src');
    expect(visibleIds(f)).toEqual(['src', 'app', 'util', 'docs', 'readme']);
    expect(active(f)).not.toBe('app');
  });

  it('steps into an already-open parent instead of opening it twice', async () => {
    const f = await setup({ expandedIds: new Set(['src']) });
    await press(f, 'ArrowRight', 'src');
    expect(active(f)).toBe('app');
    // Still open — the key must not have toggled it shut.
    expect(visibleIds(f)).toContain('app');
  });

  it('does nothing on a leaf', async () => {
    const f = await setup();
    f.componentInstance.setActive('readme');
    const prevented = await press(f, 'ArrowRight', 'readme');

    expect(prevented).toBe(true); // the key is still claimed by the tree
    expect(active(f)).toBe('readme');
    expect(visibleIds(f)).toEqual(['src', 'docs', 'readme']);
  });
});

describe('SvTreeViewComponent — ArrowLeft', () => {
  it('closes an open parent without moving off it', async () => {
    const f = await setup({ expandedIds: new Set(['src']) });
    await press(f, 'ArrowLeft', 'src');
    expect(visibleIds(f)).toEqual(['src', 'docs', 'readme']);
  });

  it('climbs to the parent row from a child', async () => {
    const f = await setup({ expandedIds: new Set(['src']) });
    await press(f, 'ArrowLeft', 'util');
    expect(active(f)).toBe('src');
  });

  it('climbs from a closed parent rather than trying to close it again', async () => {
    // `app` has children but is shut, so Left must behave like a leaf: climb.
    const f = await setup({ expandedIds: new Set(['src']) });
    await press(f, 'ArrowLeft', 'app');
    expect(active(f)).toBe('src');
    expect(visibleIds(f)).toContain('app');
  });

  it('stays put on a closed root, which has no parent to climb to', async () => {
    const f = await setup();
    f.componentInstance.setActive('readme');
    await press(f, 'ArrowLeft', 'readme');
    expect(active(f)).toBe('readme');
  });

  it('skips a whole subtree when climbing past siblings', async () => {
    const f = await setup({ expandedIds: new Set(['src', 'app']) });
    expect(visibleIds(f)).toEqual(['src', 'app', 'main', 'util', 'docs', 'readme']);

    // From `util` (depth 1) the nearest shallower row is `src`, not `main`.
    await press(f, 'ArrowLeft', 'util');
    expect(active(f)).toBe('src');
  });
});

describe('SvTreeViewComponent — activating a row', () => {
  it('selects on Enter and on Space, and takes the tab stop with it', async () => {
    for (const key of ['Enter', ' ']) {
      const f = await setup();
      const seen: TreeNode[] = [];
      f.componentInstance.nodeSelect.subscribe((n) => seen.push(n));

      const prevented = await press(f, key, 'readme');

      expect(prevented).toBe(true);
      expect(seen.map((n) => n.id)).toEqual(['readme']);
      expect(f.componentInstance.selectedId()).toBe('readme');
      expect(active(f)).toBe('readme');
    }
  });

  it('refuses to select a disabled row from the keyboard', async () => {
    const f = await setup();
    const seen: TreeNode[] = [];
    f.componentInstance.nodeSelect.subscribe((n) => seen.push(n));

    await press(f, 'Enter', 'docs');

    expect(seen).toEqual([]);
    expect(f.componentInstance.selectedId()).toBeNull();
  });

  it('leaves every other key to the page', async () => {
    // Typeahead, Tab and browser shortcuts all have to keep working.
    const f = await setup();
    const prevented = await press(f, 'a', 'src');
    expect(prevented).toBe(false);
    expect(visibleIds(f)).toEqual(['src', 'docs', 'readme']);
  });
});

describe('SvTreeViewComponent — the roving tab stop', () => {
  it('puts exactly one row in the tab order and moves it with the arrows', async () => {
    const f = await setup({ expandedIds: new Set(['src']) });
    const stops = () =>
      [...el(f).querySelectorAll('[data-tree-id]')].map((n) => n.getAttribute('tabindex'));

    expect(stops()).toEqual(['0', '-1', '-1', '-1', '-1']);

    await press(f, 'ArrowDown', 'src');
    expect(stops()).toEqual(['-1', '0', '-1', '-1', '-1']);
  });

  it('falls back to the first row when nothing is active', async () => {
    const f = await setup();
    // The seeding effect sets `activeId` on the first non-empty node set.
    expect(active(f)).toBe('src');
    expect(f.componentInstance.treeTabIndex('src')).toBe(0);
    expect(f.componentInstance.treeTabIndex('readme')).toBe(-1);

    // ★ `activeId` is a public writable signal, so a host can clear it — after
    // a filter, a reset, or restoring state from a URL. Without the fallback
    // every row would report `tabindex="-1"` and the whole tree would drop out
    // of the tab order with no way for the keyboard to get back into it.
    f.componentInstance.activeId.set(null);
    f.detectChanges();
    expect(f.componentInstance.treeTabIndex('src')).toBe(0);
    expect(
      [...el(f).querySelectorAll('[data-tree-id]')].map((n) => n.getAttribute('tabindex')),
    ).toEqual(['0', '-1', '-1']);
  });

  it('has no tab stop to give when the tree is empty', async () => {
    const f = await setup({ nodes: [] as TreeNode[] });
    expect(active(f)).toBeNull();
    expect(f.componentInstance.treeTabIndex('anything')).toBe(-1);
  });

  it('moves the tab stop when a row is clicked', async () => {
    const f = await setup();
    row(f, 'readme').click();
    f.detectChanges();
    expect(active(f)).toBe('readme');
  });
});

describe('SvTreeViewComponent — when DOM focus moves (DD-45-I3)', () => {
  /**
   * ★★ The row the keystroke moves to may not be in the DOM yet: here the host
   *    opened `src` in the same turn, so `app` renders only in the change
   *    detection that turn schedules. A microtask ran before that render and
   *    focused nothing; the macrotask lands after it.
   */
  it('focuses a row that only renders in the same turn as the keystroke', async () => {
    const f = await setup();
    expect(row(f, 'app')).toBeNull();

    f.componentInstance.expandedIds.set(new Set(['src']));
    row(f, 'src').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));

    await until(() => document.activeElement === row(f, 'app'), { label: 'focus to land on app' });
    expect(active(f)).toBe('app');
  });
});

describe('SvTreeViewComponent — aria-selected only where selection exists (DD-45-I1)', () => {
  it('publishes aria-selected on every row of a selectable tree', async () => {
    const f = await setup({ selectedId: 'readme' });
    expect(row(f, 'src').getAttribute('aria-selected')).toBe('false');
    expect(row(f, 'readme').getAttribute('aria-selected')).toBe('true');
  });

  it('publishes no aria-selected at all on a display-only tree', async () => {
    const f = await setup({ selectable: false });
    const rows = [...el(f).querySelectorAll<HTMLElement>('[role="treeitem"]')];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.hasAttribute('aria-selected')).toBe(false);
  });

  it('does not select on Enter when the tree is display-only', async () => {
    const f = await setup({ selectable: false });
    await press(f, 'Enter', 'readme');
    expect(row(f, 'readme').hasAttribute('aria-selected')).toBe(false);
  });
});
