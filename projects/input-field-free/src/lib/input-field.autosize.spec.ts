import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvInputFieldComponent } from './input-field.component';

/** `FL-J3-FI-16` / `FI-27-V2` — `autosize` on the multiline field. */
async function setup(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvInputFieldComponent, { inputs: { label: 'Bio', multiline: true, ...inputs } });
  const area = (fixture.nativeElement as HTMLElement).querySelector('textarea')!;
  return { fixture, area };
}

describe('SvInputFieldComponent — autosize', () => {
  it('grows with a value written by the host — no input event needed', async () => {
    const { fixture, area } = await setup({ autosize: true, value: '' });
    expect(area.getAttribute('data-sv-autosize')).toBe('measure');
    Object.defineProperty(area, 'scrollHeight', { configurable: true, value: 132 });
    fixture.componentRef.setInput('value', 'line\nline\nline\nline\nline');
    fixture.detectChanges();
    expect(area.style.height).toBe('132px');
  });

  it('is off by default', async () => {
    const { area } = await setup({ value: 'x' });
    expect(area.hasAttribute('data-sv-autosize')).toBe(false);
  });
});
