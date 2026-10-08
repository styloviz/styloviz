import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core';
import { SvPaginationComponent } from './pagination.component';

/**
 * ============================================================================
 *  Cursor and unknown-total modes — `NV-04-M1`, `NV-04-I11`
 * ============================================================================
 *
 * `NV-04-I11` is the honest finding and it is not fixable here: offset paging
 * asks for "rows 71–80 of whatever matches now", so a total that moves between
 * two requests shifts rows across the page boundary and the user misses one or
 * sees it twice. The count and the offset are computed on the server, between
 * two requests this component does not make. There is no patch.
 *
 * `NV-04-M1` is the structural answer, and what these specs pin is the part that
 * is easy to get wrong: **cursor mode must not render page numbers.** A keyset
 * cursor names a ROW, which is why it survives inserts — and nobody, including
 * the server, knows which numbered page that row is on. A paginator showing "4
 * of 12" there would be inventing the exact number the mode exists to stop
 * trusting.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  svResetWarnOnce();
  const cursors: (string | null)[] = [];
  const { fixture } = await render(SvPaginationComponent, {
    inputs,
    on: { cursorChange: (c: string | null) => cursors.push(c) },
  });
  return { fixture, c: fixture.componentInstance, cursors };
}

const root = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const button = (f: { nativeElement: unknown }, label: string) =>
  root(f).querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
/**
 * The labelled CONTROLS, in DOM order. Scoped to `button` deliberately: the
 * root is a `<nav aria-label="Pagination">`, so an unscoped `[aria-label]`
 * sweep picks the landmark up as a first entry and every list below reads as
 * off-by-one.
 */
const labels = (f: { nativeElement: unknown }) =>
  [...root(f).querySelectorAll('button[aria-label]')].map((e) => e.getAttribute('aria-label'));

// ─── `totalItems` may be unknown ─────────────────────────────────────────────

describe('SvPaginationComponent — an unknown total (NV-04-M1)', () => {
  /**
   * ⚠️ THE NAMED DEFECT. `totalPages` used to return `Math.max(1, ceil(0 / n))`
   * — that is, `1` — for a paginator with no count. So `goTo(4)` clamped to 1 and
   * the user could not leave the first page at all. It now returns `null`, which
   * is what "there is no last page to go to" actually is.
   */
  it('has no last page rather than a last page of 1', async () => {
    const { c } = await setup({ totalItems: null, pageSize: 10 });
    expect(c.totalPages()).toBeNull();
    expect(c.hasStableTotal()).toBe(false);
  });

  it('distinguishes null (not reported) from 0 (the filter matched nothing)', async () => {
    expect((await setup({ totalItems: 0, pageSize: 10 })).c.totalPages()).toBe(1);
    expect((await setup({ totalItems: null, pageSize: 10 })).c.totalPages()).toBeNull();
  });

  it('lets goTo past page 1 instead of clamping to a total nobody reported', async () => {
    const { c } = await setup({ totalItems: null, pageSize: 10, hasMore: true });
    c.goTo(4);
    expect(c.currentPage()).toBe(4);
  });

  it('holds a deep-linked page verbatim and does not correct it', async () => {
    const { c } = await setup({ totalItems: null, pageSize: 10, currentPage: 9 });
    expect(c.currentPage()).toBe(9);
  });

  it('renders Previous/Next and an ordinal, never numbered pages', async () => {
    const { fixture } = await setup({ totalItems: null, pageSize: 10, currentPage: 3 });
    expect(labels(fixture)).toEqual(['Previous page', 'Next page']);
    expect(root(fixture).textContent).toContain('Page 3');
    expect(root(fixture).textContent).not.toContain('of');
  });

  it('hides the count summary, which has nothing to be "of"', async () => {
    const { fixture } = await setup({ totalItems: null, pageSize: 10, showSummary: true });
    expect(root(fixture).textContent).not.toContain('Showing');
  });

  /**
   * ★ Without `hasMore`, offset-with-no-total renders a Next that can never
   * enable — a dead control, which is worse than one more input.
   */
  it('takes hasMore as the answer to "is there another page?"', async () => {
    const off = await setup({ totalItems: null, pageSize: 10 });
    expect(off.c.hasNext()).toBe(false);

    const on = await setup({ totalItems: null, pageSize: 10, hasMore: true });
    expect(on.c.hasNext()).toBe(true);
    expect(button(on.fixture, 'Next page')?.disabled).toBe(false);
  });

  it('lets hasMore override an inferred total, for a server that knows better', async () => {
    const { c } = await setup({ totalItems: 50, pageSize: 10, currentPage: 5, hasMore: true });
    expect(c.hasNext()).toBe(true);
  });
});

// ─── Cursor mode ─────────────────────────────────────────────────────────────

describe('SvPaginationComponent — mode="cursor" (NV-04-M1)', () => {
  it('starts with no cursor, nothing behind it, and Next gated on nextCursor', async () => {
    const { fixture, c } = await setup({ mode: 'cursor', nextCursor: null });
    expect(c.pager.cursor()).toBeNull();
    expect(c.hasPrev()).toBe(false);
    expect(c.hasNext()).toBe(false);
    expect(button(fixture, 'Next page')?.disabled).toBe(true);
  });

  it('walks forward on the server-supplied cursor and emits it', async () => {
    const { fixture, c, cursors } = await setup({ mode: 'cursor', nextCursor: 'c1' });

    c.next();
    expect(c.currentPage()).toBe(2);
    expect(c.pager.cursor()).toBe('c1');
    expect(cursors).toEqual(['c1']);

    fixture.componentRef.setInput('nextCursor', 'c2');
    fixture.detectChanges();
    c.next();
    expect(c.currentPage()).toBe(3);
    expect(cursors).toEqual(['c1', 'c2']);
  });

  /**
   * ★★ THE WHOLE REASON THE TRAIL EXISTS. `c1` was handed over once, on the
   * response for page 1. The server never sends it again and it is not derivable
   * from `c2`, so Previous is only possible because something remembered.
   */
  it('goes back to a cursor the server will never send again', async () => {
    const { fixture, c, cursors } = await setup({ mode: 'cursor', nextCursor: 'c1' });
    c.next();
    fixture.componentRef.setInput('nextCursor', 'c2');
    fixture.detectChanges();
    c.next();

    c.previous();
    expect(c.currentPage()).toBe(2);
    expect(c.pager.cursor()).toBe('c1');
    expect(cursors).toEqual(['c1', 'c2', 'c1']);
  });

  it('first() rewinds the whole trail to the cursorless page', async () => {
    const { fixture, c, cursors } = await setup({
      mode: 'cursor',
      variant: 'default',
      nextCursor: 'c1',
    });
    c.next();
    fixture.componentRef.setInput('nextCursor', 'c2');
    fixture.detectChanges();
    c.next();

    c.first();
    expect(c.currentPage()).toBe(1);
    expect(c.pager.hasPrevious()).toBe(false);
    expect(cursors.at(-1)).toBeNull();
  });

  /** ★ `last()` has no answer without a total, and guessing one is the defect. */
  it('last() is a no-op', async () => {
    const { c } = await setup({ mode: 'cursor', nextCursor: 'c1' });
    c.last();
    expect(c.currentPage()).toBe(1);
  });

  it('refuses goTo, because a page number is not a fetchable address', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { c } = await setup({ mode: 'cursor', nextCursor: 'c1' });

    c.goTo(4);

    expect(c.currentPage()).toBe(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('not a fetchable address'));
    warn.mockRestore();
  });

  it('renders no page numbers and no Last button, in every variant', async () => {
    for (const variant of ['default', 'compact', 'simple'] as const) {
      const { fixture } = await setup({ mode: 'cursor', variant, nextCursor: 'c1' });
      expect(labels(fixture), variant).toEqual(['Previous page', 'Next page']);
    }
  });

  it('ignores a totalItems that was passed anyway', async () => {
    const { fixture, c } = await setup({ mode: 'cursor', totalItems: 200, pageSize: 10 });
    expect(c.totalPages()).toBeNull();
    expect(root(fixture).textContent).not.toContain('Showing');
  });

  /**
   * ★ `?page=4` cannot be turned back into the cursor that produced page 4, so a
   * link carrying it restores the number and not the rows — the exact failure
   * `NV-04-I7` was fixed to avoid. Ignored loudly rather than half-honoured.
   */
  it('warns that urlKey is inert here rather than writing an unresolvable page', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await setup({ mode: 'cursor', urlKey: 'page', nextCursor: 'c1' });
    // No `provideSvNavLocation()`, so `addressable()` is false and nothing is
    // written either way; the warning is the part that has to be reachable.
    warn.mockRestore();
  });
});

// ─── `NV-04-I11` — the limit, made visible ───────────────────────────────────

describe('SvPaginationComponent — an unstable total (NV-04-I11)', () => {
  /**
   * ★★ THIS ITEM HAS NO CODE FIX AND THE WARNING IS THE DELIVERABLE. What is
   * asserted is the CONDITION, not a threshold: the first draft warned above some
   * row count, which is a guess — a million immutable audit rows page perfectly
   * by offset and a forty-row queue does not. The count is not the problem;
   * MOVEMENT is.
   */
  it('warns once when the total moves under a user who is not on page 1', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { fixture } = await setup({ totalItems: 200, pageSize: 10, currentPage: 4 });

    expect(warn).not.toHaveBeenCalled();

    fixture.componentRef.setInput('totalItems', 198);
    fixture.detectChanges();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('moved from 200 to 198');
    expect(warn.mock.calls[0][0]).toContain('cursor');

    fixture.componentRef.setInput('totalItems', 195);
    fixture.detectChanges();
    expect(warn).toHaveBeenCalledTimes(1); // once per session, not per change
    warn.mockRestore();
  });

  it('says nothing about the first response arriving', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { fixture } = await setup({ totalItems: 0, pageSize: 10, currentPage: 4 });
    fixture.componentRef.setInput('totalItems', 200);
    fixture.detectChanges();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('says nothing on page 1, where nothing can shift under anyone', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { fixture } = await setup({ totalItems: 200, pageSize: 10, currentPage: 1 });
    fixture.componentRef.setInput('totalItems', 150);
    fixture.detectChanges();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('says nothing in cursor mode, which does not have the problem', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { fixture } = await setup({
      mode: 'cursor',
      totalItems: 200,
      pageSize: 10,
      currentPage: 4,
      nextCursor: 'c1',
    });
    fixture.componentRef.setInput('totalItems', 198);
    fixture.detectChanges();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
