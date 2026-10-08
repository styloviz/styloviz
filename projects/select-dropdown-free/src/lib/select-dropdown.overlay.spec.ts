import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { flush } from '../../../../src/testing/async';
import {
  SvSelectDropdownComponent,
  type SelectOption,
} from './select-dropdown.component';

const OPTIONS = (): SelectOption[] => [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvSelectDropdownComponent, {
    inputs: { options: OPTIONS(), ...inputs },
  });
  return fixture;
}

afterEach(() => {
  vi.restoreAllMocks();
  TestBed.resetTestingModule();
});

const portal = () => document.querySelector<HTMLElement>('.sv-sd-portal');

function sync(fixture: { detectChanges(): void }): void {
  fixture.detectChanges();
  TestBed.inject(ApplicationRef).tick();
}

const triggerOf = (fixture: { nativeElement: HTMLElement }) =>
  fixture.nativeElement.querySelector('button[role="combobox"]') as HTMLButtonElement;

/**
 * jsdom lays nothing out — every `getBoundingClientRect()` is all zeros — so a
 * positioning assertion can only be made against a rect we supply. What is
 * under test is the DECISION (flip up? align right?), never a pixel jsdom
 * measured.
 */
function stubRect(el: Element, r: Partial<DOMRect>): void {
  const full = { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, x: 0, y: 0 };
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    ...full, ...r, toJSON: () => ({}),
  } as DOMRect);
}

describe('SvSelectDropdownComponent — panel placement', () => {
  it('drops the panel below the trigger when there is room', async () => {
    const f = await setup();
    stubRect(triggerOf(f), { top: 100, bottom: 140, left: 40, right: 240, width: 200 });
    f.componentInstance.openDropdown();

    const style = f.componentInstance.panelStyle();
    expect(style['top']).toBe('144px');           // rect.bottom + GAP
    expect(style['bottom']).toBeUndefined();
    expect(style['left']).toBe('40px');
    expect(style['width']).toBe('200px');
    expect(style['position']).toBe('fixed');
  });

  /** Near the bottom of the viewport the panel must flip above the trigger. */
  it('flips the panel upward when there is not enough room below', async () => {
    const f = await setup();
    stubRect(triggerOf(f), { top: 700, bottom: 740, left: 40, right: 240, width: 200 });
    f.componentInstance.openDropdown();

    const style = f.componentInstance.panelStyle();
    expect(style['bottom']).toBe(`${window.innerHeight - 700 + 4}px`);
    expect(style['top']).toBeUndefined();
    expect(style['maxHeight']).toBe('692px');     // rect.top - MARGIN
  });

  /** A trigger against the right edge must be right-aligned, not left-anchored. */
  it('right-aligns the panel when it would overflow the right edge', async () => {
    const f = await setup();
    stubRect(triggerOf(f), { top: 100, bottom: 140, left: 820, right: 1020, width: 200 });
    f.componentInstance.openDropdown();

    const style = f.componentInstance.panelStyle();
    expect(style['right']).toBe(`${window.innerWidth - 1020}px`);
    expect(style['left']).toBeUndefined();
  });

  /** Squeezed on both sides, the panel still gets a usable minimum height. */
  it('never shrinks the panel below 120px', async () => {
    const original = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', { value: 100, configurable: true });
    try {
      const f = await setup();
      // Equal space above and below keeps openUpward false, so `spaceBelow` (2px)
      // is what the floor has to rescue.
      stubRect(triggerOf(f), { top: 10, bottom: 90, left: 0, right: 200, width: 200 });
      f.componentInstance.openDropdown();
      expect(f.componentInstance.panelStyle()['maxHeight']).toBe('120px');
    } finally {
      Object.defineProperty(window, 'innerHeight', { value: original, configurable: true });
    }
  });
});

describe('SvSelectDropdownComponent — portal lifecycle', () => {
  it('mounts the panel into <body> on open and removes it on close', async () => {
    const f = await setup();
    expect(portal()).toBeNull();

    f.componentInstance.openDropdown();
    sync(f);
    // The panel is deliberately NOT a descendant of the host — that is the
    // whole point of the portal.
    expect(portal()).not.toBeNull();
    expect(f.nativeElement.contains(portal())).toBe(false);
    expect(portal()!.querySelector('ul[role="listbox"]')).not.toBeNull();

    f.componentInstance.closeDropdown();
    expect(portal()).toBeNull();
  });

  /** A destroyed component must not leave its panel orphaned in <body>. */
  it('tears the portal down when the component is destroyed', async () => {
    const f = await setup();
    f.componentInstance.openDropdown();
    expect(portal()).not.toBeNull();
    f.destroy();
    expect(portal()).toBeNull();
  });

  it('emits dropdownOpen and dropdownClose exactly once per cycle', async () => {
    const f = await setup();
    let opened = 0, closed = 0;
    f.componentInstance.dropdownOpen.subscribe(() => opened++);
    f.componentInstance.dropdownClose.subscribe(() => closed++);

    f.componentInstance.toggleDropdown();
    f.componentInstance.toggleDropdown();
    expect([opened, closed]).toEqual([1, 1]);
  });
});

describe('SvSelectDropdownComponent — outside interaction', () => {
  it('stays open for a mousedown on the trigger or inside the panel', async () => {
    const f = await setup();
    f.componentInstance.openDropdown();
    sync(f);

    triggerOf(f).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(f.componentInstance.isOpen()).toBe(true);

    portal()!.querySelector('ul[role="listbox"]')!
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(f.componentInstance.isOpen()).toBe(true);
  });

  it('closes on a mousedown somewhere else on the page', async () => {
    const f = await setup();
    f.componentInstance.openDropdown();
    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);
    try {
      elsewhere.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(f.componentInstance.isOpen()).toBe(false);
    } finally {
      elsewhere.remove();
    }
  });

  /**
   * Regression: the handler used to run unconditionally, so every stray click
   * anywhere on the page emitted `dropdownClose` from a dropdown that had never
   * been open — and cleared `searchQuery`/`isFocused` while it was at it.
   */
  it('says nothing when the panel was not open to begin with', async () => {
    const f = await setup();
    let closed = 0;
    f.componentInstance.dropdownClose.subscribe(() => closed++);

    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);
    try {
      elsewhere.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(closed).toBe(0);
    } finally {
      elsewhere.remove();
    }
  });

  /** Resize invalidates the captured coordinates, so close rather than drift. */
  it('closes on window resize, and does nothing when already closed', async () => {
    const f = await setup();
    let closed = 0;
    f.componentInstance.dropdownClose.subscribe(() => closed++);

    window.dispatchEvent(new Event('resize'));
    expect(closed).toBe(0);

    f.componentInstance.openDropdown();
    window.dispatchEvent(new Event('resize'));
    expect(f.componentInstance.isOpen()).toBe(false);
    expect(closed).toBe(1);
  });
});

describe('SvSelectDropdownComponent — chip overflow measurement', () => {
  const MANY = (): SelectOption[] =>
    ['a', 'b', 'c', 'd', 'e', 'f'].map((v) => ({ value: v, label: v.toUpperCase() }));

  /** Everything fits: no "+N more", every chip rendered. */
  it('shows every chip when they all fit the row', async () => {
    const f = await setup({ multiple: true, options: MANY(), value: ['a', 'b', 'c'] });
    f.detectChanges();
    await flush();
    expect(f.componentInstance.visibleChipCount()).toBe(3);
    expect(f.componentInstance.overflowCount()).toBe(0);
  });

  it('caps the chips and counts the remainder when the row overflows', async () => {
    const f = await setup({ multiple: true, options: MANY(), value: ['a'] });
    f.detectChanges();
    await flush();

    // Chip N sits at x = 100·(N+1); the row ends at 300 and reserves 60px for
    // the badge, so only the chips ending at or before 240 may stay.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element) {
        const base = { top: 0, left: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) };
        if (this.hasAttribute('data-chip')) {
          const i = Array.from(this.parentElement!.children).indexOf(this);
          return { ...base, right: 100 * (i + 1) } as DOMRect;
        }
        if (this.querySelector('[data-chip]')) return { ...base, right: 300 } as DOMRect;
        return { ...base, right: 0 } as DOMRect;
      },
    );

    f.componentInstance.value.set(['a', 'b', 'c', 'd', 'e', 'f']);
    f.detectChanges();
    await flush();
    f.detectChanges();

    expect(f.componentInstance.visibleChipCount()).toBe(2);
    expect(f.componentInstance.visibleChips().map((o) => o.value)).toEqual(['a', 'b']);
    expect(f.componentInstance.overflowCount()).toBe(4);
  });

  /** No chips at all measures as zero, not as "999 fit". */
  it('measures an empty chip row as zero', async () => {
    const f = await setup({ multiple: true, options: MANY(), value: ['a'] });
    f.detectChanges();
    await flush();
    f.componentInstance.value.set([]);
    f.detectChanges();
    await flush();
    expect(f.componentInstance.visibleChipCount()).toBe(0);
  });

  /** With maxSelected set the count is the fixed legacy cap, not a measurement. */
  it('does not measure at all when maxSelected caps the strip', async () => {
    const f = await setup({ multiple: true, maxSelected: 6, options: MANY(), value: ['a', 'b'] });
    f.detectChanges();
    await flush();
    expect(f.componentInstance.visibleChipCount()).toBe(999);
    expect(f.componentInstance.visibleChips()).toHaveLength(2);
  });
});

// ─── Icons come from the library ──────────────────────────────────────────────

/**
 * All five glyphs were `[attr.d]` bindings off `SelectOption.iconPath`, now
 * `SelectOption.icon` (an icon-library name).
 *
 * ★ Two of the five live on OPTION rows inside the panel, and the panel is
 * **portaled to `<body>`** — a guard that queried the host element would have
 * asserted over an empty list and passed. It opens the dropdown and queries
 * `document`, and asserts something was drawn first.
 */
describe('SvSelectDropdownComponent — icons come from the library', () => {
  const ICON_OPTS = [
    { value: 'a', label: 'Ada', icon: 'user' },
    { value: 'b', label: 'Bob', icon: 'star' },
  ];

  it('draws no glyph by hand on the closed trigger', async () => {
    const f = await setup({ options: ICON_OPTS, value: 'a' });
    const svgs = [...(f.nativeElement as HTMLElement).querySelectorAll('svg')];
    expect(svgs.length).toBeGreaterThan(0);
    expect(svgs.every((n) => n.closest('sv-icon'))).toBe(true);
  });

  it('draws no glyph by hand on the portaled option rows', async () => {
    const f = await setup({ options: ICON_OPTS });
    f.componentInstance.openDropdown();
    sync(f);
    const panel = portal();
    expect(panel).not.toBeNull();
    const svgs = [...panel!.querySelectorAll('svg')];
    expect(svgs.length).toBeGreaterThan(0);
    expect(svgs.every((n) => n.closest('sv-icon'))).toBe(true);
  });

  it('draws no glyph by hand on multi-select chips', async () => {
    const f = await setup({ options: ICON_OPTS, multiple: true, value: ['a', 'b'] });
    const svgs = [...(f.nativeElement as HTMLElement).querySelectorAll('svg')];
    expect(svgs.length).toBeGreaterThan(0);
    expect(svgs.every((n) => n.closest('sv-icon'))).toBe(true);
  });
});
