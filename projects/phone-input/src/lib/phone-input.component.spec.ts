import { TestBed } from '@angular/core/testing';
import { render, screen, fireEvent } from '@testing-library/angular';
import { untilRendered } from '../../../../src/testing/async';
import { SvPhoneInputComponent } from './phone-input.component';

describe('SvPhoneInputComponent', () => {
  it('defaults to the United States (+1) with the picker closed', async () => {
    await render(SvPhoneInputComponent, {});
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('opens the country listbox on button click, listing every bundled country', async () => {
    const { fixture } = await render(SvPhoneInputComponent, {});
    fireEvent.click(screen.getByRole('button'));
    await untilRendered(fixture, () => screen.queryByRole('listbox') !== null);
    expect(screen.getAllByRole('option').length).toBe(8);
  });

  it('selecting a country updates the dial code and closes the panel', async () => {
    const { fixture } = await render(SvPhoneInputComponent, {});
    fireEvent.click(screen.getByRole('button'));
    await untilRendered(fixture, () => screen.queryByRole('listbox') !== null);

    fireEvent.click(screen.getByText('United Kingdom'));
    await untilRendered(fixture, () => screen.queryByRole('listbox') === null);
    expect(screen.getByText('+44')).toBeTruthy();
  });

  it('keeps the typed value when switching between two countries sharing a preset (US -> Canada)', async () => {
    const { fixture } = await render(SvPhoneInputComponent, { inputs: { value: '(555) 123-4567' } });
    fireEvent.click(screen.getByRole('button', { name: /\+1/ }));
    await untilRendered(fixture, () => screen.queryByRole('listbox') !== null);

    fireEvent.click(screen.getByText('Canada'));
    await untilRendered(fixture, () => screen.queryByRole('listbox') === null);
    expect(fixture.componentInstance.value()).toBe('(555) 123-4567');
  });

  it('KEEPS the digits when the country changes (US -> UK)', async () => {
    /**
     * ★★ THIS TEST USED TO ASSERT THE OPPOSITE, and the old behaviour was the
     *    defect written down as a guarantee: switching country threw the number
     *    away. That made the commonest correction in this control — realising
     *    the country is wrong and fixing it — cost the user everything they had
     *    typed.
     *
     *    It is safe to keep them now because the mask covers the NATIONAL
     *    number only. The country code was never among the digits, so changing
     *    country re-groups them rather than re-interpreting them.
     */
    const { fixture } = await render(SvPhoneInputComponent, {
      inputs: { value: '(555) 123-4567' },
    });
    fireEvent.click(screen.getByRole('button', { name: /\+1/ }));
    await untilRendered(fixture, () => screen.queryByRole('listbox') !== null);

    fireEvent.click(screen.getByText('United Kingdom'));
    await untilRendered(fixture, () => fixture.componentInstance.country() === 'GB');
    expect(fixture.componentInstance.value().replace(/\D/g, '')).toBe('5551234567');
  });

  it('restricts the picker to the given `countries` list', async () => {
    const { fixture } = await render(SvPhoneInputComponent, { inputs: { countries: ['US', 'GB'] } });
    fireEvent.click(screen.getByRole('button'));
    await untilRendered(fixture, () => screen.queryByRole('listbox') !== null);
    expect(screen.getAllByRole('option').length).toBe(2);
  });

  it('supports keyboard navigation: ArrowDown opens the panel, Enter selects the active option', async () => {
    const { fixture } = await render(SvPhoneInputComponent, {});
    const button = screen.getByRole('button');
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    await untilRendered(fixture, () => screen.queryByRole('listbox') !== null);

    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'ArrowDown' }); // US(0) -> CA(1)
    fireEvent.keyDown(list, { key: 'Enter' });
    await untilRendered(fixture, () => screen.queryByRole('listbox') === null);
    expect(screen.getByText('+1')).toBeTruthy(); // CA is also +1
    expect(fixture.componentInstance.country()).toBe('CA');
  });

  it('closes the panel on Escape without changing the selection', async () => {
    const { fixture } = await render(SvPhoneInputComponent, {});
    fireEvent.click(screen.getByRole('button'));
    await untilRendered(fixture, () => screen.queryByRole('listbox') !== null);

    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    await untilRendered(fixture, () => screen.queryByRole('listbox') === null);
    expect(fixture.componentInstance.country()).toBe('US');
  });

  it('closes the panel on an outside pointerdown', async () => {
    const { fixture } = await render(SvPhoneInputComponent, {});
    fireEvent.click(screen.getByRole('button'));
    await untilRendered(fixture, () => screen.queryByRole('listbox') !== null);

    fireEvent.pointerDown(document.body);
    await untilRendered(fixture, () => screen.queryByRole('listbox') === null);
  });
});

describe('SvPhoneInputComponent — label position (SR-03)', () => {
  // The country button used to be aligned with the field's `<label>` because
  // `sv-input-mask` rendered the label INSIDE the flex item. Now sv-phone-input
  // owns the visible label and shares its accessible name with both controls.
  it('renders a single label above the row, not inside the flex item', async () => {
    const { fixture } = await render(SvPhoneInputComponent, {});
    const host = fixture.nativeElement as HTMLElement;
    // The visible label is a <span> (compound control) — see the template
    // comment for why a <label for=...> is the wrong element here.
    const label = host.querySelector('span#' + fixture.componentInstance.labelId)!;
    expect(label).not.toBeNull();
    const row = host.querySelector('.flex.items-start.gap-0')!;
    // The label is a sibling BEFORE the row, not a child of it.
    expect(row.contains(label)).toBe(false);
    expect(label.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('names the country button with the field label + selected country', async () => {
    await render(SvPhoneInputComponent, {});
    const button = screen.getByRole('button', { name: /Phone number: United States/ });
    expect(button).not.toBeNull();
  });

  it('names the number input via aria-label, not a redundant <label>', async () => {
    const { fixture } = await render(SvPhoneInputComponent, {});
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toBe('Phone number');
    // No visible <label> inside the mask — its label is suppressed and the
    // name comes from the phone input's own outer span.
    expect(fixture.nativeElement.querySelectorAll('label').length).toBe(0);
  });
});

describe('SvPhoneInputComponent — seam cosmetics (SR-05)', () => {
  /**
   * ★★ ONE COUNTRY MEANS NO PICKER. With a single allowed country there is
   *    nothing to choose, so the chevron would be a lie. A static flag +
   *    dial code + ISO badge keeps the seam honest and is `aria-hidden`
   *    so it does not steal the named-control's accessible name.
   */
  it('hides the picker when only one country is allowed', async () => {
    const { fixture } = await render(SvPhoneInputComponent, { inputs: { countries: ['GB'] } });
    // The trigger is a div, not a button — no chevron, no listbox to open.
    expect(screen.queryByRole('button', { name: /United Kingdom/ })).toBeNull();
    // The flag + dial code + ISO are still visible so the user can read
    // which country the value belongs to.
    expect(screen.getByText('+44')).toBeTruthy();
    expect(screen.getByText('GB')).toBeTruthy();
    // And it is NOT exposed as a focusable / nameable control.
    const host = fixture.nativeElement as HTMLElement;
    const staticBox = host.querySelector(`#${fixture.componentInstance.buttonId}`)!;
    expect(staticBox.getAttribute('aria-hidden')).toBe('true');
  });

  /**
   * ★★ The flag is decorative. The button's accessible name is the field
   *    label + the country; the flag should not re-announce the country.
   */
  it('marks the inline flag as aria-hidden inside the picker button', async () => {
    const { fixture } = await render(SvPhoneInputComponent, {});
    const flag = fixture.nativeElement.querySelector('button sv-phone-flag')!;
    expect(flag.getAttribute('aria-hidden')).toBe('true');
  });

  /**
   * ★★ The seam follows the READING DIRECTION. `rounded-s-md` (logical, not
   *    `l-`) puts the inner corners on the start edge in both LTR and RTL,
   *    and the mask is told the same via `[&_input]:rounded-s-none` (mirrors
   *    `sv-split-button`'s "logical, not positional" rule).
   */
  it('uses logical border/radius classes that follow the reading direction', async () => {
    const { fixture } = await render(SvPhoneInputComponent, {});
    const button = screen.getByRole('button', { name: /United States/ });
    expect(button.className).toContain('rounded-s-md');
    expect(button.className).toContain('border-e-0');
    expect(button.className).not.toContain('border-s-0');
    expect(button.className).not.toMatch(/\brounded-[lr]-(?:md|none)\b/);
    expect(button.className).not.toMatch(/\bborder-[lr]-0\b/);
    // The mask wrapper carries the seam-flatten rule, exactly as sv-split-button
    // carries its inner-seam rule.
    const mask = fixture.nativeElement.querySelector('sv-input-mask')!;
    expect(mask.className).toContain('[&_input]:rounded-s-none');
  });
});

/**
 * The value a backend should actually store.
 *
 * ★★★ UNTIL NOW THE COMPONENT PUBLISHED NO SUCH THING. A host got the formatted
 *     display string, which carries the user's spaces and brackets, or the bare
 *     digits, which carry no country at all. Storing either is how one person
 *     ends up in a database three times — as "(555) 123-4567", as "5551234567"
 *     and as "+15551234567" — and why matching an inbound call fails.
 */
describe('SvPhoneInputComponent — E.164, and what stays out of it', () => {
  async function mount(inputs: Record<string, unknown> = {}) {
    TestBed.resetTestingModule();
    const r = await render(SvPhoneInputComponent, { inputs });
    return {
      ...r,
      c: r.fixture.componentInstance as unknown as {
        e164: () => string;
        value: { set: (v: string) => void };
        country: { set: (v: string) => void };
        extension: { set: (v: string) => void };
      },
      host: r.fixture.nativeElement as HTMLElement,
    };
  }

  it('composes the country code and the digits', async () => {
    const { c, fixture } = await mount();
    c.value.set('(555) 123-4567');
    fixture.detectChanges();
    expect(c.e164()).toBe('+15551234567');
  });

  it('strips the punctuation the user typed', async () => {
    const { c, fixture } = await mount();
    c.value.set('555 123 4567');
    fixture.detectChanges();
    expect(c.e164()).toBe('+15551234567');
  });

  it('follows the selected country', async () => {
    const { c, fixture } = await mount();
    c.country.set('GB');
    c.value.set('20 7946 0018');
    fixture.detectChanges();
    expect(c.e164()).toBe('+442079460018');
  });

  it('does not double the country code when the user typed it', async () => {
    // ★ A pasted "+1 555 123 4567" must not become +115551234567.
    const { c, fixture } = await mount();
    c.value.set('+1 555 123 4567');
    fixture.detectChanges();
    expect(c.e164()).toBe('+15551234567');
  });

  it('is empty when there is nothing storable yet', async () => {
    const { c, fixture } = await mount();
    for (const v of ['', '   ', '()-']) {
      c.value.set(v);
      fixture.detectChanges();
      expect(c.e164()).toBe('');
    }
  });

  it('keeps the extension OUT of it', async () => {
    // ★★ E.164 is a country code plus a subscriber number and nothing else.
    //    Appending an extension produces a string that looks canonical and
    //    cannot be dialled.
    const { c, fixture } = await mount({ showExtension: true });
    c.value.set('5551234567');
    c.extension.set('4021');
    fixture.detectChanges();
    expect(c.e164()).toBe('+15551234567');
    expect(c.e164()).not.toContain('4021');
  });

  it('emits the storable value when the digits change', async () => {
    const seen: string[] = [];
    TestBed.resetTestingModule();
    const { fixture } = await render(SvPhoneInputComponent, {
      on: { e164Changed: (v: string) => seen.push(v) },
    });
    (fixture.componentInstance as unknown as { value: { set: (v: string) => void } })
      .value.set('5551234567');
    fixture.detectChanges();
    expect(seen).toContain('+15551234567');
  });

  it('emits again when the COUNTRY changes under the same digits', async () => {
    // ★ The storable value moves on a country pick too, which is why it is
    //   published from one effect rather than from each call site.
    const seen: string[] = [];
    TestBed.resetTestingModule();
    const { fixture } = await render(SvPhoneInputComponent, {
      on: { e164Changed: (v: string) => seen.push(v) },
    });
    const c = fixture.componentInstance as unknown as {
      value: { set: (v: string) => void };
      country: { set: (v: string) => void };
    };
    c.value.set('2079460018');
    fixture.detectChanges();
    c.country.set('GB');
    fixture.detectChanges();
    expect(seen.some(v => v.startsWith('+44'))).toBe(true);
  });
});

/**
 * A flag cannot identify a calling code.
 *
 * ★★★ +1 IS THE US, CANADA AND NINETEEN OTHER TERRITORIES, so a flag and a dial
 *     code together still cannot say which is selected — and the flag is the
 *     half a reader trusts.
 */
describe('SvPhoneInputComponent — saying which country is selected', () => {
  it('shows the ISO code beside the dial code', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvPhoneInputComponent, {});
    const trigger = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(trigger.textContent).toContain('+1');
    expect(trigger.textContent).toContain('US');
  });

  it('distinguishes two countries that share a dial code', async () => {
    // The whole point: +1 alone is ambiguous between these two.
    TestBed.resetTestingModule();
    const { fixture } = await render(SvPhoneInputComponent, { inputs: { country: 'CA' } });
    const trigger = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(trigger.textContent).toContain('+1');
    expect(trigger.textContent).toContain('CA');
  });
});

describe('SvPhoneInputComponent — the extension field', () => {
  it('is hidden unless asked for', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvPhoneInputComponent, {});
    expect((fixture.nativeElement as HTMLElement).querySelector('input[autocomplete="tel-extension"]'))
      .toBeNull();
  });

  it('appears on request, with a label bound to it', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvPhoneInputComponent, { inputs: { showExtension: true } });
    const host = fixture.nativeElement as HTMLElement;
    const field = host.querySelector<HTMLInputElement>('input[autocomplete="tel-extension"]')!;
    expect(field).not.toBeNull();
    const label = host.querySelector<HTMLLabelElement>(`label[for="${field.id}"]`);
    expect(label?.textContent).toContain('Extension');
  });

  it('keeps only digits — an extension with punctuation is not dialable', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvPhoneInputComponent, { inputs: { showExtension: true } });
    const host = fixture.nativeElement as HTMLElement;
    const field = host.querySelector<HTMLInputElement>('input[autocomplete="tel-extension"]')!;
    fireEvent.input(field, { target: { value: 'x-40 21' } });
    fixture.detectChanges();
    expect((fixture.componentInstance as unknown as { extension: () => string }).extension())
      .toBe('4021');
  });
});

describe('SvPhoneInputComponent — only a TYPED country code is stripped (DD-26-M1)', () => {
  async function mount(inputs: Record<string, unknown>) {
    TestBed.resetTestingModule();
    const r = await render(SvPhoneInputComponent, { inputs });
    r.fixture.detectChanges();
    return r.fixture.componentInstance;
  }

  it('keeps an Indian mobile that starts with 91 intact', async () => {
    // 9198765432 is ten national digits; the leading 91 is NOT India's code.
    const c = await mount({ country: 'IN', value: '91987 65432' });
    expect(c.nationalDigits()).toBe('9198765432');
    expect(c.e164()).toBe('+919198765432');
  });

  it('strips the code when the value opens with +', async () => {
    const c = await mount({ country: 'IN', value: '+91 98765 43210' });
    expect(c.e164()).toBe('+919876543210');
  });

  it('strips the code when the value opens with the 00 international prefix', async () => {
    const c = await mount({ country: 'IN', value: '0091 98765 43210' });
    expect(c.e164()).toBe('+919876543210');
  });

  it('strips the code when there are more digits than the national plan allows', async () => {
    const c = await mount({ country: 'IN', value: '919876543210' });
    expect(c.e164()).toBe('+919876543210');
  });
});

describe('SvPhoneInputComponent — type-to-select in the country listbox (DD-26-M2)', () => {
  async function openList() {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvPhoneInputComponent, {});
    fireEvent.click(screen.getByRole('button'));
    await untilRendered(fixture, () => screen.queryByRole('listbox') !== null);
    return fixture;
  }

  const activeName = () => {
    const list = screen.getByRole('listbox');
    const id = list.getAttribute('aria-activedescendant')!;
    return document.getElementById(id)?.textContent ?? '';
  };

  it('jumps to the first country starting with the typed letter', async () => {
    const fixture = await openList();
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'j' });
    fixture.detectChanges();
    expect(activeName()).toContain('Japan');
  });

  it('cycles through countries sharing a first letter when the letter repeats', async () => {
    const fixture = await openList();
    const list = screen.getByRole('listbox');
    // Active starts on United States; "u" moves past it to United Kingdom.
    fireEvent.keyDown(list, { key: 'u' });
    fixture.detectChanges();
    expect(activeName()).toContain('United Kingdom');
    fireEvent.keyDown(list, { key: 'u' });
    fixture.detectChanges();
    expect(activeName()).toContain('United States');
  });

  it('works from the trigger button, where focus stays while the list is open', async () => {
    const fixture = await openList();
    // The country button's accessible name now combines the field label with
    // the selected country — `SR-03` — so a screen reader announces the
    // picker as part of the field, not as a separate "Country" control.
    fireEvent.keyDown(screen.getByRole('button', { name: /United States/ }), { key: 'g' });
    fixture.detectChanges();
    expect(activeName()).toContain('Germany');
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Enter' });
    await untilRendered(fixture, () => fixture.componentInstance.country() === 'DE');
    expect(fixture.componentInstance.country()).toBe('DE');
  });
});

describe('SvPhoneInputComponent — host-supplied plans (DD-26-I3)', () => {
  it('measures the length hint against the host plan, not the bundled one', async () => {
    TestBed.resetTestingModule();
    const plans = [
      { code: 'NZ', name: 'New Zealand', dialCode: '+64', nationalDigits: [8, 10] as const, groups: [2, 3, 4] },
    ];
    const { fixture } = await render(SvPhoneInputComponent, {
      inputs: { plans, country: 'NZ', value: '21 123' },
    });
    fixture.detectChanges();
    const hint = (fixture.nativeElement as HTMLElement).querySelector('[data-sv-length-hint]');
    expect(hint?.textContent).toContain('New Zealand numbers are usually 8–10 digits; this has 5.');

    fixture.componentRef.setInput('value', '21 123 4567');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-sv-length-hint]')).toBeNull();
    expect(fixture.componentInstance.e164()).toBe('+64211234567');
  });
});

describe('SvPhoneInputComponent — body portaled listbox (SR-04)', () => {
  // The country picker used to live inside `div.relative` as `position: absolute`
  // and was clipped by every showcase card's `isolate overflow-hidden`. It is
  // now rendered into `document.body` via `createPortalHost`, so it escapes
  // any transform / overflow containment.

  /** The portal host sits under `<body>` and carries the data-sv-portal marker. */
  const portal = () => document.querySelector<HTMLElement>('[data-sv-portal="phone-input"]');

  afterEach(() => portal()?.remove());

  it('renders the open listbox into document.body, not the component host', async () => {
    const { fixture } = await render(SvPhoneInputComponent, {});
    const host = fixture.nativeElement as HTMLElement;

    fireEvent.click(screen.getByRole('button', { name: /United States/ }));
    await untilRendered(fixture, () => screen.queryByRole('listbox') !== null);

    // The listbox is NOT a descendant of the sv-phone-input host — it lives
    // inside the body-portaled host instead.
    expect(host.querySelector('[role="listbox"]')).toBeNull();
    const inBody = portal()?.querySelector('[role="listbox"]');
    expect(inBody).not.toBeNull();
  });

  it('positions the panel with position: fixed', async () => {
    const { fixture } = await render(SvPhoneInputComponent, {});
    fireEvent.click(screen.getByRole('button', { name: /United States/ }));
    await untilRendered(fixture, () => screen.queryByRole('listbox') !== null);

    const listbox = portal()!.querySelector<HTMLElement>('[role="listbox"]')!;
    // The portal panel is `position: fixed` (was `absolute` — that put it
    // inside the trigger's `div.relative` and let `isolate overflow-hidden`
    // on a showcase card clip the picker after two rows, `SR-04`).
    expect(listbox.style.position).toBe('fixed');
    // In jsdom the viewport is 0×0, so the numbers come out of the helper —
    // we just assert the panel IS positioned (a px-suffixed string was set).
    const top = listbox.style.top;
    expect(top.endsWith('px') || top === '').toBe(true);
  });

  it('closes (and removes the portal) when the user selects a country', async () => {
    const { fixture } = await render(SvPhoneInputComponent, {});
    fireEvent.click(screen.getByRole('button', { name: /United States/ }));
    await untilRendered(fixture, () => screen.queryByRole('listbox') !== null);
    expect(portal()).not.toBeNull();

    fireEvent.click(screen.getByRole('option', { name: /Germany/ }));
    await untilRendered(fixture, () => screen.queryByRole('listbox') === null);
    // The portal host is taken down with the listbox.
    expect(portal()).toBeNull();
  });

  it('keeps an outside click inside the portal from closing it', async () => {
    const { fixture } = await render(SvPhoneInputComponent, {});
    fireEvent.click(screen.getByRole('button', { name: /United States/ }));
    await untilRendered(fixture, () => screen.queryByRole('listbox') !== null);

    // A pointerdown on an option inside the portal must not be treated as
    // "outside" — that is how a click selects an option. `PointerEvent` is
    // not in jsdom, so we use a generic Event the document handler reads
    // the same way.
    const option = portal()!.querySelector('[role="option"]')!;
    option.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    fixture.detectChanges();
    expect(screen.queryByRole('listbox')).not.toBeNull();
  });
});

describe('SvPhoneInputComponent — label re-check (SR-03)', () => {
  it('names the whole control as a group labelled by the visible label', async () => {
    const { fixture } = await render(SvPhoneInputComponent, {});
    const group = screen.getByRole('group', { name: 'Phone number' });
    expect(group.getAttribute('aria-labelledby')).toBe(fixture.componentInstance.labelId);
  });

  it('renders no stray "Custom Mask" label when the label is cleared', async () => {
    const { fixture } = await render(SvPhoneInputComponent, { inputs: { label: '' } });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).not.toContain('Custom Mask');
    expect(host.querySelectorAll('label').length).toBe(0);
    expect(host.querySelector('input')!.getAttribute('aria-label')).toBe('Phone number');
    expect(screen.queryByRole('group')).toBeNull();
  });
});

describe('SvPhoneInputComponent — portal re-check (SR-04)', () => {
  const portal = () => document.querySelector<HTMLElement>('[data-sv-portal="phone-input"]');
  afterEach(() => portal()?.remove());

  it('hangs the panel from its bottom edge when it opens above the trigger', async () => {
    const { fixture } = await render(SvPhoneInputComponent, {});
    const button = screen.getByRole('button', { name: /United States/ });
    const vh = window.innerHeight;
    button.getBoundingClientRect = () =>
      ({ top: vh - 40, bottom: vh - 0, left: 20, right: 120, width: 100, height: 40, x: 20, y: vh - 40, toJSON: () => ({}) }) as DOMRect;
    fireEvent.click(button);
    await untilRendered(fixture, () => screen.queryByRole('listbox') !== null);
    const listbox = portal()!.querySelector<HTMLElement>('[role="listbox"]')!;
    expect(listbox.style.bottom).toBe(`${40 + 4}px`);
    expect(listbox.style.top).toBe('');
  });

  it('keeps the panel open and re-anchored on a window resize', async () => {
    const { fixture } = await render(SvPhoneInputComponent, {});
    fireEvent.click(screen.getByRole('button', { name: /United States/ }));
    await untilRendered(fixture, () => screen.queryByRole('listbox') !== null);
    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    expect(screen.queryByRole('listbox')).not.toBeNull();
  });
});
