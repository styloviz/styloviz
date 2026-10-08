import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { until, quietFor } from '../../../../src/testing/async';
import { SvSearchBarComponent, type SearchSuggestion } from './search-bar.component';

/**
 * Keyboard control of the combobox.
 *
 * The interesting half is the guard: every key except Enter is ignored while
 * the dropdown is shut, because a search box with no suggestions on screen must
 * still submit on Enter and must not swallow Escape from the page around it.
 */

async function setup(inputs: Partial<ComponentInput<SvSearchBarComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvSearchBarComponent, {
    inputs: inputs as ComponentInput<SvSearchBarComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const input = (f: { nativeElement: unknown }) => el(f).querySelector<HTMLInputElement>('input')!;
const panel = () => document.querySelector<HTMLElement>('.sv-search-portal');

type Fixture = {
  nativeElement: unknown;
  detectChanges(): void;
  componentInstance: SvSearchBarComponent;
};

function focusIn(f: Fixture) {
  f.componentInstance.onFocus();
  f.detectChanges();
}

/** Dispatch a key at the real input so the component's own binding runs. */
function key(f: Fixture, k: string, init: KeyboardEventInit = {}) {
  input(f).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
  f.detectChanges();
}

const SUGGESTIONS: SearchSuggestion[] = [
  { id: '1', label: 'Invoices' },
  { id: '2', label: 'Inventory' },
  { id: '3', label: 'Insights' },
];

describe('SvSearchBarComponent — walking the list', () => {
  it('moves down from nothing to the first row and stops at the last', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    focusIn(fixture);
    const c = fixture.componentInstance;
    expect(c.activeIndex()).toBe(-1);

    key(fixture, 'ArrowDown');
    expect(c.activeIndex()).toBe(0);
    key(fixture, 'ArrowDown');
    key(fixture, 'ArrowDown');
    expect(c.activeIndex()).toBe(2);
    // The floor: a fourth press must not walk off the end.
    key(fixture, 'ArrowDown');
    expect(c.activeIndex()).toBe(2);
  });

  it('moves up and stops at "nothing selected" rather than wrapping', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    focusIn(fixture);
    const c = fixture.componentInstance;
    c.activeIndex.set(1);

    key(fixture, 'ArrowUp');
    expect(c.activeIndex()).toBe(0);
    key(fixture, 'ArrowUp');
    expect(c.activeIndex()).toBe(-1);
    key(fixture, 'ArrowUp');
    expect(c.activeIndex()).toBe(-1);
  });

  it('cancels the browser\'s own caret movement for the arrows', async () => {
    // Without preventDefault the caret jumps to the start/end of the query on
    // every arrow press while the list moves underneath it.
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    focusIn(fixture);

    for (const k of ['ArrowDown', 'ArrowUp']) {
      const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
      input(fixture).dispatchEvent(event);
      expect(event.defaultPrevented, `${k} did not preventDefault`).toBe(true);
    }
  });

  it('closes on Escape, drops the highlight, and gives up focus', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    focusIn(fixture);
    input(fixture).focus();
    fixture.componentInstance.activeIndex.set(1);

    key(fixture, 'Escape');
    expect(fixture.componentInstance.activeIndex()).toBe(-1);
    expect(fixture.componentInstance.showDropdown()).toBe(false);
    expect(panel()).toBeNull();
    expect(document.activeElement).not.toBe(input(fixture));
  });
});

describe('SvSearchBarComponent — Enter', () => {
  it('picks the highlighted row when there is one', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    focusIn(fixture);
    const submitted: string[] = [];
    const selected: SearchSuggestion[] = [];
    fixture.componentInstance.submitted.subscribe((v) => submitted.push(v));
    fixture.componentInstance.suggestionSelected.subscribe((s) => selected.push(s));

    key(fixture, 'ArrowDown');
    key(fixture, 'ArrowDown');
    key(fixture, 'Enter');

    expect(fixture.componentInstance.value()).toBe('Inventory');
    expect(submitted).toEqual(['Inventory']);
    expect(selected.map((s) => s.id)).toEqual(['2']);
  });

  it('submits the raw query when nothing is highlighted, and closes', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS, value: 'inv' });
    focusIn(fixture);
    const submitted: string[] = [];
    const selected: SearchSuggestion[] = [];
    fixture.componentInstance.submitted.subscribe((v) => submitted.push(v));
    fixture.componentInstance.suggestionSelected.subscribe((s) => selected.push(s));

    key(fixture, 'Enter');
    expect(submitted).toEqual(['inv']);
    // The negative: no suggestion was chosen, so none may be reported.
    expect(selected).toEqual([]);
    expect(fixture.componentInstance.value()).toBe('inv');
    expect(panel()).toBeNull();
  });

  it('submits with the dropdown shut — the one key that gets through the guard', async () => {
    const { fixture } = await setup({ suggestions: [], value: 'orphan query' });
    const submitted: string[] = [];
    fixture.componentInstance.submitted.subscribe((v) => submitted.push(v));

    key(fixture, 'Enter');
    expect(submitted).toEqual(['orphan query']);
  });

  it('submits an empty query rather than swallowing the key', async () => {
    const { fixture } = await setup({ suggestions: [] });
    const submitted: string[] = [];
    fixture.componentInstance.submitted.subscribe((v) => submitted.push(v));

    key(fixture, 'Enter');
    expect(submitted).toEqual(['']);
  });

  it('submits the query when the highlight points past the end of the list', async () => {
    // The list can shrink under a stale highlight between a keystroke and a
    // re-render; treating that as "row 5 of 3" would throw.
    const { fixture } = await setup({ suggestions: SUGGESTIONS, value: 'inv' });
    focusIn(fixture);
    fixture.componentInstance.activeIndex.set(9);
    const submitted: string[] = [];
    fixture.componentInstance.submitted.subscribe((v) => submitted.push(v));

    key(fixture, 'Enter');
    expect(submitted).toEqual(['inv']);
  });
});

describe('SvSearchBarComponent — keys the guard turns away', () => {
  it('ignores the arrows and Escape while the dropdown is shut', async () => {
    const { fixture } = await setup({ suggestions: [] });
    const c = fixture.componentInstance;
    c.activeIndex.set(-1);

    for (const k of ['ArrowDown', 'ArrowUp', 'Escape']) {
      const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
      input(fixture).dispatchEvent(event);
      // Not consumed: the page around the search box keeps its own Escape.
      expect(event.defaultPrevented, `${k} was consumed with the list shut`).toBe(false);
    }
    expect(c.activeIndex()).toBe(-1);
  });

  it('ignores a key it has no business with, open or shut', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    focusIn(fixture);
    const submitted: string[] = [];
    fixture.componentInstance.submitted.subscribe((v) => submitted.push(v));

    key(fixture, 'Tab');
    key(fixture, 'a');
    expect(fixture.componentInstance.activeIndex()).toBe(-1);
    expect(submitted).toEqual([]);
    expect(panel()).not.toBeNull();
  });
});

describe('SvSearchBarComponent — blur closes the list, but not before a click lands', () => {
  it('keeps the list up long enough for a suggestion click to register', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    focusIn(fixture);
    fixture.componentInstance.onBlur();
    fixture.detectChanges();

    // Still open on the very next tick — that gap is the whole point.
    expect(fixture.componentInstance.isFocused()).toBe(true);
    expect(panel()).not.toBeNull();

    await until(() => !fixture.componentInstance.isFocused(), {
      label: 'the delayed blur to close the list',
    });
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  /**
   * ★ DEFECT (fixed): the blur timer outlived the component.
   *
   * `onBlur` fired a bare `setTimeout` that nothing owned — not cleared by a
   * second blur, not cleared on destroy. A component torn down inside that
   * 150ms window (a route change, a closing modal — exactly when a field is
   * blurred) left a callback running that wrote to a destroyed component's
   * state. The Pro twin had already been given a tracked `blurTimer`; the free
   * one had not, so the pair disagreed. Fixed here to match.
   */
  it('cancels the pending blur when it is destroyed inside the window', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    focusIn(fixture);
    fixture.componentInstance.onBlur();
    fixture.destroy();

    await quietFor(250);
    // The timer never ran, so nothing wrote to the destroyed component.
    expect(fixture.componentInstance.isFocused()).toBe(true);
  });

  it('keeps a single pending timer across repeated blurs', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    focusIn(fixture);
    fixture.componentInstance.onBlur();
    fixture.componentInstance.onBlur();
    fixture.componentInstance.onBlur();

    await until(() => !fixture.componentInstance.isFocused(), {
      label: 'the list to close after the last blur',
    });
    // Re-focusing must not then be undone by a leftover earlier timer.
    fixture.componentInstance.onFocus();
    await quietFor(250);
    expect(fixture.componentInstance.isFocused()).toBe(true);
  });

  it('reopens on focus after a resize suppressed it', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    focusIn(fixture);
    expect(panel()).not.toBeNull();

    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    expect(fixture.componentInstance.resizeSuppressed()).toBe(true);
    expect(panel()).toBeNull();

    fixture.componentInstance.onFocus();
    fixture.detectChanges();
    expect(fixture.componentInstance.resizeSuppressed()).toBe(false);
    expect(panel()).not.toBeNull();
  });

  it('reopens on typing after a resize suppressed it', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS, debounceMs: 0 });
    focusIn(fixture);
    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    expect(panel()).toBeNull();

    fixture.componentInstance.onInput('in');
    fixture.detectChanges();
    expect(fixture.componentInstance.resizeSuppressed()).toBe(false);
    expect(panel()).not.toBeNull();
  });

  it('ignores a resize while the list is already shut', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    window.dispatchEvent(new Event('resize'));
    expect(fixture.componentInstance.resizeSuppressed()).toBe(false);
  });
});
