import { Component, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core';
import { SvModalComponent } from './modal.component';
import { flush, until } from '../../../../src/testing/async';

/**
 * The modal renders nothing in place: its whole overlay lives in an
 * `<ng-template>` that is instantiated into `document.body` on open. Every
 * query here is therefore against `document.body` **deliberately**, and every
 * test cleans up after itself — a leaked portal is a `<div>` in `<body>` that
 * the next spec file's `getByRole` would find.
 *
 * ★★ jsdom has no layout. `getFocusableElements` filters on
 * `offsetParent !== null`, which in jsdom is null for *everything*, so without
 * the stub in `stubLayout()` the focus trap silently degrades to its
 * "nothing is focusable" arm and no test could tell the two apart. The stub is
 * explicit, scoped to the tests that need it, and reverted afterwards.
 */

const portal = () => document.querySelector('[data-sv-modal-portal]');
const panel = () => document.querySelector<HTMLElement>('[role="dialog"]');

/**
 * Give jsdom just enough layout for the focus trap to behave as a browser does:
 * an element is "visible" unless it is marked `data-offscreen`.
 */
function stubLayout(): () => void {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute('data-offscreen') ? null : document.body;
    },
  });
  return () => {
    if (original) Object.defineProperty(HTMLElement.prototype, 'offsetParent', original);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetParent;
  };
}

/** A host so the modal has real projected content to trap focus inside. */
@Component({
  standalone: true,
  imports: [SvModalComponent],
  template: `
    <sv-modal
      [(isOpen)]="open"
      [title]="title()"
      [initialFocus]="initialFocus()"
      [showCloseButton]="showClose()"
      [showHeader]="showHeader()"
      [showFooter]="true">
      <ng-container slot="body">
        <input id="first" />
        <div tabindex="0" disabled id="disabled-div">not focusable</div>
        <button id="hidden-btn" aria-hidden="true">hidden</button>
        <button id="offscreen-btn" data-offscreen>offscreen</button>
      </ng-container>
      <ng-container slot="footer">
        <button id="last">Confirm</button>
      </ng-container>
    </sv-modal>
  `,
})
class Host {
  readonly open = signal(false);
  readonly title = signal('Delete project');
  readonly initialFocus = signal('');
  readonly showClose = signal(true);
  readonly showHeader = signal(true);
}

async function setupHost() {
  TestBed.resetTestingModule();
  const { fixture } = await render(Host);
  return fixture;
}

/** Open and wait for the deferred mount the component schedules on a timer. */
async function openAndSettle(fixture: { detectChanges(): void }, host: Host) {
  host.open.set(true);
  fixture.detectChanges();
  await until(() => portal() !== null, { label: 'the portal to be mounted' });
  fixture.detectChanges();
}

afterEach(() => {
  document.querySelectorAll('[data-sv-modal-portal]').forEach((n) => n.remove());
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
});

describe('SvModalComponent — the portal', () => {
  it('renders nothing in place and everything in <body> once open', async () => {
    const fixture = await setupHost();
    expect(portal()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]')).toBeNull();

    await openAndSettle(fixture, fixture.componentInstance);

    expect(portal()).not.toBeNull();
    expect(panel()?.getAttribute('aria-modal')).toBe('true');
    // The panel is in <body>, NOT inside the component's own element — that is
    // the whole point of the portal.
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]')).toBeNull();
  });

  it('takes the portal back out of <body> on close', async () => {
    const fixture = await setupHost();
    await openAndSettle(fixture, fixture.componentInstance);

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();

    expect(portal()).toBeNull();
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);
  });

  it('takes the portal out on destroy, so a torn-down modal leaves nothing behind', async () => {
    const fixture = await setupHost();
    await openAndSettle(fixture, fixture.componentInstance);
    expect(portal()).not.toBeNull();

    fixture.destroy();

    expect(portal()).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  /**
   * The mount is deferred to a timer so it lands after the current
   * change-detection pass. A modal opened and closed again inside that window
   * must not mount at all — otherwise the portal appears after the close and is
   * never removed.
   */
  it('does not mount when the modal is closed again before the timer fires', async () => {
    const fixture = await setupHost();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    fixture.componentInstance.open.set(false);
    fixture.detectChanges();

    await flush();
    await flush();

    expect(portal()).toBeNull();
  });

  it('mounts one portal, not two, when opened twice', async () => {
    const fixture = await setupHost();
    await openAndSettle(fixture, fixture.componentInstance);
    // A second open transition with the portal already up must be a no-op.
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await flush();

    expect(document.querySelectorAll('[data-sv-modal-portal]')).toHaveLength(1);
  });

  it('gives two modals on one page their own portal and their own ids', async () => {
    @Component({
      standalone: true,
      imports: [SvModalComponent],
      template: `
        <sv-modal [isOpen]="true" title="One" subtitle="a" />
        <sv-modal [isOpen]="true" title="Two" subtitle="b" />
      `,
    })
    class Two {}

    TestBed.resetTestingModule();
    const { fixture } = await render(Two);
    await until(() => document.querySelectorAll('[data-sv-modal-portal]').length === 2, {
      label: 'both portals to mount',
    });

    const ids = [...document.querySelectorAll('[role="dialog"]')]
      .map((d) => d.getAttribute('aria-labelledby'));
    expect(new Set(ids).size).toBe(2);
    fixture.destroy();
  });
});

describe('SvModalComponent — scroll lock', () => {
  it('locks the body while open and releases it on close', async () => {
    const fixture = await setupHost();
    await openAndSettle(fixture, fixture.componentInstance);
    expect(document.body.style.overflow).toBe('hidden');

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('');
  });

  /**
   * ★★ Layout stub, deliberate. `window.innerWidth - clientWidth` is the
   * scrollbar width; in jsdom both are 1024 and 0 respectively, so the
   * *difference* is nonzero for the wrong reason and the zero case never
   * happens. Both are pinned explicitly rather than read off a fake layout.
   */
  it('compensates for the scrollbar width so the page does not shift', async () => {
    const original = Object.getOwnPropertyDescriptor(
      Document.prototype, 'documentElement',
    );
    // A 1024px window with a 1009px document = a 15px scrollbar.
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true, get: () => window.innerWidth - 15,
    });

    const fixture = await setupHost();
    await openAndSettle(fixture, fixture.componentInstance);
    expect(document.body.style.paddingRight).toBe('15px');

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    expect(document.body.style.paddingRight).toBe('');

    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true, get: () => window.innerWidth,
    });
    if (original) Object.defineProperty(Document.prototype, 'documentElement', original);
  });

  it('adds no padding when there is no scrollbar to compensate for', async () => {
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true, get: () => window.innerWidth,
    });
    const fixture = await setupHost();
    await openAndSettle(fixture, fixture.componentInstance);
    expect(document.body.style.paddingRight).toBe('');
  });
});

describe('SvModalComponent — focus', () => {
  let restore: () => void;
  beforeEach(() => { restore = stubLayout(); });
  afterEach(() => restore());

  it('moves focus into the dialog on open', async () => {
    const fixture = await setupHost();
    await openAndSettle(fixture, fixture.componentInstance);
    expect(panel()!.contains(document.activeElement)).toBe(true);
  });

  it('focuses the requested element when initialFocus matches', async () => {
    const fixture = await setupHost();
    fixture.componentInstance.initialFocus.set('#last');
    await openAndSettle(fixture, fixture.componentInstance);
    expect(document.activeElement?.id).toBe('last');
  });

  /** A selector that matches nothing must not leave focus outside the dialog. */
  it('falls back to the first focusable when initialFocus matches nothing', async () => {
    const fixture = await setupHost();
    fixture.componentInstance.initialFocus.set('#nope');
    await openAndSettle(fixture, fixture.componentInstance);
    expect(panel()!.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.id).not.toBe('nope');
  });

  /**
   * A dialog with no focusable content at all still has to take focus, or the
   * next Tab escapes into the page behind it.
   */
  it('focuses the panel itself when nothing inside can take focus', async () => {
    @Component({
      standalone: true,
      imports: [SvModalComponent],
      template: `<sv-modal [isOpen]="true" title="Empty" [showCloseButton]="false">
        <ng-container slot="body"><p>nothing here</p></ng-container>
      </sv-modal>`,
    })
    class Bare {}

    TestBed.resetTestingModule();
    const { fixture } = await render(Bare);
    await until(() => portal() !== null, { label: 'the portal to mount' });

    expect(document.activeElement).toBe(panel());
    fixture.destroy();
  });

  /**
   * Only three things count as focusable: not `disabled`, not `aria-hidden`,
   * and laid out. The host projects one of each so the filter cannot be
   * loosened without a failure here.
   */
  it('skips disabled, aria-hidden and unlaid-out candidates', async () => {
    const fixture = await setupHost();
    await openAndSettle(fixture, fixture.componentInstance);

    const trap = fixture.debugElement.children[0].componentInstance as SvModalComponent;
    const focusable = (trap as unknown as {
      getFocusableElements(c: HTMLElement): Element[];
    }).getFocusableElements(panel()!);
    const ids = focusable.map((e) => e.id);

    expect(ids).toContain('first');
    expect(ids).toContain('last');
    expect(ids).not.toContain('disabled-div');
    expect(ids).not.toContain('hidden-btn');
    expect(ids).not.toContain('offscreen-btn');
  });

  it('wraps Tab from the last focusable back to the first', async () => {
    const fixture = await setupHost();
    await openAndSettle(fixture, fixture.componentInstance);

    const last = document.getElementById('last')!;
    last.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    panel()!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close dialog');
  });

  it('wraps Shift+Tab from the first focusable back to the last', async () => {
    const fixture = await setupHost();
    await openAndSettle(fixture, fixture.componentInstance);

    const first = panel()!.querySelector<HTMLElement>('[aria-label="Close dialog"]')!;
    first.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Tab', shiftKey: true, bubbles: true, cancelable: true,
    });
    panel()!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('last');
  });

  it('wraps Shift+Tab from the panel itself, not only from the first control', async () => {
    const fixture = await setupHost();
    await openAndSettle(fixture, fixture.componentInstance);

    panel()!.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Tab', shiftKey: true, bubbles: true, cancelable: true,
    });
    panel()!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('last');
  });

  /** Tab in the middle of the ring is the browser's job, not the trap's. */
  it('leaves a Tab in the middle of the ring alone', async () => {
    const fixture = await setupHost();
    await openAndSettle(fixture, fixture.componentInstance);

    document.getElementById('first')!.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    panel()!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement?.id).toBe('first');
  });

  it('keeps focus in an empty dialog rather than letting Tab escape it', async () => {
    @Component({
      standalone: true,
      imports: [SvModalComponent],
      template: `<sv-modal [isOpen]="true" title="Empty" [showCloseButton]="false">
        <ng-container slot="body"><p>nothing</p></ng-container>
      </sv-modal>`,
    })
    class Bare {}

    TestBed.resetTestingModule();
    const { fixture } = await render(Bare);
    await until(() => portal() !== null, { label: 'the portal to mount' });

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    panel()!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(panel());
    fixture.destroy();
  });

  /**
   * ★ Assert the negative: a modal that never opened has no panel, so the focus
   * trap must be a no-op rather than throwing on a null panel.
   */
  it('does nothing on Tab while closed', async () => {
    const fixture = await setupHost();
    const modal = fixture.debugElement.children[0].componentInstance as SvModalComponent;
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });

    expect(() => modal.onKeydown(event)).not.toThrow();
    expect(event.defaultPrevented).toBe(false);
  });

  it('returns focus to whatever opened it', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const fixture = await setupHost();
    await openAndSettle(fixture, fixture.componentInstance);
    expect(document.activeElement).not.toBe(trigger);

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});

describe('SvModalComponent — on the server', () => {
  /**
   * ★ SSR fork. There is no `document.body` to portal into and no scrollbar to
   * compensate for, so the whole open transition is skipped — including the
   * `opened` output, which a host must not receive twice when hydration runs
   * the same effect again in the browser.
   */
  it('mounts no portal, locks no scroll and emits nothing', async () => {
    TestBed.resetTestingModule();
    const opened = vi.fn();
    const { fixture } = await render(SvModalComponent, {
      inputs: { isOpen: true, title: 'SSR' },
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });
    fixture.componentInstance.opened.subscribe(opened);
    fixture.detectChanges();
    await flush();

    expect(portal()).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(opened).not.toHaveBeenCalled();
  });

  it('tears down without touching the DOM', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvModalComponent, {
      inputs: { isOpen: true },
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });
    document.body.style.overflow = 'scroll';
    fixture.destroy();
    // Unchanged: the server path must not run `unlockScroll`.
    expect(document.body.style.overflow).toBe('scroll');
    document.body.style.overflow = '';
  });
});

describe('SvModalComponent — a stale open timer', () => {
  /**
   * ★ REGRESSION. The mount is deferred with
   * `this.openTimer = setTimeout(...)`, and the handle was overwritten on every
   * opening transition. Open → close → open leaves TWO timers pending but only
   * the second handle stored, so `ngOnDestroy`'s `clearTimeout` cleared one of
   * them. The first then fired after teardown, found `isOpen()` still true —
   * destroying a component does not reset its signals — and appended a modal
   * to `<body>` that nothing owned and nothing would ever remove: a full-screen
   * backdrop over a page with no way to dismiss it, and the scroll lock left on.
   */
  it('leaves nothing behind when destroyed mid-reopen', async () => {
    const fixture = await setupHost();
    const host = fixture.componentInstance;

    host.open.set(true);
    fixture.detectChanges();
    host.open.set(false);
    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();

    fixture.destroy();

    await flush();
    await flush();

    expect(portal()).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('still opens normally after a close/reopen cycle', async () => {
    const fixture = await setupHost();
    const host = fixture.componentInstance;

    host.open.set(true);
    fixture.detectChanges();
    host.open.set(false);
    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();

    await until(() => portal() !== null, { label: 'the portal to mount' });
    expect(document.querySelectorAll('[data-sv-modal-portal]')).toHaveLength(1);
    fixture.destroy();
  });
});

// ── X-6 · where focus goes when the trigger is gone ──────────────────────────

@Component({
  standalone: true,
  imports: [SvModalComponent],
  template: `
    <ul id="rows">
      @for (r of rows(); track r) {
        <li><button type="button" [id]="'row-' + r">row {{ r }}</button></li>
      }
    </ul>
    <sv-modal [(isOpen)]="open" title="Edit row" />
  `,
})
class RowModalHost {
  readonly rows = signal([1, 2]);
  readonly open = signal(false);
}

describe('SvModalComponent — X-6 focus restoration', () => {
  /**
   * ★★ The modal that deletes the row its own trigger sits in is the commonest
   *    modal there is, and `previouslyFocused?.focus?.()` could not serve it:
   *    `focus()` on a detached element does nothing, silently, and focus fell
   *    to `<body>` — where the next Tab restarts at the top of the document.
   */
  it('★ lands in the list the trigger was removed from, not on <body>', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(RowModalHost);
    const host = fixture.componentInstance;

    document.getElementById('row-2')!.focus();
    host.open.set(true);
    fixture.detectChanges();
    await until(() => !!panel());

    host.rows.set([1]);
    fixture.detectChanges();
    host.open.set(false);
    fixture.detectChanges();
    await flush();

    expect(document.activeElement).toBe(document.getElementById('row-1'));
  });

  it('still returns focus to the trigger in the case that always worked', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(RowModalHost);
    const host = fixture.componentInstance;

    const trigger = document.getElementById('row-2')!;
    trigger.focus();
    host.open.set(true);
    fixture.detectChanges();
    await until(() => !!panel());

    host.open.set(false);
    fixture.detectChanges();
    await flush();

    expect(document.activeElement).toBe(trigger);
  });
});

// ── OF-09-I4 · an initialFocus selector that matches nothing ─────────────────

describe('SvModalComponent — OF-09-I4 initial focus', () => {
  /**
   * ★★★ THE SILENT FAILURE IS WHAT MAKES THIS WORTH A WARNING. A selector that
   *     matches nothing falls through to "the first focusable element", which
   *     in a dialog is usually the close button — so a renamed field, or one
   *     inside an `@if` that has not rendered yet, LOOKS like it works: focus
   *     lands somewhere plausible every single time, and nothing in the DOM
   *     afterwards records that the selector was never used.
   */
  it('★ warns once when the selector matches nothing, and still focuses something', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    svResetWarnOnce();
    try {
      TestBed.resetTestingModule();
      const { fixture } = await render(SvModalComponent, {
        inputs: { isOpen: true, title: 'Edit', initialFocus: '#was-renamed' },
      });
      await until(() => !!panel());
      await flush();

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('#was-renamed');
      // ★ And focus still went somewhere — the warning reports a fallback, it
      //   does not replace one.
      expect(panel()!.contains(document.activeElement)).toBe(true);
      fixture.destroy();
    } finally {
      warn.mockRestore();
    }
  });

  it('says nothing when the selector matches', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    svResetWarnOnce();
    try {
      TestBed.resetTestingModule();
      const { fixture } = await render(SvModalComponent, {
        inputs: { isOpen: true, title: 'Edit', initialFocus: '[aria-label="Close dialog"]' },
      });
      await until(() => !!panel());
      await flush();

      expect(warn).not.toHaveBeenCalled();
      fixture.destroy();
    } finally {
      warn.mockRestore();
    }
  });
});
