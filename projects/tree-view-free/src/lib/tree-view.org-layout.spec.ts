import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { flush } from '@testing/async';
import { SvTreeViewComponent, type TreeNode } from './tree-view.component';

/**
 * ============================================================================
 *  The org layout (FL-F11) — top-down boxes joined by connector lines
 * ============================================================================
 *
 * The org layout is a PICTURE of the same tree, not a second widget. So this
 * file pins two things at once:
 *
 *   • the picture's structure — nested `role="group"`s under each box, a
 *     connector on every box below the root, logical sides only (RTL);
 *   • that the tree model did NOT change — the same roles, levels, set sizes,
 *     the same one tab stop, and the APG keys walking the same depth-first
 *     order the list layout walks, even though children now sit below their
 *     parent and siblings side by side.
 *
 * Pixels are not asserted: jsdom has no layout. Geometry is CSS borders on
 * logical sides, which is what the class assertions below hold in place.
 */

const ORG: TreeNode[] = [
  {
    id: 'ceo',
    label: 'Sarah Chen',
    role: 'Chief Executive Officer',
    department: 'Executive',
    expanded: true,
    children: [
      {
        id: 'eng',
        label: 'Marcus Reid',
        role: 'VP Engineering',
        expanded: true,
        children: [{ id: 'fe', label: 'Priya Nair', role: 'Frontend Lead' }],
      },
      { id: 'design', label: 'Nina Scholz', role: 'Head of Design', badge: '4' },
      {
        id: 'sales',
        label: 'James Osei',
        role: 'VP Sales',
        children: [{ id: 'ae', label: 'Sofia Ruiz', role: 'Account Executive' }],
      },
    ],
  },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvTreeViewComponent, {
    inputs: { nodes: ORG, layout: 'org', ariaLabel: 'Leadership', ...inputs },
  });
  // Twice: the first pass seeds `expandedIds` from the `expanded` flags, the
  // second renders the boxes that seeding opened.
  fixture.detectChanges();
  fixture.detectChanges();
  return fixture;
}

type Fixture = Awaited<ReturnType<typeof setup>>;

const el = (f: Fixture) => f.nativeElement as HTMLElement;
const item = (f: Fixture, id: string) =>
  el(f).querySelector<HTMLElement>(`[role="treeitem"][data-tree-id="${id}"]`);
const ids = (f: Fixture) =>
  Array.from(el(f).querySelectorAll<HTMLElement>('[role="treeitem"]')).map((n) => n.dataset['treeId']);

async function press(f: Fixture, key: string, id: string): Promise<void> {
  item(f, id)!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  f.detectChanges();
  await flush();
  f.detectChanges();
}

describe('SvTreeViewComponent — org layout: the tree', () => {
  it('renders a named scroll region holding one role="tree", not the list rows', async () => {
    const f = await setup();
    const region = el(f).querySelector('[data-sv-tree-layout="org"]')!;
    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(region.getAttribute('aria-label')).toBe('Leadership');
    const trees = el(f).querySelectorAll('[role="tree"]');
    expect(trees.length).toBe(1);
    expect(trees[0].tagName).toBe('UL');
    expect(trees[0].getAttribute('aria-label')).toBe('Leadership');
  });

  it('falls back to "Org chart" for the region when the tree is unnamed', async () => {
    const f = await setup({ ariaLabel: '' });
    expect(el(f).querySelector('[data-sv-tree-layout="org"]')!.getAttribute('aria-label')).toBe('Org chart');
  });

  it('nests each box’s children in a role="group" inside its treeitem', async () => {
    const f = await setup();
    const ceo = item(f, 'ceo')!;
    const reports = ceo.querySelectorAll(':scope > [role="group"] > [role="treeitem"]');
    expect(Array.from(reports).map((n) => (n as HTMLElement).dataset['treeId'])).toEqual(['eng', 'design', 'sales']);
    expect(item(f, 'eng')!.querySelector(':scope > [role="group"] > [data-tree-id="fe"]')).not.toBeNull();
  });

  it('publishes level, set size and position for every box', async () => {
    const f = await setup();
    const attrs = (id: string) => {
      const n = item(f, id)!;
      return [n.getAttribute('aria-level'), n.getAttribute('aria-setsize'), n.getAttribute('aria-posinset')];
    };
    expect(attrs('ceo')).toEqual(['1', '1', '1']);
    expect(attrs('eng')).toEqual(['2', '3', '1']);
    expect(attrs('design')).toEqual(['2', '3', '2']);
    expect(attrs('sales')).toEqual(['2', '3', '3']);
    expect(attrs('fe')).toEqual(['3', '1', '1']);
  });

  it('names a box by what it shows, not by its whole subtree', async () => {
    const f = await setup();
    expect(item(f, 'ceo')!.getAttribute('aria-label')).toBe('Sarah Chen, Chief Executive Officer, Executive');
    expect(item(f, 'design')!.getAttribute('aria-label')).toBe('Nina Scholz, Head of Design, 4');
  });

  it('keeps aria-expanded on branches only, and one tab stop for the whole chart', async () => {
    const f = await setup();
    expect(item(f, 'ceo')!.getAttribute('aria-expanded')).toBe('true');
    expect(item(f, 'sales')!.getAttribute('aria-expanded')).toBe('false');
    expect(item(f, 'design')!.hasAttribute('aria-expanded')).toBe(false);
    const stops = Array.from(el(f).querySelectorAll('[role="treeitem"]')).filter((n) => n.getAttribute('tabindex') === '0');
    expect(stops.length).toBe(1);
  });
});

describe('SvTreeViewComponent — org layout: connectors', () => {
  const halves = (f: Fixture, id: string) => {
    const c = item(f, id)!.querySelector(':scope > [data-sv-org-connector]')!;
    const [start, end] = Array.from(c.children) as HTMLElement[];
    return { start: start.className, end: end.className };
  };

  it('hangs every box below the root from a connector, and the root from none', async () => {
    const f = await setup();
    expect(item(f, 'ceo')!.querySelector(':scope > [data-sv-org-connector]')).toBeNull();
    for (const id of ['eng', 'design', 'sales', 'fe']) {
      expect(item(f, id)!.querySelector(':scope > [data-sv-org-connector]')).not.toBeNull();
    }
    expect(item(f, 'ceo')!.querySelector(':scope > [data-sv-org-stem]')).not.toBeNull();
  });

  it('draws the sibling bar between first and last child, and only the drop for an only child', async () => {
    const f = await setup();
    const first = halves(f, 'eng');
    expect(first.start).not.toMatch(/\bborder-t\b/);
    expect(first.end).toMatch(/\bborder-t\b/);
    expect(first.end).toMatch(/\bborder-s\b/);

    const middle = halves(f, 'design');
    expect(middle.start).toMatch(/\bborder-t\b/);
    expect(middle.end).toMatch(/\bborder-t\b/);

    const last = halves(f, 'sales');
    expect(last.start).toMatch(/\bborder-t\b/);
    expect(last.start).toMatch(/\bborder-e\b/);
    expect(last.end).not.toMatch(/\bborder-t\b/);

    const only = halves(f, 'fe');
    expect(only.start).not.toMatch(/\bborder-t\b/);
    expect(only.end).toMatch(/\bborder-s\b/);
    expect(only.end).not.toMatch(/\bborder-t\b/);
  });

  it('mirrors in RTL because every side is logical — no left/right utility anywhere in the chart', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(
      `<div dir="rtl"><sv-tree-view layout="org" ariaLabel="Leadership" [nodes]="nodes" /></div>`,
      { imports: [SvTreeViewComponent], componentProperties: { nodes: ORG } },
    );
    fixture.detectChanges();
    fixture.detectChanges();
    const chart = (fixture.nativeElement as HTMLElement).querySelector('[data-sv-tree-layout="org"]')!;
    const classes = Array.from(chart.querySelectorAll<HTMLElement>('*')).map((n) => n.getAttribute('class') ?? '').join(' ');
    expect(classes).toMatch(/\bstart-0\b/);
    expect(classes).toMatch(/\bend-0\b/);
    expect(classes).not.toMatch(/(?:^|\s)-?(?:left|right|ml|mr|pl|pr)-|\bborder-[lr]\b|\brounded-[lr]|\brounded-[tb][lr]\b|\btext-(?:left|right)\b/);
  });
});

describe('SvTreeViewComponent — org layout: the APG keys, unchanged', () => {
  it('ArrowDown and ArrowUp walk the boxes depth-first, as the list does', async () => {
    const f = await setup();
    expect(ids(f)).toEqual(['ceo', 'eng', 'fe', 'design', 'sales']);
    await press(f, 'ArrowDown', 'ceo');
    expect(f.componentInstance.activeId()).toBe('eng');
    await press(f, 'ArrowDown', 'eng');
    expect(f.componentInstance.activeId()).toBe('fe');
    await press(f, 'ArrowUp', 'fe');
    expect(f.componentInstance.activeId()).toBe('eng');
  });

  it('answers on the focused box only — the key does not bubble into its ancestors', async () => {
    const f = await setup();
    // `fe` sits inside `eng`, inside `ceo`. Were their handlers to run too, the
    // outermost (ceo → eng) would win and focus would land back on `eng`.
    await press(f, 'ArrowDown', 'fe');
    expect(f.componentInstance.activeId()).toBe('design');
    expect(document.activeElement).toBe(item(f, 'design'));
  });

  it('ArrowRight opens a closed box, then steps into its first child', async () => {
    const f = await setup();
    expect(item(f, 'ae')).toBeNull();
    await press(f, 'ArrowRight', 'sales');
    expect(item(f, 'sales')!.getAttribute('aria-expanded')).toBe('true');
    expect(item(f, 'ae')).not.toBeNull();
    await press(f, 'ArrowRight', 'sales');
    expect(f.componentInstance.activeId()).toBe('ae');
  });

  it('ArrowLeft on a child climbs to its parent; on an open box it collapses the subtree', async () => {
    const f = await setup();
    await press(f, 'ArrowLeft', 'fe');
    expect(f.componentInstance.activeId()).toBe('eng');

    await press(f, 'ArrowLeft', 'eng');
    expect(item(f, 'eng')!.getAttribute('aria-expanded')).toBe('false');
    expect(item(f, 'fe')).toBeNull();
    expect(item(f, 'eng')!.querySelector('[role="group"]')).toBeNull();
    expect(item(f, 'eng')!.querySelector('[data-sv-org-stem]')).toBeNull();
  });

  it('Home and End go to the first and last visible box', async () => {
    const f = await setup();
    await press(f, 'End', 'eng');
    expect(f.componentInstance.activeId()).toBe('sales');
    await press(f, 'Home', 'sales');
    expect(f.componentInstance.activeId()).toBe('ceo');
  });

  it('Enter selects the box and emits nodeSelect', async () => {
    const f = await setup();
    const picked: string[] = [];
    f.componentInstance.nodeSelect.subscribe((n: TreeNode) => picked.push(n.id));
    await press(f, 'Enter', 'design');
    expect(picked).toEqual(['design']);
    expect(item(f, 'design')!.getAttribute('aria-selected')).toBe('true');
  });
});

describe('SvTreeViewComponent — org layout: pointer', () => {
  it('a click on a nested card selects that box, not the managers it sits under', async () => {
    const f = await setup();
    const picked: string[] = [];
    f.componentInstance.nodeSelect.subscribe((n: TreeNode) => picked.push(n.id));
    item(f, 'fe')!.querySelector<HTMLElement>(':scope > [data-sv-org-card]')!.click();
    f.detectChanges();
    expect(picked).toEqual(['fe']);
  });

  it('a click in the whitespace around a subtree selects nothing', async () => {
    const f = await setup();
    const picked: string[] = [];
    f.componentInstance.nodeSelect.subscribe((n: TreeNode) => picked.push(n.id));
    item(f, 'ceo')!.querySelector<HTMLElement>(':scope > [role="group"]')!.click();
    f.detectChanges();
    expect(picked).toEqual([]);
  });
});

describe('SvTreeViewComponent — org layout: collapse', () => {
  it('the toggle folds the subtree away and says how many boxes it hides', async () => {
    const f = await setup();
    const toggle = item(f, 'ceo')!.querySelector<HTMLButtonElement>(':scope > [data-sv-org-card] [data-sv-org-toggle]')!;
    expect(toggle.getAttribute('aria-label')).toBe('Collapse Sarah Chen');
    toggle.click();
    f.detectChanges();
    expect(ids(f)).toEqual(['ceo']);
    expect(item(f, 'ceo')!.getAttribute('aria-expanded')).toBe('false');
    const again = item(f, 'ceo')!.querySelector<HTMLButtonElement>('[data-sv-org-toggle]')!;
    expect(again.getAttribute('aria-label')).toBe('Expand Sarah Chen');
    expect(again.textContent?.trim()).toBe('3');
  });

  it('a leaf has no toggle', async () => {
    const f = await setup();
    expect(item(f, 'design')!.querySelector('[data-sv-org-toggle]')).toBeNull();
  });

  it('renders the empty state, not an empty region, when there is nothing to chart', async () => {
    const f = await setup({ nodes: [] });
    expect(el(f).querySelector('[data-sv-tree-layout="org"]')).toBeNull();
    expect(el(f).querySelector('[data-sv-state="empty"]')).not.toBeNull();
  });
});
