import { render } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import { SvSearchBarComponent } from './search-bar.component';

const SUGGESTIONS = [
  { id: '1', label: 'Invoices' },
  { id: '2', label: 'Inventory' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvSearchBarComponent, { inputs });
  return fixture;
}

/** The panel is portaled, so look for it on the document, not the fixture. */
const doc = () => document.body;

describe('SvSearchBarComponent — failed suggestion lookup', () => {
  it('renders the error inside the panel, so the query survives', async () => {
    // Replacing the whole search bar would also lose what the user typed —
    // which is the one thing they would need to try again.
    const fixture = await setup({ suggestions: SUGGESTIONS, error: 'Search is unavailable' });
    fixture.componentInstance.value.set('inv');
    (fixture.componentInstance as unknown as { isFocused: { set(v: boolean): void } })
      .isFocused.set(true);
    fixture.detectChanges();

    expect(doc().textContent).toContain('Search is unavailable');
    expect(fixture.nativeElement.querySelector('input')).toBeTruthy();
  });

  it('says nothing when there is no error', async () => {
    const fixture = await setup({ suggestions: SUGGESTIONS });
    fixture.detectChanges();
    expect(doc().querySelector('[data-sv-state="error"]')).toBeNull();
  });
});

/**
 * `X-5` — the third async state.
 *
 * `loading` cannot express "these results answer the term before last": it is
 * true for the first fetch too, where the right treatment is a skeleton and not
 * a dimmed list. `stale` is that distinction, and `SvStaleDirective` is the one
 * treatment shared by every picker in the kit.
 */
describe('SvSearchBarComponent — stale suggestions', () => {
  const openStale = async (stale: boolean) => {
    const fixture = await setup({ suggestions: SUGGESTIONS, stale });
    fixture.componentInstance.value.set('inv');
    (fixture.componentInstance as unknown as { isFocused: { set(v: boolean): void } })
      .isFocused.set(true);
    fixture.detectChanges();
    return fixture;
  };
  const results = (): HTMLElement | null => document.querySelector<HTMLElement>('[role="listbox"]');

  it('says nothing at all while the results are current', async () => {
    await openStale(false);

    expect(results()).not.toBeNull();
    expect(results()!.getAttribute('aria-busy')).toBeNull();
    expect(results()!.getAttribute('data-sv-state')).toBeNull();
    expect(results()!.classList.contains('opacity-60')).toBe(false);
  });

  it('marks the results busy and dim while a newer query is in flight', async () => {
    await openStale(true);

    expect(results()!.getAttribute('aria-busy')).toBe('true');
    expect(results()!.getAttribute('data-sv-state')).toBe('stale');
    expect(results()!.classList.contains('opacity-60')).toBe(true);
  });

  /**
   * The whole point of keeping the previous results is that they stay usable.
   * A dimmed list nobody can click is worse than a blanked one, because it
   * looks available.
   */
  it('leaves the results reachable', async () => {
    await openStale(true);

    expect(results()!.classList.contains('pointer-events-none')).toBe(false);
    expect(results()!.getAttribute('inert')).toBeNull();
  });
});
