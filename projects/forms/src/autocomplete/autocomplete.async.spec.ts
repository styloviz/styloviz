import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvAutocompleteComponent } from './autocomplete.component';
import type { AutocompleteOption } from './autocomplete.component';

const options: readonly AutocompleteOption[] = [
  { value: 'alpha', label: 'Alpha' },
  { value: 'beta', label: 'Beta' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAutocompleteComponent, { inputs: { options, ...inputs } });
  return fixture;
}

describe('SvAutocompleteComponent — remote lookup', () => {
  it('debounces a burst of keystrokes into one lookup', async () => {
    vi.useFakeTimers();
    try {
      TestBed.resetTestingModule();
      const seen: string[] = [];
      const { fixture } = await render(SvAutocompleteComponent, {
        inputs: { options, debounceMs: 300 },
        on: { inputChange: (t: string) => seen.push(t) },
      });

      for (const term of ['a', 'al', 'alp']) {
        fixture.componentInstance.onInputChange(term);
        fixture.detectChanges();
        vi.advanceTimersByTime(100);
      }
      vi.advanceTimersByTime(300);
      fixture.detectChanges();

      expect(seen.filter((t) => t === 'alp')).toHaveLength(1);
      expect(seen).not.toContain('al');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not fire a lookup for the empty box it starts with', async () => {
    const seen: string[] = [];
    TestBed.resetTestingModule();
    const { fixture } = await render(SvAutocompleteComponent, {
      inputs: { options, debounceMs: 0 },
      on: { inputChange: (t: string) => seen.push(t) },
    });
    fixture.detectChanges();
    expect(seen).toEqual([]);
  });

  it('holds the lookup back until minChars is reached', async () => {
    TestBed.resetTestingModule();
    const seen: string[] = [];
    const { fixture } = await render(SvAutocompleteComponent, {
      inputs: { options, debounceMs: 0, minChars: 3 },
      on: { inputChange: (t: string) => seen.push(t) },
    });

    fixture.componentInstance.onInputChange('al');
    fixture.detectChanges();
    expect(seen).toEqual([]);

    fixture.componentInstance.onInputChange('alp');
    fixture.detectChanges();
    expect(seen).toEqual(['alp']);
  });

  it('says what it is waiting for instead of "No results found"', async () => {
    const f = await setup({ minChars: 3 });
    f.componentInstance.onInputChange('al');
    f.detectChanges();
    expect(f.componentInstance.belowMinChars()).toBe(true);
    expect(f.componentInstance.minCharsHint()).toBe('Type 3 characters to search');
  });

  /** Client-side filtering can only ever search the page already downloaded. */
  it('leaves the supplied options alone in serverSide mode', async () => {
    const f = await setup({ serverSide: true });
    f.componentInstance.onInputChange('nothing-matches');
    f.detectChanges();
    expect(f.componentInstance.filtered()).toHaveLength(2);
  });

  it('still filters locally when serverSide is off', async () => {
    const f = await setup();
    f.componentInstance.onInputChange('alph');
    f.detectChanges();
    expect(f.componentInstance.filtered().map((o) => o.value)).toEqual(['alpha']);
  });
});

/**
 * `X-5` / `FI-01-I1` / `FI-01-M1` — the third async state.
 *
 * `loading` cannot express "these results answer the term before last": it is
 * true for the first fetch too, where the right treatment is a skeleton and not
 * a dimmed list. `stale` is that distinction, and `SvStaleDirective` is the one
 * treatment shared by every picker in the kit.
 */
describe('SvAutocompleteComponent — stale results', () => {
  const listbox = (): HTMLElement | null =>
    document.querySelector<HTMLElement>('[role="listbox"]');

  const open = async (inputs: Record<string, unknown> = {}) => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvAutocompleteComponent, { inputs: { options, ...inputs } });
    const el = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    el.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    return fixture;
  };

  afterEach(() => document.querySelectorAll('.sv-ac-portal').forEach((n) => n.remove()));

  it('says nothing at all while the results are current', async () => {
    await open();

    expect(listbox()).not.toBeNull();
    expect(listbox()!.getAttribute('aria-busy')).toBeNull();
    expect(listbox()!.getAttribute('data-sv-state')).toBeNull();
  });

  it('marks the listbox busy and dim while a newer lookup is in flight', async () => {
    await open({ stale: true });

    expect(listbox()!.getAttribute('aria-busy')).toBe('true');
    expect(listbox()!.getAttribute('data-sv-state')).toBe('stale');
    expect(listbox()!.classList.contains('opacity-60')).toBe(true);
  });

  /**
   * The whole point of keeping the previous results is that they stay usable.
   * A dimmed list nobody can click is worse than a blanked one, because it
   * looks available.
   */
  it('leaves the options reachable', async () => {
    await open({ stale: true });

    expect(listbox()!.classList.contains('pointer-events-none')).toBe(false);
    expect(listbox()!.querySelectorAll('[role="option"]').length).toBe(options.length);
  });
});
