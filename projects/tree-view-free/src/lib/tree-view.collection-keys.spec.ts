import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { flush } from '@testing/async';
import { svResetWarnOnce } from '@styloviz/core';
import { SvTreeViewComponent } from './tree-view.component';
import type { TreeNode } from './tree-view.component';

/**
 * `X-10` keyboard at scale and `X-12` focus after the host mutates `nodes`.
 */

const many = (n: number): TreeNode[] =>
  Array.from({ length: n }, (_, i) => ({ id: `n${i}`, label: `Node ${String(i).padStart(4, '0')}` }));

const NAMED: TreeNode[] = [
  { id: 'a', label: 'Alpha' },
  { id: 'r', label: 'Reports' },
  { id: 'rev', label: 'Revenue' },
  { id: 'z', label: 'Zulu' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvTreeViewComponent, {
    inputs: { nodes: NAMED, ariaLabel: 'Files', ...inputs },
  });
  fixture.detectChanges();
  return fixture;
}
type Fixture = Awaited<ReturnType<typeof setup>>;

const el = (f: Fixture) => f.nativeElement as HTMLElement;
const row = (f: Fixture, id: string) => el(f).querySelector<HTMLElement>(`[data-tree-id="${id}"]`)!;
/** Every Tab-reachable element inside the collection itself (the tree, or the tree table's body). */
const tabStops = (f: Fixture) =>
  [
    ...el(f).querySelectorAll<HTMLElement>(
      ':is([role="tree"], tbody) :is(a[href], button, input, select, textarea, [tabindex])',
    ),
  ].filter((e) => e.getAttribute('tabindex') !== '-1' && !e.hasAttribute('disabled'));

function press(f: Fixture, key: string, id: string): boolean {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  const fn = f.componentInstance.visibleNodes().find((n) => n.node.id === id)!;
  f.componentInstance.onKeydown(event, fn, f.componentInstance.visibleNodes().indexOf(fn));
  f.detectChanges();
  return event.defaultPrevented;
}

describe('SvTreeViewComponent — X-10 keyboard at scale', () => {
  it('one tab stop across 1,500 rows', async () => {
    const f = await setup({ nodes: many(1500) });
    expect(tabStops(f)).toHaveLength(1);
  });

  it('PageDown jumps ten rows and clamps at the last; PageUp clamps at the first', async () => {
    const f = await setup({ nodes: many(25) });
    expect(press(f, 'PageDown', 'n0')).toBe(true);
    await flush();
    expect(document.activeElement).toBe(row(f, 'n10'));
    press(f, 'PageDown', 'n20');
    await flush();
    expect(document.activeElement).toBe(row(f, 'n24'));
    press(f, 'PageUp', 'n3');
    await flush();
    expect(document.activeElement).toBe(row(f, 'n0'));
  });

  it('typeahead moves to the next row whose label starts with the typed text', async () => {
    const f = await setup();
    press(f, 'r', 'a');
    await flush();
    expect(document.activeElement).toBe(row(f, 'r'));
    press(f, 'e', 'r');
    press(f, 'v', 'r');
    await flush();
    expect(document.activeElement).toBe(row(f, 'rev'));
  });
});

describe('SvTreeViewComponent — X-12 a node deleted via [nodes]', () => {
  it('moves focus to the successor row at the same index, not <body>', async () => {
    const f = await setup();
    row(f, 'r').focus();
    f.componentRef.setInput('nodes', NAMED.filter((n) => n.id !== 'r'));
    f.detectChanges();
    await flush();
    expect(document.activeElement).toBe(row(f, 'rev'));
    expect(row(f, 'rev').getAttribute('tabindex')).toBe('0');
  });

  it('falls back to the predecessor when the last row goes', async () => {
    const f = await setup();
    row(f, 'z').focus();
    f.componentRef.setInput('nodes', NAMED.slice(0, 3));
    f.detectChanges();
    await flush();
    expect(document.activeElement).toBe(row(f, 'rev'));
  });

  it('falls back to the tree itself when every row goes', async () => {
    const f = await setup();
    row(f, 'a').focus();
    f.componentRef.setInput('nodes', []);
    f.detectChanges();
    await flush();
    expect(document.activeElement).not.toBe(document.body);
    expect(el(f).contains(document.activeElement)).toBe(true);
  });
});

describe('SvTreeViewComponent — unnamed tree warning', () => {
  afterEach(() => svResetWarnOnce());

  it('warns once in dev mode when the tree has no accessible name', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await setup({ ariaLabel: '' });
    const named = warn.mock.calls.filter((c) => String(c[0]).includes('no accessible name'));
    expect(named).toHaveLength(1);
    expect(String(named[0][0])).toContain('[styloviz] sv-tree-view:');
    warn.mockRestore();
  });

  it('stays quiet when ariaLabel is set', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await setup({ ariaLabel: 'Files' });
    expect(warn.mock.calls.some((c) => String(c[0]).includes('no accessible name'))).toBe(false);
    warn.mockRestore();
  });
});
