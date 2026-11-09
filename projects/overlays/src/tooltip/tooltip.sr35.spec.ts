import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { SvTooltipComponent, SvTooltipContentDirective } from './tooltip.component';
import { SvTooltipGroupDirective } from './tooltip-group.directive';

/**
 * `SR-35` — the free tooltip's rich layout, content slot, arrow toggle, 12
 * placements, tooltip groups, new variants, status and icon, controlled `open`,
 * anchors, touch policies and animations.
 */

async function setup(template: string) {
  TestBed.resetTestingModule();
  return render(template, { imports: [SvTooltipComponent, SvTooltipContentDirective, SvTooltipGroupDirective] });
}
const bubble = () => screen.getByRole('tooltip', { hidden: true }) as HTMLElement;
const bubbles = () => screen.getAllByRole('tooltip', { hidden: true }) as HTMLElement[];
const wrapOf = (el: Element) => el.closest('sv-tooltip')!.querySelector(':scope > div') as HTMLElement;

afterEach(() => {
  vi.useRealTimers();
  document.querySelectorAll('[data-sv-portal="tooltip"]').forEach((n) => n.remove());
});

describe('rich content', () => {
  it('title · description · keys, with a status dot and an icon', async () => {
    await setup(`<sv-tooltip title="Bold" text="Make the selection bold" [kbd]="['⌘', 'B']" status="success" icon="check">
      <button>B</button></sv-tooltip>`);
    const b = bubble();
    const rich = b.querySelector('[data-sv-tooltip-rich]')!;
    expect(rich.querySelector('.font-semibold')?.textContent).toBe('Bold');
    expect(rich.textContent).toContain('Make the selection bold');
    expect(rich.querySelectorAll('sv-kbd')).toHaveLength(2);
    expect(rich.querySelector('.rounded-full.bg-accent-500')).toBeTruthy();
    expect(rich.querySelector('sv-icon')).toBeTruthy();
  });

  it('text alone renders as it always did — no rich wrapper', async () => {
    await setup(`<sv-tooltip text="Plain"><button>x</button></sv-tooltip>`);
    expect(bubble().querySelector('[data-sv-tooltip-rich]')).toBeNull();
    expect(bubble().textContent?.trim()).toBe('Plain');
  });

  it('[svTooltipContent] replaces the text, and the trigger is described by it', async () => {
    await setup(`<sv-tooltip><button>Share</button>
      <ng-template svTooltipContent><b data-own>Share</b> — anyone with the link</ng-template></sv-tooltip>`);
    expect(bubble().querySelector('[data-own]')).toBeTruthy();
    expect(screen.getByRole('button').getAttribute('aria-describedby')).toBe(bubble().id);
  });

  it('arrow=false drops the arrow', async () => {
    await setup(`<sv-tooltip text="a"><button>a</button></sv-tooltip><sv-tooltip text="b" [arrow]="false"><button>b</button></sv-tooltip>`);
    const [withArrow, without] = bubbles();
    expect(withArrow.querySelector('span[aria-hidden="true"].rotate-45')).toBeTruthy();
    expect(without.querySelector('.rotate-45')).toBeNull();
  });
});

describe('12 placements', () => {
  it.each([
    ['top-start', 'start-0', 'start-3'],
    ['top-end', 'end-0', 'end-3'],
    ['bottom', 'top-full', 'left-1/2'],
    ['left-start', 'top-0', 'top-2'],
    ['right-end', 'bottom-0', 'bottom-2'],
  ])('%s places the bubble and its arrow inline', async (position, bubbleCls, arrowCls) => {
    await setup(`<sv-tooltip text="x" position="${position}" [portal]="false"><button>x</button></sv-tooltip>`);
    expect(bubble().className).toContain(bubbleCls);
    expect(bubble().querySelector('.rotate-45')?.className).toContain(arrowCls);
    expect(bubble().getAttribute('data-sv-tooltip-side')).toBe(position);
  });
});

describe('variants and animations', () => {
  it.each([
    ['inverted', 'dark:bg-white'],
    ['glass', 'backdrop-blur-md'],
    ['value', 'tabular-nums'],
  ])('%s', async (variant, cls) => {
    await setup(`<sv-tooltip text="42" variant="${variant}"><button>x</button></sv-tooltip>`);
    expect(bubble().className).toContain(cls);
    expect(bubble().getAttribute('data-sv-glass')).toBe(variant === 'glass' ? 'pinned' : null);
  });

  it('fade, scale and shift each have a hidden and a shown state, instant under reduced motion', async () => {
    const view = await setup(`<sv-tooltip text="Shifted" animation="shift" position="bottom" [portal]="false"><button>shift</button></sv-tooltip>
      <sv-tooltip text="Faded" animation="fade" [portal]="false"><button>fade</button></sv-tooltip>`);
    const [shift, fade] = bubbles();
    expect(shift.className).toContain('-translate-y-1');
    expect(fade.className).not.toContain('scale-95');
    expect(shift.className).toContain('motion-reduce:transition-none');
    wrapOf(screen.getByRole('button', { name: 'shift' })).dispatchEvent(new MouseEvent('mouseenter'));
    view.fixture.detectChanges();
    expect(shift.className).toContain('translate-y-0');
  });
});

describe('controlled open', () => {
  it('the trigger only asks; open decides', async () => {
    const view = await setup(`<sv-tooltip text="Tip" [open]="false" (openChange)="asked = $event"><button>trigger</button></sv-tooltip>`);
    const host = view.fixture.componentInstance as { asked?: boolean };
    wrapOf(screen.getByRole('button', { name: 'trigger' })).dispatchEvent(new MouseEvent('mouseenter'));
    view.fixture.detectChanges();
    expect(host.asked).toBe(true);
    expect(bubble().getAttribute('aria-hidden')).toBe('true');
  });

  it('open=true shows it with no trigger at all', async () => {
    const view = await setup(`<sv-tooltip text="x" [open]="true" [portal]="true"><button>x</button></sv-tooltip>`);
    view.fixture.detectChanges();
    await view.fixture.whenStable();
    expect(bubble().getAttribute('aria-hidden')).toBe('false');
  });
});

describe('anchor', () => {
  it('a viewport point places the bubble there, in a portal', async () => {
    const view = await setup(`<sv-tooltip text="x" [open]="true" [anchor]="{ x: 300, y: 200 }"><button>x</button></sv-tooltip>`);
    view.fixture.detectChanges();
    await view.fixture.whenStable();
    const b = bubble();
    expect(b.className).toContain('fixed');
    expect(document.querySelector('[data-sv-portal="tooltip"]')?.contains(b)).toBe(true);
  });
});

describe('tooltip groups', () => {
  it('the first waits the group delay, the next shows at once, only one at a time', async () => {
    vi.useFakeTimers();
    const view = await setup(`<div svTooltipGroup [groupDelay]="500" [skipDelay]="300">
      <sv-tooltip text="Bold"><button>B</button></sv-tooltip>
      <sv-tooltip text="Italic"><button>I</button></sv-tooltip></div>`);
    const [bold, italic] = bubbles();
    wrapOf(screen.getByText('B')).dispatchEvent(new MouseEvent('mouseenter'));
    view.fixture.detectChanges();
    expect(bold.getAttribute('aria-hidden')).toBe('true');
    vi.advanceTimersByTime(500);
    view.fixture.detectChanges();
    expect(bold.getAttribute('aria-hidden')).toBe('false');
    // Straight to the sibling: no wait, and the first one goes.
    wrapOf(screen.getByText('I')).dispatchEvent(new MouseEvent('mouseenter'));
    view.fixture.detectChanges();
    expect(italic.getAttribute('aria-hidden')).toBe('false');
    expect(bold.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('touch', () => {
  const noHover = () => {
    const mq = { matches: true, media: '(hover: none)', addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined };
    vi.stubGlobal('matchMedia', () => mq as unknown as MediaQueryList);
  };
  afterEach(() => vi.unstubAllGlobals());

  it('hold: a long press shows it, lifting hides it; a quick tap shows nothing', async () => {
    noHover();
    vi.useFakeTimers();
    const view = await setup(`<sv-tooltip text="Archive" touch="hold"><button>trigger</button></sv-tooltip>`);
    const wrap = wrapOf(screen.getByRole('button', { name: 'trigger' }));
    const down = () => wrap.dispatchEvent(Object.assign(new MouseEvent('pointerdown'), { pointerType: 'touch' }));
    down();
    vi.advanceTimersByTime(100);
    wrap.dispatchEvent(new MouseEvent('pointerup'));
    view.fixture.detectChanges();
    expect(bubble().getAttribute('aria-hidden')).toBe('true');
    down();
    vi.advanceTimersByTime(500);
    view.fixture.detectChanges();
    expect(bubble().getAttribute('aria-hidden')).toBe('false');
    wrap.dispatchEvent(new MouseEvent('pointerup'));
    view.fixture.detectChanges();
    expect(bubble().getAttribute('aria-hidden')).toBe('true');
    const ctx = new MouseEvent('contextmenu', { cancelable: true });
    wrap.dispatchEvent(ctx);
    expect(ctx.defaultPrevented).toBe(true);
  });

  it('off: a touch does nothing at all', async () => {
    noHover();
    const view = await setup(`<sv-tooltip text="Tip" touch="off"><button>trigger</button></sv-tooltip>`);
    wrapOf(screen.getByRole('button', { name: 'trigger' })).click();
    view.fixture.detectChanges();
    expect(bubble().getAttribute('aria-hidden')).toBe('true');
  });
});

@Component({
  standalone: true,
  imports: [SvTooltipComponent],
  template: `<span #a data-anchor></span><sv-tooltip text="40%" [open]="isOpen()" [anchor]="a"><button>x</button></sv-tooltip>`,
})
class MovingAnchor {
  readonly isOpen = signal(false);
}

describe('an element anchor that moves', () => {
  it('re-measures it each frame while open, and stops when the bubble goes', async () => {
    TestBed.resetTestingModule();
    const view = await render(MovingAnchor);
    const anchor = document.querySelector('[data-anchor]') as HTMLElement;
    let left = 100;
    anchor.getBoundingClientRect = () => ({ left, top: 50, width: 1, height: 1, right: left + 1, bottom: 51, x: left, y: 50, toJSON: () => ({}) }) as DOMRect;
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    view.fixture.componentInstance.isOpen.set(true);
    view.fixture.detectChanges();
    await view.fixture.whenStable();
    await new Promise((r) => setTimeout(r, 60));
    const before = bubble().style.left;
    left = 300;
    await new Promise((r) => setTimeout(r, 60));
    expect(bubble().style.left).not.toBe(before);
    expect(raf.mock.calls.length).toBeGreaterThan(0);
    view.fixture.componentInstance.isOpen.set(false);
    view.fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 300));
    const after = raf.mock.calls.length;
    await new Promise((r) => setTimeout(r, 120));
    expect(raf.mock.calls.length - after).toBeLessThanOrEqual(1);
    raf.mockRestore();
  });
});
