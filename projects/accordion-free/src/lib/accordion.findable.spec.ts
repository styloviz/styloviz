import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import {
  SvAccordionComponent,
  type AccordionItem,
  type AccordionToggleEvent,
} from './accordion.component';

/**
 * `NV-01-I8` — collapsed content and browser find-in-page.
 *
 * ★★ WHAT IS TESTED HERE IS THE CONTRACT, NOT THE BROWSER. jsdom implements
 *    neither `hidden="until-found"` nor `beforematch` nor `inert`'s semantics,
 *    and no amount of test scaffolding will make `Ctrl+F` exist. So what is
 *    pinned is everything the component actually decides: which of the two
 *    attributes it emits, that it NEVER emits both, which panels it refuses to
 *    make findable, and what its own state does when the event arrives.
 *
 * ★ `inert` was the thing hiding the content. An inert subtree is skipped by
 *   find-in-page, so the attribute that made a collapsed panel safe also made
 *   it unfindable — which is why the fix is a SWAP and the assertion that
 *   matters most is `not.toHaveAttribute('inert')` beside the new one.
 */

const ITEMS: AccordionItem[] = [
  { id: 'shipping', title: 'Shipping', content: 'Ships in 2 days.' },
  { id: 'returns', title: 'Returns', content: 'Thirty days.' },
  { id: 'legal', title: 'Legal', content: 'The small print.', disabled: true },
];

/**
 * Pretend to be a browser that implements `hidden="until-found"`.
 *
 * The component probes `'onbeforematch' in document.documentElement`, which is
 * the only honest probe (see the component's note), so installing the property
 * on the prototype is exactly what a supporting browser looks like.
 */
function withUntilFound(): () => void {
  return swapProbe({ value: null, writable: true, configurable: true });
}

/**
 * Pretend to be a browser that does NOT.
 *
 * ★★ THIS IS NOT THE TEST ENVIRONMENT'S DEFAULT, and assuming it was is what
 *    made this file wrong the first time. **jsdom 26 defines `onbeforematch` on
 *    `HTMLElement.prototype`** — an accessor, enumerable and configurable —
 *    while implementing none of `until-found`: no `content-visibility`, no
 *    reveal, no `beforematch` dispatch. So the only honest probe a browser can
 *    make has a false positive in the only environment these tests run in.
 *
 * ★ That is a fact about jsdom, not a reason to weaken the probe. There is no
 *   second signal to AND it with that a non-supporting *browser* would fail,
 *   and a probe tuned to satisfy jsdom would start denying find-in-page to
 *   Chrome. So neither world is the default here: both describe blocks install
 *   the one they mean, and any spec elsewhere that asserts `inert` on a
 *   collapsed panel has to do the same.
 */
function withoutUntilFound(): () => void {
  return swapProbe(undefined);
}

/** Install (or remove) the probe property, restoring whatever jsdom had. */
function swapProbe(descriptor: PropertyDescriptor | undefined): () => void {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  const original = Object.getOwnPropertyDescriptor(proto, 'onbeforematch');
  if (descriptor === undefined) delete proto['onbeforematch'];
  else Object.defineProperty(proto, 'onbeforematch', descriptor);
  return () => {
    delete proto['onbeforematch'];
    if (original) Object.defineProperty(proto, 'onbeforematch', original);
  };
}

async function setup(inputs: Partial<ComponentInput<SvAccordionComponent>> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAccordionComponent, {
    inputs: { items: ITEMS, ...inputs } as ComponentInput<SvAccordionComponent>,
  });
  return fixture;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const headers = (f: { nativeElement: unknown }) =>
  [...el(f).querySelectorAll<HTMLButtonElement>('button[aria-expanded]')];
/** The inner overflow wrapper — the element that actually holds the body. */
const bodies = (f: { nativeElement: unknown }) =>
  [...el(f).querySelectorAll<HTMLElement>('[role="region"] > div')];
const hiddenAttrs = (f: { nativeElement: unknown }) =>
  bodies(f).map((d) => d.getAttribute('hidden'));
const inertAttrs = (f: { nativeElement: unknown }) =>
  bodies(f).map((d) => d.hasAttribute('inert'));

describe('SvAccordionComponent — findability without support', () => {
  let restore: () => void;
  beforeEach(() => { restore = withoutUntilFound(); });
  afterEach(() => restore());

  it('keeps today’s behaviour exactly where the browser has no until-found', async () => {
    const f = await setup();
    expect(inertAttrs(f)).toEqual([true, true, true]);
    expect(hiddenAttrs(f)).toEqual([null, null, null]);
  });
});

describe('SvAccordionComponent — findability with support', () => {
  let restore: () => void;
  beforeEach(() => { restore = withUntilFound(); });
  afterEach(() => restore());

  it('marks a collapsed panel hidden="until-found" and drops inert', async () => {
    const f = await setup();
    // ★ Exactly one of the two. `inert` alongside `until-found` would re-close
    //   the one door being opened: find-in-page skips inert subtrees.
    expect(hiddenAttrs(f)).toEqual(['until-found', 'until-found', null]);
    expect(inertAttrs(f)).toEqual([false, false, true]);
  });

  it('never emits plain hidden, which would be display:none', async () => {
    const f = await setup();
    for (const value of hiddenAttrs(f)) {
      expect(value).not.toBe('');
    }
  });

  it('carries neither attribute once the panel is open', async () => {
    const f = await setup({ openIds: new Set(['shipping']) });
    expect(hiddenAttrs(f)[0]).toBeNull();
    expect(inertAttrs(f)[0]).toBe(false);
  });

  it('refuses to make a DISABLED panel findable', async () => {
    // The browser reveals a match by deleting the attribute, and the component
    // cannot refuse — so `Ctrl+F` would become a way around `disabled`.
    const f = await setup();
    expect(hiddenAttrs(f)[2]).toBeNull();
    expect(inertAttrs(f)[2]).toBe(true);
  });

  it('honours findInPage=false for content meant to stay hidden', async () => {
    const f = await setup({ findInPage: false });
    expect(hiddenAttrs(f)).toEqual([null, null, null]);
    expect(inertAttrs(f)).toEqual([true, true, true]);
  });
});

describe('SvAccordionComponent — the browser reveals a panel itself', () => {
  let restore: () => void;
  beforeEach(() => { restore = withUntilFound(); });
  afterEach(() => restore());

  it('adopts the reveal as a real expansion, so DOM and state agree', async () => {
    const f = await setup();
    const seen: AccordionToggleEvent[] = [];
    f.componentInstance.itemToggled.subscribe((e) => seen.push(e));

    // The UA has already removed `hidden` by the time this fires.
    bodies(f)[1].dispatchEvent(new Event('beforematch', { bubbles: true }));
    f.detectChanges();

    expect([...f.componentInstance.openIds()]).toEqual(['returns']);
    expect(headers(f)[1].getAttribute('aria-expanded')).toBe('true');
    // And the attributes are gone, so the panel is not simultaneously skipped.
    expect(hiddenAttrs(f)[1]).toBeNull();
    expect(inertAttrs(f)[1]).toBe(false);
    expect(seen).toEqual([{ id: 'returns', open: true, source: 'find-in-page' }]);
  });

  it('honours single-expand: the previously open panel closes', async () => {
    const f = await setup({ openIds: new Set(['shipping']) });
    bodies(f)[1].dispatchEvent(new Event('beforematch', { bubbles: true }));
    f.detectChanges();
    expect([...f.componentInstance.openIds()]).toEqual(['returns']);
  });

  it('keeps every open panel in multi mode', async () => {
    const f = await setup({ expandMode: 'multi', openIds: new Set(['shipping']) });
    bodies(f)[1].dispatchEvent(new Event('beforematch', { bubbles: true }));
    f.detectChanges();
    expect([...f.componentInstance.openIds()].sort()).toEqual(['returns', 'shipping']);
  });

  it('says nothing when the panel was already open', async () => {
    const f = await setup({ openIds: new Set(['shipping']) });
    const seen: AccordionToggleEvent[] = [];
    f.componentInstance.itemToggled.subscribe((e) => seen.push(e));

    bodies(f)[0].dispatchEvent(new Event('beforematch', { bubbles: true }));
    f.detectChanges();
    expect(seen).toEqual([]);
  });
});
