import { signal } from '@angular/core';
import { createDebouncer } from './debounce';

describe('createDebouncer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('holds the settled value until the delay elapses', () => {
    const d = createDebouncer('', { delayMs: 300 });
    d.set('ab');
    expect(d.raw()).toBe('ab');
    expect(d.value()).toBe('');
    expect(d.pending()).toBe(true);

    vi.advanceTimersByTime(299);
    expect(d.value()).toBe('');

    vi.advanceTimersByTime(1);
    expect(d.value()).toBe('ab');
    expect(d.pending()).toBe(false);
  });

  it('settles once for a burst of keystrokes', () => {
    const d = createDebouncer('', { delayMs: 300 });
    for (const term of ['a', 'ab', 'abc']) {
      d.set(term);
      vi.advanceTimersByTime(100);
    }
    expect(d.value()).toBe('');
    vi.advanceTimersByTime(300);
    expect(d.value()).toBe('abc');
  });

  it('settles synchronously when the delay is zero or negative', () => {
    const zero = createDebouncer('', { delayMs: 0 });
    zero.set('now');
    expect(zero.value()).toBe('now');

    const negative = createDebouncer('', { delayMs: -5 });
    negative.set('now');
    expect(negative.value()).toBe('now');
  });

  it('reads the delay from a signal on every set', () => {
    const delayMs = signal(500);
    const d = createDebouncer('', { delayMs });
    d.set('a');
    vi.advanceTimersByTime(300);
    expect(d.value()).toBe('');

    delayMs.set(100);
    d.set('b');
    vi.advanceTimersByTime(100);
    expect(d.value()).toBe('b');
  });

  it('flush settles immediately — for Enter and blur', () => {
    const d = createDebouncer('', { delayMs: 300 });
    d.set('abc');
    d.flush();
    expect(d.value()).toBe('abc');
    expect(d.pending()).toBe(false);
  });

  it('cancel discards the pending value and rewinds raw', () => {
    const d = createDebouncer('keep', { delayMs: 300 });
    d.set('discard');
    d.cancel();
    vi.advanceTimersByTime(1000);
    expect(d.value()).toBe('keep');
    expect(d.raw()).toBe('keep');
  });

  it('does not fire after destroy — a timer outliving the component writes to a dead view', () => {
    const d = createDebouncer('', { delayMs: 300 });
    d.set('late');
    d.destroy();
    vi.advanceTimersByTime(1000);
    expect(d.value()).toBe('');
  });

  it('clears the timer through the supplied DestroyRef', () => {
    const callbacks: (() => void)[] = [];
    const destroyRef = { onDestroy: (fn: () => void) => callbacks.push(fn) };
    const d = createDebouncer('', {
      delayMs: 300,
      destroyRef: destroyRef as unknown as import('@angular/core').DestroyRef,
    });

    d.set('late');
    callbacks.forEach((fn) => fn());
    vi.advanceTimersByTime(1000);
    expect(d.value()).toBe('');
  });

  it('defaults to 300 ms when no delay is given', () => {
    // Callers that omit `delayMs` are the common case (`createDebouncer('')`),
    // and the default is a UX decision, not an implementation detail: it is the
    // gap between "types fast enough" and "fires a request per keystroke".
    const d = createDebouncer('');
    d.set('ab');
    vi.advanceTimersByTime(299);
    expect(d.value()).toBe('');
    vi.advanceTimersByTime(1);
    expect(d.value()).toBe('ab');
  });
});
