import { Component, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvAutofocusDirective } from './autofocus.directive';
import { SvChartAnimDirective } from './chart-animate.directive';
import { SvStopPropagationDirective } from './stop-propagation.directive';

/** Resets TestBed so a single test can render more than once. */
async function setup<T>(component: Type<T>, inputs: ComponentInput<T> = {}) {
  TestBed.resetTestingModule();
  return render(component, { inputs });
}

// ── svAutofocus ──────────────────────────────────────────────────────────────

/*
 * The directive acts in `afterNextRender`, i.e. during the very first render,
 * so the enabled/selectOnFocus values have to be in place before `render()` is
 * called. Literal bindings in one host per case are the honest way to do that —
 * setting a field afterwards would be testing a different code path.
 */

@Component({
  standalone: true,
  imports: [SvAutofocusDirective],
  template: `<input data-testid="on" svAutofocus value="hello" /><input data-testid="other" />`,
})
class AutofocusBareHost {}

@Component({
  standalone: true,
  imports: [SvAutofocusDirective],
  template: `<input data-testid="on" [svAutofocus]="false" value="hello" />`,
})
class AutofocusOffHost {}

@Component({
  standalone: true,
  imports: [SvAutofocusDirective],
  template: `<input data-testid="on" svAutofocus [selectOnFocus]="true" value="hello" />`,
})
class AutofocusSelectHost {}

@Component({
  standalone: true,
  imports: [SvAutofocusDirective],
  template: `<div tabindex="0" data-testid="div" svAutofocus [selectOnFocus]="true">text</div>`,
})
class AutofocusDivHost {}

describe('SvAutofocusDirective', () => {
  it('focuses the element it is on once it has rendered', async () => {
    const { fixture } = await setup(AutofocusBareHost);
    const host = fixture.nativeElement as HTMLElement;
    // The bare attribute reads as '' — falsy, but it must not mean "off", which
    // is why the input is typed `'' | boolean` rather than `boolean`.
    expect(document.activeElement).toBe(host.querySelector('[data-testid="on"]'));
  });

  it('does not take focus when bound to false', async () => {
    const { fixture } = await setup(AutofocusOffHost);
    const host = fixture.nativeElement as HTMLElement;
    // Assert the negative: focus must be somewhere other than our input.
    expect(document.activeElement).not.toBe(host.querySelector('[data-testid="on"]'));
  });

  it('leaves the existing value alone unless asked to select it', async () => {
    const { fixture } = await setup(AutofocusBareHost);
    const input = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="on"]',
    ) as HTMLInputElement;
    expect(input.selectionStart).toBe(input.selectionEnd); // nothing selected
  });

  it('selects the current text when selectOnFocus is set', async () => {
    const { fixture } = await setup(AutofocusSelectHost);
    const input = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="on"]',
    ) as HTMLInputElement;
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('hello'.length);
  });

  it('does not try to select on an element that has no selection to make', async () => {
    // A div has no `.select()`. Calling it would throw inside afterNextRender,
    // where the host component cannot catch it — hence the instanceof guard.
    const { fixture } = await setup(AutofocusDivHost);
    const div = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="div"]');
    expect(document.activeElement).toBe(div);
  });
});

// ── svChartAnim ──────────────────────────────────────────────────────────────

@Component({
  standalone: true,
  imports: [SvChartAnimDirective],
  template: `<div svChartAnim data-testid="chart">bars</div>`,
})
class ChartAnimHost {}

/** Minimal IntersectionObserver double: records targets, fires on demand. */
class FakeIntersectionObserver {
  static last: FakeIntersectionObserver | null = null;
  readonly observed: Element[] = [];
  readonly unobserved: Element[] = [];
  disconnected = false;

  constructor(
    private readonly cb: (entries: IntersectionObserverEntry[]) => void,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.last = this;
  }
  observe(el: Element): void {
    this.observed.push(el);
  }
  unobserve(el: Element): void {
    this.unobserved.push(el);
  }
  disconnect(): void {
    this.disconnected = true;
  }
  fire(target: Element, isIntersecting: boolean): void {
    this.cb([{ target, isIntersecting } as IntersectionObserverEntry]);
  }
}

/** rAF in jsdom is real; resolve after one frame so the class lands. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

describe('SvChartAnimDirective', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeIntersectionObserver.last = null;
  });

  it('animates immediately on a host with no IntersectionObserver', async () => {
    // SSR and jsdom both land here. The animation is decorative, so its absence
    // must mean "already in its final state", not "chart never appears".
    vi.stubGlobal('IntersectionObserver', undefined);
    const { fixture } = await setup(ChartAnimHost);
    const el = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="chart"]');
    expect(el?.classList.contains('sv-animate')).toBe(true);
  });

  it('waits for the chart to enter the viewport before animating', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    const { fixture } = await setup(ChartAnimHost);
    const el = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="chart"]',
    ) as HTMLElement;
    const obs = FakeIntersectionObserver.last;

    expect(obs?.observed).toEqual([el]);
    expect(obs?.options?.threshold).toBe(0.1);
    // Not yet visible — nothing may have been added.
    expect(el.classList.contains('sv-animate')).toBe(false);

    obs?.fire(el, true);
    await nextFrame();
    expect(el.classList.contains('sv-animate')).toBe(true);
    // Once run, it stops watching: a chart that re-animates on every scroll
    // past is a distraction, not a flourish.
    expect(obs?.unobserved).toEqual([el]);
  });

  it('ignores an entry that reports the chart as still off-screen', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    const { fixture } = await setup(ChartAnimHost);
    const el = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="chart"]',
    ) as HTMLElement;
    const obs = FakeIntersectionObserver.last;

    obs?.fire(el, false);
    await nextFrame();
    expect(el.classList.contains('sv-animate')).toBe(false);
    expect(obs?.unobserved).toEqual([]);
  });

  it('disconnects the observer when the chart is destroyed', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    const { fixture } = await setup(ChartAnimHost);
    const obs = FakeIntersectionObserver.last;
    fixture.destroy();
    expect(obs?.disconnected).toBe(true);
  });
});

// ── svStopPropagation ────────────────────────────────────────────────────────

@Component({
  standalone: true,
  imports: [SvStopPropagationDirective],
  template: `
    <!-- The outer element stands in for a document-level outside-click
         listener; it is a test fixture, not a control, hence the disabled
         interaction rules. -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
    <div data-testid="outside" (click)="outsideClicks = outsideClicks + 1">
      <div data-testid="panel" svStopPropagation>panel</div>
      <div data-testid="plain">plain</div>
    </div>
  `,
})
class StopPropagationHost {
  outsideClicks = 0;
}

describe('SvStopPropagationDirective', () => {
  it('keeps a click inside the panel from reaching the outside-click listener', async () => {
    const { fixture } = await setup(StopPropagationHost);
    const host = fixture.nativeElement as HTMLElement;

    host.querySelector<HTMLElement>('[data-testid="plain"]')?.click();
    expect(fixture.componentInstance.outsideClicks).toBe(1);

    host.querySelector<HTMLElement>('[data-testid="panel"]')?.click();
    // Still 1 — the panel's own click must not count as "outside".
    expect(fixture.componentInstance.outsideClicks).toBe(1);
  });
});
