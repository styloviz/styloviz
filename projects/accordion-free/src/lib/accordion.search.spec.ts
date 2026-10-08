import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvLiveAnnouncer } from '@styloviz/core';
import {
  SvAccordionComponent,
  type AccordionItem,
  type AccordionToggleEvent,
} from './accordion.component';

/**
 * `NV-01-M5` — search, reveal and highlight.
 *
 * ★★ THE POINT OF THE FEATURE IS THAT A REVEAL IS NOT AN EXPANSION. "Why is
 *    this panel open" is a different question from "is it open", and the reveal
 *    registry keeps the two apart: a query opens the panels it matched, clearing
 *    it puts every panel back exactly as the reader left it, and `openIds` — the
 *    thing the host binds, persists and puts in the URL — is never touched.
 *    That separation is what the P2 print contract reuses, so it is tested here
 *    through `reveal('print', …)` as well as through the query.
 *
 * ★ And the highlight is a SECURITY test as much as a visual one. The four-line
 *   version of "mark the match" builds `<mark>` from the query and binds it to
 *   `[innerHTML]` (`FI-01-I3`); this one splits text into segments and lets the
 *   template write the element, so nothing ever reaches the HTML parser.
 */

const ITEMS: AccordionItem[] = [
  { id: 'shipping', title: 'Shipping', content: 'Ships in 2 days by courier.' },
  { id: 'returns', title: 'Returns', content: 'Thirty days, no courier needed.' },
  { id: 'legal', title: 'Legal', content: 'Courier liability, the small print.', disabled: true },
];

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
const expanded = (f: { nativeElement: unknown }) =>
  headers(f).map((b) => b.getAttribute('aria-expanded'));
const rows = (f: { nativeElement: unknown }) =>
  [...el(f).querySelectorAll<HTMLElement>('[role="region"]')].map((p) => p.style.gridTemplateRows);
const marks = (f: { nativeElement: unknown }) =>
  [...el(f).querySelectorAll('mark')].map((m) => m.textContent);

function search(f: { componentRef: { setInput(k: string, v: unknown): void }; detectChanges(): void }, q: string) {
  f.componentRef.setInput('searchQuery', q);
  f.detectChanges();
}

describe('SvAccordionComponent — search reveals what matches', () => {
  it('renders no <mark> and no extra state without a query', async () => {
    const f = await setup();
    expect(marks(f)).toEqual([]);
    expect(expanded(f)).toEqual(['false', 'false', 'false']);
  });

  it('opens the panel whose BODY holds the match — the text nobody could find', async () => {
    const f = await setup();
    search(f, 'in 2 days');
    expect(expanded(f)).toEqual(['true', 'false', 'false']);
    expect(rows(f)).toEqual(['1fr', '0fr', '0fr']);
  });

  it('opens on a title match too, case-insensitively', async () => {
    const f = await setup();
    search(f, 'RETURNS');
    expect(expanded(f)).toEqual(['false', 'true', 'false']);
  });

  it('reports the matching ids in items order', async () => {
    const f = await setup();
    search(f, 'courier');
    expect(f.componentInstance.matchedIds()).toEqual(['shipping', 'returns', 'legal']);
  });

  it('refuses to reveal a DISABLED panel it matched', async () => {
    // Same call `syncFromUrl` makes: a section the UI has closed off is not
    // opened by a URL, and is not opened by a search either.
    const f = await setup();
    search(f, 'courier');
    expect(expanded(f)).toEqual(['true', 'true', 'false']);
  });

  it('shows every match in single-expand mode, and still holds one openId', async () => {
    // ★ A deliberate decision: `single` constrains what the USER can have open.
    // Answering "where is this text" with one of three hits is not an answer.
    const f = await setup({ expandMode: 'single' });
    search(f, 'days');
    expect(expanded(f)).toEqual(['true', 'true', 'false']);
    expect([...f.componentInstance.openIds()]).toEqual([]);
  });

  it('closes nothing the reader opened', async () => {
    const f = await setup({ expandMode: 'multi', openIds: new Set(['returns']) });
    search(f, 'in 2 days');
    expect(expanded(f)).toEqual(['true', 'true', 'false']);
  });

  it('never writes the open set, so a reveal cannot be persisted by accident', async () => {
    const f = await setup({ openIds: new Set(['returns']) });
    search(f, 'in 2 days');
    expect([...f.componentInstance.openIds()]).toEqual(['returns']);
  });

  it('restores exactly the reader’s own state when the query is cleared', async () => {
    const f = await setup({ expandMode: 'multi', openIds: new Set(['returns']) });
    search(f, 'in 2 days');
    expect(expanded(f)).toEqual(['true', 'true', 'false']);

    search(f, '');
    expect(expanded(f)).toEqual(['false', 'true', 'false']);
    expect(marks(f)).toEqual([]);
  });

  it('treats a whitespace-only query as no query', async () => {
    const f = await setup();
    search(f, '   ');
    expect(expanded(f)).toEqual(['false', 'false', 'false']);
  });

  it('announces the match count, so the reveal is not a silent visual change', async () => {
    const f = await setup();
    const announcer = TestBed.inject(SvLiveAnnouncer);
    const spy = vi.spyOn(announcer, 'announce');

    search(f, 'courier');
    expect(spy.mock.calls.at(-1)?.[0]).toBe('3 sections match courier.');

    search(f, 'nothing here');
    expect(spy.mock.calls.at(-1)?.[0]).toBe('No sections match nothing here.');
    spy.mockRestore();
  });
});

describe('SvAccordionComponent — the highlight', () => {
  it('marks every occurrence, with the text’s own capitalisation', async () => {
    const f = await setup();
    search(f, 'day');
    // 'Ships in 2 days…' and 'Thirty days…' — the slice comes out of the
    // content, not out of the query, so a lower-case search keeps 'Day' if the
    // text had one.
    expect(marks(f)).toEqual(['day', 'day']);
  });

  it('marks the header as well as the body', async () => {
    const f = await setup();
    search(f, 'ship');
    const inHeader = [...headers(f)[0].querySelectorAll('mark')].map((m) => m.textContent);
    expect(inHeader).toEqual(['Ship']);
  });

  it('does not break the word it highlights with stray whitespace', async () => {
    const f = await setup();
    search(f, 'hipp');
    // The segments are rendered tight against their tags; a newline in the
    // template would land inside the word as a real space.
    expect(headers(f)[0].textContent).toContain('Shipping');
  });

  it('builds NO markup from the query — a query full of tags is text', async () => {
    const f = await setup({
      items: [{ id: 'x', title: 'Tagged', content: 'before <img src=y> after' }],
    });
    search(f, '<img src=y>');

    expect(el(f).querySelector('img')).toBeNull();
    expect(marks(f)).toEqual(['<img src=y>']);
  });
});

describe('SvAccordionComponent — a revealed panel is still operable', () => {
  it('closes on ONE click, rather than being a dead control', async () => {
    // ★ The defect this prevents: `openIds` never held the id, so deleting it
    //   is a no-op and the reveal reopens the panel on the next read.
    const f = await setup();
    search(f, 'in 2 days');
    expect(expanded(f)).toEqual(['true', 'false', 'false']);

    await userEvent.click(headers(f)[0]);
    f.detectChanges();
    expect(expanded(f)).toEqual(['false', 'false', 'false']);
  });

  it('reopens it again on the next click', async () => {
    const f = await setup();
    search(f, 'in 2 days');
    await userEvent.click(headers(f)[0]);
    f.detectChanges();
    await userEvent.click(headers(f)[0]);
    f.detectChanges();
    expect(expanded(f)).toEqual(['true', 'false', 'false']);
  });

  it('reports the close to the host like any other', async () => {
    const f = await setup();
    const seen: AccordionToggleEvent[] = [];
    f.componentInstance.itemToggled.subscribe((e) => seen.push(e));

    search(f, 'in 2 days');
    await userEvent.click(headers(f)[0]);
    f.detectChanges();
    expect(seen).toEqual([{ id: 'shipping', open: false, source: 'user' }]);
  });

  it('forgets a dismissal when the query changes', async () => {
    const f = await setup();
    search(f, 'in 2 days');
    await userEvent.click(headers(f)[0]);
    f.detectChanges();
    expect(expanded(f)).toEqual(['false', 'false', 'false']);

    // A new search is a new question; the answer cannot be silently suppressed
    // by something the reader did to the previous one.
    search(f, 'courier');
    expect(expanded(f)).toEqual(['true', 'true', 'false']);
  });
});

describe('SvAccordionComponent — the reveal seam the print contract reuses', () => {
  it('opens panels for a named source without touching the open set', async () => {
    const f = await setup({ openIds: new Set(['returns']) });
    f.componentInstance.reveal('print', ['shipping', 'returns']);
    f.detectChanges();

    expect(expanded(f)).toEqual(['true', 'true', 'false']);
    expect([...f.componentInstance.openIds()]).toEqual(['returns']);
  });

  it('withdraws by source, leaving the reader’s expansion intact', async () => {
    const f = await setup({ openIds: new Set(['returns']) });
    f.componentInstance.reveal('print', ['shipping']);
    f.detectChanges();
    f.componentInstance.withdrawReveal('print');
    f.detectChanges();

    expect(expanded(f)).toEqual(['false', 'true', 'false']);
  });

  it('does not close a panel a live search is still holding', async () => {
    // ★ Why the registry is a MAP: two sources can hold one panel, and the one
    //   that leaves must not close it on the other's behalf.
    const f = await setup();
    search(f, 'in 2 days');
    f.componentInstance.reveal('print', ['shipping', 'returns']);
    f.detectChanges();
    expect(expanded(f)).toEqual(['true', 'true', 'false']);

    f.componentInstance.withdrawReveal('print');
    f.detectChanges();
    expect(expanded(f)).toEqual(['true', 'false', 'false']);
  });

  it('reports revealed ids separately from the open set', async () => {
    const f = await setup({ openIds: new Set(['returns']) });
    search(f, 'in 2 days');
    expect([...f.componentInstance.revealedIds()]).toEqual(['shipping']);
    expect([...f.componentInstance.openIds()]).toEqual(['returns']);
  });

  it('is a no-op to withdraw a source that never revealed anything', async () => {
    const f = await setup();
    f.componentInstance.withdrawReveal('print');
    f.detectChanges();
    expect(expanded(f)).toEqual(['false', 'false', 'false']);
  });
});
