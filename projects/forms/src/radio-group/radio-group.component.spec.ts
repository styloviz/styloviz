import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import { SvRadioGroupComponent } from './radio-group.component';
import type { RadioOption } from './radio-group.component';

/**
 * Two renderings of one control: native `<input type="radio">` for the default
 * and card styles, and `role="radio"` buttons for the button style. The button
 * style has to hand-roll everything the browser gives the native one for free —
 * roving tabindex, arrow navigation, wrapping, skipping disabled options — so
 * that is where the tests concentrate.
 */

const OPTIONS: RadioOption[] = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
];

async function setup(inputs: ComponentInput<SvRadioGroupComponent> = {}) {
  TestBed.resetTestingModule();
  return render(SvRadioGroupComponent, {
    inputs: { options: OPTIONS, ...inputs } as ComponentInput<SvRadioGroupComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const group = (host: HTMLElement) => host.querySelector('[role="radiogroup"]')!;
const buttons = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLElement>('[data-radio-button]')];
const button = (host: HTMLElement, v: string) =>
  host.querySelector<HTMLElement>(`[data-radio-button="${v}"]`)!;
const natives = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')];

describe('SvRadioGroupComponent — the native styles', () => {
  it('is a radiogroup naming itself', async () => {
    const { fixture } = await setup({ value: 'md', ariaLabel: 'Size' });
    expect(group(el(fixture)).getAttribute('aria-label')).toBe('Size');
  });

  it('shares one form name across every option, so the browser groups them', async () => {
    const { fixture } = await setup({ value: 'md', groupName: 'size' });
    const names = new Set(natives(el(fixture)).map((r) => r.name));
    expect([...names]).toEqual(['size']);
  });

  it('invents a stable name when the host does not supply one', async () => {
    const { fixture } = await setup({ value: 'md' });
    const names = natives(el(fixture)).map((r) => r.name);
    expect(new Set(names).size).toBe(1);
    expect(names[0]).not.toBe('');
  });

  it('checks exactly the selected option', async () => {
    const { fixture } = await setup({ value: 'lg' });
    expect(natives(el(fixture)).filter((r) => r.checked).map((r) => r.value)).toEqual(['lg']);
  });
});

describe('SvRadioGroupComponent — selection', () => {
  it('selects and reports once', async () => {
    const seen: string[] = [];
    const { fixture } = await setup({ value: 'sm' });
    fixture.componentInstance.changed.subscribe((v) => seen.push(v));

    fixture.componentInstance.select(OPTIONS[1]);
    expect(fixture.componentInstance.value()).toBe('md');
    expect(seen).toEqual(['md']);
  });

  it('refuses a disabled option', async () => {
    const { fixture } = await setup({
      value: 'a',
      options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B', disabled: true }],
    });
    fixture.componentInstance.select({ value: 'b', label: 'B', disabled: true });
    expect(fixture.componentInstance.value()).toBe('a');
  });

  it('refuses everything when the whole group is disabled', async () => {
    const { fixture } = await setup({ value: 'sm', disabled: true });
    fixture.componentInstance.select(OPTIONS[1]);
    expect(fixture.componentInstance.value()).toBe('sm');
  });

  it('merges a disabled form control with the disabled input', async () => {
    const { fixture } = await setup({ value: 'sm' });
    fixture.componentInstance.setDisabledState(true);
    fixture.detectChanges();
    fixture.componentInstance.select(OPTIONS[1]);
    expect(fixture.componentInstance.value()).toBe('sm');
  });

  it('takes a value in from a form control, and tolerates null', async () => {
    const { fixture } = await setup({ value: 'sm' });
    const c = fixture.componentInstance;
    c.writeValue('lg');
    expect(c.value()).toBe('lg');
    c.writeValue(null as unknown as string);
    expect(c.value()).toBe(''); // cleared, not "null"
  });
});

describe('SvRadioGroupComponent — the button style', () => {
  const press = (host: HTMLElement, from: string, key: string) =>
    button(host, from).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

  it('renders radios with a roving tabindex — exactly one is tabbable', async () => {
    const { fixture } = await setup({ value: 'md', radioStyle: 'button' });
    const host = el(fixture);
    expect(buttons(host).length).toBe(3);
    const tabbable = buttons(host).filter((b) => b.getAttribute('tabindex') === '0');
    expect(tabbable.map((b) => b.getAttribute('data-radio-button'))).toEqual(['md']);
  });

  it('falls back to the first enabled option when nothing is selected', async () => {
    const { fixture } = await setup({
      value: '',
      radioStyle: 'button',
      options: [{ value: 'a', label: 'A', disabled: true }, { value: 'b', label: 'B' }],
    });
    expect(fixture.componentInstance.focusableValue()).toBe('b');
  });

  it('moves and selects with the arrows, in both orientations', async () => {
    const { fixture } = await setup({ value: 'sm', radioStyle: 'button' });
    const host = el(fixture);

    press(host, 'sm', 'ArrowRight');
    expect(fixture.componentInstance.value()).toBe('md');

    press(host, 'md', 'ArrowDown');
    expect(fixture.componentInstance.value()).toBe('lg');

    press(host, 'lg', 'ArrowUp');
    expect(fixture.componentInstance.value()).toBe('md');
  });

  it('wraps at both ends', async () => {
    const { fixture } = await setup({ value: 'lg', radioStyle: 'button' });
    const host = el(fixture);

    press(host, 'lg', 'ArrowRight');
    expect(fixture.componentInstance.value()).toBe('sm');

    press(host, 'sm', 'ArrowLeft');
    expect(fixture.componentInstance.value()).toBe('lg');
  });

  it('jumps to the ends with Home and End', async () => {
    const { fixture } = await setup({ value: 'md', radioStyle: 'button' });
    const host = el(fixture);

    press(host, 'md', 'End');
    expect(fixture.componentInstance.value()).toBe('lg');

    press(host, 'lg', 'Home');
    expect(fixture.componentInstance.value()).toBe('sm');
  });

  it('skips a disabled option rather than landing on it', async () => {
    const { fixture } = await setup({
      value: 'a',
      radioStyle: 'button',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B', disabled: true },
        { value: 'c', label: 'C' },
      ],
    });
    press(el(fixture), 'a', 'ArrowRight');
    expect(fixture.componentInstance.value()).toBe('c');
  });

  it('selects with Space and Enter', async () => {
    for (const key of [' ', 'Enter']) {
      const { fixture } = await setup({ value: 'sm', radioStyle: 'button' });
      press(el(fixture), 'md', key);
      expect(fixture.componentInstance.value()).toBe('md');
    }
  });

  it('leaves unrelated keys alone', async () => {
    const { fixture } = await setup({ value: 'sm', radioStyle: 'button' });
    press(el(fixture), 'sm', 'x');
    expect(fixture.componentInstance.value()).toBe('sm');
  });

  it('does nothing when every option is disabled', async () => {
    const { fixture } = await setup({
      value: '',
      radioStyle: 'button',
      options: [{ value: 'a', label: 'A', disabled: true }],
    });
    press(el(fixture), 'a', 'ArrowRight');
    expect(fixture.componentInstance.value()).toBe('');
  });
});

describe('SvRadioGroupComponent — the error slot', () => {
  it('shows a client-side message and marks the group invalid', async () => {
    const { fixture } = await setup({ value: 'sm', errorMessage: 'Pick a size.' });
    expect(group(el(fixture)).getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain('Pick a size.');
  });

  it('points the group at whatever it is describing', async () => {
    const { fixture } = await setup({ value: 'sm', errorMessage: 'Pick a size.' });
    const describedBy = group(el(fixture)).getAttribute('aria-describedby') ?? '';
    expect(describedBy).not.toBe('');
    expect(el(fixture).querySelector(`#${describedBy}`)?.textContent).toContain('Pick a size.');
  });

  it('lets a server rejection outrank the client message, then expires it', async () => {
    const { fixture } = await setup({
      value: 'sm',
      errorMessage: 'Pick a size.',
      serverError: 'Small is out of stock.',
    });
    expect(fixture.componentInstance.resolvedError()).toBe('Small is out of stock.');

    fixture.componentInstance.select(OPTIONS[1]);
    fixture.detectChanges();
    // The rejection was about "sm", which is no longer selected.
    expect(fixture.componentInstance.resolvedError()).toBe('Pick a size.');
  });

  it('leaves aria-invalid off when there is nothing wrong', async () => {
    const { fixture } = await setup({ value: 'sm' });
    expect(group(el(fixture)).hasAttribute('aria-invalid')).toBe(false);
  });
});
