import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvInputMaskComponent } from './input-mask.component';

/**
 * `FL-J3-FI-10` / `FI-13-M5` — IME composition. Full-width digits typed through
 * a CJK IME arrive as `input` events with `isComposing`; the mask must leave
 * the field alone until `compositionend`, then format the committed text once.
 * jsdom has no IME, so the events are the ones a browser dispatches, in order.
 */
async function setup(preset: 'phone-us' | 'credit-card' = 'phone-us') {
  TestBed.resetTestingModule();
  const changed: string[] = [];
  const { fixture } = await render(SvInputMaskComponent, { inputs: { preset }, on: { changed: (v: string) => changed.push(v) } });
  const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
  return { fixture, c: fixture.componentInstance, input, changed };
}

const composeInput = (el: HTMLInputElement, value: string): void => {
  el.value = value;
  el.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, data: value }));
};

describe('sv-input-mask — IME composition', () => {
  it('does not reformat while composing, then formats the committed full-width digits once', async () => {
    const { c, input, changed } = await setup();
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    composeInput(input, '５');
    composeInput(input, '５５');
    composeInput(input, '５５５０１０９９９９');
    // The IME's text is untouched and nothing was emitted mid-composition.
    expect(input.value).toBe('５５５０１０９９９９');
    expect(changed).toEqual([]);
    expect(c.value()).toBe('');

    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '５５５０１０９９９９' }));
    expect(c.value()).toBe('(５５５) ０１０-９９９９');
    expect(input.value).toBe('(５５５) ０１０-９９９９');
    expect(changed).toEqual(['(５５５) ０１０-９９９９']);
  });

  it('ignores the IME’s keys (keyCode 229 / isComposing) so Backspace edits the candidate', async () => {
    const { c, input } = await setup();
    c.value.set('(555) 0');
    input.value = '(555) 0';
    input.setSelectionRange(7, 7);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', keyCode: 229, bubbles: true }));
    expect(c.value()).toBe('(555) 0');
  });

  it('still formats ordinary typing immediately', async () => {
    const { c, input } = await setup('credit-card');
    input.value = '42424242';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    expect(c.value()).toBe('4242 4242');
  });

  it('an input that arrives after compositionend (Safari’s order) formats the same text again, harmlessly', async () => {
    const { c, input, changed } = await setup();
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    composeInput(input, '５５５');
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    expect(c.value()).toBe('(５５５');
    expect(changed.every((v) => v === '(５５５')).toBe(true);
  });
});
