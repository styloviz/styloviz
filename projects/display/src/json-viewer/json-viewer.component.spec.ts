import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvJsonViewerComponent } from './json-viewer.component';
import { classify, containerPreview, joinPath, scalarText } from './json-viewer.types';

/**
 * `sv-json-viewer`.
 *
 * A JSON viewer exists to tell you what you actually received, so nearly every
 * test here is about TYPE FIDELITY — the ways `JSON.stringify` in a `<pre>`
 * would quietly tell you something false — plus the two structural things that
 * break a naive implementation outright: a cycle, and a very large container.
 */

async function setup(inputs: ComponentInput<SvJsonViewerComponent> = {}) {
  TestBed.resetTestingModule();
  const view = await render(SvJsonViewerComponent, { inputs });
  view.fixture.detectChanges();
  return view;
}

const rows = () => [...document.querySelectorAll<HTMLElement>('[data-sv-json-row]')];
const texts = () => rows().map((r) => r.textContent?.replace(/\s+/g, ' ').trim() ?? '');
/** The rendered text of the row whose key is `key`. */
const rowFor = (key: string) => texts().find((t) => t.startsWith(`${key}:`)) ?? '';

// ── The classifier ───────────────────────────────────────────────────────────

describe('json-viewer — classify()', () => {
  /**
   * ★★★ THE WHOLE POINT, IN ONE TABLE.
   *
   * Each of these is a value `JSON.stringify` either destroys or throws on, and
   * each is a value a real API or a real reducer produces.
   */
  it.each([
    [null, 'null'],
    [undefined, 'undefined'],
    ['x', 'string'],
    [1, 'number'],
    [Number.NaN, 'number'],
    [Number.POSITIVE_INFINITY, 'number'],
    [true, 'boolean'],
    [10n, 'bigint'],
    [new Date(0), 'date'],
    [new Map(), 'map'],
    [new Set(), 'set'],
    [[], 'array'],
    [{}, 'object'],
  ])('classifies %s', (value, kind) => {
    expect(classify(value)).toBe(kind);
  });

  it('separates a function and a symbol from "some object"', () => {
    expect(classify(() => undefined)).toBe('function');
    expect(classify(Symbol('s'))).toBe('symbol');
  });
});

describe('json-viewer — scalarText()', () => {
  /**
   * ★★★ `NaN` AND `Infinity` STRINGIFY TO `null`.
   *
   * That is the single most damaging thing a stringify-based viewer does: it
   * shows a MISSING VALUE where you have a broken calculation, and the two have
   * completely different causes.
   */
  it('prints NaN and Infinity as themselves, not as null', () => {
    expect(scalarText(Number.NaN, 'number', true)).toBe('NaN');
    expect(scalarText(Number.POSITIVE_INFINITY, 'number', true)).toBe('Infinity');
    expect(scalarText(Number.NEGATIVE_INFINITY, 'number', true)).toBe('-Infinity');
    expect(JSON.stringify(Number.NaN)).toBe('null'); // …which is what we are avoiding
  });

  /**
   * ★★ `-0` IS NOT `0`, AND `String(-0)` SAYS IT IS.
   *
   * The difference is real (a sort that reverses, a division that flips sign)
   * and invisible in every plain conversion, which is exactly when a viewer
   * should be the thing that shows it.
   */
  it('spells out negative zero', () => {
    expect(scalarText(-0, 'number', true)).toBe('-0');
    expect(String(-0)).toBe('0'); // the trap
  });

  it('marks a bigint as one', () => {
    expect(scalarText(10n, 'bigint', true)).toBe('10n');
  });

  it('shows an invalid date as invalid rather than as NaN', () => {
    expect(scalarText(new Date('nope'), 'date', true)).toBe('Invalid Date');
  });

  it('quotes strings on request, so " " and "" are visible', () => {
    expect(scalarText('  ', 'string', true)).toBe('"  "');
    expect(scalarText('  ', 'string', false)).toBe('  ');
  });
});

describe('json-viewer — paths', () => {
  it('brackets array indices and dots plain keys', () => {
    expect(joinPath('$', 'user', 'object')).toBe('$.user');
    expect(joinPath('$.roles', '2', 'array')).toBe('$.roles[2]');
  });

  /** A key that is not an identifier has to be bracketed and quoted, or the
   *  copied path is not something anyone can paste back. */
  it('quotes a key that is not an identifier', () => {
    expect(joinPath('$', 'content-type', 'object')).toBe('$["content-type"]');
  });

  it('tells an empty container from a full one', () => {
    expect(containerPreview('array', 0)).toBe('[]');
    expect(containerPreview('object', 0)).toBe('{}');
    expect(containerPreview('array', 3)).toBe('[3]');
    expect(containerPreview('map', 2)).toBe('Map(2)');
  });
});

// ── Rendering ────────────────────────────────────────────────────────────────

describe('SvJsonViewerComponent — rendering', () => {
  it('renders a tree with one row per visible node', async () => {
    await setup({ value: { a: 1, b: 'two' }, rootLabel: 'res' });
    expect(screen.getByRole('tree')).toBeTruthy();
    expect(texts()[0]).toContain('res');
    expect(rowFor('a')).toContain('1');
    expect(rowFor('b')).toContain('"two"');
  });

  /**
   * `expandDepth` counts CONTAINERS OPENED, not rows shown: 1 opens the root, so
   * its direct children are visible and their contents are not. The default is 1
   * rather than 0 or Infinity — a collapsed root shows nothing and reads as
   * broken, and a fully expanded 4 MB response locks the tab.
   */
  it('opens exactly that many levels of container', async () => {
    const value = { level1: { level2: { level3: 'deep' } } };

    await setup({ value, expandDepth: 1 });
    expect(texts().some((t) => t.includes('level1'))).toBe(true);
    expect(texts().some((t) => t.includes('level2'))).toBe(false);

    await setup({ value, expandDepth: 3 });
    expect(texts().some((t) => t.includes('level3'))).toBe(true);

    await setup({ value, expandDepth: 0 });
    expect(rows()).toHaveLength(1);
  });

  /**
   * ★★ `null` AND `undefined` MUST LOOK DIFFERENT.
   *
   * They are different facts — "the server sent nothing" and "this key was
   * never set" — and stringify renders the second as the first inside an array
   * and drops it entirely inside an object.
   */
  it('shows null and undefined as themselves, and as different things', async () => {
    await setup({ value: { nothing: null, missing: undefined } });
    expect(rowFor('nothing')).toContain('null');
    expect(rowFor('missing')).toContain('undefined');
    expect(rowFor('missing')).not.toContain('null');
  });

  it('shows a Map and a Set as what they are, not as {}', async () => {
    await setup({
      value: { m: new Map([['k', 1]]), s: new Set([1, 2]) },
      expandDepth: 1,
    });
    expect(rowFor('m')).toContain('Map(1)');
    expect(rowFor('s')).toContain('Set(2)');
    expect(JSON.stringify({ m: new Map([['k', 1]]) })).toBe('{"m":{}}'); // the trap
  });

  it('summarises a collapsed container by size', async () => {
    await setup({ value: { list: [1, 2, 3], empty: {} }, expandDepth: 1 });
    expect(rowFor('list')).toContain('[3]');
    expect(rowFor('empty')).toContain('{}');
  });

  it('offers no twisty on an empty container — there is nothing behind it', async () => {
    await setup({ value: { empty: [] }, expandDepth: 2 });
    const empty = rows().find((r) => r.textContent?.includes('empty'))!;
    expect(empty.closest('[role="treeitem"]')!.hasAttribute('aria-expanded')).toBe(false);
  });
});

// ── The two structural traps ─────────────────────────────────────────────────

describe('SvJsonViewerComponent — cycles', () => {
  /**
   * ★★★ A CYCLE MUST NOT TAKE THE PANEL WITH IT.
   *
   * `JSON.stringify` throws on one, and a naive tree walker recurses until the
   * stack goes. Either way the debug panel dies at the exact moment its content
   * is most interesting.
   */
  it('marks a self-reference instead of recursing forever', async () => {
    const node: Record<string, unknown> = { name: 'root' };
    node['self'] = node;

    await setup({ value: node, expandDepth: 3 });

    expect(rowFor('self')).toContain('[Circular]');
    expect(() => JSON.stringify(node)).toThrow(); // …which is what we are avoiding
  });

  /**
   * ★★★ THE HALF EVERY "SEEN SET" IMPLEMENTATION GETS WRONG.
   *
   * A cycle is a value that contains ITSELF — it is on the path from the root
   * to here. One `author` object referenced by three posts is a DAG: ordinary,
   * finite and perfectly renderable. A global seen-set marks the second and
   * third appearance `[Circular]`, which HIDES REAL DATA and sends the reader
   * hunting a cycle that does not exist.
   */
  it('does not mistake a shared object for a cycle', async () => {
    const author = { name: 'Ada' };
    await setup({ value: { posts: [{ author }, { author }] }, expandDepth: 4 });

    const authors = texts().filter((t) => t.startsWith('author:'));
    expect(authors).toHaveLength(2);
    expect(authors.every((t) => !t.includes('Circular'))).toBe(true);
    // …and both really rendered their contents.
    expect(texts().filter((t) => t.includes('"Ada"'))).toHaveLength(2);
  });

  it('survives a cycle two levels down', async () => {
    const a: Record<string, unknown> = { id: 'a' };
    const b: Record<string, unknown> = { id: 'b', back: a };
    a['forward'] = b;

    await setup({ value: a, expandDepth: 5 });

    expect(texts().some((t) => t.includes('[Circular]'))).toBe(true);
    expect(rows().length).toBeLessThan(20);
  });
});

describe('SvJsonViewerComponent — very large containers', () => {
  /**
   * ★★★ 50,000 ROWS IS NOT A PATIENCE PROBLEM.
   *
   * It is a DOM node per element and a tab that stops responding. The cap is
   * COUNTED AND SHOWN rather than silent — a viewer that quietly drops rows is
   * worse than one that shows fewer, because the reader believes they have seen
   * everything.
   */
  it('caps children and says how many it withheld', async () => {
    await setup({ value: { big: Array.from({ length: 500 }, (_, i) => i) }, expandDepth: 2, maxChildren: 25 });

    const shown = texts().filter((t) => /^\d+:/.test(t));
    expect(shown).toHaveLength(25);
    expect(document.body.textContent).toContain('… 475 more');
  });

  it('says nothing about truncation when nothing was truncated', async () => {
    await setup({ value: { small: [1, 2] }, expandDepth: 2, maxChildren: 25 });
    expect(document.body.textContent).not.toContain('more');
  });
});

// ── Interaction ──────────────────────────────────────────────────────────────

describe('SvJsonViewerComponent — expanding', () => {
  it('opens and closes a container on click', async () => {
    const user = userEvent.setup();
    await setup({ value: { child: { hidden: 1 } }, expandDepth: 1 });
    expect(texts().some((t) => t.includes('hidden'))).toBe(false);

    await user.click(rows().find((r) => r.textContent?.includes('child'))!);
    expect(texts().some((t) => t.includes('hidden'))).toBe(true);

    await user.click(rows().find((r) => r.textContent?.includes('child'))!);
    expect(texts().some((t) => t.includes('hidden'))).toBe(false);
  });

  /**
   * ★★★ A NEW VALUE MUST NOT INHERIT THE OLD ONE'S EXPANSION.
   *
   * The paths look the same and mean something else: `data[3]` in the previous
   * response is a different node from `data[3]` in this one. Carrying the set
   * over shows a tree opened to positions that belonged to data the user is no
   * longer looking at.
   */
  it('re-seeds expansion when the value is replaced', async () => {
    const user = userEvent.setup();
    const { fixture } = await setup({ value: { a: { deep: 1 } }, expandDepth: 1 });

    await user.click(rows().find((r) => r.textContent?.includes('a:'))!);
    expect(texts().some((t) => t.includes('deep'))).toBe(true);

    fixture.componentRef.setInput('value', { a: { deep: 2 } });
    fixture.detectChanges();

    expect(texts().some((t) => t.includes('deep'))).toBe(false);
  });

  it('expands and collapses everything on demand', async () => {
    const { fixture } = await setup({ value: { a: { b: { c: 1 } } }, expandDepth: 0 });
    fixture.componentInstance.expandAll();
    fixture.detectChanges();
    expect(texts().some((t) => t.includes('c:'))).toBe(true);

    fixture.componentInstance.collapseAll();
    fixture.detectChanges();
    expect(rows()).toHaveLength(1);
  });

  it('does not hang expandAll on a cycle', async () => {
    const node: Record<string, unknown> = {};
    node['self'] = node;
    const { fixture } = await setup({ value: node, expandDepth: 0 });
    fixture.componentInstance.expandAll();
    fixture.detectChanges();
    expect(rows().length).toBeLessThan(10);
  });
});

// ── Keyboard ─────────────────────────────────────────────────────────────────

describe('SvJsonViewerComponent — the tree keyboard model', () => {
  it('is one tab stop', async () => {
    await setup({ value: { a: 1, b: 2 }, expandDepth: 1 });
    expect(rows().filter((r) => r.getAttribute('tabindex') === '0')).toHaveLength(1);
  });

  it('moves down and up the visible rows', async () => {
    const user = userEvent.setup();
    await setup({ value: { a: 1, b: 2 }, expandDepth: 1 });
    rows()[0].focus();

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement?.textContent).toContain('a:');
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement?.textContent).toContain('b:');
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement?.textContent).toContain('a:');
  });

  /**
   * ★★ RIGHT AND LEFT ARE NOT DOWN AND UP.
   *
   * Right OPENS a closed node and only then descends; Left CLOSES an open one
   * and only then climbs to the parent. Collapsing that into vertical movement
   * is what makes a hand-rolled tree feel like an indented list.
   */
  it('opens with Right, then descends; closes with Left, then climbs', async () => {
    const user = userEvent.setup();
    await setup({ value: { parent: { child: 1 } }, expandDepth: 1 });
    const parentRow = () => rows().find((r) => r.textContent?.includes('parent'))!;
    parentRow().focus();
    await user.keyboard('{ArrowDown}'); // onto `parent`

    await user.keyboard('{ArrowRight}'); // opens
    expect(texts().some((t) => t.includes('child'))).toBe(true);
    expect(document.activeElement?.textContent).toContain('parent');

    await user.keyboard('{ArrowRight}'); // descends
    expect(document.activeElement?.textContent).toContain('child');

    await user.keyboard('{ArrowLeft}'); // climbs — child is a leaf
    expect(document.activeElement?.textContent).toContain('parent');

    await user.keyboard('{ArrowLeft}'); // closes
    expect(texts().some((t) => t.includes('child'))).toBe(false);
  });

  it('jumps to the ends with Home and End', async () => {
    const user = userEvent.setup();
    await setup({ value: { a: 1, b: 2, c: 3 }, expandDepth: 1 });
    rows()[0].focus();

    await user.keyboard('{End}');
    expect(document.activeElement?.textContent).toContain('c:');
    await user.keyboard('{Home}');
    expect(document.activeElement?.textContent).toContain('root');
  });

  it('publishes the level, so depth is announced', async () => {
    await setup({ value: { a: { b: 1 } }, expandDepth: 2 });
    const levels = [...document.querySelectorAll('[role="treeitem"]')].map((n) =>
      n.getAttribute('aria-level'),
    );
    expect(levels).toEqual(['1', '2', '3']);
  });
});
