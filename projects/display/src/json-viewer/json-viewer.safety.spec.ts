import { render, type ComponentInput } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import { SvJsonViewerComponent } from './json-viewer.component';
import {
  childrenOf,
  classNameOf,
  containerPreview,
  omissionNote,
  secretKeyRedactor,
  type JsonCopyEvent,
} from './json-viewer.types';

/**
 * The three things a JSON viewer can do that have nothing to do with rendering
 * JSON: leak a secret, run the value's code, and stop responding.
 *
 * None of them are visible in a demo. All three are what happens when the panel
 * is pointed at a real payload from a real API rather than at a fixture.
 */

async function setup(inputs: ComponentInput<SvJsonViewerComponent> = {}) {
  TestBed.resetTestingModule();
  const view = await render(SvJsonViewerComponent, { inputs });
  view.fixture.detectChanges();
  return view;
}

const rows = () => [...document.querySelectorAll<HTMLElement>('[data-sv-json-row]')];
const texts = () => rows().map((r) => r.textContent?.replace(/\s+/g, ' ').trim() ?? '');
const rowFor = (key: string) => texts().find((t) => t.startsWith(`${key}:`)) ?? '';
const bodyText = () => document.body.textContent?.replace(/\s+/g, ' ') ?? '';

// ── Redaction ────────────────────────────────────────────────────────────────

describe('SvJsonViewerComponent — redaction', () => {
  const payload = {
    id: 'evt_1',
    headers: { authorization: 'Bearer sk_live_51H', 'content-type': 'application/json' },
  };

  it('renders nothing by default, because it cannot know what is a secret', async () => {
    await setup({ value: payload, expandDepth: 3 });
    expect(bodyText()).toContain('Bearer sk_live_51H');
  });

  it('masks a matching row', async () => {
    await setup({ value: payload, expandDepth: 3, redact: secretKeyRedactor });
    expect(bodyText()).not.toContain('sk_live_51H');
    expect(rowFor('authorization')).toContain('[redacted]');
    // …and leaves everything else alone.
    expect(rowFor('id')).toContain('"evt_1"');
    expect(rowFor('content-type')).toContain('application/json');
  });

  it('takes the wording for the mask', async () => {
    await setup({
      value: payload,
      expandDepth: 3,
      redact: secretKeyRedactor,
      redactedLabel: '•••',
    });
    expect(rowFor('authorization')).toContain('•••');
    expect(bodyText()).not.toContain('[redacted]');
  });

  /**
   * ★★★ THE HALF THAT MAKES IT REDACTION RATHER THAN A TINT.
   *
   * A mask that only changed the pixels is a mask the clipboard walks straight
   * past — and copy is exactly how a token gets out of a debug drawer.
   */
  it('copies the mask, not the secret', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const events: JsonCopyEvent[] = [];
    const { fixture } = await setup({
      value: payload,
      expandDepth: 3,
      redact: secretKeyRedactor,
    });
    fixture.componentInstance.copied.subscribe((e) => events.push(e));

    const row = rows().find((r) => r.textContent?.startsWith('authorization:'))!;
    row.click();
    fixture.detectChanges();
    const copyValue = [
      ...document.querySelectorAll<HTMLElement>('button[aria-label^="Copy value"]'),
    ][0];
    copyValue.click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).not.toContain('sk_live_51H');
    expect(writeText.mock.calls[0][0]).toContain('[redacted]');
    expect(events[0].redacted).toBe(true);
    expect(events[0].what).toBe('value');
  });

  /**
   * A masked container is masked all the way down. Descending into it would put
   * the values back on screen one level lower, which is not a subtlety — it is
   * the whole leak.
   */
  it('does not descend into a redacted container', async () => {
    await setup({
      value: { credentials: { user: 'ada', password: 'hunter2' } },
      expandDepth: 5,
      redact: secretKeyRedactor,
    });
    expect(bodyText()).not.toContain('hunter2');
    expect(bodyText()).not.toContain('ada');
    expect(rowFor('credentials')).toContain('[redacted]');
  });

  it('offers no twisty on a masked row — there is nothing behind it', async () => {
    await setup({
      value: { credentials: { user: 'ada' } },
      expandDepth: 5,
      redact: secretKeyRedactor,
    });
    const row = rows().find((r) => r.textContent?.startsWith('credentials:'))!;
    expect(row.closest('[role="treeitem"]')!.hasAttribute('aria-expanded')).toBe(false);
  });

  it('matches on the key rather than guessing from the value', () => {
    // A heuristic over values flags a random-looking order id and misses "hunter2".
    expect(secretKeyRedactor({ path: '$.x', key: 'X-Api-Key', kind: 'string', value: 'a' })).toBe(true);
    expect(secretKeyRedactor({ path: '$.x', key: 'refreshToken', kind: 'string', value: 'a' })).toBe(true);
    expect(secretKeyRedactor({ path: '$.x', key: 'client_secret', kind: 'string', value: 'a' })).toBe(true);
    expect(secretKeyRedactor({ path: '$.x', key: 'orderId', kind: 'string', value: 'kY3nQ8' })).toBe(false);
  });
});

// ── Getters and hidden properties ────────────────────────────────────────────

describe('json-viewer — childrenOf() does not run the value', () => {
  /**
   * ★★★ `Object.entries` CALLS EVERY GETTER IT FINDS.
   *
   * On a fixture that is harmless. On the objects people paste into a debug
   * drawer it can hit the network, mutate state or throw — and opening a panel
   * to look at an object is not consent to execute it.
   */
  it('lists an accessor without invoking it', () => {
    let calls = 0;
    const value = {
      plain: 1,
      get lazy() {
        calls++;
        return 'expensive';
      },
    };

    const children = childrenOf(value, 'object', false);

    expect(calls).toBe(0);
    expect(children.items.map((c) => c.key)).toEqual(['plain', 'lazy']);
    expect(children.items[1].unreadGetter).toBe(true);
    expect(children.items[1].value).toBeUndefined();
  });

  it('invokes it when the host asks, and survives one that throws', () => {
    const value = {
      get ok() {
        return 7;
      },
      get broken(): never {
        throw new Error('backend unavailable');
      },
    };

    const children = childrenOf(value, 'object', false, true);

    expect(children.items[0].value).toBe(7);
    expect(children.items[1].threw).toBe(true);
    expect(children.items[1].value).toBe('backend unavailable');
  });

  /**
   * ★★ `Object.entries` IS ALSO SILENTLY PARTIAL. "This object has two fields"
   *    is a claim, and making it while hiding two more is worse than showing
   *    nothing.
   */
  it('counts the own properties it did not list', () => {
    const value: Record<string, unknown> = { shown: 1 };
    Object.defineProperty(value, 'hidden', { value: 2, enumerable: false });
    value[Symbol('tag') as unknown as string] = 3;

    const children = childrenOf(value, 'object', false);

    expect(children.items.map((c) => c.key)).toEqual(['shown']);
    expect(children.nonEnumerable).toBe(1);
    expect(children.symbolKeys).toBe(1);
    expect(omissionNote(children)).toBe(
      '+ 1 non-enumerable, 1 symbol-keyed own properties not shown',
    );
  });

  it('says nothing when there is nothing hidden', () => {
    expect(omissionNote(childrenOf({ a: 1 }, 'object', false))).toBe('');
  });

  it('sorts by key on request, accessors included', () => {
    const value = {
      z: 1,
      get a() {
        return 2;
      },
    };
    expect(childrenOf(value, 'object', true).items.map((c) => c.key)).toEqual(['a', 'z']);
  });
});

describe('json-viewer — the prototype is named, not walked', () => {
  class User {
    constructor(readonly name: string) {}
    greet(): string {
      return `hi ${this.name}`;
    }
  }

  it('does not list inherited methods as properties', () => {
    const children = childrenOf(new User('Ada'), 'object', false);
    expect(children.items.map((c) => c.key)).toEqual(['name']);
  });

  /**
   * The consequence worth stating: a `get` in a class body is on the prototype,
   * so not walking the prototype means not listing it either — and not running
   * it, which is the point. Own accessors, which is how a lazily attached field
   * is actually defined, still show.
   */
  it('leaves a class-body accessor out, and an own one in', () => {
    class Order {
      readonly id = 'o1';
      // A `readonly` field is what the rule wants and is exactly what this must
      // not be: the subject here is a PROTOTYPE accessor, and a field would be an
      // own enumerable property that the assertion below expects to be absent.
      // eslint-disable-next-line @typescript-eslint/class-literal-property-style
      get total(): number {
        return 99;
      }
    }
    const order = new Order();
    expect(childrenOf(order, 'object', false).items.map((c) => c.key)).toEqual(['id']);

    Object.defineProperty(order, 'shipping', { enumerable: true, get: () => 5 });
    const withOwn = childrenOf(order, 'object', false);
    expect(withOwn.items.map((c) => c.key)).toEqual(['id', 'shipping']);
    expect(withOwn.items[1].unreadGetter).toBe(true);
  });

  /**
   * The class name is the one fact the unwalked prototype chain is still worth
   * saying — `{1}` alone loses that this was a `User` and not a bag of fields.
   */
  it('names the constructor in the preview', () => {
    expect(classNameOf(new User('Ada'))).toBe('User');
    expect(containerPreview('object', 1, 'User')).toBe('User {1}');
  });

  it('says nothing for a plain object or a null prototype', () => {
    expect(classNameOf({ a: 1 })).toBe('');
    expect(classNameOf(Object.create(null))).toBe('');
    expect(containerPreview('object', 1)).toBe('{1}');
  });
});

describe('SvJsonViewerComponent — getters and hidden properties on screen', () => {
  it('shows an accessor as an unread getter', async () => {
    await setup({
      value: {
        get token() {
          return 'secret';
        },
      },
      expandDepth: 2,
    });
    expect(rowFor('token')).toContain('getter');
    expect(bodyText()).not.toContain('secret');
  });

  it('reads it when told to', async () => {
    await setup({
      value: {
        get answer() {
          return 42;
        },
      },
      expandDepth: 2,
      evaluateGetters: true,
    });
    expect(rowFor('answer')).toContain('42');
  });

  it('discloses hidden own properties under the container', async () => {
    const value: Record<string, unknown> = { shown: 1 };
    Object.defineProperty(value, 'hidden', { value: 2, enumerable: false });

    await setup({ value, expandDepth: 2 });

    expect(bodyText()).toContain('1 non-enumerable own property not shown');
  });

  /** A notice about the tree is not a node in it. */
  it('does not make the disclosure a treeitem', async () => {
    const value: Record<string, unknown> = { shown: 1 };
    Object.defineProperty(value, 'hidden', { value: 2, enumerable: false });

    await setup({ value, expandDepth: 2 });

    const items = [...document.querySelectorAll('[role="treeitem"]')];
    expect(items).toHaveLength(2); // root + `shown`
  });
});

// ── The ceiling ──────────────────────────────────────────────────────────────

describe('SvJsonViewerComponent — the total row ceiling', () => {
  /** 40 containers of 40 children each: every one of them inside `maxChildren`. */
  const wide = () =>
    Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [
        `group${i}`,
        Object.fromEntries(Array.from({ length: 40 }, (_, j) => [`k${j}`, j])),
      ]),
    );

  /**
   * ★★★ `maxChildren` IS A WIDTH LIMIT, NOT A CEILING.
   *
   * 1,640 rows here all pass the per-container cap of 100, because nesting
   * multiplies and the per-container cap does not see it.
   */
  it('stops at maxRows and says that it did', async () => {
    await setup({ value: wide(), expandDepth: 3, maxRows: 200 });

    expect(rows().length).toBeLessThanOrEqual(200);
    expect(bodyText()).toContain('stopped at 200 rows');
  });

  it('says nothing when the whole tree fits', async () => {
    await setup({ value: { a: 1, b: 2 }, expandDepth: 2, maxRows: 200 });
    expect(bodyText()).not.toContain('stopped at');
  });

  /**
   * `expandAll()` and `*` reach the entire value at once, which is the fastest
   * way to find the ceiling — and the reason walking past it has to cost nothing.
   */
  it('holds when expandAll opens everything', async () => {
    const { fixture } = await setup({ value: wide(), expandDepth: 0, maxRows: 150 });
    fixture.componentInstance.expandAll();
    fixture.detectChanges();

    expect(rows().length).toBeLessThanOrEqual(150);
    expect(bodyText()).toContain('stopped at 150 rows');
  });

  it('is not a tab stop, so the keyboard cannot land on the notice', async () => {
    await setup({ value: wide(), expandDepth: 3, maxRows: 200 });
    const notices = [...document.querySelectorAll('p')].filter((p) =>
      p.textContent?.includes('stopped at'),
    );
    expect(notices).toHaveLength(1);
    expect(notices[0].hasAttribute('tabindex')).toBe(false);
  });
});

// ── Copy and click on an ANCESTOR go through the same redacting walk ────────

describe('SvJsonViewerComponent — ancestor copy is redacted (DD-19-I1/M1)', () => {
  const secretPayload = () => ({
    id: 'evt_1',
    headers: { authorization: 'Bearer sk_live_51H', 'content-type': 'application/json' },
  });

  function stubClipboard() {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    return writeText;
  }

  async function copyRoot(fixture: { detectChanges(): void }): Promise<void> {
    rows()[0].click();
    fixture.detectChanges();
    document.querySelector<HTMLElement>('button[aria-label^="Copy value"]')!.click();
    await Promise.resolve();
    await Promise.resolve();
  }

  it('copying `$` with a redacted descendant does not contain the secret', async () => {
    const writeText = stubClipboard();
    const { fixture } = await setup({ value: secretPayload(), expandDepth: 3, redact: secretKeyRedactor });
    const audited: unknown[] = [];
    fixture.componentInstance.copyAudited.subscribe((e) => audited.push(e));
    await copyRoot(fixture);

    const text = writeText.mock.calls[0][0] as string;
    expect(text).not.toContain('sk_live_51H');
    expect(JSON.parse(text)).toEqual({
      id: 'evt_1',
      headers: { authorization: '[redacted]', 'content-type': 'application/json' },
    });
    // The audit event says a mask was involved — and never carries the text.
    expect(audited).toHaveLength(1);
    expect(audited[0]).toMatchObject({ source: 'sv-json-viewer', field: '$', redacted: true });
    expect(Object.keys(audited[0] as object).sort()).toEqual(['at', 'field', 'redacted', 'source']);
  });

  it('masks a descendant even while the ancestor is collapsed', async () => {
    const writeText = stubClipboard();
    const { fixture } = await setup({ value: secretPayload(), expandDepth: 0, redact: secretKeyRedactor });
    await copyRoot(fixture);
    expect(writeText.mock.calls[0][0]).not.toContain('sk_live_51H');
  });

  it('copying a container does not invoke a getter', async () => {
    const writeText = stubClipboard();
    const getter = vi.fn(() => 'side effect');
    const value = { plain: 1 };
    Object.defineProperty(value, 'lazy', { get: getter, enumerable: true });
    const { fixture } = await setup({ value, expandDepth: 1 });
    await copyRoot(fixture);
    expect(getter).not.toHaveBeenCalled();
    expect(JSON.parse(writeText.mock.calls[0][0] as string)).toEqual({
      plain: 1,
      lazy: '(getter — not read)',
    });
  });

  it('copies a cycle as [Circular] instead of failing', async () => {
    const writeText = stubClipboard();
    const value: Record<string, unknown> = { name: 'loop' };
    value['self'] = value;
    const { fixture } = await setup({ value, expandDepth: 1 });
    await copyRoot(fixture);
    expect(JSON.parse(writeText.mock.calls[0][0] as string)).toEqual({ name: 'loop', self: '[Circular]' });
  });

  it('nodeClick on a container carries the redacted projection', async () => {
    const { fixture } = await setup({ value: secretPayload(), expandDepth: 3, redact: secretKeyRedactor });
    const clicks: { value: unknown }[] = [];
    fixture.componentInstance.nodeClick.subscribe((e) => clicks.push(e));
    rows().find((r) => r.textContent?.trim().startsWith('headers:'))!.click();
    expect(JSON.stringify(clicks[0].value)).not.toContain('sk_live_51H');
    expect(clicks[0].value).toEqual({ authorization: '[redacted]', 'content-type': 'application/json' });
  });

  it('nodeClick without a redactor keeps handing out the live value', async () => {
    const value = secretPayload();
    const { fixture } = await setup({ value, expandDepth: 3 });
    const clicks: { value: unknown }[] = [];
    fixture.componentInstance.nodeClick.subscribe((e) => clicks.push(e));
    rows().find((r) => r.textContent?.trim().startsWith('headers:'))!.click();
    expect(clicks[0].value).toBe(value.headers);
  });
});
