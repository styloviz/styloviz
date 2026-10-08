import { render } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import { SvSearchBarComponent } from './search-bar.component';

/**
 * `FI-20-I2` / `FI-20-M2` — "we found nothing" and "type to begin".
 *
 * These were the same picture, and the picture was nothing at all: the panel
 * opened only when it had at least one row, so a search that came back empty
 * closed the dropdown, stopped the spinner, and left the user staring at their
 * own query unable to tell whether anything had happened.
 *
 * The panel is portalled into `<body>`, so assertions look there; the live
 * region stays in the component's own template and is read off the fixture.
 */

const SUGGESTIONS = [
  { id: '1', label: 'Invoices' },
  { id: '2', label: 'Inventory' },
];

interface FocusableInternals {
  isFocused: { set(v: boolean): void };
}

async function open(inputs: Record<string, unknown> = {}, term = 'inv') {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvSearchBarComponent, {
    inputs: { suggestions: [], ...inputs },
  });
  fixture.componentInstance.value.set(term);
  (fixture.componentInstance as unknown as FocusableInternals).isFocused.set(true);
  fixture.detectChanges();
  return fixture;
}

const panel = () => document.body;
const emptyBlock = () => document.querySelector<HTMLElement>('[data-sv-state="no-results"], [data-sv-state="no-data"]');
const liveRegion = (fixture: { nativeElement: HTMLElement }) =>
  fixture.nativeElement.querySelector<HTMLElement>('[role="status"]');

describe('SvSearchBarComponent — empty is not the same as no-results (FI-20-I2)', () => {
  it('stays shut when the host says nothing about why the list is empty', async () => {
    // The pre-existing behaviour, kept exactly: an unbound `emptyReason` means
    // a host that has not adopted the contract sees no new panel appear.
    await open();

    expect(emptyBlock()).toBeNull();
  });

  it('opens with "type to search" for the opening state', async () => {
    await open({ emptyReason: 'no-data' }, '');

    expect(panel().textContent).toContain('Type to search');
    expect(emptyBlock()?.getAttribute('data-sv-state')).toBe('no-data');
  });

  it('opens with "no results" once a search has answered with nothing', async () => {
    await open({ emptyReason: 'no-results' });

    expect(panel().textContent).toContain('No results found');
    expect(emptyBlock()?.getAttribute('data-sv-state')).toBe('no-results');
  });

  /**
   * The whole point of the item: a user has to be able to tell these apart
   * without being told which one they are looking at.
   */
  it('renders the two states differently', async () => {
    await open({ emptyReason: 'no-data' }, '');
    const opening = emptyBlock()!.textContent;
    const openingState = emptyBlock()!.getAttribute('data-sv-state');

    await open({ emptyReason: 'no-results' });
    const empty = emptyBlock()!.textContent;

    expect(empty).not.toBe(opening);
    expect(emptyBlock()!.getAttribute('data-sv-state')).not.toBe(openingState);
  });

  it('quotes the term that matched nothing back at the user', async () => {
    // Which is also how someone notices the trailing space or the stray
    // character they cannot see in the field.
    await open({ emptyReason: 'no-results' }, 'qqzz ');

    expect(panel().textContent).toContain('Nothing matched “qqzz”');
  });

  it('takes the host’s own wording over both defaults', async () => {
    await open({
      emptyReason: 'no-results',
      noResultsLabel: 'No matching orders',
      noResultsHint: 'Try an order number',
    });

    expect(panel().textContent).toContain('No matching orders');
    expect(panel().textContent).toContain('Try an order number');
  });

  it('says nothing about emptiness the moment there are rows to show', async () => {
    // A reason that outlived its list is worse than none: the panel would show
    // results under a line saying there are none.
    await open({ emptyReason: 'no-results', suggestions: SUGGESTIONS });

    expect(emptyBlock()).toBeNull();
    expect(panel().textContent).toContain('Invoices');
  });

  it('lets a failure speak instead — "no results" for a request that never answered is untrue', async () => {
    await open({ emptyReason: 'no-results', error: 'Search is unavailable' });

    expect(emptyBlock()).toBeNull();
    expect(panel().textContent).toContain('Search is unavailable');
  });
});

describe('SvSearchBarComponent — the panel opens for a failure (FI-20-I2)', () => {
  /**
   * A bug the error surface shipped with. A failed lookup usually returns no
   * suggestions, and the panel that holds `<sv-error-shell>` only opened when
   * it had rows — so the error had nowhere to render and `retry` was
   * unreachable in exactly the case it existed for. The existing async spec
   * missed it because it always passes a populated `suggestions`.
   */
  it('renders the error with an empty suggestion list', async () => {
    await open({ error: 'Search is unavailable' });

    expect(panel().textContent).toContain('Search is unavailable');
  });
});

describe('SvSearchBarComponent — announcing the empty state', () => {
  it('keeps a live region mounted, holding nothing, while there is nothing to say', async () => {
    // Inside the portalled panel it would be inserted with its text already in
    // it, which readers frequently do not announce at all.
    const fixture = await open();

    expect(liveRegion(fixture)).not.toBeNull();
    expect(liveRegion(fixture)!.textContent?.trim()).toBe('');
  });

  it('announces both lines of the no-results state as one sentence', async () => {
    const fixture = await open({ emptyReason: 'no-results' }, 'qqzz');

    expect(liveRegion(fixture)!.textContent).toContain('No results found');
    expect(liveRegion(fixture)!.textContent).toContain('qqzz');
  });

  it('announces the opening state', async () => {
    const fixture = await open({ emptyReason: 'no-data' }, '');

    expect(liveRegion(fixture)!.textContent?.trim()).toBe('Type to search');
  });

  it('goes quiet when the field is not focused, since no panel is open to explain', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvSearchBarComponent, {
      inputs: { suggestions: [], emptyReason: 'no-results' },
    });
    fixture.detectChanges();

    expect(liveRegion(fixture)!.textContent?.trim()).toBe('');
  });
});
