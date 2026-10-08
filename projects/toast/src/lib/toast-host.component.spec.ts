import { render } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import { SvLiveAnnouncer } from '@styloviz/core';
import { ToastService } from '@styloviz/core';
import { SvToastHostComponent } from './toast-host.component';

async function setup(inputs: Record<string, unknown> = {}) {
  const { fixture } = await render(SvToastHostComponent, { inputs });
  const service = TestBed.inject(ToastService);
  service.dismissAll(); // reset the root singleton between tests
  return { host: fixture.componentInstance, service, fixture };
}

describe('SvToastHostComponent — stack filtering', () => {
  it('shows only toasts anchored to this host position', async () => {
    const { host, service, fixture } = await setup({ position: 'top-right' });
    service.success('here', { duration: 0, position: 'top-right' });
    service.success('elsewhere', { duration: 0, position: 'bottom-left' });
    fixture.detectChanges();

    expect(host.toasts().map((t) => t.message)).toEqual(['here']);
  });

  it('caps the visible stack at maxVisible (keeping the newest)', async () => {
    const { host, service, fixture } = await setup({ position: 'top-right', maxVisible: 2 });
    service.success('1', { duration: 0 });
    service.success('2', { duration: 0 });
    service.success('3', { duration: 0 });
    fixture.detectChanges();

    expect(host.toasts().map((t) => t.message)).toEqual(['2', '3']);
  });
});

describe('SvToastHostComponent — ARIA politeness', () => {
  /**
   * ★★★ THIS TEST ASSERTED THE DEFECT, and it asserted it twice over. It
   *     pinned `role="alert"` and `aria-live` onto each toast NODE — the
   *     pattern where every toast is its own live region, created with its
   *     text already inside it, which assistive technology is least likely
   *     to announce at all (`OF-19-I8`). And it pinned `warning` as
   *     ASSERTIVE, which is the mapping Alert Banner disagreed with: the
   *     same severity interrupting the user in one component and not the
   *     other.
   *
   *     Both are gone. The politeness rule now lives in one place, and the
   *     toast node carries no live semantics because the shared region does
   *     the speaking.
   */
  it('★ a toast node is no longer a live region of its own', async () => {
    const { fixture, service } = await setup();
    service.error('Upload failed', { duration: 0 });
    fixture.detectChanges();

    const node = document.getElementById(service.toasts()[0].id)!;
    expect(node.hasAttribute('aria-live')).toBe(false);
    expect(node.getAttribute('role')).not.toBe('alert');
    expect(node.getAttribute('role')).not.toBe('status');
  });

  it('★ announces through the shared region, at the shared politeness', async () => {
    // ★ Inject AFTER render: `TestBed.inject` instantiates the test module,
    //   and `render` then refuses to configure it.
    const { fixture, service } = await setup();
    const announcer = TestBed.inject(SvLiveAnnouncer);

    service.error('Upload failed', { duration: 0 });
    fixture.detectChanges();
    expect(announcer.regionFor('assertive')?.textContent).toContain('Upload failed');

    // ★ `warning` is POLITE now — the disagreement with Alert Banner is
    //   settled in `svAnnouncePriorityFor`, and it went the quieter way.
    service.warning('Disk almost full', { duration: 0 });
    fixture.detectChanges();
    expect(announcer.regionFor('polite')?.textContent).toContain('Disk almost full');
    announcer.reset();
  });

  it('the stack container is still navigable', async () => {
    // Removing the per-toast live region must not remove the way a screen
    // reader user REACHES a toast to press its action.
    const { fixture } = await setup();
    fixture.detectChanges();
    const region = document.querySelector('[role="region"][aria-label="Notifications"]');
    expect(region).not.toBeNull();
  });

  it('★ a second toast does not re-announce the first', async () => {
    // ★★★ AND THIS IS THE CASE THAT TESTS THE GUARD, which took two attempts
    //     to find. A bare `detectChanges()` does not re-run the effect at all
    //     — effects wake on signal changes, not on renders — so "re-render"
    //     tests pass whether or not the host tracks what it has said. What
    //     DOES re-run it is another toast arriving, and the effect then walks
    //     the whole visible list: without the seen-set it announces the first
    //     toast again, every time a new one appears. On a busy page that is
    //     every earlier toast repeated on each new one.
    const { fixture, service } = await setup();
    const announcer = TestBed.inject(SvLiveAnnouncer);
    const spy = vi.spyOn(announcer, 'announce');

    service.success('First saved', { duration: 0 });
    fixture.detectChanges();
    service.success('Second saved', { duration: 0 });
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls.map((c) => c[0])).toEqual(['First saved', 'Second saved']);
    spy.mockRestore();
    announcer.reset();
  });
});

/**
 * ★ REGRESSION GUARD (T0-1). The stack pauses for two overlapping reasons —
 *   the pointer is over it, and focus is inside it — and a single boolean
 *   cannot represent both. The failing sequence is ordinary: hover a toast,
 *   tab into its action button, move the mouse away. `mouseleave` then resumed
 *   the countdown while the user was still focused on the button they were
 *   about to press, and the toast vanished mid-keystroke (WCAG 2.2.1).
 *
 *   These assert the reason-counting, not the timer arithmetic — the service's
 *   own spec owns that.
 */
describe('SvToastHostComponent — pausing for two reasons', () => {
  it('stays paused when the pointer leaves but focus is still inside', async () => {
    const { host } = await setup({ position: 'top-right' });

    host.onPointerEnter();
    host.onFocusIn();
    expect(host.paused()).toBe(true);

    host.onPointerLeave(); // the mouse goes; focus has not
    expect(host.paused()).toBe(true);

    host.onFocusOut(); // now nothing holds it
    expect(host.paused()).toBe(false);
  });

  it('stays paused when focus leaves but the pointer is still over it', async () => {
    // The mirror case, and the one a single `focusWithin` flag would miss.
    const { host } = await setup({ position: 'top-right' });

    host.onFocusIn();
    host.onPointerEnter();
    host.onFocusOut();
    expect(host.paused()).toBe(true);

    host.onPointerLeave();
    expect(host.paused()).toBe(false);
  });

  it('resumes only once both reasons are gone, whatever the order', async () => {
    const { host } = await setup({ position: 'top-right' });
    for (const [first, second] of [
      ['onPointerLeave', 'onFocusOut'],
      ['onFocusOut', 'onPointerLeave'],
    ] as const) {
      host.onPointerEnter();
      host.onFocusIn();
      host[first]();
      expect(host.paused()).toBe(true);
      host[second]();
      expect(host.paused()).toBe(false);
    }
  });
});

/**
 * `X-12` / `OF-19-I1` — what a deduplicated repeat looks like on screen.
 *
 * The service decides that a repeat is one toast; what the host owes is making
 * the repeat VISIBLE. A collapsed repeat that renders identically to a single
 * occurrence has simply hidden information the user needed.
 */
describe('SvToastHostComponent — deduplicated repeats', () => {
  it('renders one node for a repeat, with a count badge', async () => {
    const { service, fixture } = await setup({ position: 'top-right' });
    service.error('Sync failed', { duration: 0 });
    service.error('Sync failed', { duration: 0 });
    fixture.detectChanges();

    const badges = fixture.nativeElement.querySelectorAll('[data-sv-toast-count]');
    expect(badges).toHaveLength(1);
    // ★ The glyph is `aria-hidden` and the count is spelled out beside it:
    //   `aria-label` on a bare <span> is ignored by screen readers (no role)
    //   and flagged serious by axe, and "×2" is not reliably read as a repeat.
    expect(badges[0].querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe('×2');
    expect(badges[0].querySelector('.sr-only')?.textContent?.trim()).toBe('Repeated 2 times');
  });

  it('shows no badge for a single occurrence', async () => {
    const { service, fixture } = await setup({ position: 'top-right' });
    service.error('Sync failed', { duration: 0 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[data-sv-toast-count]')).toHaveLength(0);
  });

  it('★ restarts the progress animation on a repeat by changing its name', async () => {
    // A running CSS animation does not restart because a property it does not
    // depend on changed, and the node is deliberately NOT recreated (it is
    // tracked by id, so focus inside it survives). Only `animation-name` can
    // restart it, so repeats alternate between two identical keyframes.
    const { host, service, fixture } = await setup({ position: 'top-right' });
    service.error('Sync failed', { duration: 4000 });
    fixture.detectChanges();
    const first = host.progressStyle(host.toasts()[0]);

    service.error('Sync failed', { duration: 4000 });
    fixture.detectChanges();
    const second = host.progressStyle(host.toasts()[0]);

    expect(first).toContain('toast-progress ');
    expect(second).toContain('toast-progress-alt');
    expect(second).not.toBe(first);
  });

  it('does not announce a repeat a second time', async () => {
    // ★ The host is rendered FIRST: `TestBed.inject` instantiates the testing
    //   module, and `render` cannot configure one that already exists. The
    //   toasts come after the spy either way, which is what the test needs.
    const { service, fixture } = await setup({ position: 'top-right' });

    const spoken: string[] = [];
    const announcer = TestBed.inject(SvLiveAnnouncer);
    const original = announcer.announce.bind(announcer);
    vi.spyOn(announcer, 'announce').mockImplementation((text: string, opts?: unknown) => {
      spoken.push(text);
      return original(text, opts as never);
    });

    service.error('Sync failed', { duration: 0 });
    fixture.detectChanges();
    service.error('Sync failed', { duration: 0 });
    fixture.detectChanges();

    // ★ The same sentence twice is spam; the badge carries the repeat. The
    //   "already announced" set is keyed by id, and a repeat keeps its id —
    //   which is one of the reasons it keeps it.
    expect(spoken.filter((t) => t === 'Sync failed')).toHaveLength(1);
  });
});
