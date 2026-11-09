import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { render, fireEvent } from '@testing-library/angular';
import { flush } from '@testing/async';
import { describeAsyncContract } from '@testing/async-contract';
import { SvFileTreeComponent, type SvFileNode } from './file-tree.component';
import { svFileIconName } from './file-tree.icons-map';

/**
 * sv-file-tree is sv-tree-view with file glyphs. What is pinned here is the
 * composition — the mapping, the sort, the glyphs, the outputs — and that the
 * tree's own WAI-ARIA keyboard engine drives it (the keys themselves are
 * specified in tree-view.keyboard.spec.ts and are not re-specified here).
 */

const FILES: SvFileNode[] = [
  { id: 'readme', name: 'README.md' },
  {
    id: 'src',
    name: 'src',
    children: [
      { id: 'main', name: 'main.ts' },
      { id: 'app10', name: 'app10.ts' },
      { id: 'app2', name: 'app2.ts' },
      { id: 'assets', name: 'assets', kind: 'folder' },
    ],
  },
  { id: 'pkg', name: 'package.json' },
  { id: 'logo', name: 'logo.svg', disabled: true },
];

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const row = (f: ComponentFixture<unknown>, id: string) => el(f).querySelector<HTMLElement>(`[data-tree-id="${id}"]`)!;
const order = (f: ComponentFixture<unknown>) =>
  [...el(f).querySelectorAll<HTMLElement>('[role="treeitem"]')].map((r) => r.dataset['treeId']);

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvFileTreeComponent, { inputs: { nodes: FILES, ...inputs } });
  fixture.detectChanges();
  return fixture as ComponentFixture<SvFileTreeComponent>;
}

async function press(f: ComponentFixture<unknown>, key: string, id: string): Promise<void> {
  row(f, id).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  f.detectChanges();
  await flush();
  f.detectChanges();
}

describe('svFileIconName', () => {
  it('picks a free glyph by exact name, then by extension, then a plain file', () => {
    expect(svFileIconName('src', 'folder')).toBe('folder');
    expect(svFileIconName('package.json', 'file')).toBe('npm');
    expect(svFileIconName('Dockerfile', 'file')).toBe('docker');
    expect(svFileIconName('.env.local', 'file')).toBe('lock');
    expect(svFileIconName('app.component.TS', 'file')).toBe('typescript');
    expect(svFileIconName('photo.jpeg', 'file')).toBe('image');
    expect(svFileIconName('data.csv', 'file')).toBe('file-spreadsheet');
    expect(svFileIconName('Makefile', 'file')).toBe('file');
    expect(svFileIconName('archive.unknownext', 'file')).toBe('file');
  });
});

describe('SvFileTreeComponent — the composition', () => {
  it('is sv-tree-view underneath: one named tree, treeitems, the tree engine', async () => {
    const f = await setup({ ariaLabel: 'Project files' });
    const trees = el(f).querySelectorAll('[role="tree"]');
    expect(trees).toHaveLength(1);
    expect(trees[0]!.getAttribute('aria-label')).toBe('Project files');
    expect(el(f).querySelector('sv-tree-view')).not.toBeNull();
  });

  it('defaults the tree name to "Files"', async () => {
    const f = await setup();
    expect(el(f).querySelector('[role="tree"]')?.getAttribute('aria-label')).toBe('Files');
  });

  it('sorts folders first, then names in natural order', async () => {
    const f = await setup({ expandedIds: new Set(['src']) });
    expect(order(f)).toEqual(['src', 'assets', 'app2', 'app10', 'main', 'logo', 'pkg', 'readme']);
  });

  it('keeps the given order with sort="none"', async () => {
    const f = await setup({ sort: 'none' });
    expect(order(f)).toEqual(['readme', 'src', 'pkg', 'logo']);
  });

  it('reads an empty folder as a folder when kind says so', async () => {
    const f = await setup({ expandedIds: new Set(['src']) });
    const assets = row(f, 'assets');
    expect(f.componentInstance['iconName']('assets')).toBe('folder');
    // No children, so no expand state to claim.
    expect(assets.getAttribute('aria-expanded')).toBeNull();
  });

  it('draws one decorative glyph per row', async () => {
    const f = await setup();
    for (const id of order(f)) {
      const glyph = row(f, id!).querySelector('[data-sv-tree-icon]');
      expect(glyph?.getAttribute('aria-hidden')).toBe('true');
      expect(glyph?.querySelector('sv-icon')).not.toBeNull();
    }
    expect(f.componentInstance['iconName']('pkg')).toBe('npm');
  });

  it('lets the host choose the glyph', async () => {
    const f = await setup({ iconFor: (n: SvFileNode) => (n.name.endsWith('.md') ? 'book-open' : 'file') });
    expect(f.componentInstance['iconName']('readme')).toBe('book-open');
  });
});

describe('SvFileTreeComponent — selection and opening', () => {
  it('selects with a click, emits nodeSelect with the file node, and fileOpen for a file', async () => {
    const f = await setup();
    const selected: SvFileNode[] = [];
    const opened: SvFileNode[] = [];
    f.componentInstance.nodeSelect.subscribe((n) => selected.push(n));
    f.componentInstance.fileOpen.subscribe((n) => opened.push(n));

    fireEvent.click(row(f, 'readme'));
    f.detectChanges();
    expect(selected.map((n) => n.id)).toEqual(['readme']);
    expect(opened.map((n) => n.id)).toEqual(['readme']);
    expect(row(f, 'readme').getAttribute('aria-selected')).toBe('true');
    expect(f.componentInstance.selectedId()).toBe('readme');
  });

  it('does not emit fileOpen for a folder', async () => {
    const f = await setup();
    const opened: SvFileNode[] = [];
    f.componentInstance.fileOpen.subscribe((n) => opened.push(n));
    fireEvent.click(row(f, 'src'));
    f.detectChanges();
    expect(opened).toEqual([]);
    expect(f.componentInstance.selectedId()).toBe('src');
  });

  it('ignores a disabled file', async () => {
    const f = await setup();
    const selected: SvFileNode[] = [];
    f.componentInstance.nodeSelect.subscribe((n) => selected.push(n));
    fireEvent.click(row(f, 'logo'));
    f.detectChanges();
    expect(selected).toEqual([]);
  });

  it('claims no selection model when selectable is false', async () => {
    const f = await setup({ selectable: false });
    expect(row(f, 'readme').hasAttribute('aria-selected')).toBe(false);
  });
});

describe('SvFileTreeComponent — the WAI-ARIA keyboard, through the tree engine', () => {
  it('opens a folder with ArrowRight, steps in, and reports the expansion through the model', async () => {
    const f = await setup();
    const changes: Set<string>[] = [];
    f.componentInstance.expandedIds.subscribe((s) => changes.push(s));

    await press(f, 'ArrowRight', 'src');
    expect(row(f, 'src').getAttribute('aria-expanded')).toBe('true');
    expect(changes.at(-1)?.has('src')).toBe(true);

    await press(f, 'ArrowRight', 'src');
    expect(document.activeElement).toBe(row(f, 'assets'));

    await press(f, 'ArrowLeft', 'assets');
    expect(document.activeElement).toBe(row(f, 'src'));
    await press(f, 'ArrowLeft', 'src');
    expect(row(f, 'src').getAttribute('aria-expanded')).toBe('false');
  });

  it('moves with ArrowDown and opens a file with Enter', async () => {
    const f = await setup();
    const opened: SvFileNode[] = [];
    f.componentInstance.fileOpen.subscribe((n) => opened.push(n));

    await press(f, 'ArrowDown', 'src');
    // `logo` is disabled, so the engine steps over it to the next enabled row.
    expect(document.activeElement).toBe(row(f, 'pkg'));
    await press(f, 'Enter', 'pkg');
    expect(opened.map((n) => n.id)).toEqual(['pkg']);
  });

  it('keeps one tab stop for the whole tree', async () => {
    const f = await setup({ expandedIds: new Set(['src']) });
    const stops = [...el(f).querySelectorAll('[role="treeitem"]')].filter((r) => r.getAttribute('tabindex') === '0');
    expect(stops).toHaveLength(1);
  });
});

describe('SvFileTreeComponent — states', () => {
  it('uses the empty copy it is given', async () => {
    const f = await setup({ nodes: [], emptyText: 'No folders' });
    expect(el(f).querySelector('[data-sv-state="empty"]')?.textContent).toContain('No folders');
  });
});

describeAsyncContract({
  component: SvFileTreeComponent,
  collection: 'nodes',
  rows: FILES,
  loadedSelector: '[role="treeitem"]',
  skip: {
    twoEmpties:
      'a file tree has no filter or search of its own — every empty is `no-data`, and a `filtered` input ' +
      'would be one no host could meaningfully set.',
  },
});
