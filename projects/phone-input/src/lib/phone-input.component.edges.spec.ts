import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen, fireEvent } from '@testing-library/angular';
import { SvOverlayStackService } from '@styloviz/core';
import { untilRendered } from '@testing/async';
import { SvPhoneInputComponent } from './phone-input.component';
import type { PhoneCountry } from './phone-countries';

/**
 * The edges of `sv-phone-input`: the keyboard on the trigger while the list is
 * open (where focus actually is), the list keys the topic spec does not press,
 * the empty and degenerate inputs a host can pass, and the length hint in each
 * of its directions.
 */

async function mount(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvPhoneInputComponent, { inputs });
  return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

const tick = (): void => TestBed.inject(ApplicationRef).tick();
const trigger = (): HTMLElement => screen.getByRole('button', { name: /^Country:/ });
const listbox = (): HTMLElement | null => screen.queryByRole('listbox');
const activeName = (): string => {
  const id = listbox()!.getAttribute('aria-activedescendant')!;
  return document.getElementById(id)?.textContent ?? '';
};
const hint = (host: HTMLElement): string | null =>
  host.querySelector('[data-sv-length-hint]')?.textContent?.trim() ?? null;

function key(el: Element, k: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(ev);
  return ev;
}

async function openList(fixture: { detectChanges(): void }): Promise<void> {
  fireEvent.click(trigger());
  await untilRendered(fixture, () => listbox() !== null);
}

afterEach(() => vi.restoreAllMocks());

describe('sv-phone-input — choosing a country without leaving the trigger', () => {
  /**
   * ★★ The defect this pins. Focus stays on the trigger while the list is
   *    open, and the trigger used to read Enter and Space as "move down one".
   *    Opening the list, arrowing to a country and pressing Enter highlighted
   *    the NEXT country and selected nothing — there was no key on the trigger
   *    that selected at all.
   */
  it('Enter selects the highlighted country and closes the list', async () => {
    const { c, fixture } = await mount();
    key(trigger(), 'Enter');                 // opens
    await untilRendered(fixture, () => listbox() !== null);
    key(trigger(), 'ArrowDown');             // United States → Canada
    key(trigger(), 'ArrowDown');             // → United Kingdom
    fixture.detectChanges();
    expect(activeName()).toContain('United Kingdom');

    const ev = key(trigger(), 'Enter');
    await untilRendered(fixture, () => listbox() === null);
    expect(ev.defaultPrevented).toBe(true);
    expect(c.country()).toBe('GB');
  });

  it('Space selects too', async () => {
    const { c, fixture } = await mount();
    key(trigger(), ' ');
    await untilRendered(fixture, () => listbox() !== null);
    key(trigger(), 'ArrowDown');
    key(trigger(), ' ');
    await untilRendered(fixture, () => listbox() === null);
    expect(c.country()).toBe('CA');
  });

  it('↑, Home and End work from the trigger as they do in the list', async () => {
    const { fixture } = await mount();
    await openList(fixture);
    key(trigger(), 'ArrowUp');               // wraps from the first to the last
    fixture.detectChanges();
    expect(activeName()).toContain('Japan');
    key(trigger(), 'Home');
    fixture.detectChanges();
    expect(activeName()).toContain('United States');
    key(trigger(), 'End');
    fixture.detectChanges();
    expect(activeName()).toContain('Japan');
  });

  it('Escape on the trigger closes the list and keeps the country', async () => {
    const { c, fixture } = await mount();
    await openList(fixture);
    key(trigger(), 'ArrowDown');
    key(trigger(), 'Escape');
    await untilRendered(fixture, () => listbox() === null);
    expect(c.country()).toBe('US');
  });

  it('a closed trigger opens only on ↓, Enter and Space', async () => {
    const { fixture } = await mount();
    for (const k of ['Escape', 'Tab', 'a', 'ArrowUp']) {
      expect(key(trigger(), k).defaultPrevented, k).toBe(false);
    }
    fixture.detectChanges();
    expect(listbox()).toBeNull();
  });
});

describe('sv-phone-input — the list keys', () => {
  it('↑ wraps, Home and End jump to the ends', async () => {
    const { fixture } = await mount();
    await openList(fixture);
    key(listbox()!, 'ArrowUp');
    fixture.detectChanges();
    expect(activeName()).toContain('Japan');
    key(listbox()!, 'Home');
    fixture.detectChanges();
    expect(activeName()).toContain('United States');
    key(listbox()!, 'End');
    fixture.detectChanges();
    expect(activeName()).toContain('Japan');
  });

  it('leaves Tab, modifiers and shortcuts alone', async () => {
    const { fixture } = await mount();
    await openList(fixture);
    for (const [k, init] of [
      ['Tab', {}], ['Shift', {}], ['a', { ctrlKey: true }], ['a', { metaKey: true }], ['a', { altKey: true }],
    ] as const) {
      expect(key(listbox()!, k, init).defaultPrevented, `${k} ${JSON.stringify(init)}`).toBe(false);
    }
    fixture.detectChanges();
    expect(activeName()).toContain('United States');
  });

  /**
   * ★★ The highlight names a COUNTRY, not a row number. `aria-activedescendant`
   *    used to keep pointing at row 8 after a `countries` filter left two rows —
   *    an id that no longer existed — so a screen reader announced nothing and
   *    Enter silently selected nothing.
   */
  const activeRow = (): HTMLElement | null =>
    document.getElementById(listbox()!.getAttribute('aria-activedescendant')!);

  it('hands the highlight to the successor when the highlighted country is filtered out', async () => {
    const { c, fixture } = await mount();
    await openList(fixture);
    key(listbox()!, 'End');                  // Japan, the 8th row
    fixture.componentRef.setInput('countries', ['US', 'GB']);
    fixture.detectChanges();

    // The kit's mutation rule: the row now at its place, else the one before.
    expect(activeRow()).not.toBeNull();
    expect(activeRow()!.textContent).toContain('United Kingdom');
    key(listbox()!, 'Enter');
    fixture.detectChanges();
    expect(c.country()).toBe('GB');
  });

  it('keeps the highlight on the same country when the filter moves its row', async () => {
    const { c, fixture } = await mount();
    await openList(fixture);
    key(listbox()!, 'ArrowDown');            // Canada
    key(listbox()!, 'ArrowDown');            // United Kingdom, the 3rd row
    fixture.componentRef.setInput('countries', ['GB', 'JP']);
    fixture.detectChanges();

    expect(activeRow()!.textContent).toContain('United Kingdom'); // now the 1st row
    key(listbox()!, 'Enter');
    fixture.detectChanges();
    expect(c.country()).toBe('GB');
  });
});

describe('sv-phone-input — type-to-select timing', () => {
  it('extends the prefix within half a second instead of skipping ahead', async () => {
    const now = vi.spyOn(Date, 'now');
    const { fixture } = await mount();
    await openList(fixture);

    now.mockReturnValue(10_000);
    key(listbox()!, 'u');                    // past United States → United Kingdom
    now.mockReturnValue(10_100);
    key(listbox()!, 'n');                    // "un" still matches where it is
    fixture.detectChanges();
    expect(activeName()).toContain('United Kingdom');

    now.mockReturnValue(11_000);             // a pause: a fresh search moves on
    key(listbox()!, 'u');
    fixture.detectChanges();
    expect(activeName()).toContain('United States');
  });
});

describe('sv-phone-input — direct calls a host can make', () => {
  it('refuses to open while disabled', async () => {
    const { c } = await mount({ disabled: true });
    c.toggle();
    expect(c.open()).toBe(false);
  });

  it('ignores a country code it does not offer', async () => {
    const { c, fixture } = await mount({ countries: ['US', 'GB'] });
    await openList(fixture);
    c.select('ZZ');
    c.select('FR');                          // real, but filtered out here
    fixture.detectChanges();
    expect(c.country()).toBe('US');
    expect(listbox()).not.toBeNull();
  });
});

describe('sv-phone-input — degenerate host inputs', () => {
  it('an empty `plans` array means the bundled plans, not an empty picker', async () => {
    const { fixture } = await mount({ plans: [] });
    await openList(fixture);
    expect(screen.getAllByRole('option')).toHaveLength(8);
  });

  it('an empty `countries` array means every country', async () => {
    const { fixture } = await mount({ countries: [] });
    await openList(fixture);
    expect(screen.getAllByRole('option')).toHaveLength(8);
  });

  it('a selected country outside the allowed list shows the first allowed one', async () => {
    await mount({ countries: ['GB', 'FR'], country: 'US' });
    expect(trigger().getAttribute('aria-label')).toBe('Country: United Kingdom (+44)');
  });

  it('a host plan with no grouping gets one ungrouped run of its longest length', async () => {
    const plans: PhoneCountry[] = [
      { code: 'XT', name: 'Testland', dialCode: '+999', nationalDigits: [6, 8] },
    ];
    const { c } = await mount({ plans, country: 'XT' });
    expect(c.activeMask()).toBe('########');
  });
});

describe('sv-phone-input — the storable value', () => {
  it('is empty when only the country code has been typed', async () => {
    const { c } = await mount({ value: '+1' });
    expect(c.e164()).toBe('');
  });
});

describe('sv-phone-input — the length hint, in every direction', () => {
  it('says nothing for an empty field', async () => {
    const { host } = await mount({ value: '' });
    expect(hint(host)).toBeNull();
  });

  it('names an exact length as one number when the number is short', async () => {
    const { host } = await mount({ country: 'FR', value: '612' });
    expect(hint(host)).toBe('France numbers are usually 9 digits; this has 3.');
  });

  it('says so when the number is longer than the plan', async () => {
    const { host } = await mount({ country: 'FR', value: '6123456789' });
    expect(hint(host)).toBe('France numbers are usually 9 digits; this has 10.');
  });

  it('states the E.164 ceiling, which is a rule and not a guess, past fifteen digits', async () => {
    const { host } = await mount({ value: '234567890123456' });
    expect(hint(host)).toContain('That is 16 digits including +1. E.164 allows at most 15');
  });
});

describe('sv-phone-input — outside-pointer dismissal', () => {
  it('does nothing while closed', async () => {
    const { c } = await mount();
    fireEvent.pointerDown(document.body);
    expect(c.open()).toBe(false);
  });

  it('stays open for a pointerdown on its own trigger', async () => {
    const { c, fixture } = await mount();
    await openList(fixture);
    fireEvent.pointerDown(trigger());
    expect(c.open()).toBe(true);
  });

  it('stays open for a pointerdown inside a surface opened above it', async () => {
    const { c, fixture } = await mount();
    await openList(fixture);
    tick();   // the list takes its place on the overlay stack

    const nested = document.createElement('div');
    document.body.appendChild(nested);
    const child = TestBed.inject(SvOverlayStackService).push('anchored', { element: () => nested });
    try {
      fireEvent.pointerDown(nested);
      expect(c.open()).toBe(true);
    } finally {
      child.release();
      nested.remove();
    }
    fireEvent.pointerDown(document.body);
    expect(c.open()).toBe(false);
  });
});
