import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { render } from '@testing-library/angular';
import { SvAutocompleteComponent, type AutocompleteOption } from './autocomplete.component';
import { until } from '../../../../src/testing/async';

/**
 * The panel is portalled into `<body>`, so it is looked up by its own class
 * rather than through the fixture. Everything in the trigger is scoped to the
 * host.
 */

const OPTIONS: readonly AutocompleteOption[] = [
  { value: 'alpha', label: 'Alpha', sublabel: 'first letter', group: 'Greek' },
  { value: 'beta', label: 'Beta', group: 'Greek', icon: 'star' },
  { value: 'gamma', label: 'Gamma', disabled: true, group: 'Greek' },
  { value: 'aleph', label: 'Aleph' },
];

async function setup(inputs: Record<string, unknown> = {}, on: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAutocompleteComponent, {
    inputs: { options: OPTIONS, ...inputs },
    on,
  });
  const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
  return { fixture, input, c: fixture.componentInstance };
}

const portal = () => document.querySelector<HTMLElement>('.sv-ac-portal');
const rows = () => [...(portal()?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
const type = (
  s: { fixture: { detectChanges(): void }; input: HTMLInputElement },
  text: string,
) => {
  s.input.value = text;
  s.input.dispatchEvent(new Event('input', { bubbles: true }));
  s.fixture.detectChanges();
};

afterEach(() => document.querySelectorAll('.sv-ac-portal').forEach((n) => n.remove()));

describe('SvAutocompleteComponent — filtering', () => {
  it('matches on label, sublabel and value alike', async () => {
    const { c } = await setup();
    c.query.set('first letter');
    expect(c.filtered().map((o) => o.value)).toEqual(['alpha']);

    c.query.set('aleph');
    expect(c.filtered().map((o) => o.value)).toEqual(['aleph']);
  });

  it('is case-insensitive and ignores surrounding spaces', async () => {
    const { c } = await setup();
    c.query.set('  BET ');
    expect(c.filtered().map((o) => o.value)).toEqual(['beta']);
  });

  /** A disabled option is not an answer — it must never appear as a match. */
  it('never offers a disabled option as a match', async () => {
    const { c } = await setup();
    c.query.set('gam');
    expect(c.filtered()).toEqual([]);
  });

  it('shows everything, including disabled entries, for an empty query', async () => {
    const { c } = await setup();
    expect(c.filtered().map((o) => o.value)).toEqual(['alpha', 'beta', 'gamma', 'aleph']);
  });

  it('caps the list at maxItems', async () => {
    const { c } = await setup({ maxItems: 2 });
    expect(c.filtered()).toHaveLength(2);
    c.query.set('a');
    expect(c.filtered()).toHaveLength(2);
  });

  it('reports exactly one match as one match', async () => {
    const { c } = await setup();
    c.query.set('Alph');
    expect(c.filtered()).toHaveLength(1);
  });
});

describe('SvAutocompleteComponent — grouping', () => {
  it('buckets by group and keeps each option flat index intact', async () => {
    const { c } = await setup({ grouped: true });
    const groups = c.groupedFiltered();
    expect(groups.map((g) => g.label)).toEqual(['Greek', null]);
    expect(groups[0].rows.map((r) => r.index)).toEqual([0, 1, 2]);
    expect(groups[1].rows.map((r) => r.index)).toEqual([3]);
  });

  it('renders the section heading only for a named group', async () => {
    const s = await setup({ grouped: true });
    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();
    const headings = [...portal()!.querySelectorAll('[role="presentation"]')];
    expect(headings.map((h) => h.textContent!.trim())).toEqual(['Greek']);
    expect(rows()).toHaveLength(4);
  });

  it('puts an ungrouped-only list in a single unnamed bucket', async () => {
    const { c } = await setup({
      grouped: true,
      options: [{ value: 'x', label: 'X' }] as AutocompleteOption[],
    });
    expect(c.groupedFiltered()).toEqual([
      { label: null, rows: [{ opt: { value: 'x', label: 'X' }, index: 0 }] },
    ]);
  });
});

describe('SvAutocompleteComponent — keyboard', () => {
  const press = (
    s: { fixture: { detectChanges(): void }; input: HTMLInputElement },
    key: string,
  ) => {
    const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    s.input.dispatchEvent(e);
    s.fixture.detectChanges();
    return e;
  };

  it('opens the panel on the first ArrowDown and moves the highlight', async () => {
    const s = await setup();
    expect(s.c.open()).toBe(false);
    expect(press(s, 'ArrowDown').defaultPrevented).toBe(true);
    expect(s.c.open()).toBe(true);
    expect(s.c.highlightIdx()).toBe(0);

    press(s, 'ArrowDown');
    expect(s.c.highlightIdx()).toBe(1);
  });

  it('stops at the last option instead of wrapping', async () => {
    const s = await setup();
    for (let i = 0; i < 8; i++) press(s, 'ArrowDown');
    expect(s.c.highlightIdx()).toBe(3);
  });

  it('stops at the first option going up', async () => {
    const s = await setup();
    press(s, 'ArrowDown');
    press(s, 'ArrowDown');
    press(s, 'ArrowUp');
    press(s, 'ArrowUp');
    press(s, 'ArrowUp');
    expect(s.c.highlightIdx()).toBe(0);
  });

  it('jumps to the ends with Home and End, but only while open', async () => {
    const s = await setup();
    // Shut: neither key is claimed and nothing moves.
    expect(press(s, 'End').defaultPrevented).toBe(false);
    expect(s.c.highlightIdx()).toBe(-1);

    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();
    expect(press(s, 'End').defaultPrevented).toBe(true);
    expect(s.c.highlightIdx()).toBe(3);
    expect(press(s, 'Home').defaultPrevented).toBe(true);
    expect(s.c.highlightIdx()).toBe(0);
  });

  it('picks the highlighted option on Enter', async () => {
    const chosen: AutocompleteOption[] = [];
    const s = await setup({}, { selected: (o: AutocompleteOption) => chosen.push(o) });
    press(s, 'ArrowDown');
    press(s, 'ArrowDown');
    press(s, 'Enter');
    expect(chosen.map((o) => o.value)).toEqual(['beta']);
    expect(s.c.open()).toBe(false);
  });

  /** Enter with nothing highlighted must not guess at the first row. */
  it('picks nothing on Enter when nothing is highlighted', async () => {
    const chosen: AutocompleteOption[] = [];
    const s = await setup({}, { selected: (o: AutocompleteOption) => chosen.push(o) });
    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();
    expect(s.c.highlightIdx()).toBe(-1);
    press(s, 'Enter');
    expect(chosen).toEqual([]);
  });

  it('closes on Escape', async () => {
    const s = await setup();
    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();
    press(s, 'Escape');
    expect(s.c.open()).toBe(false);
    expect(portal()).toBeNull();
  });

  it('leaves ordinary keys to the input', async () => {
    const s = await setup();
    expect(press(s, 'x').defaultPrevented).toBe(false);
  });

  it('points aria-activedescendant at the highlighted row, and drops it when shut', async () => {
    const s = await setup();
    press(s, 'ArrowDown');
    expect(s.input.getAttribute('aria-activedescendant')).toBe(s.c.optionId(0));
    expect(s.input.getAttribute('aria-expanded')).toBe('true');

    press(s, 'Escape');
    expect(s.input.getAttribute('aria-activedescendant')).toBeNull();
    expect(s.input.getAttribute('aria-controls')).toBeNull();
  });
});

describe('SvAutocompleteComponent — choosing', () => {
  it('puts the label in the box and the value in the model', async () => {
    const chosen: AutocompleteOption[] = [];
    const s = await setup({}, { selected: (o: AutocompleteOption) => chosen.push(o) });
    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();
    rows()[0].click();
    s.fixture.detectChanges();

    expect(s.c.query()).toBe('Alpha');
    expect(s.c.value()).toBe('alpha');
    expect(chosen).toHaveLength(1);
    expect(s.c.open()).toBe(false);
  });

  /** The row is rendered but must refuse the click. */
  it('refuses to pick a disabled option', async () => {
    const chosen: AutocompleteOption[] = [];
    const s = await setup({}, { selected: (o: AutocompleteOption) => chosen.push(o) });
    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();

    const disabled = rows().find((r) => r.getAttribute('aria-disabled') === 'true')!;
    disabled.click();
    s.fixture.detectChanges();
    expect(chosen).toEqual([]);
    expect(s.c.value()).toBe('');
    expect(s.c.open()).toBe(true);
  });

  it('highlights whatever the pointer is over', async () => {
    const s = await setup();
    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();
    rows()[2].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    s.fixture.detectChanges();
    expect(s.c.highlightIdx()).toBe(2);
  });

  it('marks only the chosen row aria-selected', async () => {
    const s = await setup({ value: 'beta' });
    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();
    expect(rows().filter((r) => r.getAttribute('aria-selected') === 'true')).toHaveLength(1);
  });

  it('clears the box, the value and the highlight', async () => {
    let cleared = 0;
    const s = await setup({ value: 'alpha' }, { cleared: () => cleared++ });
    s.c.query.set('Alpha');
    s.fixture.detectChanges();

    (s.fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[aria-label="Clear"]')!.click();
    s.fixture.detectChanges();
    expect(cleared).toBe(1);
    expect(s.c.query()).toBe('');
    expect(s.c.value()).toBe('');
  });

  it('refuses to clear while disabled', async () => {
    let cleared = 0;
    const s = await setup({ disabled: true }, { cleared: () => cleared++ });
    s.c.query.set('Alpha');
    s.c.clear();
    expect(cleared).toBe(0);
    expect(s.c.query()).toBe('Alpha');
  });

  it('offers no clear control until there is something to clear', async () => {
    const s = await setup();
    expect(s.fixture.nativeElement.querySelector('[aria-label="Clear"]')).toBeNull();
    type(s, 'a');
    expect(s.fixture.nativeElement.querySelector('[aria-label="Clear"]')).not.toBeNull();
  });

  it('offers no clear control when clearable is off', async () => {
    const s = await setup({ clearable: false });
    type(s, 'a');
    expect(s.fixture.nativeElement.querySelector('[aria-label="Clear"]')).toBeNull();
  });
});

describe('SvAutocompleteComponent — the highlighted term', () => {
  /**
   * ★★★ THESE FOUR ASSERTED AN HTML STRING, AND THAT CONTRACT IS GONE
   *     (`FI-01-I3`). `highlight()` built
   *     `text.replace(re, '<mark …>$1</mark>')` and the template bound it to
   *     `[innerHTML]`. The query was escaped for regex — the LABEL was never
   *     escaped for HTML, and labels come from whoever supplies the options.
   *
   *     Angular's sanitiser is why this looked fine for so long: it strips
   *     scripts, so nothing executed, but `<b>`, `<a href>` and `<img src>` all
   *     render. The component now returns runs of plain text and the template
   *     writes the `<mark>` itself, so there is no HTML string at all.
   *
   * ★★ The claims below are the same claims, restated against the new
   *    contract — corrected, not deleted. The one that matters most is new:
   *    `rejoin` proves nothing was invented, dropped or re-cased.
   */
  const rejoin = (segs: readonly { text: string }[]): string => segs.map((s) => s.text).join('');
  const marked = (segs: readonly { text: string; match: boolean }[]): string[] =>
    segs.filter((s) => s.match).map((s) => s.text);

  it('marks every occurrence of the query, case-insensitively', async () => {
    const { c } = await setup();
    c.query.set('al');
    const segs = c.highlightSegments('Alpha and Alpine');
    expect(marked(segs)).toEqual(['Al', 'Al']);
    // And the label survives intact, capitalisation included.
    expect(rejoin(segs)).toBe('Alpha and Alpine');
  });

  it('leaves the text alone when nothing has been typed', async () => {
    const { c } = await setup();
    expect(c.highlightSegments('Alpha')).toEqual([{ text: 'Alpha', match: false }]);
    c.query.set('   ');
    expect(c.highlightSegments('Alpha')).toEqual([{ text: 'Alpha', match: false }]);
  });

  /** A query of `a.*` must match the literal characters, not act as a regex. */
  it('treats regex metacharacters in the query as literal text', async () => {
    const { c } = await setup();
    c.query.set('a.*');
    expect(marked(c.highlightSegments('Alpha'))).toEqual([]);
    expect(marked(c.highlightSegments('a.*b'))).toEqual(['a.*']);
  });

  it('does not throw on a query that is not a valid regular expression', async () => {
    // It no longer builds one. Reachable by typing `(` into the box.
    const { c } = await setup();
    c.query.set('(');
    expect(() => c.highlightSegments('a (b) c')).not.toThrow();
    expect(marked(c.highlightSegments('a (b) c'))).toEqual(['(']);
  });

  it('renders a label containing markup as TEXT, not as markup', async () => {
    // The defect itself. Before this, the `<img>` reached the HTML parser and
    // the browser made a request to `evil.example` for every viewer — no click,
    // no visible artefact, and Angular's sanitiser perfectly happy.
    const s = await setup({
      options: [{ value: 'x', label: '<img src="https://evil.example/pixel">alpha' }],
    });
    type(s, 'alpha');
    const row = portal()!.querySelector('li p');
    expect(row!.querySelector('img')).toBeNull();
    expect(row!.textContent).toContain('<img src="https://evil.example/pixel">');
  });

  it('renders the marks into the row', async () => {
    const s = await setup();
    type(s, 'alp');
    expect(portal()!.querySelector('mark')).not.toBeNull();
  });

  it('does not pad the word it highlights', async () => {
    // ★★ Angular PRESERVES whitespace between `@for` / `@if` blocks, so laying
    //    the template's control flow out over indented lines inserts spaces
    //    inside the highlighted word — "Al pha" instead of "Alpha". The blocks
    //    are written closed-up for this reason, and this is the test that says
    //    so, because the rendering looks almost right either way.
    const s = await setup();
    type(s, 'alp');
    const row = portal()!.querySelector('li p');
    expect(row!.textContent).toBe('Alpha');
  });
});

describe('SvAutocompleteComponent — what the panel says', () => {
  it('says nothing matched, in the host copy', async () => {
    const s = await setup({ noResultsLabel: 'Nobody here' });
    type(s, 'zzzz');
    expect(portal()!.textContent).toContain('Nobody here');
    expect(rows()).toHaveLength(0);
  });

  it('shows a failed lookup instead of "no results"', async () => {
    let retried = 0;
    const s = await setup({ error: 'Directory down', options: [] }, { retry: () => retried++ });
    type(s, 'zzz');
    expect(portal()!.querySelector('[data-sv-state="error"]')).not.toBeNull();
    portal()!.querySelector<HTMLButtonElement>('button')!.click();
    expect(retried).toBe(1);
  });

  it('says what it is waiting for instead of "no results" below minChars', async () => {
    const s = await setup({ minChars: 3, options: [] });
    type(s, 'al');
    expect(portal()!.querySelector('[data-sv-state="min-chars"]')!.textContent).toContain(
      'Type 3 characters to search',
    );
  });

  it('uses the singular for a one-character minimum', async () => {
    const { c } = await setup({ minChars: 1 });
    expect(c.minCharsHint()).toBe('Type 1 character to search');
  });

  it('shows no empty state at all while the box is still blank', async () => {
    const s = await setup({ options: [] });
    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();
    expect(portal()!.textContent!.trim()).toBe('');
  });

  it('shows no empty state while a lookup is in flight', async () => {
    const s = await setup({ options: [], loading: true });
    type(s, 'zzz');
    expect(portal()!.textContent!.trim()).toBe('');
    // …and the leading icon becomes a spinner.
    expect(s.fixture.nativeElement.querySelector('sv-spinner-arc')).not.toBeNull();
  });
});

describe('SvAutocompleteComponent — opening and closing', () => {
  it('opens on focus and closes on a click outside', async () => {
    const s = await setup();
    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();
    expect(portal()).not.toBeNull();

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    s.fixture.detectChanges();
    expect(portal()).toBeNull();
  });

  it('stays open for a click on itself or inside its own panel', async () => {
    const s = await setup();
    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();

    s.input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    s.fixture.detectChanges();
    expect(portal()).not.toBeNull();

    portal()!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    s.fixture.detectChanges();
    expect(portal()).not.toBeNull();
  });

  it('does not reopen on a focus it already has', async () => {
    const s = await setup();
    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();
    const first = portal();
    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();
    expect(portal()).toBe(first);
  });

  it('ignores Escape, outside clicks and resize while it is shut', async () => {
    const s = await setup();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    window.dispatchEvent(new Event('resize'));
    expect(s.c.open()).toBe(false);
  });

  it('closes on Escape pressed anywhere in the document', async () => {
    const s = await setup();
    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    s.fixture.detectChanges();
    expect(portal()).toBeNull();
  });

  it('closes on a window resize', async () => {
    const s = await setup();
    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();
    window.dispatchEvent(new Event('resize'));
    s.fixture.detectChanges();
    expect(portal()).toBeNull();
  });

  it('takes the panel down with it when destroyed', async () => {
    const s = await setup();
    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();
    s.fixture.destroy();
    expect(portal()).toBeNull();
  });

  it('keeps typing in an already-open panel without remounting it', async () => {
    const s = await setup();
    type(s, 'a');
    const first = portal();
    type(s, 'al');
    expect(portal()).toBe(first);
  });
});

/**
 * Placement. jsdom reports an all-zero rect and a 1024×768 viewport, so every
 * rect below is an EXPLICIT stub — the arithmetic is the subject.
 */
describe('SvAutocompleteComponent — where the panel goes', () => {
  const stub = (s: { input: HTMLInputElement }, rect: Partial<DOMRect>) => {
    s.input.getBoundingClientRect = () =>
      ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, ...rect }) as DOMRect;
  };

  it('drops below and matches the input width', async () => {
    const s = await setup();
    stub(s, { top: 40, bottom: 70, left: 30, right: 230, width: 200 });
    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();

    const style = s.c.panelStyle();
    expect(s.c.openAbove()).toBe(false);
    expect(style['top']).toBe('74px');
    expect(style['left']).toBe('30px');
    expect(style['width']).toBe('200px');
  });

  it('flips above an input with more room over it than under it', async () => {
    const s = await setup();
    stub(s, { top: 700, bottom: 730, left: 30, right: 230, width: 200 });
    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();

    const style = s.c.panelStyle();
    expect(s.c.openAbove()).toBe(true);
    expect(style['bottom']).toBe(`${768 - 700 + 4}px`);
    expect(style['top']).toBeUndefined();
    expect(style['maxHeight']).toBe(`${700 - 4 - 8}px`);
  });

  it('keeps a usable height even with almost no room', async () => {
    const s = await setup();
    stub(s, { top: 10, bottom: 760, left: 30, right: 230, width: 200 });
    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();
    // Below has 768−760−4−8 = −4; the floor keeps it usable and scrolling.
    expect(s.c.panelStyle()['maxHeight']).toBe('160px');
  });

  it('right-anchors an input whose right edge is off-screen', async () => {
    const s = await setup();
    stub(s, { top: 40, bottom: 70, left: 900, right: 1100, width: 200 });
    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();

    const style = s.c.panelStyle();
    expect(s.c.alignRight()).toBe(true);
    expect(style['right']).toBe('8px'); // clamped to MARGIN
    expect(style['left']).toBeUndefined();
  });

  it('follows the input while an ancestor scrolls, and ignores scroll when shut', async () => {
    const s = await setup();
    stub(s, { top: 40, bottom: 70, left: 30, right: 230, width: 200 });
    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();
    expect(s.c.panelStyle()['top']).toBe('74px');

    stub(s, { top: 140, bottom: 170, left: 30, right: 230, width: 200 });
    window.dispatchEvent(new Event('scroll'));
    await until(() => s.c.panelStyle()['top'] === '174px', {
      label: 'the panel to follow the input',
    });

    s.c.close();
    s.fixture.detectChanges();
    const frozen = s.c.panelStyle();
    window.dispatchEvent(new Event('scroll'));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(s.c.panelStyle()).toBe(frozen);
  });
});

describe('SvAutocompleteComponent — presentation', () => {
  it.each([
    ['sm', 'h-8'],
    ['md', 'h-10'],
    ['lg', 'h-12'],
  ])('sizes the field for %s', async (size, cls) => {
    const { c } = await setup({ size });
    expect(c.inputClass()).toContain(cls);
  });

  it.each([
    ['default', 'border-gray-200'],
    ['filled', 'bg-gray-100'],
    ['ghost', 'bg-transparent'],
  ])('styles the %s variant', async (variant, cls) => {
    const { c } = await setup({ variant });
    expect(c.inputClass()).toContain(cls);
  });

  it('adds the focus ring only while the panel is open', async () => {
    const s = await setup();
    expect(s.c.inputClass()).not.toContain('ring-2');
    s.input.dispatchEvent(new Event('focus'));
    s.fixture.detectChanges();
    expect(s.c.inputClass()).toContain('ring-2');
  });

  it('labels itself from the placeholder when there is no visible label', async () => {
    const bare = await setup({ placeholder: 'Find a thing' });
    expect(bare.c.accessibleName()).toBe('Find a thing');
    expect(bare.input.getAttribute('aria-label')).toBe('Find a thing');

    const labelled = await setup({ label: 'Country' });
    expect(labelled.c.accessibleName()).toBe('Country');
    // A visible <label> already names it — a duplicate aria-label would win
    // over it and hide the association.
    expect(labelled.input.getAttribute('aria-label')).toBeNull();
    expect(labelled.fixture.nativeElement.querySelector('label')).not.toBeNull();
  });

  it('gives every instance its own ids', async () => {
    // Both instances must share an application: ids are per application (svUniqueId).
    const a = await setup();
    const b = TestBed.createComponent(SvAutocompleteComponent);
    b.componentRef.setInput('options', OPTIONS);
    b.detectChanges();
    await b.whenStable();
    expect(a.c._uid).not.toBe(b.componentInstance._uid);
    expect(a.c.optionId(2)).toBe(`${a.c._uid}-opt-2`);
  });
});

describe('SvAutocompleteComponent — as a form control', () => {
  @Component({
    standalone: true,
    imports: [SvAutocompleteComponent, ReactiveFormsModule],
    template: `<sv-autocomplete [options]="options" [formControl]="ctrl" />`,
  })
  class Host {
    readonly ctrl = new FormControl<string>('beta');
    readonly options = OPTIONS;
  }

  async function hostSetup() {
    TestBed.resetTestingModule();
    const { fixture } = await render(Host);
    const c = fixture.debugElement.children[0].componentInstance as SvAutocompleteComponent;
    return { fixture, c, host: fixture.componentInstance as Host };
  }

  it('shows the label of the option the form named', async () => {
    const { c } = await hostSetup();
    expect(c.query()).toBe('Beta');
    expect(c.value()).toBe('beta');
  });

  it('falls back to the raw value when no option matches it', async () => {
    const { fixture, c, host } = await hostSetup();
    host.ctrl.setValue('not-an-option');
    fixture.detectChanges();
    expect(c.query()).toBe('not-an-option');
  });

  it('treats null as an empty box', async () => {
    const { fixture, c, host } = await hostSetup();
    host.ctrl.setValue(null);
    fixture.detectChanges();
    expect(c.query()).toBe('');
    expect(c.value()).toBe('');
  });

  it('writes the chosen value back, and the typed text before that', async () => {
    const { fixture, c, host } = await hostSetup();
    c.onInputChange('al');
    fixture.detectChanges();
    expect(host.ctrl.value).toBe('al');

    c.pick(OPTIONS[0]);
    fixture.detectChanges();
    expect(host.ctrl.value).toBe('alpha');
  });

  it('writes an empty value when cleared', async () => {
    const { fixture, c, host } = await hostSetup();
    c.clear();
    fixture.detectChanges();
    expect(host.ctrl.value).toBe('');
  });

  it('follows the control when it is disabled and re-enabled', async () => {
    const { fixture, c, host } = await hostSetup();
    host.ctrl.disable();
    fixture.detectChanges();
    expect(c.resolvedDisabled()).toBe(true);
    expect(fixture.nativeElement.querySelector('input').disabled).toBe(true);

    host.ctrl.enable();
    fixture.detectChanges();
    expect(c.resolvedDisabled()).toBe(false);
  });

  it('marks the control touched on blur', async () => {
    const { fixture, host } = await hostSetup();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(host.ctrl.touched).toBe(false);
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(host.ctrl.touched).toBe(true);
  });
});
