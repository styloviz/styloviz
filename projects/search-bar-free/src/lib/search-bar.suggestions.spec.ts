import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { until, quietFor } from '../../../../src/testing/async';
import { SvSearchBarComponent, type SearchSuggestion } from './search-bar.component';

/**
 * The dropdown: when it exists at all, what each row resolves to, and how the
 * typed query is highlighted inside a label.
 *
 * `highlightMatch` returns a three-way split that the template renders as
 * `pre<mark>match</mark>post`, so every one of its early returns has to put the
 * WHOLE label in `pre` — a miss that returns an empty `pre` silently deletes
 * the suggestion's text from the page.
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
const rows = () => [...(panel()?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];

type Fixture = {
  nativeElement: unknown;
  detectChanges(): void;
  componentInstance: SvSearchBarComponent;
};

/** Focus the field the way the component sees it, and let the portal mount. */
function focusIn(f: Fixture) {
  f.componentInstance.onFocus();
  f.detectChanges();
}

const SUGGESTIONS: SearchSuggestion[] = [
  { id: '1', label: 'Invoices', sublabel: 'Billing' },
  { id: '2', label: 'Inventory', badge: 'New' },
  { id: '3', label: 'Insights' },
];

describe('SvSearchBarComponent — when the dropdown exists', () => {
  it('needs focus AND at least one suggestion', async () => {
    const noFocus = await setup({ suggestions: SUGGESTIONS });
    expect(noFocus.fixture.componentInstance.showDropdown()).toBe(false);
    expect(panel()).toBeNull();

    const noSuggestions = await setup({ suggestions: [] });
    focusIn(noSuggestions.fixture);
    expect(noSuggestions.fixture.componentInstance.showDropdown()).toBe(false);
    expect(panel()).toBeNull();

    const both = await setup({ suggestions: SUGGESTIONS });
    focusIn(both.fixture);
    expect(both.fixture.componentInstance.showDropdown()).toBe(true);
    expect(panel()).not.toBeNull();
  });

  it('mounts the panel outside its own element', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    focusIn(fixture);
    expect(el(fixture).contains(panel())).toBe(false);
    expect(rows().length).toBe(3);
  });

  it('unmounts the panel when the suggestions run out', async () => {
    const { fixture, rerender } = await setup({ suggestions: SUGGESTIONS });
    focusIn(fixture);
    expect(panel()).not.toBeNull();

    await rerender({ inputs: { suggestions: [] } as ComponentInput<SvSearchBarComponent> });
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it('tells an AT what it is controlling, only while it is open', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    const field = input(fixture);
    expect(field.getAttribute('aria-expanded')).toBe('false');
    expect(field.getAttribute('aria-controls')).toBeNull();
    expect(field.getAttribute('aria-autocomplete')).toBe('list');

    focusIn(fixture);
    expect(field.getAttribute('aria-expanded')).toBe('true');
    expect(field.getAttribute('aria-controls')).toBe(fixture.componentInstance.listboxId);
  });

  it('says it autocompletes nothing when there are no suggestions to offer', async () => {
    const { fixture } = await setup({ suggestions: [] });
    expect(input(fixture).getAttribute('aria-autocomplete')).toBe('none');
  });

  it('names the active row for aria-activedescendant, and nothing when none is', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    focusIn(fixture);
    expect(fixture.componentInstance.activeDescendantId()).toBeNull();
    expect(input(fixture).getAttribute('aria-activedescendant')).toBeNull();

    fixture.componentInstance.activeIndex.set(1);
    fixture.detectChanges();
    expect(fixture.componentInstance.activeDescendantId())
      .toBe(fixture.componentInstance.optionId(1));
    expect(rows()[1].getAttribute('aria-selected')).toBe('true');
    expect(rows()[0].getAttribute('aria-selected')).toBe('false');
  });

  it('gives two search bars on one page different listbox ids', async () => {
    // Both bars must share an application: ids are per application (svUniqueId).
    const a = await setup({ suggestions: SUGGESTIONS });
    const b = TestBed.createComponent(SvSearchBarComponent);
    b.componentRef.setInput('suggestions', SUGGESTIONS);
    b.detectChanges();
    await b.whenStable();
    expect(a.fixture.componentInstance.listboxId)
      .not.toBe(b.componentInstance.listboxId);
  });

  it('names the listbox by its header, then the field, then a fallback', async () => {
    const labelled = await setup({ suggestions: SUGGESTIONS, suggestionsLabel: 'Recent' });
    focusIn(labelled.fixture);
    expect(panel()!.querySelector('[role="listbox"]')?.getAttribute('aria-label')).toBe('Recent');
    expect(panel()!.textContent).toContain('Recent');

    const named = await setup({ suggestions: SUGGESTIONS, ariaLabel: 'Find anything' });
    focusIn(named.fixture);
    expect(panel()!.querySelector('[role="listbox"]')?.getAttribute('aria-label'))
      .toBe('Find anything');
  });

  it('falls back through ariaLabel → label → placeholder for its own name', async () => {
    expect((await setup({ ariaLabel: 'A', label: 'B', placeholder: 'C' }))
      .fixture.componentInstance.accessibleName()).toBe('A');
    expect((await setup({ label: 'B', placeholder: 'C' }))
      .fixture.componentInstance.accessibleName()).toBe('B');
    expect((await setup({ placeholder: 'C' }))
      .fixture.componentInstance.accessibleName()).toBe('C');
  });
});

describe('SvSearchBarComponent — resolving a suggestion row', () => {
  const named = [
    { iconType: 'search' as const, name: 'search' },
    { iconType: 'page'   as const, name: 'file-text' },
    { iconType: 'user'   as const, name: 'user' },
    { iconType: 'tag'    as const, name: 'tag' },
  ];

  for (const { iconType, name } of named) {
    it(`maps iconType "${iconType}" to the ${name} glyph`, async () => {
      const { fixture } = await setup({ suggestions: [{ id: '1', label: 'X', iconType }] });
      const row = fixture.componentInstance.computedSuggestions()[0];
      expect(row.resolvedIconName).toBe(name);
      expect(row.resolvedIconName).not.toBe('');
    });
  }

  it('defaults an unlabelled suggestion to the magnifier', async () => {
    const { fixture } = await setup({ suggestions: [{ id: '1', label: 'X' }] });
    const row = fixture.componentInstance.computedSuggestions()[0];
    expect(row.resolvedIconName).toBe('search');
  });

  /**
   * ★ THESE TWO HAD GONE STALE and were failing. They were written when
   * `SearchSuggestion.icon` was `iconPath`, a raw `<path d="…">`, and the
   * component published a `SUGGESTION_ICONS` path map beside an unused name
   * map — one of five half-migrations the icon sweep found. Both assertions
   * contradicted themselves outright (`toBe('')` then `toBe('M0 0h4v4H0z')`),
   * which is only possible in a test that never ran.
   *
   * The claims are kept and made true of the component as it is now.
   */
  it('takes a custom NAME for an iconType of custom', async () => {
    const { fixture } = await setup({
      suggestions: [{ id: '1', label: 'X', iconType: 'custom', icon: 'star' }],
    });
    const row = fixture.componentInstance.computedSuggestions()[0];
    expect(row.resolvedIconName).toBe('star');

    focusIn(fixture);
    // It really is drawn, and by the library rather than by hand.
    const drawn = [...panel()!.querySelectorAll('svg')];
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.every((n) => n.closest('sv-icon'))).toBe(true);
  });

  /**
   * ★ DELIBERATE, AND A BEHAVIOUR CHANGE WORTH KNOWING. The old raw-path
   * version fell back to the magnifier `d` when a `custom` row supplied no
   * path, so the slot always drew something. A name-based resolver returns `''`
   * instead, and `<sv-icon name="">` renders no `<svg>` at all — an empty slot
   * rather than a magnifier the host never asked for. Pinned so the choice is
   * visible rather than assumed.
   */
  it('draws nothing for a custom row that names no icon', async () => {
    const { fixture } = await setup({ suggestions: [{ id: '1', label: 'X', iconType: 'custom' }] });
    const row = fixture.componentInstance.computedSuggestions()[0];
    expect(row.resolvedIconName).toBe('');

    focusIn(fixture);
    expect(panel()!.querySelector('sv-icon svg')).toBeNull();
  });

  it('renders the optional sublabel and badge only when present', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    focusIn(fixture);
    expect(rows()[0].textContent).toContain('Billing');
    expect(rows()[1].textContent).toContain('New');
    expect(rows()[2].textContent?.trim()).toBe('Insights');
  });
});

describe('SvSearchBarComponent — highlighting the query inside a label', () => {
  const split = async (value: string, label = 'Invoices') => {
    const { fixture } = await setup({ suggestions: [{ id: '1', label }], value });
    return fixture.componentInstance.computedSuggestions()[0].highlighted;
  };

  it('splits the label around the match', async () => {
    expect(await split('voi')).toEqual({ pre: 'In', match: 'voi', post: 'ces' });
  });

  it('matches case-insensitively but keeps the label\'s own casing', async () => {
    expect(await split('INV')).toEqual({ pre: '', match: 'Inv', post: 'oices' });
  });

  it('puts the whole label in `pre` when the query is empty', async () => {
    // A miss that returned an empty `pre` would delete the row's text.
    expect(await split('')).toEqual({ pre: 'Invoices', match: '', post: '' });
  });

  it('puts the whole label in `pre` for a whitespace-only query', async () => {
    expect(await split('   ')).toEqual({ pre: 'Invoices', match: '', post: '' });
  });

  it('ignores whitespace around the query rather than failing to match', async () => {
    // A query is typed, so it picks up stray spaces; ' voi ' appears nowhere in
    // "Invoices" verbatim, and without the trim the row simply stops
    // highlighting the moment the user hits the space bar.
    expect(await split(' voi ')).toEqual({ pre: 'In', match: 'voi', post: 'ces' });
    expect(await split('invoices ')).toEqual({ pre: '', match: 'Invoices', post: '' });
  });

  it('puts the whole label in `pre` when the query is nowhere in it', async () => {
    expect(await split('zzz')).toEqual({ pre: 'Invoices', match: '', post: '' });
  });

  it('highlights a match at the very end, leaving `post` empty', async () => {
    expect(await split('ces')).toEqual({ pre: 'Invoi', match: 'ces', post: '' });
  });

  it('highlights only the first occurrence', async () => {
    expect(await split('a', 'banana')).toEqual({ pre: 'b', match: 'a', post: 'nana' });
  });

  it('renders the three parts into the row without losing a character', async () => {
    const { fixture } = await setup({ suggestions: [{ id: '1', label: 'Invoices' }], value: 'voi' });
    focusIn(fixture);
    expect(rows()[0].textContent?.replace(/\s+/g, '')).toContain('Invoices');
    expect(rows()[0].querySelector('mark')?.textContent).toBe('voi');
  });
});

describe('SvSearchBarComponent — choosing a suggestion', () => {
  it('takes the label as the value and reports it twice, then closes', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    focusIn(fixture);
    const submitted: string[] = [];
    const selected: SearchSuggestion[] = [];
    fixture.componentInstance.submitted.subscribe((v) => submitted.push(v));
    fixture.componentInstance.suggestionSelected.subscribe((s) => selected.push(s));

    await userEvent.click(rows()[1]);
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBe('Inventory');
    expect(submitted).toEqual(['Inventory']);
    expect(selected.map((s) => s.id)).toEqual(['2']);
    expect(fixture.componentInstance.activeIndex()).toBe(-1);
    expect(panel()).toBeNull();
  });

  it('highlights the row the pointer is over', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS });
    focusIn(fixture);
    await userEvent.hover(rows()[2]);
    fixture.detectChanges();
    expect(fixture.componentInstance.activeIndex()).toBe(2);
  });

  it('offers the footer only when it has been given a label, and closes on it', async () => {
    const without = await setup({ suggestions: SUGGESTIONS });
    focusIn(without.fixture);
    expect(panel()!.querySelectorAll('button').length).toBe(0);

    const { fixture } = await setup({ suggestions: SUGGESTIONS, footerLabel: 'View all results' });
    focusIn(fixture);
    const seen: string[] = [];
    fixture.componentInstance.footerClick.subscribe(() => seen.push('footer'));

    const footer = panel()!.querySelector<HTMLButtonElement>('button')!;
    expect(footer.textContent).toContain('View all results');
    await userEvent.click(footer);
    fixture.detectChanges();

    expect(seen).toEqual(['footer']);
    expect(panel()).toBeNull();
  });
});

describe('SvSearchBarComponent — the debounce', () => {
  it('emits once after the quiet period, not once per keystroke', async () => {
    const { fixture } = await setup({ debounceMs: 20 });
    const seen: string[] = [];
    fixture.componentInstance.searched.subscribe((v) => seen.push(v));

    // ★★★ THE KEYSTROKES ARRIVE IN ONE TICK, DELIBERATELY.
    //
    // This was `await userEvent.type(input(fixture), 'abc')`, which puts real
    // awaits between each character — change detection, DOM events, and
    // testing-library's own scheduling. The debounce window here is 20 ms, so
    // any pair of keystrokes landing more than 20 ms apart makes the component
    // do exactly the right thing and emit the prefix. The test then fails with
    //
    //     AssertionError: expected [ 'a', 'abc' ] to deeply equal [ 'abc' ]
    //
    // which pins the machine's scheduling, not the component's behaviour: green
    // on an idle machine, red on a busy one. It survived three
    // `test:sweep:full` rounds on 2026-08-21 disguised as one of the starvation
    // timeouts around it. The tell was the CLOCK — it failed in 1,870 ms, far
    // too fast to be the 30 s timeout the others were.
    //
    // Delivering all three in one tick takes the scheduler out of the
    // assertion: `onInput` clears its pending timer on every call, so exactly
    // one survives no matter how the machine behaves afterwards. Typing
    // fidelity is not lost — the sibling test below types for real with the
    // debounce switched off and asserts that every keystroke lands.
    fixture.componentInstance.onInput('a');
    fixture.componentInstance.onInput('ab');
    fixture.componentInstance.onInput('abc');

    await until(() => seen.length >= 1, { label: 'the debounced query to fire' });
    await quietFor();
    // ★ The guard is THIS line, not the `until` above. A debounce that fired
    // once per keystroke also reaches `length >= 1`, so only the exact-equality
    // check can tell coalescing from its absence.
    expect(seen).toEqual(['abc']);
  });

  it('emits on every keystroke when the debounce is switched off', async () => {
    const { fixture } = await setup({ debounceMs: 0 });
    const seen: string[] = [];
    fixture.componentInstance.searched.subscribe((v) => seen.push(v));

    await userEvent.type(input(fixture), 'ab');
    expect(seen).toEqual(['a', 'ab']);
  });

  it('cancels a pending query when the component goes away', async () => {
    const { fixture } = await setup({ debounceMs: 30 });
    const seen: string[] = [];
    fixture.componentInstance.searched.subscribe((v) => seen.push(v));

    fixture.componentInstance.onInput('abc');
    fixture.destroy();
    await quietFor();
    expect(seen).toEqual([]);
  });

  it('resets the highlight the moment the query changes', async () => {
    const { fixture } = await setup({ suggestions: SUGGESTIONS, debounceMs: 0 });
    focusIn(fixture);
    fixture.componentInstance.activeIndex.set(2);

    fixture.componentInstance.onInput('in');
    expect(fixture.componentInstance.activeIndex()).toBe(-1);
  });
});

describe('SvSearchBarComponent — clearing', () => {
  it('appears only with a value, and not while disabled', async () => {
    const clear = (f: { nativeElement: unknown }) =>
      el(f).querySelector('[aria-label="Clear search"]');

    expect(clear((await setup({})).fixture)).toBeNull();
    expect(clear((await setup({ value: 'x', disabled: true })).fixture)).toBeNull();
    expect(clear((await setup({ value: 'x' })).fixture)).not.toBeNull();
  });

  it('empties the field, announces it, and re-queries with nothing', async () => {
    const { fixture } = await setup({ value: 'invoices' });
    const cleared: string[] = [];
    const searched: string[] = [];
    fixture.componentInstance.cleared.subscribe(() => cleared.push('cleared'));
    fixture.componentInstance.searched.subscribe((v) => searched.push(v));

    await userEvent.click(el(fixture).querySelector<HTMLButtonElement>('[aria-label="Clear search"]')!);
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBe('');
    expect(cleared).toEqual(['cleared']);
    // Without the empty re-query the host keeps showing results for a query
    // that is no longer in the box.
    expect(searched).toEqual(['']);
    expect(fixture.componentInstance.activeIndex()).toBe(-1);
  });

  it('puts the caret back in the field afterwards', async () => {
    const { fixture } = await setup({ value: 'invoices' });
    await userEvent.click(el(fixture).querySelector<HTMLButtonElement>('[aria-label="Clear search"]')!);
    await until(() => document.activeElement === input(fixture), {
      label: 'focus to return to the search field',
    });
  });

  it('focuses on demand through the public focus() method', async () => {
    const { fixture } = await setup({});
    fixture.componentInstance.focus();
    expect(document.activeElement).toBe(input(fixture));
  });
});
