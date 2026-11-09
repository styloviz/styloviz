import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvInputFieldComponent } from './input-field.component';

/** `FL-J3-FI-12` / `FI-27-M5` — `clearable`: a real, labelled button that empties and returns focus. */
async function setup(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const cleared: number[] = [];
  const { fixture } = await render(SvInputFieldComponent, { inputs: { label: 'Name', ...inputs }, on: { cleared: () => cleared.push(1) } });
  const root = fixture.nativeElement as HTMLElement;
  return { fixture, c: fixture.componentInstance, root, cleared, button: () => root.querySelector<HTMLButtonElement>('[data-sv-clear]') };
}

describe('sv-input-field — clearable', () => {
  it('is off by default', async () => {
    const { button } = await setup({ value: 'Ada' });
    expect(button()).toBeNull();
  });

  it('shows a labelled 24px button only while there is text', async () => {
    const { fixture, button } = await setup({ value: '', clearable: true });
    expect(button()).toBeNull();
    fixture.componentRef.setInput('value', 'Ada');
    fixture.detectChanges();
    const b = button()!;
    expect(b.tagName).toBe('BUTTON');
    expect(b.type).toBe('button');
    expect(b.getAttribute('aria-label')).toBe('Clear');
    expect(b.classList.contains('sv-target')).toBe(true);
  });

  it('empties the value, notifies the form and hands focus back to the field', async () => {
    const { fixture, c, root, cleared, button } = await setup({ value: 'Ada', clearable: true });
    const changes: string[] = [];
    c.registerOnChange((v: string) => changes.push(v));
    button()!.click();
    fixture.detectChanges();
    expect(c.value()).toBe('');
    expect(changes).toEqual(['']);
    expect(cleared).toEqual([1]);
    expect(document.activeElement).toBe(root.querySelector('input'));
    expect(button()).toBeNull();
  });

  it('is not offered when disabled, read-only, on a select or a password', async () => {
    for (const inputs of [
      { disabled: true }, { readonly: true }, { type: 'password' },
      { options: [{ value: 'a', label: 'A' }], value: 'a' },
    ]) {
      const { button } = await setup({ value: 'a', clearable: true, ...inputs });
      expect(button(), JSON.stringify(inputs)).toBeNull();
    }
  });

  it('works on the multiline textarea too', async () => {
    const { root, button } = await setup({ value: 'Line', clearable: true, multiline: true });
    button()!.click();
    expect(document.activeElement).toBe(root.querySelector('textarea'));
  });
});
