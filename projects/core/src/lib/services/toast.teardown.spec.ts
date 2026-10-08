import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

/**
 * `OF-19-I4` — what happens to a five-second countdown when the thing that
 * started it is destroyed.
 *
 * ★★★ THE LEAK IS THE TIMER, NOT THE TOAST. A pending `setTimeout` is a strong
 *     reference held by the runtime: its closure holds the service, which holds
 *     every toast in the signal, and none of it can be collected until the
 *     timer fires. On the server that is once per request — a per-request root
 *     injector kept alive for six seconds by a message nobody will ever see,
 *     and then a `dismiss()` against a dead service.
 *
 * ★ `vi.getTimerCount()` is the assertion because it is the only one that can
 *   fail for the right reason. Asserting on `toasts()` after destroy would pass
 *   with the timer still armed, which is the bug.
 */
describe('ToastService — teardown', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('★ clears pending auto-dismiss timers', () => {
    const s = new ToastService();
    s.success('Saved', { duration: 4000 });
    s.error('Sync failed');
    expect(vi.getTimerCount()).toBe(2);

    s.ngOnDestroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('★ is called by Angular when the injector is destroyed', () => {
    // The half a reviewer should doubt: the hook is useless unless the
    // framework actually runs it for a `providedIn: 'root'` service.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const s = TestBed.inject(ToastService);
    s.info('Still counting', { duration: 5000 });
    expect(vi.getTimerCount()).toBe(1);

    TestBed.resetTestingModule();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves a persistent toast alone, having never armed a timer', () => {
    const s = new ToastService();
    s.info('Read me', { duration: 0 });
    expect(vi.getTimerCount()).toBe(0);
    expect(() => s.ngOnDestroy()).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is safe to call twice, and after dismissAll', () => {
    const s = new ToastService();
    s.success('Saved');
    s.dismissAll();
    s.ngOnDestroy();
    s.ngOnDestroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('★ does not clear a PAUSED toast into a lost countdown', () => {
    // A paused timer has no handle and must not be mistaken for a live one:
    // `forEach` over the map would call `clearTimeout(undefined)`, which is
    // harmless, but the entry must still go so a later resume cannot revive it.
    const s = new ToastService();
    const id = s.success('Saved', { duration: 4000 });
    s.pause(id);
    expect(vi.getTimerCount()).toBe(0);

    s.ngOnDestroy();
    s.resume(id);
    expect(vi.getTimerCount()).toBe(0);
  });
});
