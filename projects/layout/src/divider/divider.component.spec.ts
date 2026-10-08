import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import { SvDividerComponent } from './divider.component';
import { ICON_REGISTRY } from '@styloviz/icons';

/**
 * A separator whose whole job is a line and, sometimes, a label sitting in a
 * gap in it. What is worth pinning is which side of the label the gap falls on
 * — `align` decides which of the two line segments is dropped, and getting it
 * backwards is invisible in a class-name assertion — and that a screen reader
 * is told what kind of break this is.
 */

async function setup(inputs: Partial<ComponentInput<SvDividerComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvDividerComponent, { inputs: inputs as ComponentInput<SvDividerComponent> });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const rule = () => screen.getByRole('separator');
const segments = () => [...rule().children].filter((c) => c.tagName === 'DIV' && !c.querySelector('span, svg'));

describe('SvDividerComponent — as a separator', () => {
  it('announces its orientation', async () => {
    const { fixture: h } = await setup();
    expect(rule().getAttribute('aria-orientation')).toBe('horizontal');
    expect(h.componentInstance.isHorizontal()).toBe(true);

    await setup({ orientation: 'vertical' });
    expect(rule().getAttribute('aria-orientation')).toBe('vertical');
  });

  it('carries its label as its accessible name', async () => {
    await setup({ label: 'or' });
    expect(rule().getAttribute('aria-label')).toBe('or');
  });

  it('has no name when it is only a line', async () => {
    await setup();
    expect(rule().getAttribute('aria-label')).toBeNull();
  });
});

describe('SvDividerComponent — where the gap falls', () => {
  it('is one unbroken line with nothing in it', async () => {
    await setup();
    expect(segments().length).toBe(1);
  });

  it('breaks in the middle for a centred label', async () => {
    await setup({ label: 'or' });
    expect(segments().length).toBe(2);
    expect(screen.getByText('or')).toBeTruthy();
  });

  it('puts the label first when aligned to the start', async () => {
    await setup({ label: 'or', align: 'start' });
    expect(segments().length).toBe(1);
    const children = [...rule().children];
    expect(children[0].textContent?.trim()).toBe('or');
  });

  it('puts the label last when aligned to the end', async () => {
    await setup({ label: 'or', align: 'end' });
    expect(segments().length).toBe(1);
    const children = [...rule().children];
    expect(children.at(-1)?.textContent?.trim()).toBe('or');
  });

  it('ignores align when there is nothing to align around', async () => {
    await setup({ align: 'start' });
    expect(segments().length).toBe(1);
  });

  /**
   * `icon` was a raw `<path d="…">` and this asserted the string came back out
   * of the DOM — which would have passed for any string at all, including one
   * that draws nothing. It is a library NAME now, so the check is that the name
   * resolved: the geometry has to be the registry's.
   */
  it('renders an icon on its own, and alongside a label', async () => {
    const { fixture: iconOnly } = await setup({ icon: 'star' });
    const host = el(iconOnly);
    expect(host.querySelector('sv-icon')).toBeTruthy();
    const expected = (ICON_REGISTRY.star[0] as { d?: string }).d;
    expect(host.querySelector('path')?.getAttribute('d')).toBe(expected);
    expect(iconOnly.componentInstance.hasContent()).toBe(true);

    await setup({ icon: 'star', label: 'or' });
    expect(screen.getByText('or')).toBeTruthy();
  });
});

describe('SvDividerComponent — the line itself', () => {
  it('draws along the top when horizontal and the left when vertical', async () => {
    const { fixture: h } = await setup({ thickness: 3 });
    expect(h.componentInstance.lineStyle()).toContain('border-top-width:3px');

    const { fixture: v } = await setup({ orientation: 'vertical', thickness: 3 });
    expect(v.componentInstance.lineStyle()).toContain('border-left-width:3px');
  });

  it.each(['dashed', 'dotted'] as const)('draws a %s rule', async (variant) => {
    const { fixture } = await setup({ variant });
    expect(fixture.componentInstance.lineStyle()).toContain(`border-top-style:${variant}`);
  });

  it('takes a colour, and drops the default colour class when it does', async () => {
    const { fixture } = await setup({ color: '#ff0000' });
    expect(fixture.componentInstance.lineStyle()).toContain('border-color:#ff0000');
    expect(fixture.componentInstance.lineClass()).not.toContain('border-gray-200');
  });

  it('paints a gradient instead of a border, on either axis', async () => {
    const { fixture: h } = await setup({ variant: 'gradient' });
    expect(h.componentInstance.lineStyle()).toBe('');
    expect(h.componentInstance.lineClass()).toContain('bg-gradient-to-r');

    const { fixture: v } = await setup({ variant: 'gradient', orientation: 'vertical' });
    expect(v.componentInstance.lineClass()).toContain('bg-gradient-to-b');
  });

  it('stretches to its parent when vertical, and fills the row when not', async () => {
    const { fixture: h } = await setup();
    expect(h.componentInstance.hostClass()).toContain('w-full');

    const { fixture: v } = await setup({ orientation: 'vertical' });
    expect(v.componentInstance.hostClass()).toContain('self-stretch');
  });

  it('takes an explicit size, so it does not need a stretched parent', async () => {
    const { fixture } = await setup({ orientation: 'vertical', height: '2rem' });
    expect(fixture.componentInstance.rootStyle()).toBe('height:2rem;');
    expect(el(fixture).style.height).toBe('2rem');

    const { fixture: short } = await setup({ width: '120px' });
    expect(short.componentInstance.rootStyle()).toBe('width:120px;');
  });

  /**
   * The gap around a label has to open along the divider's own axis: sideways
   * on a horizontal rule, up and down on a vertical one. Getting it backwards
   * squeezes the text against the line it is meant to interrupt.
   */
  it('opens the gap around the label along its own axis', async () => {
    const { fixture: h } = await setup({ label: 'or' });
    expect(h.componentInstance.contentSpacingClass()).toBe('mx-3');
    expect(el(h).querySelector('[class*="mx-3"]')).toBeTruthy();

    const { fixture: v } = await setup({ label: 'or', orientation: 'vertical' });
    expect(v.componentInstance.contentSpacingClass()).toBe('my-3');
    expect(el(v).querySelector('[class*="my-3"]')).toBeTruthy();
    expect(v.componentInstance.wrapperClass()).toContain('mx-4');
  });

  it('has default spacing, and takes an override', async () => {
    const { fixture: normal } = await setup();
    expect(normal.componentInstance.wrapperClass()).toContain('my-4');

    const { fixture: custom } = await setup({ spacing: 'my-8' });
    expect(custom.componentInstance.wrapperClass()).toContain('my-8');
    expect(custom.componentInstance.wrapperClass()).not.toContain('my-4');
  });
});

/**
 * `LU-03-I1` / `LU-03-M1`: the component could not tell a real thematic break
 * from a visual flourish, so every flourish was announced as a separator. The
 * `semantics` input makes the choice explicit — and the default must keep
 * rendering exactly what it rendered before the input existed.
 */
describe('SvDividerComponent — semantic versus decorative', () => {
  const root = (f: { nativeElement: unknown }) => el(f).firstElementChild as HTMLElement;

  it('keeps the pre-existing output when semantics is not set', async () => {
    const { fixture } = await setup({ label: 'or', orientation: 'vertical' });
    const r = root(fixture);
    expect(r.getAttribute('role')).toBe('separator');
    expect(r.getAttribute('aria-orientation')).toBe('vertical');
    expect(r.getAttribute('aria-label')).toBe('or');
    expect(r.hasAttribute('aria-hidden')).toBe(false);
  });

  it('is a named separator with an orientation when semantic', async () => {
    await setup({ semantics: 'semantic', label: 'Section' });
    expect(rule().getAttribute('aria-orientation')).toBe('horizontal');
    expect(rule().getAttribute('aria-label')).toBe('Section');
  });

  it('leaves the accessibility tree entirely when decorative and unlabelled', async () => {
    const { fixture } = await setup({ semantics: 'decorative' });
    const r = root(fixture);
    expect(r.getAttribute('role')).toBe('none');
    expect(r.getAttribute('aria-hidden')).toBe('true');
    expect(r.hasAttribute('aria-orientation')).toBe(false);
    expect(screen.queryByRole('separator')).toBeNull();
  });

  /** "OR" between two sign-in buttons still means something when the line does not. */
  it('keeps a decorative label readable as plain text, announcing no separator', async () => {
    const { fixture } = await setup({ semantics: 'decorative', label: 'or' });
    const r = root(fixture);
    expect(r.getAttribute('role')).toBe('none');
    expect(r.hasAttribute('aria-hidden')).toBe(false);
    expect(r.hasAttribute('aria-label')).toBe(false);
    expect(screen.getByText('or')).toBeTruthy();
    expect(screen.queryByRole('separator')).toBeNull();
  });
});
