import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { quietFor, until } from '../../../../src/testing/async';
import { SvTagInputComponent, type TagOption } from './tag-input.component';

const OPTIONS = (): TagOption[] => [
  { value: 'ng', label: 'Angular' },
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvTagInputComponent, {
    inputs: { options: OPTIONS(), ...inputs },
  });
  return fixture;
}

afterEach(() => {
  vi.restoreAllMocks();
  TestBed.resetTestingModule();
});

function sync(fixture: { detectChanges(): void }): void {
  fixture.detectChanges();
  TestBed.inject(ApplicationRef).tick();
}

/** The panel is portaled into <body>, so it is not under the host element. */
const portal = () => document.querySelector<HTMLElement>('.sv-tag-input-portal');

/**
 * jsdom lays nothing out, so a positioning assertion can only be made against
 * a rect we supply. What is under test is the DECISION, never a measurement.
 */
function stubRect(el: Element, r: Partial<DOMRect>): void {
  const base = { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, x: 0, y: 0 };
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    ...base, ...r, toJSON: () => ({}),
  } as DOMRect);
}

const fieldOf = (fixture: { nativeElement: HTMLElement }) =>
  fixture.nativeElement.querySelector('[data-trigger]') as HTMLElement;

const inputOf = (fixture: { nativeElement: HTMLElement }) =>
  fixture.nativeElement.querySelector('input[role="combobox"]') as HTMLInputElement;

describe('SvTagInputComponent — panel placement', () => {
  it('drops the panel below the field when there is room', async () => {
    const f = await setup();
    stubRect(fieldOf(f), { top: 100, bottom: 140, left: 40, right: 240, width: 200 });
    f.componentInstance.open();

    const c = f.componentInstance;
    expect(c.panelTop()).toBe(146);            // bottom + GAP
    expect(c.panelBottom()).toBeNull();
    expect(c.panelLeft()).toBe(40);
    expect(c.panelWidth()).toBe(200);
  });

  it('flips the panel above the field when there is not enough room below', async () => {
    const f = await setup();
    stubRect(fieldOf(f), { top: 700, bottom: 740, left: 40, right: 240, width: 200 });
    f.componentInstance.open();

    const c = f.componentInstance;
    expect(c.panelTop()).toBeNull();
    expect(c.panelBottom()).toBe(window.innerHeight - 700 + 6);
    expect(c.panelMaxHeight()).toBe(688);      // rect.top - 12
  });

  /** A field wider than the viewport must not produce a panel that spills off. */
  it('caps the panel width to the viewport', async () => {
    const f = await setup();
    stubRect(fieldOf(f), { top: 10, bottom: 50, left: 0, right: 1400, width: 1400 });
    f.componentInstance.open();
    expect(f.componentInstance.panelWidth()).toBe(window.innerWidth - 16);
    expect(f.componentInstance.panelLeft()).toBe(8);
  });

  it('pulls the panel back inside the right edge', async () => {
    const f = await setup();
    stubRect(fieldOf(f), { top: 10, bottom: 50, left: 900, right: 1100, width: 200 });
    f.componentInstance.open();
    expect(f.componentInstance.panelLeft()).toBe(window.innerWidth - 8 - 200);
  });

  it('pushes the panel back inside the left edge', async () => {
    const f = await setup();
    stubRect(fieldOf(f), { top: 10, bottom: 50, left: -50, right: 150, width: 200 });
    f.componentInstance.open();
    expect(f.componentInstance.panelLeft()).toBe(8);
  });

  /** Squeezed on both sides the panel still gets a usable minimum height. */
  it('never shrinks the panel below 120px', async () => {
    const original = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', { value: 100, configurable: true });
    try {
      const f = await setup();
      // Equal space above and below keeps the panel below the field, so the
      // 2px of space there is what the floor has to rescue.
      stubRect(fieldOf(f), { top: 14, bottom: 86, left: 0, right: 200, width: 200 });
      f.componentInstance.open();
      expect(f.componentInstance.panelTop()).not.toBeNull();
      expect(f.componentInstance.panelMaxHeight()).toBe(120);
    } finally {
      Object.defineProperty(window, 'innerHeight', { value: original, configurable: true });
    }
  });
});

describe('SvTagInputComponent — portal lifecycle', () => {
  it('mounts the panel outside the host and removes it on close', async () => {
    const f = await setup();
    expect(portal()).toBeNull();

    f.componentInstance.open();
    sync(f);
    expect(portal()).not.toBeNull();
    expect(f.nativeElement.contains(portal())).toBe(false);
    expect(portal()!.querySelector('[role="listbox"]')).not.toBeNull();

    f.componentInstance.close();
    expect(portal()).toBeNull();
  });

  /** Opening twice must not stack two panels in <body>. */
  it('does not mount a second panel when already open', async () => {
    const f = await setup();
    f.componentInstance.open();
    f.componentInstance.open();
    sync(f);
    expect(document.querySelectorAll('.sv-tag-input-portal')).toHaveLength(1);
  });

  it('takes the panel down when the component is destroyed', async () => {
    const f = await setup();
    f.componentInstance.open();
    expect(portal()).not.toBeNull();
    f.destroy();
    expect(portal()).toBeNull();
  });

  it('refuses to open while disabled', async () => {
    const f = await setup({ disabled: true });
    f.componentInstance.open();
    f.componentInstance.focusInput();
    expect(f.componentInstance.isOpen()).toBe(false);
    expect(portal()).toBeNull();
  });

  it('opens on focus and on a click anywhere in the field', async () => {
    const byFocus = await setup();
    byFocus.componentInstance.onInputFocus();
    expect(byFocus.componentInstance.focused()).toBe(true);
    expect(byFocus.componentInstance.isOpen()).toBe(true);

    const byClick = await setup();
    fieldOf(byClick).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(byClick.componentInstance.isOpen()).toBe(true);
  });
});

describe('SvTagInputComponent — dismissal', () => {
  it('stays open for a mousedown on the field or inside the panel', async () => {
    const f = await setup();
    const c = f.componentInstance;
    c.open();
    sync(f);

    fieldOf(f).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(c.isOpen()).toBe(true);
    portal()!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(c.isOpen()).toBe(true);
  });

  it('closes on a mousedown elsewhere on the page', async () => {
    const f = await setup();
    f.componentInstance.open();
    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);
    try {
      elsewhere.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(f.componentInstance.isOpen()).toBe(false);
    } finally {
      elsewhere.remove();
    }
  });

  // NOTE: the `if (!this.isOpen()) return` early exit in `onDocMousedown` is
  // deliberately NOT covered. Unlike the Pro select — where the same guard
  // stops a spurious `dropdownClose` output — closing an already-closed free
  // tag-input has no observable consequence whatsoever, so a test for it could
  // not fail. Mutation-checked: removing the guard leaves this file green.

  it('closes on window resize, and does nothing when already closed', async () => {
    const f = await setup();
    window.dispatchEvent(new Event('resize'));
    expect(f.componentInstance.isOpen()).toBe(false);

    f.componentInstance.open();
    window.dispatchEvent(new Event('resize'));
    expect(f.componentInstance.isOpen()).toBe(false);
    expect(portal()).toBeNull();
  });

  /** Blur must not close the panel when focus merely moved into the panel. */
  it('keeps the panel open when focus lands inside the portal', async () => {
    const f = await setup();
    const c = f.componentInstance;
    c.open();
    sync(f);

    const row = portal()!.querySelector('[role="option"]') as HTMLElement;
    row.tabIndex = -1;
    row.focus();
    c.onInputBlur();

    await quietFor(220);        // past the component's own 150ms grace
    expect(c.isOpen()).toBe(true);
  });

  it('closes when focus leaves the field entirely', async () => {
    const f = await setup();
    const c = f.componentInstance;
    c.open();
    sync(f);
    inputOf(f).blur();
    c.onInputBlur();

    await until(() => !c.isOpen(), { label: 'the panel closed after blur' });
    expect(c.focused()).toBe(false);
  });

  /** A scroll while the panel is shut must not schedule any work. */
  it('ignores scroll while closed', async () => {
    const f = await setup();
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    window.dispatchEvent(new Event('scroll'));
    expect(raf).not.toHaveBeenCalled();
    f.destroy();
  });

  it('repositions the open panel on an ancestor scroll', async () => {
    const f = await setup();
    const c = f.componentInstance;
    stubRect(fieldOf(f), { top: 100, bottom: 140, left: 40, right: 240, width: 200 });
    c.open();
    expect(c.panelTop()).toBe(146);

    stubRect(fieldOf(f), { top: 300, bottom: 340, left: 40, right: 240, width: 200 });
    window.dispatchEvent(new Event('scroll'));
    await until(() => c.panelTop() === 346, { label: 'the panel followed the field' });
  });
});

describe('SvTagInputComponent — chips and field chrome', () => {
  it('keeps an unknown value, and MARKS it rather than passing the id off as a name', async () => {
    /**
     * ★★★ THIS TEST USED TO ASSERT THE DEFECT (`FI-26-I1`). Its old name was
     *     "resolves an unknown value to a chip labelled with the raw value" —
     *     which is exactly what went wrong: a chip the user picked as a name
     *     silently relabelled itself to the raw id the moment the option left
     *     the list, and looked like a tag somebody had typed.
     *
     *     The value is still KEPT — dropping it would silently remove the
     *     user's selection because a list refreshed — but it now carries
     *     `unresolved`, so the chip renders as unknown instead of as a name.
     */
    const f = await setup({ values: ['ng', 'mystery'] });
    expect(f.componentInstance.selectedTags()).toEqual([
      { value: 'ng', label: 'Angular' },
      { value: 'mystery', label: 'mystery', unresolved: true },
    ]);
    expect(f.componentInstance.unresolvedTags().map((t) => t.value)).toEqual(['mystery']);
  });

  it('removes one chip from its own button without opening the panel', async () => {
    const f = await setup({ values: ['ng', 'react'] });
    sync(f);
    const remove = f.nativeElement.querySelector('[aria-label="Remove Angular"]') as HTMLElement;
    remove.click();

    expect(f.componentInstance.values()).toEqual(['react']);
    // The click must not bubble to the field, which would re-open the panel.
    expect(f.componentInstance.isOpen()).toBe(false);
  });

  it('clears every chip from the clear-all button', async () => {
    const f = await setup({ values: ['ng', 'react'] });
    sync(f);
    (f.nativeElement.querySelector('[aria-label="Clear all"]') as HTMLElement).click();
    expect(f.componentInstance.values()).toEqual([]);
    expect(f.componentInstance.isOpen()).toBe(false);
  });

  it('hides the remove and clear controls while disabled', async () => {
    const f = await setup({ values: ['ng'], disabled: true });
    sync(f);
    expect(f.nativeElement.querySelector('[aria-label="Clear all"]')).toBeNull();
    expect(f.nativeElement.querySelector('[aria-label="Remove Angular"]')).toBeNull();
    expect(inputOf(f).disabled).toBe(true);
  });

  /** The placeholder is for an empty field; chips replace it. */
  it('drops the placeholder once there is a tag', async () => {
    const empty = await setup({ placeholder: 'Add tags…' });
    sync(empty);
    expect(inputOf(empty).getAttribute('placeholder')).toBe('Add tags…');

    const filled = await setup({ placeholder: 'Add tags…', values: ['ng'] });
    sync(filled);
    expect(inputOf(filled).getAttribute('placeholder')).toBe('');
  });

  it('scales the chip, field and text classes together', async () => {
    for (const [size, chip, field, text] of [
      ['sm', 'h-5 gap-1 px-1.5 text-[10px]', 'min-h-[32px] px-2 py-1 gap-1', 'text-xs placeholder:text-xs'],
      ['md', 'h-6 gap-1 px-2 text-[11px]', 'min-h-[42px] px-3 py-1.5 gap-1.5', 'text-sm placeholder:text-sm'],
      ['lg', 'h-7 gap-1.5 px-2.5 text-xs', 'min-h-[50px] px-3.5 py-2 gap-2', 'text-sm placeholder:text-sm'],
    ] as const) {
      const c = (await setup({ size })).componentInstance;
      expect(c.chipSizeClass(), size).toBe(chip);
      expect(c.fieldMinHeight(), size).toBe(field);
      expect(c.inputTextClass(), size).toBe(text);
    }
  });

  it('shows the error in place of the hint', async () => {
    const f = await setup({ hint: 'Pick a few', errorMessage: 'Too few' });
    sync(f);
    expect(f.nativeElement.textContent).toContain('Too few');
    expect(f.nativeElement.textContent).not.toContain('Pick a few');
  });

  /** The server error expires the moment the value it described changes. */
  it('drops a server error once the tags change', async () => {
    const f = await setup({ values: ['ng'], serverError: { message: 'Tag rejected' } });
    expect(f.componentInstance.resolvedError()).toBe('Tag rejected');

    f.componentInstance.removeTag('ng');
    expect(f.componentInstance.resolvedError()).toBe('');
  });

  it('takes a bare string as a server error too', async () => {
    const f = await setup({ values: ['ng'], serverError: 'Rejected' });
    expect(f.componentInstance.resolvedError()).toBe('Rejected');
  });
});
