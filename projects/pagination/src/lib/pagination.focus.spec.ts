import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvLiveAnnouncer } from '@styloviz/core';
import { untilRendered } from '../../../../src/testing/async';
import { SvPaginationComponent } from './pagination.component';

/**
 * ============================================================================
 *  Focus and announcement after a page change — `X-14`, `NV-04-I6`, `NV-04-M5`
 * ============================================================================
 *
 * ★ Paging is the one navigation in the kit with no destination. The rows change
 * and the page number changes — and a screen reader says nothing, because it
 * narrates what it is focused on and focus has not moved. If the host re-renders
 * the control, focus lands on `<body>`: the top of the document, so the next Tab
 * goes to the site's first link. They paged forward and were returned to the
 * start of the page, silently.
 *
 * ★★ And the obvious fix — move focus into the new results — is wrong for the
 * common case. Paging is a sequence: next, next, next. Moving focus into the
 * results means Shift-Tabbing back to the control before every subsequent press,
 * so it makes the ordinary interaction worse. Focus is RESTORED to the button
 * that was pressed, and the announcement does the work the focus move would have.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const said: string[] = [];
  const { fixture } = await render(SvPaginationComponent, {
    inputs: { totalItems: 200, pageSize: 10, ...inputs },
  });
  const announcer = TestBed.inject(SvLiveAnnouncer);
  vi.spyOn(announcer, 'announce').mockImplementation((m: string) => {
    said.push(m);
    return true;
  });
  return { fixture, said };
}

const root = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const button = (f: { nativeElement: unknown }, label: string) =>
  root(f).querySelector<HTMLElement>(`[aria-label="${label}"]`);

describe('SvPaginationComponent — focus after a page change', () => {
  it('leaves focus on the control that was pressed', async () => {
    const { fixture } = await setup();
    const next = button(fixture, 'Next page')!;

    next.focus();
    fixture.componentInstance.goTo(2);
    fixture.detectChanges();
    await untilRendered(fixture, () => document.activeElement === next);

    expect(document.activeElement).toBe(next);
  });

  /**
   * ★ Next disables itself on the last page, so a user who paged to the end has
   * to land on something. The policy falls back to the other direction, and then
   * to the nav landmark — never `<body>`.
   */
  it('falls back when the pressed control is gone', async () => {
    const { fixture } = await setup({ totalItems: 20 });
    const next = button(fixture, 'Next page')!;

    next.focus();
    fixture.componentInstance.goTo(2);
    fixture.detectChanges();
    await untilRendered(fixture, () => document.activeElement !== next);

    expect(document.activeElement).not.toBe(document.body);
    expect(button(fixture, 'Previous page')).toBe(document.activeElement);
  });

  /**
   * A host that drove the change itself — a URL, a deep link, its own button —
   * did not have focus in here, and a component that grabs it would be yanking
   * the page away from whatever the user was actually doing.
   */
  it('does not grab focus when the change came from outside', async () => {
    const { fixture } = await setup();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();

    fixture.componentInstance.goTo(3);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 5));

    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
});

describe('SvPaginationComponent — what it announces', () => {
  /** The announcement does the work the focus move deliberately does not. */
  it('says which page, out of how many', async () => {
    const { fixture, said } = await setup();
    button(fixture, 'Next page')!.focus();

    fixture.componentInstance.goTo(3);
    fixture.detectChanges();
    await untilRendered(fixture, () => said.length > 0);

    expect(said).toEqual(['Page 3 of 20.']);
  });
});

describe('SvPaginationComponent — scrollToTop', () => {
  /**
   * ★ Off by default, and that is the honest default: whether the list starts at
   * the top of the viewport depends on the host's layout, which this component
   * cannot see. Scrolling a paginator embedded in a card yanks the page for no
   * reason.
   */
  it('does not scroll unless asked', async () => {
    const { fixture } = await setup();
    const scroll = vi.fn();
    root(fixture).scrollIntoView = scroll;

    fixture.componentInstance.goTo(2);
    expect(scroll).not.toHaveBeenCalled();
  });

  it('falls back to scrolling the paginator itself when no scrollTarget is given', async () => {
    const { fixture } = await setup({ scrollToTop: true });
    const scroll = vi.fn();
    root(fixture).scrollIntoView = scroll;

    fixture.componentInstance.goTo(2);
    expect(scroll).toHaveBeenCalledWith({ block: 'start' });
  });

  /**
   * ★ `NV-04-M5`. The paginator usually sits BELOW the list, so scrolling it into
   * view lands the user at the bottom of the new page. The results are the target.
   */
  it('scrolls the results, not the paginator, when a scrollTarget is given', async () => {
    const results = document.createElement('section');
    const toResults = vi.fn();
    results.scrollIntoView = toResults;
    const { fixture } = await setup({ scrollToTop: true, scrollTarget: results });
    const toHost = vi.fn();
    root(fixture).scrollIntoView = toHost;

    fixture.componentInstance.goTo(2);

    expect(toResults).toHaveBeenCalledWith({ block: 'start' });
    expect(toHost).not.toHaveBeenCalled();
  });
});
