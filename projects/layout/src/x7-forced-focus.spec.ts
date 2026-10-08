import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { afterEach, vi } from 'vitest';
import { SvScrollToTopComponent } from './scroll-to-top/scroll-to-top.component';
import { SvToolbarComponent, type ToolbarAction, type ToolbarVariant } from './toolbar/toolbar.component';

/**
 * `X-7` forced colors — a VISIBLE FOCUS on every focusable element.
 *
 * Scroll to Top and Toolbar draw focus as `outline-none` + a box-shadow ring.
 * `forced-colors: active` removes every box shadow, so a keyboard user in
 * Windows High Contrast saw no focus indicator at all. Each focusable element
 * now carries an outline scoped to that mode.
 *
 * ⚠️ All three classes are required, and the spec asserts all three: in
 * Tailwind 4 `outline-none` sets `--tw-outline-style: none` and `outline-2`
 * READS that variable, so without `outline-solid` the outline has style `none`.
 * jsdom cannot emulate forced colors, so these pin the classes on the RENDERED
 * nodes — every variant, every focusable element.
 */

const FORCED_FOCUS = [
  'forced-colors:focus-visible:outline-2',
  'forced-colors:focus-visible:outline-solid',
  'forced-colors:focus-visible:outline-offset-2',
] as const;

function expectForcedFocus(el: Element, what: string): void {
  for (const cls of FORCED_FOCUS) {
    expect(el.classList.contains(cls), `${what} lacks ${cls}`).toBe(true);
  }
}

afterEach(() => vi.restoreAllMocks());

describe('Scroll to Top — forced-colors focus (X-7)', () => {
  const variants = ['circle', 'rounded', 'pill'] as const;
  const appearances = ['solid', 'glass', 'gradient', 'outline'] as const;
  const cases = variants.flatMap((variant) => appearances.map((appearance) => [variant, appearance] as const));

  it.each(cases)('%s / %s: the button keeps a visible focus outline', async (variant, appearance) => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvScrollToTopComponent, {
      inputs: { demo: true, variant, appearance } as ComponentInput<SvScrollToTopComponent>,
    });
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
    expect(buttons.length).toBe(1);
    expectForcedFocus(buttons[0], `${variant}/${appearance} button`);
  });

  it.each([{ contained: true }, { contained: false }])('keeps it in the non-demo modes too (%o)', async (mode) => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvScrollToTopComponent, {
      inputs: mode as ComponentInput<SvScrollToTopComponent>,
    });
    expectForcedFocus((fixture.nativeElement as HTMLElement).querySelector('button') as HTMLElement, 'button');
  });
});

describe('Toolbar — forced-colors focus (X-7)', () => {
  const ACTIONS: readonly ToolbarAction[] = [
    { id: 'plain', label: 'Plain', icon: 'bold' },
    { id: 'primary', label: 'Primary', icon: 'bold', variant: 'primary', toggle: true },
    { id: 'danger', label: 'Danger', icon: 'bold', variant: 'danger' },
    { id: 'success', label: 'Success', icon: 'bold', variant: 'success', toggle: true },
    { id: 'off', label: 'Off', icon: 'bold', disabled: true },
  ];
  const VARIANTS: readonly ToolbarVariant[] = ['default', 'glass', 'bordered', 'elevated', 'ghost'];

  it.each(VARIANTS)('%s: every action button, idle and active, keeps a focus outline', async (variant) => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvToolbarComponent, {
      inputs: {
        actions: ACTIONS,
        variant,
        // Two toggles active, so both accent branches render too.
        activeIds: new Set(['primary', 'success']),
      } as ComponentInput<SvToolbarComponent>,
    });
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
    expect(buttons.length).toBe(ACTIONS.length);
    expect([...buttons].filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(2);
    for (const b of Array.from(buttons)) expectForcedFocus(b, `${variant} ${b.getAttribute('data-action-id')}`);
  });

  it.each(['sm', 'md', 'lg'] as const)('size %s keeps it', async (size) => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvToolbarComponent, {
      inputs: { actions: ACTIONS.slice(0, 1), size } as ComponentInput<SvToolbarComponent>,
    });
    expectForcedFocus((fixture.nativeElement as HTMLElement).querySelector('button') as HTMLElement, `${size} button`);
  });

  @Component({
    standalone: true,
    imports: [SvToolbarComponent],
    template: `<sv-toolbar overflow="menu" label="Editor" [actions]="actions()" />`,
  })
  class MenuHost {
    readonly actions = signal<readonly ToolbarAction[]>(ACTIONS);
  }

  it('the More button and every overflow menu item keep it', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const width = this.tagName === 'SV-TOOLBAR' ? 120 : 32;
      return { x: 0, y: 0, top: 0, left: 0, width, height: 40, right: width, bottom: 40, toJSON: () => ({}) } as DOMRect;
    });
    TestBed.resetTestingModule();
    const { fixture } = await render(MenuHost);
    await fixture.whenStable();
    const more = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-sv-toolbar-more]');
    expect(more).toBeTruthy();
    expectForcedFocus(more as HTMLButtonElement, 'More button');

    (more as HTMLButtonElement).click();
    fixture.detectChanges();
    const items = document.body.querySelectorAll('[data-sv-toolbar-menuitem]');
    expect(items.length).toBeGreaterThan(0);
    for (const item of Array.from(items)) expectForcedFocus(item, `menu item ${item.getAttribute('data-action-id')}`);
    fixture.destroy();
  });
});
