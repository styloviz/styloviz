import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core';
import { SvAccordionComponent, type AccordionItem } from './accordion.component';

/**
 * `NV-01-I2` / `NV-01-M6` — the document outline.
 *
 * ★ AT `HEAD` THERE WAS NO HEADING AT ALL, which is the same failure the
 *   backlog describes as "hard-coded": a screen-reader user navigating a long
 *   FAQ by heading could not find the sections, and the accordion contributed
 *   nothing to the page outline. So the heading ships unconditionally and the
 *   LEVEL is the input — with a clamp, because `<h7>` is not an element and
 *   rendering one would silently take the accordion back out of the outline.
 */

const ITEMS: AccordionItem[] = [
  { id: 'a', title: 'First', content: 'One' },
  { id: 'b', title: 'Second', content: 'Two' },
];

async function setup(inputs: Partial<ComponentInput<SvAccordionComponent>> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAccordionComponent, {
    inputs: { items: ITEMS, ...inputs } as ComponentInput<SvAccordionComponent>,
  });
  return fixture;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const headers = (f: { nativeElement: unknown }) =>
  [...el(f).querySelectorAll<HTMLButtonElement>('button[aria-expanded]')];
/** The tag name of each header button's parent — the heading wrapper. */
const levels = (f: { nativeElement: unknown }) =>
  headers(f).map((b) => b.parentElement!.tagName.toLowerCase());

describe('SvAccordionComponent — heading level', () => {
  beforeEach(() => svResetWarnOnce());

  it('wraps every header button in a real heading element', async () => {
    const f = await setup();
    // A real `<h3>`, not a `<div role="heading">`: heading-map tooling, reader
    // modes and the HTML outline all read the element, not only the role.
    expect(levels(f)).toEqual(['h3', 'h3']);
  });

  it('renders the level the host asked for', async () => {
    for (const [level, tag] of [[1, 'h1'], [2, 'h2'], [4, 'h4'], [5, 'h5'], [6, 'h6']] as const) {
      const f = await setup({ headingLevel: level });
      expect(levels(f)).toEqual([tag, tag]);
    }
  });

  it('leaves the heading visually inert, so the level changes nothing on screen', async () => {
    const three = await setup();
    const one = await setup({ headingLevel: 1 });
    // `m-0` and nothing else: a heading's default margin would push the panels
    // apart, and its default font-size would fight the button's own type scale.
    expect(headers(three)[0].parentElement!.className).toBe('m-0');
    expect(headers(one)[0].parentElement!.className).toBe('m-0');
    expect(headers(one)[0].className).toBe(headers(three)[0].className);
  });

  it('clamps a level above 6 and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const f = await setup({ headingLevel: 9 });

    expect(levels(f)).toEqual(['h6', 'h6']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('headingLevel="9"');
    warn.mockRestore();
  });

  it('clamps a level below 1 rather than emitting an <h0>', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const f = await setup({ headingLevel: 0 });

    expect(levels(f)).toEqual(['h1', 'h1']);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('falls back to h3 for a value that is not a number at all', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // `depth + 1` where `depth` is undefined — the shape this input exists to
    // survive, and the reason it takes `number` rather than a literal union.
    const f = await setup({ headingLevel: Number.NaN });

    expect(levels(f)).toEqual(['h3', 'h3']);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('truncates a fractional level without complaining', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const f = await setup({ headingLevel: 2.9 });

    expect(levels(f)).toEqual(['h2', 'h2']);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns once per accordion, not once per panel', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await setup({ headingLevel: 7, items: [...ITEMS, { id: 'c', title: 'Third', content: 'Three' }] });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('keeps the header a button inside the heading, not the heading itself', async () => {
    const f = await setup({ headingLevel: 2 });
    const heading = el(f).querySelector('h2')!;
    expect(heading.children.length).toBe(1);
    expect(heading.firstElementChild!.tagName).toBe('BUTTON');
    expect(heading.getAttribute('role')).toBeNull();
  });
});
