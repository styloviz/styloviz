import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvItemsWithMoreComponent, type ItemsWithMoreItem } from './items-with-more.component';

/**
 * "Three tags and +4 more". The split itself is arithmetic, and the part worth
 * pinning is that the two halves never disagree — whatever is hidden is exactly
 * what the +N counts and exactly what the dropdown lists, for any list length
 * including none and including fewer items than the limit.
 *
 * The dropdown is portalled into `<body>`, which is why Escape is its own test:
 * bound to the host it could never fire, because focus is moved into the panel
 * on open.
 */

const ITEMS = ['Design', 'Engineering', 'Marketing', 'Sales', 'Support'];

async function setup(inputs: Partial<ComponentInput<SvItemsWithMoreComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvItemsWithMoreComponent, {
    inputs: { items: ITEMS, ...inputs } as ComponentInput<SvItemsWithMoreComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const trigger = (f: { nativeElement: unknown }) =>
  el(f).querySelector<HTMLButtonElement>('[data-trigger]')!;
const panel = () => document.querySelector('.sv-dropdown-portal');

/**
 * A button inside THIS component, by its visible text.
 *
 * ★ Not `screen`, which searches the whole document. This component portals its
 * dropdown into `<body>`, so a portal left behind by the previous test puts a
 * second matching button in the document and `getByRole` throws on the
 * ambiguity — intermittently, and only under the load of a full shard, which is
 * the worst way for a test to fail. The inline more/less control is always
 * inside the host.
 */
const buttonIn = (f: { nativeElement: unknown }, text: RegExp) =>
  [...el(f).querySelectorAll('button')].find((b) => text.test(b.textContent ?? ''))!;

/**
 * Waits out the ONE deferred measurement the component schedules on mount.
 *
 * ★★ How this file came to need it. The constructor runs an `effect()` that
 * schedules `rAF(rAF(_measureInlineFits))`. Under jsdom every width is 0, and
 * the measurement used to read `0 <= 0` as "it all fits" — putting
 * `_inlineFits` back to **true** and, because a container that grew is supposed
 * to collapse an expansion, resetting `inlineExpanded` to **false**.
 *
 * The inline tests below force `_inlineFits` to false, because a container that
 * cannot report a width can never reach that state on its own. When the
 * deferred measurement landed *after* that — which it does the moment a test
 * `await`s anything, and far more often under the load of a full suite than in
 * a single-file run — it silently undid both. That is exactly how `opens out to
 * the whole sentence, and back` failed once in a 4,227-test run and passed
 * every time it was run alone.
 *
 * ★ The real fix was in the component, not here: an unlaid-out box now yields
 * no conclusion at all (see `concludes nothing while it is not being laid out`
 * below, which is the same defect as a hidden tab panel). These two frames are
 * belt and braces — they make the ordering explicit rather than incidental.
 *
 * Two `requestAnimationFrame`s, not a sleep: rAF callbacks are FIFO, so a frame
 * queued now always runs after the one the component queued during `render()`,
 * and the second after its second. That holds however loaded the machine is,
 * which is precisely what a `setTimeout` would not.
 */
const settleInlineMeasurement = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

// Belt and braces: nothing this file mounts should outlive its own test.
afterEach(() => document.querySelectorAll('.sv-dropdown-portal').forEach((n) => n.remove()));

describe('SvItemsWithMoreComponent — the split', () => {
  it('shows the first few and counts the rest', async () => {
    const { fixture } = await setup({ maxVisible: 3 });
    const c = fixture.componentInstance;
    expect(c.visibleItems()).toEqual(['Design', 'Engineering', 'Marketing']);
    expect(c.overflowItems()).toEqual(['Sales', 'Support']);
    expect(c.overflowCount()).toBe(2);
    expect(c.hasOverflow()).toBe(true);
  });

  it('hides exactly what it counts', async () => {
    for (const maxVisible of [0, 1, 3, 4, 5, 9]) {
      const { fixture } = await setup({ maxVisible });
      const c = fixture.componentInstance;
      expect(c.visibleItems().length + c.overflowItems().length).toBe(ITEMS.length);
      expect(c.overflowCount()).toBe(c.overflowItems().length);
    }
  });

  it('counts nothing when everything fits', async () => {
    const { fixture } = await setup({ maxVisible: 10 });
    const c = fixture.componentInstance;
    expect(c.overflowCount()).toBe(0);
    expect(c.hasOverflow()).toBe(false);
    expect(el(fixture).querySelector('[data-trigger]')).toBeNull();
  });

  it('copes with no items at all', async () => {
    const { fixture } = await setup({ items: [] });
    const c = fixture.componentInstance;
    expect(c.visibleItems()).toEqual([]);
    expect(c.overflowCount()).toBe(0);
    expect(c.hasOverflow()).toBe(false);
  });

  it('puts the count into the label the host wrote', async () => {
    const { fixture } = await setup({ maxVisible: 2, moreLabel: '+{n} more' });
    expect(fixture.componentInstance.formattedMoreLabel()).toBe('+3 more');

    const { fixture: custom } = await setup({ maxVisible: 2, moreLabel: 'and {n} others' });
    expect(custom.componentInstance.formattedMoreLabel()).toBe('and 3 others');
  });

  it('reads a label off an object item as happily as off a string', async () => {
    const objects: ItemsWithMoreItem[] = [
      { label: 'Design', color: 'red' },
      { label: 'Ops' },
    ];
    const { fixture } = await setup({ items: objects, maxVisible: 1 });
    const c = fixture.componentInstance;
    expect(c.label(objects[0])).toBe('Design');
    expect(c.label('plain')).toBe('plain');
    expect(c.overflowItems()).toEqual([objects[1]]);
  });
});

describe('SvItemsWithMoreComponent — the more control', () => {
  it('names what it is hiding, not just how many', async () => {
    // ★★ "+2 more" is a COUNT, not an answer. It said two things were hidden
    //    and nothing about whether the one the reader came for was among them —
    //    and with `moreDropdown` off, which is the default, there is no panel
    //    to open to find out. The names were simply unavailable.
    const { fixture } = await setup({ maxVisible: 3 });
    expect(trigger(fixture).getAttribute('aria-label')).toBe(
      'Show 2 more items: Sales, Support',
    );

    const { fixture: one } = await setup({ maxVisible: 4 });
    expect(trigger(one).getAttribute('aria-label')).toBe('Show 1 more item: Support');
  });

  it('hands the hidden items to the host when pressed', async () => {
    const seen: unknown[][] = [];
    const { fixture } = await setup({ maxVisible: 3 });
    fixture.componentInstance.moreClick.subscribe((items) => seen.push(items));

    await userEvent.click(trigger(fixture));
    expect(seen).toEqual([['Sales', 'Support']]);
  });

  it('claims no popup when it does not open one', async () => {
    const { fixture } = await setup({ maxVisible: 3 });
    expect(trigger(fixture).getAttribute('aria-haspopup')).toBeNull();
    expect(trigger(fixture).getAttribute('aria-expanded')).toBeNull();

    await userEvent.click(trigger(fixture));
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it.each(['badge', 'chip', 'text'] as const)('renders the %s variant', async (moreVariant) => {
    const { fixture } = await setup({ maxVisible: 3, moreVariant });
    expect(trigger(fixture)).toBeTruthy();
    expect(el(fixture).textContent).toContain('Design');
  });
});

describe('SvItemsWithMoreComponent — the dropdown', () => {
  it('says it opens a popup, and whether it is open', async () => {
    const { fixture } = await setup({ maxVisible: 3, moreDropdown: true });
    expect(trigger(fixture).getAttribute('aria-haspopup')).toBe('true');
    expect(trigger(fixture).getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(trigger(fixture));
    fixture.detectChanges();
    expect(trigger(fixture).getAttribute('aria-expanded')).toBe('true');
    expect(trigger(fixture).getAttribute('aria-controls')).toContain(String(fixture.componentInstance._uid));
  });

  it('mounts the panel outside its own element and lists what is hidden', async () => {
    const { fixture } = await setup({ maxVisible: 3, moreDropdown: true });
    await userEvent.click(trigger(fixture));
    fixture.detectChanges();

    expect(panel()).not.toBeNull();
    expect(el(fixture).contains(panel())).toBe(false);
    expect(panel()!.textContent).toContain('Sales');
    expect(panel()!.textContent).toContain('Support');
  });

  it('closes on a second press', async () => {
    const { fixture } = await setup({ maxVisible: 3, moreDropdown: true });
    await userEvent.click(trigger(fixture));
    fixture.detectChanges();
    await userEvent.click(trigger(fixture));
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it('closes on Escape pressed inside the panel', async () => {
    // Focus is moved into the portal on open, so a key pressed there never
    // bubbles through this component's element.
    const { fixture } = await setup({ maxVisible: 3, moreDropdown: true });
    await userEvent.click(trigger(fixture));
    fixture.detectChanges();

    (panel() as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(false);
    expect(panel()).toBeNull();
  });

  it('closes on a mousedown outside it', async () => {
    const { fixture } = await setup({ maxVisible: 3, moreDropdown: true });
    await userEvent.click(trigger(fixture));
    fixture.detectChanges();

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it('gives every instance its own panel id', async () => {
    // Both instances must share an application: ids are per application (svUniqueId).
    const { fixture: a } = await setup();
    const b = TestBed.createComponent(SvItemsWithMoreComponent);
    b.componentRef.setInput('items', ITEMS);
    b.detectChanges();
    await b.whenStable();
    expect(a.componentInstance._uid).not.toBe(b.componentInstance._uid);
  });

  it('takes the panel down with it', async () => {
    const { fixture } = await setup({ maxVisible: 3, moreDropdown: true });
    await userEvent.click(trigger(fixture));
    fixture.detectChanges();
    fixture.destroy();
    expect(panel()).toBeNull();
  });
});

describe('SvItemsWithMoreComponent — the inline variant', () => {
  it('reads as one sentence while it all fits', async () => {
    const { fixture } = await setup({ moreVariant: 'inline' });
    const c = fixture.componentInstance;
    expect(c._inlineFits()).toBe(true);
    expect(c.inlineText()).toBe('Design, Engineering, Marketing, Sales, Support');
  });

  it('assumes it fits until something has measured it', async () => {
    // Starting the other way round flashes a "+N more" button on every mount and
    // then takes it away again.
    const { fixture } = await setup({ moreVariant: 'inline' });
    expect(fixture.componentInstance._inlineFits()).toBe(true);
  });

  it('trims to the limit, and counts the rest, once it does not fit', async () => {
    const { fixture } = await setup({ moreVariant: 'inline', maxVisible: 2 });
    const c = fixture.componentInstance;
    await settleInlineMeasurement();
    c._inlineFits.set(false);
    fixture.detectChanges();

    expect(c.inlineText()).toBe('Design, Engineering, ');
    expect(c.inlineOverflowCount()).toBe(3);
    expect(c.inlineFormattedMoreLabel()).toBe('+3 more');
    expect(c.inlineHasOverflow()).toBe(true);
  });

  it('opens out to the whole sentence, and back', async () => {
    const { fixture } = await setup({ moreVariant: 'inline', maxVisible: 2 });
    const c = fixture.componentInstance;
    await settleInlineMeasurement();
    c._inlineFits.set(false);
    fixture.detectChanges();

    const button = buttonIn(fixture, /more/);
    expect(button.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(button);
    fixture.detectChanges();

    // ★ If this one ever fails, the deferred mount measurement has run late and
    // reset both signals — see `settleInlineMeasurement`. Asserting it here
    // means the next failure names its own cause instead of just reporting
    // `expected false to be true` on the line below.
    expect(c._inlineFits()).toBe(false);
    expect(c.inlineExpanded()).toBe(true);
    expect(c.inlineText()).toBe('Design, Engineering, Marketing, Sales, Support ');
    expect(buttonIn(fixture, /Less|less/).getAttribute('aria-expanded')).toBe('true');
  });

  it('concludes nothing while it is not being laid out, and keeps the expansion', async () => {
    // ★★ The bug this pins is not a test artefact. Verified in Chromium: when an
    // ancestor becomes `display:none`, ResizeObserver fires with contentRect
    // 0×0 and the hidden subtree reports `clientWidth` 0 and `offsetWidth` 0 —
    // so the measurement runs at the one moment it can measure nothing. Reading
    // `0 <= 0` as "it all fits" put the "+N more" button back AND discarded the
    // reader's expansion, so switching to another tab and back turned their
    // "Show less" into "+3 more" again.
    //
    // jsdom reports exactly those zeroes for every element, which makes it the
    // right place to pin it: before the guard, this test failed on both
    // assertions.
    const { fixture } = await setup({ moreVariant: 'inline', maxVisible: 2 });
    const c = fixture.componentInstance;
    c._inlineFits.set(false);
    c.inlineExpanded.set(true);

    await settleInlineMeasurement();

    expect(c._inlineFits()).toBe(false);
    expect(c.inlineExpanded()).toBe(true);
  });

  it('always renders the full text somewhere, for measuring against', async () => {
    const { fixture } = await setup({ moreVariant: 'inline', maxVisible: 2 });
    expect(fixture.componentInstance.inlineFullText())
      .toBe('Design, Engineering, Marketing, Sales, Support');
  });

  it('offers nothing to expand when there is nothing hidden', async () => {
    const { fixture } = await setup({ moreVariant: 'inline', maxVisible: 10 });
    await settleInlineMeasurement();
    fixture.componentInstance._inlineFits.set(false);
    fixture.detectChanges();
    expect(fixture.componentInstance.inlineHasOverflow()).toBe(false);
  });
});
