import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SvAutosizeDirective } from './autosize.directive';

/**
 * `FL-J3-FI-16` — the autosizing textarea. jsdom has no layout, so the
 * measured path is driven with a stubbed `scrollHeight`, and the CSS path by
 * stubbing `CSS.supports('field-sizing', 'content')` — the two engines' answers.
 */
@Component({
  standalone: true,
  imports: [SvAutosizeDirective],
  template: `<textarea rows="2" style="line-height:20px;padding:4px 0;font-size:16px"
    [svAutosize]="on()" [svAutosizeValue]="text()" [svAutosizeMaxRows]="maxRows()"></textarea>`,
})
class HostComponent {
  readonly on = signal(true);
  readonly text = signal('');
  readonly maxRows = signal(0);
}

function setup(supportsFieldSizing: boolean) {
  TestBed.resetTestingModule();
  vi.stubGlobal('CSS', { supports: (prop: string, value: string) => supportsFieldSizing && prop === 'field-sizing' && value === 'content' });
  const fixture = TestBed.createComponent(HostComponent);
  const area = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
  let content = 40;
  Object.defineProperty(area, 'scrollHeight', { configurable: true, get: () => content });
  fixture.detectChanges();
  return { fixture, area, setContent: (px: number) => { content = px; } };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SvAutosizeDirective — measured path (WebKit, Firefox)', () => {
  it('sets the height to the content when the value changes, without an input event', () => {
    const { fixture, area, setContent } = setup(false);
    expect(area.getAttribute('data-sv-autosize')).toBe('measure');
    setContent(120);
    fixture.componentInstance.text.set('one\ntwo\nthree\nfour\nfive');
    fixture.detectChanges();
    expect(area.style.height).toBe('120px');
    expect(area.style.overflowY).toBe('hidden');
  });

  it('re-measures on typing', () => {
    const { area, setContent } = setup(false);
    setContent(90);
    area.dispatchEvent(new Event('input'));
    expect(area.style.height).toBe('90px');
  });

  it('caps at maxRows and scrolls past it', () => {
    const { fixture, area, setContent } = setup(false);
    fixture.componentInstance.maxRows.set(3); // 3 × 20 + 8 padding
    setContent(400);
    fixture.componentInstance.text.set('long');
    fixture.detectChanges();
    expect(area.style.height).toBe('68px');
    expect(area.style.overflowY).toBe('auto');
  });

  it('leaves the textarea alone when off', () => {
    const { fixture, area, setContent } = setup(false);
    fixture.componentInstance.on.set(false);
    setContent(300);
    fixture.componentInstance.text.set('x');
    fixture.detectChanges();
    area.dispatchEvent(new Event('input'));
    expect(area.style.height).toBe('');
    expect(area.hasAttribute('data-sv-autosize')).toBe(false);
  });
});

describe('SvAutosizeDirective — CSS path (Chromium field-sizing)', () => {
  it('uses field-sizing: content, keeps rows as the floor, and never sets a height', () => {
    // jsdom's style object drops properties it does not know, `field-sizing`
    // among them — so the write itself is what is asserted.
    const setProperty = vi.spyOn(CSSStyleDeclaration.prototype, 'setProperty');
    const { fixture, area } = setup(true);
    fixture.componentInstance.maxRows.set(4);
    fixture.detectChanges();
    expect(area.getAttribute('data-sv-autosize')).toBe('css');
    expect(setProperty).toHaveBeenCalledWith('field-sizing', 'content');
    expect(area.style.minHeight).toBe('48px');   // 2 rows × 20 + 8
    expect(area.style.maxHeight).toBe('88px');   // 4 rows × 20 + 8
    area.dispatchEvent(new Event('input'));
    expect(area.style.height).toBe('');
  });
});
