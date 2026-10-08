import { TestBed } from '@angular/core/testing';
import { svResetWarnOnce } from '../dev/warn-once';
import { SvShortcutRegistryService } from './shortcut-registry';

/**
 * An IME owns the keyboard while it is composing: a keydown that is part of
 * text must never run a registered binding — not even a `whileTyping` one
 * like the command palette's open key. `isComposing` is the standard signal;
 * `keyCode` 229 is how Safari and older Chromium report the same keydowns.
 */

function svc(): SvShortcutRegistryService {
  TestBed.resetTestingModule();
  return TestBed.inject(SvShortcutRegistryService);
}

beforeEach(() => svResetWarnOnce());

describe('SvShortcutRegistryService — IME composition', () => {
  let input: HTMLInputElement;
  beforeEach(() => {
    input = document.createElement('input');
    document.body.appendChild(input);
  });
  afterEach(() => input.remove());

  it('★★★ a composing keydown does not run a whileTyping binding, and is not prevented', () => {
    const s = svc();
    const ran: string[] = [];
    // jsdom reports a Linux platform, so `mod` is Ctrl here.
    const h = s.register({ keys: 'mod+k', whileTyping: true, run: () => ran.push('k') });

    const composing = new KeyboardEvent('keydown', {
      key: 'k', ctrlKey: true, isComposing: true, bubbles: true, cancelable: true,
    });
    input.dispatchEvent(composing);
    expect(ran).toEqual([]);
    expect(composing.defaultPrevented).toBe(false);

    // …and the same chord once composition has ended still works.
    const plain = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true });
    input.dispatchEvent(plain);
    expect(ran).toEqual(['k']);
    h.release();
  });

  it('★ keyCode 229 (the Safari form of the same signal) is treated as composing', () => {
    const s = svc();
    const ran: string[] = [];
    const h = s.register({ keys: 'mod+k', whileTyping: true, run: () => ran.push('k') });

    const legacy = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true });
    Object.defineProperty(legacy, 'keyCode', { value: 229 });
    input.dispatchEvent(legacy);
    expect(ran).toEqual([]);
    h.release();
  });

  it('resolve() agrees — nothing would run for a composing event', () => {
    const s = svc();
    const h = s.register({ keys: 'mod+k', run: () => undefined });
    const base = { key: 'k', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, target: document.body };
    expect(s.resolve(base)).not.toBeNull();
    expect(s.resolve({ ...base, isComposing: true })).toBeNull();
    expect(s.resolve({ ...base, keyCode: 229 })).toBeNull();
    h.release();
  });
});
