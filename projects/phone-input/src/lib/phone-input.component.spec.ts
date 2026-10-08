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
    fireEvent.keyDown(screen.getByRole('button', { name: /Country/ }), { key: 'g' });
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
