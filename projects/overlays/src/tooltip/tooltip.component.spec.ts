import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import { SvTooltipComponent } from './tooltip.component';

/**
 * A tooltip is judged on what it does when the pointer is not involved. It has
 * to appear on focus, be dismissible with Escape without moving focus (WCAG
 * 1.4.13), and be tied to its trigger by `aria-describedby` only while it is
 * actually showing — a description that is always present is read out whether
 * or not the tooltip is up.
 *
 * ★ REGRESSION GUARD — Phase 4 finding (PHASE4_OVERLAYS_FEEDBACK_AUDIT.md, P2).
 *   Two tests in this file exist because the defect they describe SHIPPED:
 *
 *     • "appears for a keyboard user too"  — the hover trigger once bound only
 *       `mouseenter`/`mouseleave`, so a keyboard user who tabbed to the trigger
 *       never saw the tooltip at all (WCAG 1.4.13 / 2.1.1).
 *     • "drops a pending appearance when it is torn down" — the delayed-show
 *       `setTimeout` was not cleared on destroy, so a pending show could fire
 *       into a destroyed component.
 *
 *   Neither is redundant with the hover and delay tests beside it: those assert
 *   the pointer path, and the pointer path was never broken. DO NOT DELETE
 *   either test in a "consolidate the duplicate show/hide cases" refactor.
 *   Closed 2026-09-14 (`X-1` / `X-3`).
 */

async function setup(attrs = '') {
  TestBed.resetTestingModule();
  return render(
    `<sv-tooltip text="Delete this row" ${attrs}><button type="button">Delete</button></sv-tooltip>`,
    { imports: [SvTooltipComponent] },
  );
}

type View = Awaited<ReturnType<typeof setup>>;

const wrapper = (v: View) =>
  (v.fixture.nativeElement as HTMLElement).querySelector('sv-tooltip > div') as HTMLElement;
const instance = (v: View) =>
  v.fixture.debugElement.children[0].componentInstance as SvTooltipComponent;
const trigger = () => screen.getByRole('button', { name: 'Delete' });

afterEach(() => vi.useRealTimers());

describe('SvTooltipComponent — showing and hiding', () => {
  it('stays down until something asks for it', async () => {
    const v = await setup();
    expect(instance(v).visible()).toBe(false);
    expect(wrapper(v).getAttribute('aria-describedby')).toBeNull();
  });

  it('appears on hover and goes on hover out', async () => {
    const v = await setup();
    await userEvent.hover(wrapper(v));
    expect(instance(v).visible()).toBe(true);

    await userEvent.unhover(wrapper(v));
    expect(instance(v).visible()).toBe(false);
  });

  it('appears for a keyboard user too', async () => {
    // ★ REGRESSION GUARD (Phase 4, P2). Hover-only is a tooltip half the users
    // cannot read: content available on hover must also be available on focus.
    // The default trigger is `hover`, so this asserts the DEFAULT — the
    // explicit `trigger="focus"` case is covered separately below.
    const v = await setup();
    trigger().focus();
    wrapper(v).dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(instance(v).visible()).toBe(true);

    wrapper(v).dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(instance(v).visible()).toBe(false);
  });

  it('dismisses on Escape without moving focus', async () => {
    const v = await setup();
    instance(v).show();
    v.fixture.detectChanges();

    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    v.fixture.detectChanges();
    expect(instance(v).visible()).toBe(false);
    expect(document.activeElement === document.body || document.activeElement === trigger()).toBe(true);
  });

  it('toggles on click when that is the trigger, and ignores hover', async () => {
    const v = await setup('trigger="click"');
    await userEvent.hover(wrapper(v));
    expect(instance(v).visible()).toBe(false);

    await userEvent.click(trigger());
    expect(instance(v).visible()).toBe(true);

    await userEvent.click(trigger());
    expect(instance(v).visible()).toBe(false);
  });

  it('ignores hover when focus is the trigger', async () => {
    const v = await setup('trigger="focus"');
    await userEvent.hover(wrapper(v));
    expect(instance(v).visible()).toBe(false);

    wrapper(v).dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(instance(v).visible()).toBe(true);
  });

  it('stays down while disabled', async () => {
    const v = await setup('[disabled]="true"');
    await userEvent.hover(wrapper(v));
    expect(instance(v).visible()).toBe(false);
  });

  it('reports each change once, and only on a real change', async () => {
    const seen: boolean[] = [];
    const v = await setup();
    instance(v).visibleChange.subscribe((x) => seen.push(x));

    instance(v).show();
    instance(v).show();
    instance(v).hide();
    instance(v).hide();
    expect(seen).toEqual([true, false]);
  });
});

describe('SvTooltipComponent — the delay', () => {
  it('waits before showing when asked to', async () => {
    const v = await setup('[delay]="300"');
    vi.useFakeTimers();
    instance(v).show();
    expect(instance(v).visible()).toBe(false);

    vi.advanceTimersByTime(300);
    expect(instance(v).visible()).toBe(true);
  });

  it('does not appear at all if the pointer leaves first', async () => {
    // A tooltip that pops up after the pointer has gone is a tooltip over the
    // wrong thing.
    const v = await setup('[delay]="300"');
    vi.useFakeTimers();
    instance(v).show();
    instance(v).hide();

    vi.advanceTimersByTime(1_000);
    expect(instance(v).visible()).toBe(false);
  });

  it('drops a pending appearance when it is torn down', async () => {
    // ★ REGRESSION GUARD (Phase 4, P2, secondary). The show timer outlived the
    // component: teardown mid-delay left a `setTimeout` that woke up and set
    // `visible` on a destroyed instance. Distinct from the `hide()` case above —
    // that one cancels through a code path the component still owns; this one
    // has to be cancelled by `ngOnDestroy`.
    const v = await setup('[delay]="300"');
    vi.useFakeTimers();
    const c = instance(v);
    c.show();
    v.fixture.destroy();

    vi.advanceTimersByTime(1_000);
    expect(c.visible()).toBe(false);
  });
});

describe('SvTooltipComponent — how it is announced', () => {
  it('describes the trigger only while it is showing', async () => {
    const v = await setup();
    const bubble = screen.getByRole('tooltip', { hidden: true });
    expect(bubble.getAttribute('aria-hidden')).toBe('true');
    expect(wrapper(v).getAttribute('aria-describedby')).toBeNull();

    instance(v).show();
    v.fixture.detectChanges();
    expect(wrapper(v).getAttribute('aria-describedby')).toBe(instance(v).tooltipId);
    expect(screen.getByRole('tooltip').getAttribute('aria-hidden')).toBe('false');
  });

  it('gives every instance its own id', async () => {
    // Both instances must share an application: ids are per application (svUniqueId).
    const a = await setup();
    const first = instance(a).tooltipId;
    const b = TestBed.createComponent(SvTooltipComponent);
    b.componentRef.setInput('text', 'Delete this row');
    b.detectChanges();
    expect(b.componentInstance.tooltipId).toMatch(/^sv-tooltip-\w+-\d+$/);
    expect(b.componentInstance.tooltipId).not.toBe(first);
  });

  it('renders no bubble at all with nothing to say', async () => {
    TestBed.resetTestingModule();
    await render('<sv-tooltip><button type="button">Delete</button></sv-tooltip>', {
      imports: [SvTooltipComponent],
    });
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
  });

  it('keeps the wrapper out of the tab order so the trigger is announced once', async () => {
    const v = await setup();
    expect(wrapper(v).getAttribute('tabindex')).toBeNull();
    expect(wrapper(v).getAttribute('role')).toBeNull();
  });
});

describe('SvTooltipComponent — looks', () => {
  it.each(['top', 'bottom', 'left', 'right'] as const)('places itself %s of the trigger', async (position) => {
    const v = await setup(`position="${position}"`);
    expect(instance(v).tooltipClasses()).not.toContain('undefined');
    expect(instance(v).arrowClasses()).not.toContain('undefined');
  });

  it('matches the arrow colour to the bubble', async () => {
    const v = await setup('variant="danger"');
    expect(instance(v).tooltipClasses()).toContain('bg-danger-600');
    expect(instance(v).arrowClasses()).toContain('bg-danger-600');
  });

  it('fades rather than unmounting, so the description stays addressable', async () => {
    const v = await setup();
    expect(instance(v).tooltipClasses()).toContain('opacity-0');

    instance(v).show();
    expect(instance(v).tooltipClasses()).toContain('opacity-100');
  });

  it('takes a maximum width', async () => {
    await setup('[maxWidth]="120"');
    const bubble = screen.getByRole('tooltip', { hidden: true }) as HTMLElement;
    expect(bubble.style.maxWidth).toBe('120px');
  });

  /**
   * The wrapper hugs its trigger by default, which is right for a word or a
   * button and wrong for a card in a grid — there the wrapper becomes the
   * track item and the card stops filling its cell.
   */
  it('hugs its trigger by default', async () => {
    const v = await setup();
    expect(wrapper(v).className).toContain('inline-flex');
    expect(wrapper(v).className).not.toContain('w-full');
  });

  it('stretches to its container when asked to', async () => {
    const v = await setup('[fullWidth]="true"');
    expect(wrapper(v).className).toContain('w-full');
    expect(wrapper(v).className).not.toContain('inline-flex');
  });
});
