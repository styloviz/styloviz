import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvListViewComponent, type ListViewItem } from './list-view.component';

/**
 * Item identity and state ownership (audit item X-6), free tier.
 *
 * The Pro twin shares no code with this one, so its `list-view.identity.spec.ts`
 * asserts the same contract separately: `expandedIds` is a `model` on both
 * sides, and both warn about a duplicate `id` before `@for` empties the list
 * with NG0955.
 *
 * ⚠ One warning per context, ever — the memo in `@styloviz/core` is module-level
 * and nothing resets it, so each context string is asserted in exactly one test.
 */

const NESTED = (): ListViewItem[] => [
  {
    id: 'inv',
    title: 'Invoices',
    children: [{ id: 'inv-1', title: 'Invoice 1' }],
  },
  { id: 'rec', title: 'Receipts', children: [{ id: 'rec-1', title: 'Receipt 1' }] },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvListViewComponent, {
    inputs: { items: NESTED(), nested: true, ...inputs },
  });
  return fixture;
}

const ids = (set: Set<string | number>) => [...set].sort();

describe('SvListViewComponent — who owns the expansion state', () => {
  it('opens the branch the host names', async () => {
    const f = await setup({ expandedIds: new Set(['rec']) });
    expect(f.nativeElement.textContent).toContain('Receipt 1');
    expect(f.nativeElement.textContent).not.toContain('Invoice 1');
  });

  it('emits every expansion, so a host can persist what was open', async () => {
    const f = await setup();
    const c = f.componentInstance;
    const seen: (string | number)[][] = [];
    c.expandedIds.subscribe((s) => seen.push(ids(s)));

    c.toggleExpand(NESTED()[0]);
    c.toggleExpand(NESTED()[0]);

    expect(seen).toEqual([['inv'], []]);
  });
});

describe('SvListViewComponent — duplicate ids', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('reports a flat duplicate even while a search is hiding one of the pair', async () => {
    await setup({
      nested: false,
      query: 'Alpha',
      items: [
        { id: 1, title: 'Alpha' },
        { id: 1, title: 'Beta' },
      ],
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sv-list-view [items]'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('NG0955'));
  });

  it('catches ids that only collide once the tree is flattened', async () => {
    await setup({
      expandedIds: new Set(['a', 'b']),
      items: [
        { id: 'a', title: 'A', children: [{ id: 'dup', title: 'A child' }] },
        { id: 'b', title: 'B', children: [{ id: 'dup', title: 'B child' }] },
      ],
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('(nested)'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"dup"'));
  });

  it('says nothing about a well-formed tree', async () => {
    await setup({ expandedIds: new Set(['inv', 'rec']) });
    expect(warn).not.toHaveBeenCalled();
  });
});
