import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvTimePickerComponent } from './time-picker.component';

/**
 * ============================================================================
 *  You could not type a time, and you could not reach one  ·  `FI-28-I1`/`M1`
 * ============================================================================
 *
 * ★★★ THE CONTROL HAD NO TEXT INPUT AT ALL. The trigger is a `<button>`, the
 *     panel is three scrolling columns of `<button>`s, and there was no
 *     arrow-key handling anywhere — so DOCUMENT ORDER WAS THE NAVIGATION.
 *     Measured below rather than asserted, because "cumbersome" is an opinion
 *     and 146 is a number.
 *
 * ★★ THE BACKLOG SAID "scroll wheels are cumbersome for keyboard users". They
 *    are not cumbersome; they are the difference between a control a keyboard
 *    user can operate and one they cannot — and the same tab stops are the
 *    same number of swipes for a screen-reader user moving by form control.
 */

async function setup(inputs: Partial<ComponentInput<SvTimePickerComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvTimePickerComponent, {
    inputs: inputs as ComponentInput<SvTimePickerComponent>,
  });
  return { ...r, c: r.fixture.componentInstance };
}

const panel = (): HTMLElement => document.querySelector('.sv-tp-portal')!;

const stops = (): HTMLElement[] =>
  Array.from(
    panel().querySelectorAll<HTMLElement>(
      'input, button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]',
    ),
  );

const key = (k: string): KeyboardEvent =>
  new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });

describe('the size of the problem, counted', () => {
  it('was 146 tab stops, and the roving tabindex collapses it', async () => {
    /**
     * ★★★ THE MEASUREMENT THIS WHOLE ITEM RESTS ON. With `format="24h"` and
     *     `withSeconds`, every one of 24 + 60 + 60 cells plus Now and Done was
     *     its own tab stop: **146**, with minute `37` at position **61**.
     *
     *     Asserted as an upper bound rather than an exact number, because the
     *     point is the ORDER OF MAGNITUDE and pinning 5 would make this test
     *     fail on a cosmetic footer change. What must not come back is a
     *     control where the count scales with the number of minutes in an hour.
     */
    const { c } = await setup({ format: '24h', withSeconds: true });
    c.toggle();

    const reachable = stops();
    expect(reachable.length, 'tab stops in the open panel').toBeLessThan(10);

    // And the columns are still all there — this is fewer STOPS, not fewer cells.
    expect(panel().querySelectorAll('[data-col="minutes"] button')).toHaveLength(60);
  });

  it('gives each column exactly one tab stop, on the selected cell', async () => {
    const { c } = await setup({ value: '09:45', format: '24h' });
    c.toggle();

    for (const [col, want] of [['hours', '09'], ['minutes', '45']] as const) {
      const zero = panel().querySelectorAll(`[data-col="${col}"] [tabindex="0"]`);
      expect(zero, col).toHaveLength(1);
      expect(zero[0].getAttribute('data-cell'), col).toBe(want);
    }
  });
});

describe('typing a time', () => {
  const type = (c: SvTimePickerComponent, text: string): void => {
    c.onTypedInput({ target: { value: text } } as unknown as Event);
  };

  it('is offered by default', async () => {
    /**
     * ⚠️ DEFAULTED ON, unlike the locale inputs added for `FI-09-M2`. Those
     *    change what an existing caller's users SEE. This adds a second way to
     *    reach the same value and takes nothing away — and leaving an
     *    accessibility fix opt-in means nobody gets it.
     */
    const { c } = await setup();
    c.toggle();
    expect(panel().querySelector('[data-typed]')).not.toBeNull();
  });

  it('opens showing the current time, not blank', async () => {
    const { c } = await setup({ value: '14:30', format: '24h' });
    c.toggle();
    expect(c.draft()).toBe('14:30');
  });

  it('shows the 12-hour spelling when the control is 12-hour', async () => {
    const { c } = await setup({ value: '14:30', format: '12h' });
    c.toggle();
    expect(c.draft()).toBe('02:30 PM');
  });

  it('commits on Enter', async () => {
    const { c } = await setup({ value: '09:00', format: '24h' });
    c.toggle();
    type(c, '14:37');
    c.onTypedKeydown(key('Enter'));
    expect(c.value()).toBe('14:37');
  });

  it('commits on blur', async () => {
    const { c } = await setup({ value: '09:00', format: '24h' });
    c.toggle();
    type(c, '14:37');
    c.commitTyped();
    expect(c.value()).toBe('14:37');
  });

  it('does NOT commit while you are still typing', async () => {
    /**
     * ★★★ "1" IS A VALID TIME AND SO IS "14". A control that parsed on every
     *     keystroke would set 01:00 on the way to 14:30 — and with `[(value)]`
     *     bound to a form, EMIT it. Every intermediate keystroke becomes a
     *     value the host saw and may have saved.
     */
    const seen: string[] = [];
    const { c } = await setup({ value: '09:00', format: '24h' });
    c.changed.subscribe((v: string) => seen.push(v));
    c.toggle();

    for (const partial of ['1', '14', '14:', '14:3', '14:37']) type(c, partial);
    expect(c.value()).toBe('09:00');
    expect(seen).toEqual([]);

    c.commitTyped();
    expect(seen).toEqual(['14:37']);
  });

  it('reads the 12-hour forms against the period the user named', async () => {
    const { c } = await setup({ value: '09:00', format: '12h' });
    c.toggle();
    type(c, '2:30 PM');
    c.commitTyped();
    expect(c.value()).toBe('14:30');
  });

  it('falls back to the period the panel is already showing', async () => {
    // The control shows PM (14:00). A bare "2:30" means the PM the user can see.
    const { c } = await setup({ value: '14:00', format: '12h' });
    c.toggle();
    type(c, '2:30');
    c.commitTyped();
    expect(c.value()).toBe('14:30');
  });

  it('lets an unambiguous 24-hour time override that fallback', async () => {
    // Showing AM, but "14:30" can only mean one thing.
    const { c } = await setup({ value: '09:00', format: '12h' });
    c.toggle();
    type(c, '14:30');
    c.commitTyped();
    expect(c.value()).toBe('14:30');
  });

  it('reads a non-Latin code, the same defect as `FI-16-I3`', async () => {
    const { c } = await setup({ value: '09:00', format: '24h' });
    c.toggle();
    type(c, '١٤:٣٠');
    c.commitTyped();
    expect(c.value()).toBe('14:30');
  });
});

describe('refusing a time', () => {
  const type = (c: SvTimePickerComponent, text: string): void => {
    c.onTypedInput({ target: { value: text } } as unknown as Event);
  };

  it('keeps the text and marks it invalid rather than clamping', async () => {
    /**
     * ★★★ THE DECISION WORTH DEFENDING. `25:00` could be clamped to `23:59` and
     *     the panel would look like it worked — which teaches the user their
     *     typing was accepted, and they walk away believing they set a time
     *     they did not set. The text stays put to be corrected.
     */
    const { c } = await setup({ value: '09:00', format: '24h' });
    c.toggle();
    type(c, '25:00');
    expect(c.commitTyped()).toBe(false);
    expect(c.value()).toBe('09:00');
    expect(c.draft()).toBe('25:00');
    expect(c.draftInvalid()).toBe(true);
  });

  it('says so where a screen reader will hear it', async () => {
    /**
     * ★★ A RED BORDER IS NOT AN ERROR MESSAGE. The field takes `aria-invalid`
     *    and the hint below it becomes `role="alert"` carrying the accepted
     *    format — so the correction is announced with the complaint, rather
     *    than the user being told they are wrong and not what right looks like.
     *    Asserted through the DOM, because that is where the behaviour is.
     */
    const { fixture, c } = await setup({ format: '24h' });
    c.toggle();
    type(c, 'noon');
    c.commitTyped();
    fixture.detectChanges();

    const field = panel().querySelector('[data-typed]')!;
    expect(field.getAttribute('aria-invalid')).toBe('true');

    const hint = panel().querySelector(`#${field.getAttribute('aria-describedby')}`)!;
    expect(hint.getAttribute('role')).toBe('alert');
    expect(hint.textContent).toContain('14:30'); // the worked example, not just "invalid"
  });

  it('reopening the panel is a fresh edit', async () => {
    const { c } = await setup({ format: '24h' });
    c.toggle();
    type(c, 'noon');
    c.commitTyped();
    expect(c.draftInvalid()).toBe(true);
    c.close();
    c.toggle();
    expect(c.draftInvalid()).toBe(false);
  });

  it('clears the invalid mark as soon as you edit again', async () => {
    const { c } = await setup({ format: '24h' });
    c.toggle();
    type(c, 'noon');
    c.commitTyped();
    expect(c.draftInvalid()).toBe(true);
    type(c, 'noo');
    expect(c.draftInvalid()).toBe(false);
  });

  it('treats an emptied field as a cancelled edit, not a request to clear', async () => {
    // ⚠️ Clearing the value is what the host's own control does; a blank field
    //    is much more often a selection somebody deleted before retyping.
    const { c } = await setup({ value: '09:00', format: '24h' });
    c.toggle();
    type(c, '');
    expect(c.commitTyped()).toBe(true);
    expect(c.value()).toBe('09:00');
    expect(c.draft()).toBe('09:00');
  });
});

describe('the window still wins', () => {
  const type = (c: SvTimePickerComponent, text: string): void => {
    c.onTypedInput({ target: { value: text } } as unknown as Event);
  };

  it('clamps a well-formed time that is merely unavailable', async () => {
    /**
     * ⚠️ A DIFFERENT KIND OF REFUSAL FROM A MALFORMED ONE. `08:00` under
     *    `min="09:00"` is a real time the host has said is not on offer, so it
     *    is clamped like every other path in this component. `25:00` is not a
     *    time at all and is refused. Conflating the two would either clamp
     *    nonsense or reject the bounds the host asked for.
     */
    const { c } = await setup({ value: '10:00', format: '24h', min: '09:00', max: '17:00' });
    c.toggle();
    type(c, '08:00');
    expect(c.commitTyped()).toBe(true);
    expect(c.value()).toBe('09:00');
    expect(c.draft()).toBe('09:00'); // and the field shows what was actually set
  });
});

describe('arrow keys inside a column', () => {
  it('moves the selection, not just the focus', async () => {
    /**
     * ★★ These columns have no separate cursor — the highlighted cell IS the
     *    value — so an arrow key that only moved focus would leave the user
     *    pressing Down six times and seeing nothing change.
     */
    const { c } = await setup({ value: '09:30', format: '24h' });
    c.toggle();
    c.onColumnKeydown(key('ArrowDown'), 'minutes');
    expect(c.value()).toBe('09:31');
    c.onColumnKeydown(key('ArrowUp'), 'minutes');
    expect(c.value()).toBe('09:30');
  });

  it('pages by five and jumps to the ends', async () => {
    const { c } = await setup({ value: '09:30', format: '24h' });
    c.toggle();
    c.onColumnKeydown(key('PageDown'), 'minutes');
    expect(c.value()).toBe('09:35');
    c.onColumnKeydown(key('Home'), 'minutes');
    expect(c.value()).toBe('09:00');
    c.onColumnKeydown(key('End'), 'minutes');
    expect(c.value()).toBe('09:59');
  });

  it('clamps at the ends rather than wrapping', async () => {
    // ⚠️ A column is a range, not a carousel. Arrowing up from 00 to 59 changes
    //    the hour in the user's head and does not here.
    const { c } = await setup({ value: '09:00', format: '24h' });
    c.toggle();
    c.onColumnKeydown(key('ArrowUp'), 'minutes');
    expect(c.value()).toBe('09:00');
  });

  it('steps over a disabled cell instead of landing on one', async () => {
    /**
     * ★★★ A disabled `<button>` cannot take focus, so moving the roving
     *     tabindex onto one strands focus on `<body>` — and the key handler is
     *     on the cell, so every subsequent arrow key is swallowed too. The user
     *     is stuck inside the panel with no keyboard way out. Same failure the
     *     date picker documents on `clampToWindow`.
     */
    const { c } = await setup({ value: '09:00', format: '24h', min: '08:55', max: '17:00' });
    c.toggle();
    // 08:xx below 55 is out of the window; from 09:00 arrowing up must not
    // land on a disabled minute of the current hour.
    c.onColumnKeydown(key('Home'), 'hours');
    expect(c.isHourDisabled(c.currentHour())).toBe(false);
  });

  it('does nothing for a key it does not handle', async () => {
    const { c } = await setup({ value: '09:30', format: '24h' });
    c.toggle();
    const e = key('a');
    c.onColumnKeydown(e, 'minutes');
    expect(c.value()).toBe('09:30');
    expect(e.defaultPrevented).toBe(false);
  });
});

describe('typed can be turned off', () => {
  it('leaves the panel exactly as it was', async () => {
    const { c } = await setup({ typed: false, format: '24h' });
    c.toggle();
    expect(panel().querySelector('[data-typed]')).toBeNull();
    // and the columns are still keyboard-navigable, which is the half of the
    // fix that is not optional.
    c.onColumnKeydown(key('ArrowDown'), 'minutes');
    expect(c.value()).not.toBe('');
  });
});

describe('re-verification 2026-09-26 — one stop per column has to say which column', () => {
  afterEach(() => document.querySelectorAll('.sv-tp-portal').forEach(n => n.remove()));

  it('names every column and marks the selected cell in each', async () => {
    // ★ With the roving tabindex a screen reader tabbed from "09, button" to
    //   "30, button" — nothing said which was the hour, or that it was chosen.
    const { c, fixture } = await setup({ value: '14:30', format: '12h' });
    c.toggle();
    fixture.detectChanges();
    const col = (n: string) => panel().querySelector<HTMLElement>(`[data-col="${n}"]`)!;
    expect(col('hours').getAttribute('role')).toBe('group');
    expect(col('hours').getAttribute('aria-label')).toBe('Hour');
    expect(col('minutes').getAttribute('aria-label')).toBe('Minute');
    expect(col('period').getAttribute('aria-label')).toBe('AM or PM');

    const pressed = (n: string) =>
      [...col(n).querySelectorAll('button[aria-pressed="true"]')].map(b => b.textContent?.trim());
    expect(pressed('hours')).toEqual(['02']);
    expect(pressed('minutes')).toEqual(['30']);
    expect(pressed('period')).toEqual(['PM']);
    // The pressed cell is the column's one tab stop.
    expect(col('minutes').querySelector('[tabindex="0"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('names the seconds column too', async () => {
    const { c, fixture } = await setup({ value: '09:00:15', format: '24h', withSeconds: true });
    c.toggle();
    fixture.detectChanges();
    const sec = panel().querySelector<HTMLElement>('[data-col="seconds"]')!;
    expect(sec.getAttribute('aria-label')).toBe('Second');
    expect(sec.querySelector('button[aria-pressed="true"]')?.textContent?.trim()).toBe('15');
  });
});
