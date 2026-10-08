import { TestBed } from '@angular/core/testing';
import { render, screen, fireEvent } from '@testing-library/angular';
import { untilRendered } from '../../../../src/testing/async';
import { SvAnchorComponent, type AnchorItem } from './anchor.component';

/**
 * ============================================================================
 *  Focus after following an anchor — `X-14`, `NV-02-M7`
 * ============================================================================
 *
 * ★ This is the one case in the kit where the NATIVE behaviour was already right
 * and the component broke it. A real `href="#id"` moves focus to the target as
 * well as scrolling — that is what the browser does — and this component calls
 * `preventDefault()` on every rail click in order to apply `offset`.
 *
 * Taking over the scroll means taking over the focus move too. Keeping one and
 * dropping the other is how a component ends up less accessible than the markup
 * it replaced: the page scrolls, a sighted user reads the section, and a keyboard
 * user's next Tab goes to the NEXT RAIL ITEM rather than into the content they
 * asked for.
 */

class FakeIntersectionObserver {
  constructor(public readonly callback: IntersectionObserverCallback) { /* noop */ }
  observe(): void { /* noop */ }
  disconnect(): void { /* noop */ }
  unobserve(): void { /* noop */ }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

const ITEMS: readonly AnchorItem[] = [
  { id: 'intro', label: 'Introduction' },
  { id: 'usage', label: 'Usage' },
];

describe('SvAnchorComponent — focus after a jump', () => {
  let originalIO: typeof IntersectionObserver | undefined;

  beforeEach(() => {
    originalIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver =
      FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    vi.spyOn(window, 'scrollTo').mockImplementation(() => { /* jsdom cannot scroll */ });
  });

  afterEach(() => {
    globalThis.IntersectionObserver = originalIO as typeof IntersectionObserver;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  async function setup(sections: string): Promise<SvAnchorComponent> {
    const host = document.createElement('div');
    host.innerHTML = sections;
    document.body.appendChild(host);

    TestBed.resetTestingModule();
    const { fixture } = await render(SvAnchorComponent, { inputs: { items: ITEMS } });
    await untilRendered(fixture, () => true);
    return fixture.componentInstance;
  }

  /**
   * ★ The heading, not the section. `<section id="usage">` announces nothing;
   * `<h2>` announces the thing the reader just clicked.
   *
   * ⚠️ A heading is NOT focusable — it matches no focusable selector and reports
   * `tabIndex === -1` — so it has to go through the `tabindex`-borrowing path.
   * Passed as an ordinary candidate it would be skipped every time and focus
   * would quietly land on the section: the preference would read correctly in the
   * source and never once apply.
   */
  it('moves focus to the section`s heading', async () => {
    // Headings deliberately worded differently from the rail labels: otherwise
    // `getByText('Usage')` matches both and the query, not the component, fails.
    await setup(
      '<section id="intro"><h2>How to start</h2></section>' +
        '<section id="usage"><h2>Using the thing</h2></section>',
    );

    fireEvent.click(screen.getByText('Usage'));

    expect(document.activeElement).not.toBe(document.body);
    expect((document.activeElement as HTMLElement).textContent).toBe('Using the thing');
  });

  /** No heading to take it, so the section is made focusable rather than skipped. */
  it('falls back to the section itself, never to body', async () => {
    await setup('<section id="intro"></section><section id="usage"></section>');

    fireEvent.click(screen.getByText('Usage'));

    expect(document.activeElement).not.toBe(document.body);
    expect((document.activeElement as HTMLElement).id).toBe('usage');
  });

  /**
   * `svRecoverFocus` borrows the `tabindex` and gives it back, so a section does
   * not stay marked as a focus target for the rest of the session.
   */
  it('returns the borrowed tabindex when focus leaves', async () => {
    await setup('<section id="intro"></section><section id="usage"></section>');
    fireEvent.click(screen.getByText('Usage'));

    const section = document.getElementById('usage')!;
    expect(section.getAttribute('tabindex')).toBe('-1');

    screen.getByText('Introduction').focus();
    expect(section.hasAttribute('tabindex')).toBe(false);
  });

  /**
   * Only a jump the reader asked for moves focus. The location reader — a deep
   * link, the back button — jumps with `moveFocus: false`, because taking focus
   * on load strands a keyboard user somewhere they did not choose.
   */
  it('scrolls without moving focus when told not to', async () => {
    const anchor = await setup(
      '<section id="intro"></section><section id="usage"><h2>Using</h2></section>',
    );
    const rail = screen.getByText('Introduction');
    rail.focus();

    anchor.jumpTo('usage', 'replace', false);

    expect(window.scrollTo).toHaveBeenCalled();
    expect(document.activeElement).toBe(rail);
  });

  /** Nothing to jump to, so nothing to focus — and nothing thrown. */
  it('does not move focus for a target that is not there', async () => {
    await setup('<section id="intro"></section>');
    const rail = screen.getByText('Usage');
    rail.focus();

    fireEvent.click(rail);

    expect(document.activeElement).toBe(rail);
  });
});
