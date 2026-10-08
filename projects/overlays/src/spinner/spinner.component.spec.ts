import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import { SvSpinnerComponent } from './spinner.component';
import { SvLiveAnnouncer, SvOverlayStackService, svBodyScrollLockDepth, svResetBodyScrollLock } from '@styloviz/core';

/**
 * A spinner is a shape that means "wait". The shape is the part a screen reader
 * cannot see, so the only thing that actually carries the meaning is the status
 * region and its label — and that has to be there in every style and in both
 * the inline and the overlay layout, not just the default one.
 */

async function setup(inputs: Partial<ComponentInput<SvSpinnerComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvSpinnerComponent, {
    inputs: inputs as ComponentInput<SvSpinnerComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

describe('SvSpinnerComponent — saying it is busy', () => {
  it('is a status region with a default label', async () => {
    await setup();
    expect(screen.getByRole('status', { name: 'Loading…' })).toBeTruthy();
  });

  it('takes the label the host wrote', async () => {
    await setup({ label: 'Fetching orders' });
    expect(screen.getByRole('status', { name: 'Fetching orders' })).toBeTruthy();
  });

  it('says it out loud even when nothing is drawn as text', async () => {
    // Through the shared announcer, once — not as `sr-only` region content,
    // which a status region born with it would usually never read.
    await setup({ label: 'Fetching orders' });
    TestBed.inject(ApplicationRef).tick();
    expect(TestBed.inject(SvLiveAnnouncer).history().map((a) => a.message)).toEqual(['Fetching orders']);
  });

  it.each(['border', 'dots', 'pulse', 'bars'] as const)('keeps the status region in the %s style', async (spinnerStyle) => {
    await setup({ spinnerStyle });
    expect(screen.getByRole('status', { name: 'Loading…' })).toBeTruthy();
  });

  it('keeps it in the overlay layout too', async () => {
    await setup({ overlay: true });
    expect(screen.getByRole('status', { name: 'Loading…' })).toBeTruthy();
  });
});

describe('SvSpinnerComponent — layout', () => {
  it('sits inline by default', async () => {
    const { fixture } = await setup();
    expect(el(fixture).querySelector('.fixed')).toBeNull();
    expect(el(fixture).querySelector('.inline-flex')).toBeTruthy();
  });

  it('covers the screen when asked to', async () => {
    // Portalled to <body> (OF-18-I6), so it is not inside the fixture.
    await setup({ overlay: true });
    const backdrop = document.querySelector('[data-sv-spinner-overlay]');
    expect(backdrop).toBeTruthy();
    expect(backdrop?.className).toContain('inset-0');
  });

  it('shows the label as text only when asked', async () => {
    const { fixture: hidden } = await setup({ label: 'Fetching orders' });
    const visibleText = [...el(hidden).querySelectorAll('span')]
      .filter((s) => !s.classList.contains('sr-only'))
      .map((s) => s.textContent?.trim());
    expect(visibleText).not.toContain('Fetching orders');

    const { fixture: shown } = await setup({ label: 'Fetching orders', labelVisible: true });
    const nowVisible = [...el(shown).querySelectorAll('span')]
      .filter((s) => !s.classList.contains('sr-only'))
      .map((s) => s.textContent?.trim());
    expect(nowVisible).toContain('Fetching orders');
  });

  it('merges the host class onto the outer element', async () => {
    const { fixture } = await setup({ customClass: 'my-8' });
    expect(el(fixture).innerHTML).toContain('my-8');
  });
});

describe('SvSpinnerComponent — the shape', () => {
  it.each(['xs', 'sm', 'md', 'lg', 'xl'] as const)('has a size for %s', async (size) => {
    const { fixture } = await setup({ size });
    const c = fixture.componentInstance;
    expect(c.spinnerSize()).toMatch(/^h-/);
    expect(c.borderWidth()).toBeTruthy();
    expect(c.dotSize()).toBeTruthy();
    expect(c.labelSize()).toMatch(/^text-/);
    expect(c.barHeight()).toBeTruthy();
  });

  it.each(['primary', 'success', 'warning', 'danger', 'info', 'neutral', 'white'] as const)(
    'has a colour for %s',
    async (variant) => {
      const { fixture } = await setup({ variant });
      const c = fixture.componentInstance;
      for (const value of [c.trackColor(), c.fillColor(), c.dotColor()]) {
        expect(value).toBeTruthy();
        expect(value).not.toContain('undefined');
      }
    },
  );

  it('draws something in every style', async () => {
    for (const spinnerStyle of ['border', 'dots', 'pulse', 'bars'] as const) {
      const { fixture } = await setup({ spinnerStyle });
      const status = el(fixture).querySelector('[role="status"]')!;
      expect(status.children.length).toBeGreaterThan(0);
    }
  });
});

// ── OF-18-I6 / OF-18-M4 · the fullscreen spinner's overlay duties ────────────

describe('SvSpinnerComponent — overlay duties', () => {
  afterEach(() => {
    svResetBodyScrollLock(document);
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  });

  /**
   * ★ Not `sv-spinner .fixed` — `render()` mounts the component INTO a plain
   *   `<div id="root0">` rather than into its own selector element, so a
   *   selector that assumes the tag matches nothing and every assertion built
   *   on it fails for a reason that has nothing to do with the component.
   */
  const backdrop = () => document.querySelector<HTMLElement>('.fixed.inset-0');

  /**
   * ★ Render BEFORE injecting. `TestBed.inject` instantiates the test module,
   *   and `render` then throws "Cannot configure the test module when the test
   *   module has already been instantiated" — so the spinner starts inline and
   *   is switched on after the surface underneath it exists, which is also the
   *   order a real page produces.
   */
  async function inlineThenOverlay() {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvSpinnerComponent, { inputs: { overlay: false } });
    const stack = TestBed.inject(SvOverlayStackService);
    const beneath = stack.push('modal');
    fixture.componentRef.setInput('overlay', true);
    fixture.detectChanges();
    return { fixture, stack, beneath };
  }

  it('★ paints above a surface that was already open, not behind it', async () => {
    // ★★ THE OLD VALUE WAS `z-50`, AND THAT IS A BUG WITH A NUMBER IN IT.
    //    Every other surface takes its z-index from the stack, starting at
    //    1000 — so a fullscreen "please wait" raised over an open dialog
    //    painted BEHIND the dialog: the page was blocked, the backdrop was
    //    hidden under the panel, and the user could keep clicking the form
    //    they had just submitted.
    const { beneath } = await inlineThenOverlay();

    const z = Number(backdrop()!.style.zIndex);
    expect(z).toBeGreaterThan(beneath.zIndex);
    expect(z).toBeGreaterThan(50);
    beneath.release();
  });

  it('★ a surface opened AFTER it still paints on top — it is interactive, not ambient', async () => {
    // ★★ THIS IS WHAT PINS THE LAYER CHOICE, and the first version of these
    //    tests could not tell `modal` from `toast`: both bands sit above an
    //    open dialog, so every other assertion passed either way. The
    //    difference only shows for a surface raised LATER — the error dialog
    //    that reports the request this spinner was waiting on failed. An
    //    ambient band (toast, tooltip) is a fixed high number that ignores
    //    push order, so the dialog would render BEHIND the blocking spinner
    //    and be unreachable. A blocking wait is something you are inside, not
    //    something raised at you.
    const { stack, beneath } = await inlineThenOverlay();
    const z = Number(backdrop()!.style.zIndex);

    const later = stack.push('modal');
    expect(later.zIndex).toBeGreaterThan(z);

    later.release();
    beneath.release();
  });

  it('★ owns Escape while it blocks, so nothing underneath dismisses', async () => {
    // A blocking wait has no cancel, so the right answer to Escape is that
    // NOTHING happens. Registering as non-dismissible would let the keystroke
    // fall through and close the dialog underneath mid-request.
    const { beneath } = await inlineThenOverlay();

    expect(beneath.isTopmost()).toBe(false);
    beneath.release();
  });

  it('locks the page scroll while overlaying and gives it back', async () => {
    const { fixture, beneath } = await inlineThenOverlay();
    expect(svBodyScrollLockDepth()).toBe(1);

    fixture.componentRef.setInput('overlay', false);
    fixture.detectChanges();
    expect(svBodyScrollLockDepth()).toBe(0);
    beneath.release();
  });

  it('an inline spinner is not a surface — no stack entry, no lock, no z-index', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvSpinnerComponent, { inputs: { overlay: false } });
    fixture.detectChanges();
    const stack = TestBed.inject(SvOverlayStackService);

    expect(stack.size).toBe(0);
    expect(svBodyScrollLockDepth()).toBe(0);
    expect(backdrop()).toBeNull();
  });

  it('releases the stack entry and the lock when destroyed while overlaying', async () => {
    const { fixture, stack, beneath } = await inlineThenOverlay();
    expect(stack.size).toBe(2);

    fixture.destroy();
    expect(stack.size).toBe(1);
    expect(svBodyScrollLockDepth()).toBe(0);
    beneath.release();
  });
});
