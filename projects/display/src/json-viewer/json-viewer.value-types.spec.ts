import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import { SvJsonViewerComponent } from './json-viewer.component';
import { secretKeyRedactor, type JsonCopyEvent, type JsonNodeClick } from './json-viewer.types';
import type { SvSensitiveCopyEvent } from '@styloviz/core';
import { quietFor, until } from '@testing/async';

/**
 * `sv-json-viewer` — the value types on screen, the rest of the tree keyboard
 * model, and the copy actions' edges.
 *
 * The neighbouring specs pin the classifier as functions; these pin what the
 * READER sees for each type (colour is the type channel, so a `bigint` painted
 * like a `string` is a lie), and what the clipboard receives for the values
 * `JSON.stringify` cannot spell.
 */

async function setup(inputs: ComponentInput<SvJsonViewerComponent> = {}) {
  TestBed.resetTestingModule();
  const view = await render(SvJsonViewerComponent, { inputs });
  view.fixture.detectChanges();
  return view;
}

const rows = () => [...document.querySelectorAll<HTMLElement>('[data-sv-json-row]')];
const rowByKey = (key: string) =>
  rows().find((r) => r.textContent?.replace(/\s+/g, ' ').trim().startsWith(`${key}:`))!;
/** The value `<span>` of a row — the last span, after the key and the colon. */
const valueSpan = (key: string) => {
  const spans = [...rowByKey(key).querySelectorAll('span')];
  return spans[spans.length - 1];
};
const tree = () => document.querySelector<HTMLElement>('[role="tree"]')!;
const copyValueBtn = () => document.querySelector<HTMLButtonElement>('button[aria-label^="Copy value"]');
const copyPathBtn = () => document.querySelector<HTMLButtonElement>('button[aria-label^="Copy path"]');

/**
 * jsdom has no `navigator.clipboard`, so the stub is an own property this file
 * adds. Put back exactly what was there — an own descriptor if some setup file
 * installed one, otherwise nothing at all — so no later spec inherits a stub.
 */
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

function stubClipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

afterEach(() => {
  if (originalClipboard) {
    Object.defineProperty(navigator, 'clipboard', originalClipboard);
  } else {
    delete (navigator as { clipboard?: unknown }).clipboard;
  }
  vi.restoreAllMocks();
});

// ── Every type gets its own colour ───────────────────────────────────────────

describe('SvJsonViewerComponent — the type channel', () => {
  function named() {
    return function namedFn() { return 1; };
  }

  const VALUE = {
    str: 'x',
    num: 1,
    big: 10n,
    flag: true,
    nil: null,
    undef: undefined,
    when: new Date(Date.UTC(2026, 0, 2)),
    fn: named(),
    sym: Symbol('s'),
  };

  it.each([
    ['str', '"x"', 'text-emerald-700'],
    ['num', '1', 'text-sky-700'],
    ['big', '10n', 'text-sky-700'],
    ['flag', 'true', 'text-violet-700'],
    ['nil', 'null', 'text-gray-500'],
    ['undef', 'undefined', 'italic'],
    ['when', '2026-01-02T00:00:00.000Z', 'text-amber-700'],
    ['fn', 'ƒ namedFn()', 'text-fuchsia-700'],
    ['sym', 'Symbol(s)', 'text-fuchsia-700'],
  ])('paints %s as its own type', async (key, text, cls) => {
    await setup({ value: VALUE });
    expect(valueSpan(key).textContent?.trim()).toBe(text);
    expect(valueSpan(key).className).toContain(cls);
  });

  it('gives a container summary the neutral colour, not a scalar one', async () => {
    await setup({ value: { list: [1, 2], map: new Map([['a', 1]]), set: new Set([1]) } });
    for (const key of ['list', 'map', 'set']) {
      expect(valueSpan(key).className).toContain('text-gray-600');
    }
    expect(valueSpan('map').textContent?.trim()).toBe('Map(1)');
    expect(valueSpan('set').textContent?.trim()).toBe('Set(1)');
  });

  it('paints a cycle as a fault', async () => {
    const loop: Record<string, unknown> = {};
    loop['self'] = loop;
    await setup({ value: loop, expandDepth: 1 });
    expect(valueSpan('self').textContent?.trim()).toBe('[Circular]');
    expect(valueSpan('self').className).toContain('text-danger-600');
  });

  it('paints an unread getter as a placeholder, not as data', async () => {
    await setup({ value: { get lazy() { return 1; } } });
    expect(valueSpan('lazy').textContent?.trim()).toBe('(getter — not read)');
    expect(valueSpan('lazy').className).toContain('italic');
  });

  it('shows the message of a getter that threw, instead of losing the panel', async () => {
    await setup({
      value: { get broken(): number { throw new Error('nope'); } },
      evaluateGetters: true,
    });
    expect(valueSpan('broken').textContent?.trim()).toBe('(getter threw: nope)');
  });

  it('prints strings bare when quoting is off', async () => {
    await setup({ value: { s: 'plain' }, quoteStrings: false });
    expect(valueSpan('s').textContent?.trim()).toBe('plain');
  });

  it('orders keys alphabetically on request', async () => {
    await setup({ value: { b: 1, a: 2, c: 3 }, sortKeys: true });
    expect(rows().slice(1).map((r) => r.textContent?.trim().charAt(0))).toEqual(['a', 'b', 'c']);
  });
});

// ── Size, classes and the root label ─────────────────────────────────────────

describe('SvJsonViewerComponent — size and chrome', () => {
  it('is tighter at sm, in type and in indent', async () => {
    await setup({ value: { a: 1 }, size: 'sm', customClass: 'my-viewer' });
    expect(tree().className).toContain('text-[11px]');
    expect(tree().className).toContain('my-viewer');
    expect(rowByKey('a').style.paddingLeft).toBe('10px');
  });

  it('indents 12px a level at md', async () => {
    await setup({ value: { a: 1 } });
    expect(tree().className).toContain('text-xs');
    expect(rowByKey('a').style.paddingLeft).toBe('12px');
  });

  it('names the root and the tree as told', async () => {
    await setup({ value: { a: 1 }, rootLabel: 'response', ariaLabel: 'Webhook body' });
    expect(tree().getAttribute('aria-label')).toBe('Webhook body');
    expect(rows()[0].textContent).toContain('response');
  });

  it('opens nothing at a depth of zero, and treats a negative depth the same', async () => {
    for (const expandDepth of [0, -3]) {
      await setup({ value: { a: { b: 1 } }, expandDepth });
      expect(rows()).toHaveLength(1);
      expect(rows()[0].closest('[role="treeitem"]')?.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('does not seed a cycle open forever', async () => {
    const loop: Record<string, unknown> = { n: 1 };
    loop['self'] = loop;
    await setup({ value: loop, expandDepth: 50 });
    // root, n, self — the cycle is a leaf, not another open level.
    expect(rows()).toHaveLength(3);
  });

  it('does not seed a redacted container open', async () => {
    await setup({ value: { secret: { a: 1 } }, expandDepth: 5, redact: secretKeyRedactor });
    expect(rows()).toHaveLength(2);
  });

  it('hides the copy actions when asked', async () => {
    await setup({ value: { a: 1 }, showCopy: false });
    expect(copyValueBtn()).toBeNull();
  });
});

// ── Keyboard: the arms the main spec does not reach ──────────────────────────

describe('SvJsonViewerComponent — keyboard edges', () => {
  it('stays put on Up at the top and Down at the bottom', async () => {
    const user = userEvent.setup();
    await setup({ value: { a: 1 } });
    rows()[0].focus();
    await user.keyboard('{ArrowUp}');
    expect(rows()[0].getAttribute('tabindex')).toBe('0');
    await user.keyboard('{End}{ArrowDown}');
    await until(() => document.activeElement === rowByKey('a'), { label: 'focus on the last row' });
    expect(rowByKey('a').getAttribute('tabindex')).toBe('0');
  });

  it('does nothing on Right over a leaf, and nothing on Left at the root', async () => {
    const user = userEvent.setup();
    await setup({ value: { a: 1 }, expandDepth: 0 });
    rows()[0].focus();
    await user.keyboard('{ArrowLeft}'); // root, collapsed, no parent
    expect(rows()).toHaveLength(1);
    expect(rows()[0].getAttribute('tabindex')).toBe('0');

    await user.keyboard('{ArrowRight}'); // opens the root
    await user.keyboard('{ArrowRight}'); // descends onto `a`
    await until(() => document.activeElement === rowByKey('a'), { label: 'focus on a' });
    await user.keyboard('{ArrowRight}'); // a leaf: nothing to open, nowhere to go
    expect(document.activeElement).toBe(rowByKey('a'));
    expect(rows()).toHaveLength(2);
  });

  it('climbs from a later sibling past its siblings to the parent', async () => {
    const user = userEvent.setup();
    await setup({ value: { a: 1, b: 2, c: 3 } });
    rows()[0].focus();
    await user.keyboard('{End}'); // onto `c`
    await until(() => document.activeElement === rowByKey('c'), { label: 'focus on c' });
    await user.keyboard('{ArrowLeft}'); // skips b and a — same depth — to the root
    await until(() => document.activeElement === rows()[0], { label: 'focus on the root' });
    expect(rows()[0].getAttribute('tabindex')).toBe('0');
  });

  it('activates the focused row with Enter and with Space', async () => {
    const user = userEvent.setup();
    const { fixture } = await setup({ value: { a: { b: 1 } } });
    const clicks: JsonNodeClick[] = [];
    fixture.componentInstance.nodeClick.subscribe((c) => clicks.push(c));

    rows()[0].focus();
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}'); // opens `a`
    expect(rows()).toHaveLength(3);
    await user.keyboard(' '); // closes it again
    expect(rows()).toHaveLength(2);
    expect(clicks.map((c) => c.path)).toEqual(['$.a', '$.a']);
  });

  it('opens everything with *', async () => {
    const user = userEvent.setup();
    await setup({ value: { a: { b: { c: 1 } } }, expandDepth: 0 });
    rows()[0].focus();
    await user.keyboard('*');
    expect(rows().map((r) => r.dataset['svJsonRow'])).toEqual(['$', '$.a', '$.a.b', '$.a.b.c']);
  });

  it('leaves every other key to the page', async () => {
    await setup({ value: { a: 1 } });
    const ev = new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true });
    rows()[0].dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('expandAll skips a redacted container and stops at maxRows', async () => {
    const { fixture } = await setup({
      value: { token: { inner: 1 }, open: { inner: 2 } },
      expandDepth: 0,
      redact: secretKeyRedactor,
    });
    fixture.componentInstance.expandAll();
    fixture.detectChanges();
    expect(rows().map((r) => r.dataset['svJsonRow'])).toEqual(['$', '$.token', '$.open', '$.open.inner']);

    const wide = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`g${i}`, { x: i }]));
    const second = await setup({ value: wide, expandDepth: 0, maxRows: 2 });
    second.fixture.componentInstance.expandAll();
    second.fixture.detectChanges();
    expect(document.body.textContent).toContain('stopped at 2 rows');
  });
});

// ── nodeClick under a redactor ───────────────────────────────────────────────

describe('SvJsonViewerComponent — nodeClick under a redactor', () => {
  it('hands out [Circular] for a cycle rather than the live object', async () => {
    const loop: Record<string, unknown> = { password: 'hunter2' };
    loop['self'] = loop;
    const { fixture } = await setup({ value: loop, redact: secretKeyRedactor });
    const clicks: JsonNodeClick[] = [];
    fixture.componentInstance.nodeClick.subscribe((c) => clicks.push(c));

    rowByKey('self').click();
    expect(clicks[0].value).toBe('[Circular]');
  });

  it('hands out a scalar as itself', async () => {
    const { fixture } = await setup({ value: { name: 'Ada' }, redact: secretKeyRedactor });
    const clicks: JsonNodeClick[] = [];
    fixture.componentInstance.nodeClick.subscribe((c) => clicks.push(c));
    rowByKey('name').click();
    expect(clicks[0]).toEqual({ path: '$.name', key: 'name', value: 'Ada' });
  });
});

// ── Copy ─────────────────────────────────────────────────────────────────────

describe('SvJsonViewerComponent — copy edges', () => {
  async function focusAndCopy(key: string, which: 'value' | 'path', inputs: ComponentInput<SvJsonViewerComponent>) {
    const view = await setup(inputs);
    const copied: JsonCopyEvent[] = [];
    const audited: SvSensitiveCopyEvent[] = [];
    view.fixture.componentInstance.copied.subscribe((e) => copied.push(e));
    view.fixture.componentInstance.copyAudited.subscribe((e) => audited.push(e));
    rowByKey(key).click();
    view.fixture.detectChanges();
    (which === 'value' ? copyValueBtn() : copyPathBtn())!.click();
    return { view, copied, audited };
  }

  it('copies the path, and says so on the button it came from', async () => {
    const writeText = vi.fn<(t: string) => Promise<void>>().mockResolvedValue(undefined);
    stubClipboard(writeText);
    const { view, copied, audited } = await focusAndCopy('user', 'path', { value: { user: { id: 1 } } });
    await until(() => copied.length === 1, { label: 'the copy event' });
    view.fixture.detectChanges();

    expect(writeText).toHaveBeenCalledWith('$.user');
    expect(copied[0]).toEqual({ path: '$.user', what: 'path', text: '$.user', redacted: false });
    expect(audited[0]).toMatchObject({ source: 'sv-json-viewer', field: '$.user', redacted: false });
    expect(copyValueBtn()!.textContent?.trim()).toBe('copied');
  });

  it('copies a value JSON cannot spell as the text its row shows', async () => {
    const writeText = vi.fn<(t: string) => Promise<void>>().mockResolvedValue(undefined);
    stubClipboard(writeText);
    const { copied } = await focusAndCopy('big', 'value', { value: { big: 12n } });
    await until(() => copied.length === 1, { label: 'the copy event' });
    expect(writeText).toHaveBeenCalledWith('12n');
  });

  it('copies undefined as the word, not as an empty clipboard', async () => {
    const writeText = vi.fn<(t: string) => Promise<void>>().mockResolvedValue(undefined);
    stubClipboard(writeText);
    const { copied } = await focusAndCopy('u', 'value', { value: { u: undefined } });
    await until(() => copied.length === 1, { label: 'the copy event' });
    expect(writeText).toHaveBeenCalledWith('undefined');
  });

  it('reports nothing when the clipboard refuses, and keeps the panel', async () => {
    const writeText = vi.fn<(t: string) => Promise<void>>().mockRejectedValue(new Error('denied'));
    stubClipboard(writeText);
    const { view, copied, audited } = await focusAndCopy('a', 'value', { value: { a: 1 } });
    await until(() => writeText.mock.calls.length === 1, { label: 'the clipboard call' });
    // The landmark is the refused write; the window in which a success event
    // or the "copied" label COULD still land is what quietFor holds open.
    await quietFor();
    view.fixture.detectChanges();
    expect(copied).toEqual([]);
    expect(audited).toEqual([]);
    expect(copyValueBtn()!.textContent?.trim()).toBe('value');
  });
});
