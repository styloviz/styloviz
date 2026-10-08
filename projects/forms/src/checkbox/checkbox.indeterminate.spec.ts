import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { render, type ComponentInput } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core';
import { SvCheckboxComponent } from './checkbox.component';

/**
 * ============================================================================
 *  Indeterminate is a visual state, not a value  ·  `FI-06-I1`
 * ============================================================================
 *
 * ★★★ A CHECKBOX HAS TWO VALUES AND THREE APPEARANCES. `checked` is the value —
 *     a `boolean`, the only thing `ControlValueAccessor` ever writes or reads —
 *     and `indeterminate` is a separate presentation input the HOST owns.
 *
 * ★★★ MEASURED, AND THE STATE MODEL TURNED OUT TO BE RIGHT — there is no third
 *     value for a host to lose data to. What is NOT right is that **the mixed
 *     state survives the click that should have ended it**: toggling a mixed
 *     checkbox leaves `checked() === true`, `indeterminate() === true`, and the
 *     DOM still reporting `aria-checked="mixed"`. The user clicks a "select
 *     all" showing a dash, it fills in, and a screen reader still says mixed.
 *
 * ⚠️ THE ITEM ASKED FOR DOCUMENTATION ("the docs must keep that distinction
 *    loud") AND THAT WAS THE SMALLER HALF.
 */

async function setup(inputs: Partial<ComponentInput<SvCheckboxComponent>> = {}) {
  TestBed.resetTestingModule();
  svResetWarnOnce();
  const r = await render(SvCheckboxComponent, {
    inputs: inputs as ComponentInput<SvCheckboxComponent>,
  });
  return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

describe('the submitted value is never a third thing', () => {
  it('writes a boolean while indeterminate', async () => {
    const seen: unknown[] = [];
    const { c } = await setup({ indeterminate: true, checked: false });
    c.registerOnChange((v: boolean) => seen.push(v));
    c.toggle();
    expect(seen).toEqual([true]);
    expect(typeof seen[0]).toBe('boolean');
  });

  it('coerces a null written by a form to false, not to "mixed"', async () => {
    /**
     * ★★★ THE DATA LOSS THE ITEM WARNS ABOUT, SHOWN AS A VALUE. A parent that
     *     stores `null` for "some children selected" and reads it back gets
     *     `false` — `writeValue(null)` is `!!null` — so the tri-state a host
     *     invented collapses to the unchecked half of a boolean on the way
     *     back in. Nothing throws and nothing says the third state was never
     *     storable.
     */
    const { c } = await setup();
    c.writeValue(null as unknown as boolean);
    expect(c.checked()).toBe(false);
  });

  it('round-trips through a real FormControl as a boolean', async () => {
    const control = new FormControl<boolean>(false, { nonNullable: true });
    const { c } = await setup({ indeterminate: true });
    c.registerOnChange((v: boolean) => control.setValue(v));
    c.toggle();
    expect(control.value).toBe(true);
    expect(typeof control.value).toBe('boolean');
  });

  it('announces mixed to assistive tech while showing a boolean to the form', async () => {
    // ★★ The two are allowed to disagree — that is the whole design — as long
    //    as only one of them is ever submitted.
    const { c, host } = await setup({ indeterminate: true, checked: false });
    const input = host.querySelector('input')!;
    expect(input.getAttribute('aria-checked')).toBe('mixed');
    expect(input.checked).toBe(false);
    expect(c.checked()).toBe(false);
  });
});

describe('the mixed state outliving the click', () => {
  it('is what actually happens, and is asserted so it cannot be forgotten', async () => {
    const { c } = await setup({ indeterminate: true, checked: false });
    c.toggle();

    expect(c.checked()).toBe(true);
    // ⚠️ STILL TRUE. `indeterminate` is an input; the component cannot clear it.
    expect(c.indeterminate()).toBe(true);
  });

  it('warns the host, once, in dev', async () => {
    /**
     * ★★ A WARNING RATHER THAN A FIX, AND DELIBERATELY. Clearing it here would
     *    silently disagree with the host on the next change detection — the
     *    input would set it straight back — and a component that fights its own
     *    input is worse than one that reports the conflict.
     */
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const { c } = await setup({ indeterminate: true });
      c.toggle();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('indeterminate');
      expect(warn.mock.calls[0][0]).toContain('VISUAL state');

      // ★ Once per key: a grid of two hundred rows must not log two hundred times.
      c.toggle();
      c.toggle();
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('says nothing when the host is not doing anything contradictory', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const { c } = await setup({ indeterminate: false });
      c.toggle();
      c.toggle();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('stops being mixed as soon as the host clears it, which is the fix', async () => {
    // The documented contract, exercised: clear `indeterminate` in the handler
    // for `changed` and the control resolves properly.
    const { fixture, c, host } = await setup({ indeterminate: true, checked: false });
    c.changed.subscribe(() => fixture.componentRef.setInput('indeterminate', false));
    c.toggle();
    fixture.detectChanges();

    expect(c.indeterminate()).toBe(false);
    expect(host.querySelector('input')!.getAttribute('aria-checked')).not.toBe('mixed');
  });
});
