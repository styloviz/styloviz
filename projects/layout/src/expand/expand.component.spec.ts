import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { screen } from '@testing-library/angular';
import { afterEach, vi } from 'vitest';
import { SvExpandComponent } from './expand.component';

/**
 * The animation is hand-rolled: set a height, transition to another, and tidy
 * up on `transitionend`. Both halves of that are worth pinning, because both
 * were wrong in ways nothing visible reports.
 *
 * `transitionend` is not a guarantee — a zero duration fires none, and neither
 * does an element that is not being rendered — so waiting only for it left the
 * panel permanently mid-animation and `expandedChange` permanently unfired. And
 * the event bubbles, so a child of the projected content fading its own opacity
 * used to finish the panel's animation on its behalf, at whatever height it had
 * reached.
 */

/**
 * A real host, driving the panel through signals — which is how a host drives
 * it in an app, and the only way to change an input mid-test without fighting
 * Angular's dev-mode change verification.
 */
@Component({
  standalone: true,
  imports: [SvExpandComponent],
  template: `
    <sv-expand
      [expanded]="expanded()"
      [duration]="duration()"
      [lazy]="lazy()"
      [panelId]="panelId()"
      [ariaLabel]="ariaLabel()"
      [ariaLabelledby]="ariaLabelledby()"
    ><p>Panel body</p></sv-expand>
  `,
})
class HostComponent {
  readonly expanded = signal(false);
  readonly duration = signal(200);
  readonly lazy = signal(true);
  readonly panelId = signal('');
  readonly ariaLabel = signal('');
  readonly ariaLabelledby = signal('');
}

interface Props {
  expanded?: boolean;
  duration?: number;
  lazy?: boolean;
  panelId?: string;
  ariaLabel?: string;
  ariaLabelledby?: string;
}

async function setup(props: Props = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  const host = fixture.componentInstance;
  if (props.expanded !== undefined) host.expanded.set(props.expanded);
  if (props.duration !== undefined) host.duration.set(props.duration);
  if (props.lazy !== undefined) host.lazy.set(props.lazy);
  if (props.panelId !== undefined) host.panelId.set(props.panelId);
  if (props.ariaLabel !== undefined) host.ariaLabel.set(props.ariaLabel);
  if (props.ariaLabelledby !== undefined) host.ariaLabelledby.set(props.ariaLabelledby);
  fixture.detectChanges();
  return { fixture, host };
}

type View = Awaited<ReturnType<typeof setup>>;

const panel = (v: View) => (v.fixture.nativeElement as HTMLElement).querySelector('sv-expand > div') as HTMLDivElement;
const instance = (v: View) =>
  v.fixture.debugElement.children[0].componentInstance as SvExpandComponent;

/** Flip the host's `expanded` and let Angular run ngOnChanges. */
function toggle(v: View, expanded: boolean) {
  v.host.expanded.set(expanded);
  v.fixture.detectChanges();
}

afterEach(() => vi.useRealTimers());

describe('SvExpandComponent — what is mounted, and what is announced', () => {
  it('holds the content back until it is first opened', async () => {
    const v = await setup();
    expect(screen.queryByText('Panel body')).toBeNull();

    toggle(v, true);
    expect(screen.getByText('Panel body')).toBeTruthy();
  });

  it('keeps the content once it has been opened, even after closing', async () => {
    const v = await setup();
    toggle(v, true);
    toggle(v, false);
    expect(instance(v).hasBeenOpened()).toBe(true);
    expect(screen.getByText('Panel body')).toBeTruthy();
  });

  it('mounts the content up front when the host does not want it lazy', async () => {
    await setup({ lazy: false });
    expect(screen.getByText('Panel body')).toBeTruthy();
  });

  it('hides the panel from assistive tech while closed', async () => {
    const v = await setup();
    expect(panel(v).getAttribute('aria-hidden')).toBe('true');

    toggle(v, true);
    expect(panel(v).getAttribute('aria-hidden')).toBe('false');
  });

  it('starts hidden without animating into it', async () => {
    const v = await setup();
    expect(panel(v).style.display).toBe('none');
  });

  it('starts open when the host says so', async () => {
    const v = await setup({ expanded: true });
    expect(panel(v).style.display).toBe('');
    expect(screen.getByText('Panel body')).toBeTruthy();
  });
});

/**
 * ── regression: PHASE3_LAYOUT_UTILITIES_AUDIT.md finding #2 (X-2 / X-3) ───────
 * "Expand (`sv-expand`) — headless panel can't be wired to a trigger's
 * `aria-controls`": no panel id, so no `aria-controls`, and no way to expose it
 * as a named `role="region"`. The finding is CLOSED, and these tests are what
 * keep it closed. They look redundant with the template — they are not. Do not
 * delete or merge them away in a refactor; a disclosure whose trigger points at
 * nothing is invisible to every sighted reviewer.
 */
describe('SvExpandComponent — regression: Phase 3 audit finding #2, disclosure wiring (X-2/X-3)', () => {
  // regression: finding #2 — conditional named region semantics.
  it('regression (finding #2): is a region only once it has a name', async () => {
    const v = await setup();
    expect(panel(v).getAttribute('role')).toBeNull();
    expect(panel(v).getAttribute('aria-label')).toBeNull();
    expect(panel(v).getAttribute('aria-labelledby')).toBeNull();

    const named = await setup({ ariaLabel: 'Advanced options' });
    expect(panel(named).getAttribute('role')).toBe('region');
    expect(panel(named).getAttribute('aria-label')).toBe('Advanced options');
  });

  // regression: finding #2 — ariaLabelledby wins over ariaLabel.
  it('regression (finding #2): prefers the labelling element over a literal name', async () => {
    const v = await setup({ ariaLabel: 'Ignored', ariaLabelledby: 'trigger-1' });
    expect(panel(v).getAttribute('aria-labelledby')).toBe('trigger-1');
    expect(panel(v).getAttribute('aria-label')).toBeNull();
    expect(panel(v).getAttribute('role')).toBe('region');
  });

  // regression: finding #2 — panelId exists, and is omitted rather than empty.
  it('regression (finding #2): takes an id so a trigger can point aria-controls at it', async () => {
    const v = await setup({ panelId: 'advanced-panel' });
    expect(panel(v).getAttribute('id')).toBe('advanced-panel');
  });

  it('regression (finding #2): renders no empty id when panelId is unset', async () => {
    const v = await setup();
    expect(panel(v).hasAttribute('id')).toBe(false);
  });

  // regression: finding #2 — the whole relationship, resolved the way AT resolves it.
  it('regression (finding #2): a trigger\'s aria-controls resolves to the panel', async () => {
    const v = await setup({ panelId: 'wired-panel', ariaLabelledby: 'wired-trigger' });
    const trigger = document.createElement('button');
    trigger.id = 'wired-trigger';
    trigger.setAttribute('aria-controls', 'wired-panel');
    document.body.appendChild(trigger);
    try {
      expect(document.getElementById(trigger.getAttribute('aria-controls') ?? '')).toBe(panel(v));
      expect(document.getElementById(panel(v).getAttribute('aria-labelledby') ?? '')).toBe(trigger);
    } finally {
      trigger.remove();
    }
  });
});

describe('SvExpandComponent — finishing the animation', () => {
  it('finishes opening and reports it, with no transitionend in sight', async () => {
    const v = await setup({ duration: 200 });
    const seen: boolean[] = [];
    instance(v).expandedChange.subscribe((x) => seen.push(x));

    vi.useFakeTimers();
    toggle(v, true);
    expect(panel(v).style.overflow).toBe('hidden');
    expect(seen).toEqual([]);

    vi.advanceTimersByTime(250);
    expect(seen).toEqual([true]);
    expect(panel(v).style.height).toBe('');
    expect(panel(v).style.overflow).toBe('');
    expect(panel(v).style.transition).toBe('');
  });

  it('finishes closing, hides the panel and reports it', async () => {
    const v = await setup({ expanded: true, duration: 200 });
    const seen: boolean[] = [];
    instance(v).expandedChange.subscribe((x) => seen.push(x));

    vi.useFakeTimers();
    toggle(v, false);
    expect(panel(v).style.display).not.toBe('none');

    vi.advanceTimersByTime(250);
    expect(seen).toEqual([false]);
    expect(panel(v).style.display).toBe('none');
    expect(panel(v).style.height).toBe('');
  });

  it('finishes the moment its own transition ends, without waiting out the clock', async () => {
    const v = await setup({ duration: 5_000 });
    const seen: boolean[] = [];
    instance(v).expandedChange.subscribe((x) => seen.push(x));

    vi.useFakeTimers();
    toggle(v, true);
    panel(v).dispatchEvent(new Event('transitionend', { bubbles: true }));
    expect(seen).toEqual([true]);

    // And the fallback does not fire a second time.
    vi.advanceTimersByTime(6_000);
    expect(seen).toEqual([true]);
  });

  it('is not finished by something transitioning inside it', async () => {
    // `transitionend` bubbles. A child fading its own opacity used to end the
    // panel's animation early, leaving it at whatever height it had reached.
    const v = await setup({ duration: 1_000 });
    const seen: boolean[] = [];
    instance(v).expandedChange.subscribe((x) => seen.push(x));

    vi.useFakeTimers();
    toggle(v, true);
    screen.getByText('Panel body').dispatchEvent(new Event('transitionend', { bubbles: true }));
    expect(seen).toEqual([]);
    expect(panel(v).style.overflow).toBe('hidden');

    vi.advanceTimersByTime(1_100);
    expect(seen).toEqual([true]);
  });

  it('does not report anything after it has been torn down', async () => {
    const v = await setup({ duration: 200 });
    const seen: boolean[] = [];
    instance(v).expandedChange.subscribe((x) => seen.push(x));

    vi.useFakeTimers();
    toggle(v, true);
    v.fixture.destroy();

    vi.advanceTimersByTime(1_000);
    expect(seen).toEqual([]);
  });

  it('starts a new animation cleanly when toggled mid-flight', async () => {
    const v = await setup({ duration: 1_000 });
    const seen: boolean[] = [];
    instance(v).expandedChange.subscribe((x) => seen.push(x));

    vi.useFakeTimers();
    toggle(v, true);
    vi.advanceTimersByTime(200);
    toggle(v, false);

    vi.advanceTimersByTime(1_100);
    // Only the second animation reports — the first was superseded.
    expect(seen).toEqual([false]);
    expect(panel(v).style.display).toBe('none');
  });

  it('carries the duration and easing it was given into the transition', async () => {
    const v = await setup({ duration: 400 });
    toggle(v, true);
    expect(panel(v).style.transition).toContain('400ms');
    expect(panel(v).style.transition).toContain('ease-in-out');
  });

  /**
   * ngOnChanges fires for EVERY input, not just `expanded`. Re-tuning the
   * duration (or the panel's aria wiring) while the panel is closed must not
   * start an animation — that would flash a closed panel open and emit an
   * `expandedChange` nobody asked for.
   */
  it('ignores a change to an input other than expanded', async () => {
    const v = await setup({ duration: 200 });
    const seen: boolean[] = [];
    instance(v).expandedChange.subscribe((x) => seen.push(x));

    vi.useFakeTimers();
    v.host.duration.set(900);
    v.host.ariaLabel.set('Details');
    v.fixture.detectChanges();

    vi.advanceTimersByTime(1_000);
    expect(seen).toEqual([]);
    expect(panel(v).style.display).toBe('none');
    expect(panel(v).getAttribute('aria-label')).toBe('Details');
  });
});

// ── LU-04-I1 / M1 — focus policy on collapse (X-10) ─────────────────────────

/** A trigger + panel with focusable content, the shape every real disclosure has. */
@Component({
  standalone: true,
  imports: [SvExpandComponent],
  template: `
    <h3 id="focus-heading">Heading, not focusable</h3>
    <button id="focus-trigger" type="button" [attr.aria-controls]="controls()">Toggle</button>
    <button id="focus-custom" type="button">Custom target</button>
    <sv-expand
      [expanded]="expanded()"
      [duration]="200"
      [panelId]="panelId()"
      [ariaLabelledby]="labelledBy()"
      [returnFocusTo]="returnTo()"
    ><button id="inside" type="button">Inside</button></sv-expand>
  `,
})
class FocusHostComponent {
  readonly expanded = signal(true);
  readonly panelId = signal('');
  readonly labelledBy = signal('');
  readonly controls = signal<string | null>(null);
  readonly returnTo = signal<string | HTMLElement | null>(null);
}

async function focusSetup(init: (h: FocusHostComponent) => void = () => undefined) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [FocusHostComponent] });
  const fixture = TestBed.createComponent(FocusHostComponent);
  init(fixture.componentInstance);
  // TestBed attaches the host to the document, so focus() and
  // document.activeElement behave as they do in a page.
  fixture.detectChanges();
  const byId = (id: string) => (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`#${id}`)!;
  const collapse = () => {
    fixture.componentInstance.expanded.set(false);
    fixture.detectChanges();
  };
  return { fixture, byId, collapse };
}

describe('SvExpandComponent — where focus goes on collapse (LU-04-I1/M1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('moves focus to returnFocusTo (by id) when focus was inside the collapsing panel', async () => {
    const v = await focusSetup((h) => h.returnTo.set('focus-custom'));
    v.byId('inside').focus();
    expect(document.activeElement?.id).toBe('inside');

    v.collapse();
    expect(document.activeElement?.id).toBe('focus-custom');
  });

  it('accepts an element as returnFocusTo', async () => {
    const v = await focusSetup();
    const target = v.byId('focus-custom');
    v.fixture.componentInstance.returnTo.set(target);
    v.fixture.detectChanges();
    v.byId('inside').focus();

    v.collapse();
    expect(document.activeElement).toBe(target);
  });

  it('falls back to the labelling trigger when no target is given', async () => {
    const v = await focusSetup((h) => h.labelledBy.set('focus-trigger'));
    v.byId('inside').focus();

    v.collapse();
    expect(document.activeElement?.id).toBe('focus-trigger');
  });

  it('falls back to the element whose aria-controls names the panel', async () => {
    // The labelling element is a heading — not focusable — so it is skipped.
    const v = await focusSetup((h) => {
      h.labelledBy.set('focus-heading');
      h.panelId.set('p-1');
      h.controls.set('other p-1');
    });
    v.byId('inside').focus();

    v.collapse();
    expect(document.activeElement?.id).toBe('focus-trigger');
  });

  it('lands on the host — never <body> — when nothing else can take focus', async () => {
    const v = await focusSetup();
    v.byId('inside').focus();

    v.collapse();
    const host = (v.fixture.nativeElement as HTMLElement).querySelector('sv-expand');
    expect(document.activeElement).toBe(host);
    expect(document.activeElement).not.toBe(document.body);
    expect(host?.getAttribute('tabindex')).toBe('-1');
  });

  it('leaves focus alone when it was not inside the panel', async () => {
    const v = await focusSetup((h) => h.returnTo.set('focus-custom'));
    v.byId('focus-trigger').focus();

    v.collapse();
    expect(document.activeElement?.id).toBe('focus-trigger');
  });

  it('takes the collapsed content out of the tab order (inert) from the start of the collapse', async () => {
    const v = await focusSetup();
    const wrapper = (v.fixture.nativeElement as HTMLElement).querySelector('sv-expand > div') as HTMLElement;
    expect(wrapper.hasAttribute('inert')).toBe(false);

    vi.useFakeTimers();
    v.collapse();
    // Still animating (display not yet none) — and already inert.
    expect(wrapper.style.display).not.toBe('none');
    expect(wrapper.hasAttribute('inert')).toBe(true);

    v.fixture.componentInstance.expanded.set(true);
    v.fixture.detectChanges();
    expect(wrapper.hasAttribute('inert')).toBe(false);
  });

  it('is inert from first render when it starts collapsed', async () => {
    const v = await setup();
    expect(panel(v).hasAttribute('inert')).toBe(true);
  });
});

// ── LU-04-I2 / M2 — content that grows mid-open (X-4) ───────────────────────

/** A controllable ResizeObserver, installed as the global `svElementSize` reaches for. */
function fakeResizeObserver() {
  const created: { callback: ResizeObserverCallback; targets: Element[] }[] = [];
  class FakeRO {
    private readonly rec: (typeof created)[number];
    constructor(callback: ResizeObserverCallback) {
      this.rec = { callback, targets: [] };
      created.push(this.rec);
    }
    observe(el: Element): void { this.rec.targets.push(el); }
    unobserve(): void { /* not used */ }
    disconnect(): void { this.rec.targets = []; }
  }
  vi.stubGlobal('ResizeObserver', FakeRO);
  const fire = (height: number) => {
    for (const rec of created) {
      const entries = rec.targets.map(
        (target) =>
          ({
            target,
            borderBoxSize: [{ inlineSize: 300, blockSize: height }],
            contentRect: { width: 300, height },
          }) as unknown as ResizeObserverEntry,
      );
      if (entries.length) rec.callback(entries, {} as ResizeObserver);
    }
  };
  return { created, fire };
}

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

describe('SvExpandComponent — content that grows during the transition (LU-04-I2/M2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('observes the content box, not the height-pinned wrapper', async () => {
    const ro = fakeResizeObserver();
    const v = await setup();
    toggle(v, true);
    const content = panel(v).querySelector('[data-sv-expand-content]');
    expect(content).toBeTruthy();
    expect(ro.created.some((r) => r.targets.includes(content as Element))).toBe(true);
  });

  it('re-targets the open transition when an image or font grows the content mid-open', async () => {
    const ro = fakeResizeObserver();
    const v = await setup({ duration: 1_000 });
    let contentHeight = 120;
    Object.defineProperty(panel(v), 'scrollHeight', { configurable: true, get: () => contentHeight });

    toggle(v, true);
    expect(panel(v).style.height).toBe('120px');

    // An image lands: the content is now 300px tall, and the panel is still opening.
    contentHeight = 300;
    ro.fire(300);
    await frame();
    v.fixture.detectChanges();
    expect(panel(v).style.height).toBe('300px');
    expect(panel(v).style.overflow).toBe('hidden');

    const seen: boolean[] = [];
    instance(v).expandedChange.subscribe((x) => seen.push(x));
    panel(v).dispatchEvent(new Event('transitionend'));
    expect(seen).toEqual([true]);
    // Settled to auto — nothing is clipped at the old measurement.
    expect(panel(v).style.height).toBe('');
  });

  it('ignores growth while closing — it is heading for 0 whatever the content does', async () => {
    const ro = fakeResizeObserver();
    const v = await setup({ expanded: true, duration: 1_000 });
    let contentHeight = 120;
    Object.defineProperty(panel(v), 'scrollHeight', { configurable: true, get: () => contentHeight });

    toggle(v, false);
    contentHeight = 400;
    ro.fire(400);
    await frame();
    v.fixture.detectChanges();
    expect(panel(v).style.height).toBe('0px');
  });
});

// ── LU-04-I3 — interrupted transitions and rapid reversals ──────────────────

describe('SvExpandComponent — interrupted transitions settle deterministically (LU-04-I3)', () => {
  it('last write wins: open → close → open mid-flight reports only the final state, once', async () => {
    const v = await setup({ duration: 1_000 });
    const seen: boolean[] = [];
    instance(v).expandedChange.subscribe((x) => seen.push(x));

    vi.useFakeTimers();
    toggle(v, true);
    vi.advanceTimersByTime(100);
    toggle(v, false);
    vi.advanceTimersByTime(100);
    toggle(v, true);
    vi.advanceTimersByTime(5_000);

    expect(seen).toEqual([true]);
    expect(panel(v).style.display).toBe('block');
    expect(panel(v).style.height).toBe('');
    expect(panel(v).style.overflow).toBe('');
    expect(panel(v).style.transition).toBe('');
    expect(panel(v).getAttribute('aria-hidden')).toBe('false');
    expect(panel(v).hasAttribute('inert')).toBe(false);
  });

  it('a reversal starts from the height already reached, not from zero', async () => {
    const v = await setup({ duration: 1_000 });
    vi.useFakeTimers();
    toggle(v, true);
    vi.advanceTimersByTime(100);
    toggle(v, false);

    // Half-way through closing, the panel is 60px tall.
    panel(v).getBoundingClientRect = () => ({ top: 0, left: 0, bottom: 60, right: 300, width: 300, height: 60, x: 0, y: 0, toJSON: () => ({}) });
    const heights: string[] = [];
    const style = panel(v).style;
    const desc = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'height');
    Object.defineProperty(style, 'height', {
      configurable: true,
      get: () => desc?.get?.call(style) as string,
      set: (value: string) => { heights.push(value); desc?.set?.call(style, value); },
    });

    toggle(v, true);
    expect(heights[0]).toBe('60px');
  });

  it('many rapid toggles leave exactly one pending settle — a stray transitionend reports nothing more', async () => {
    const v = await setup({ duration: 1_000 });
    const seen: boolean[] = [];
    instance(v).expandedChange.subscribe((x) => seen.push(x));

    vi.useFakeTimers();
    for (const next of [true, false, true, false, true, false]) toggle(v, next);
    panel(v).dispatchEvent(new Event('transitionend'));
    expect(seen).toEqual([false]);

    panel(v).dispatchEvent(new Event('transitionend'));
    vi.advanceTimersByTime(5_000);
    expect(seen).toEqual([false]);
    expect(panel(v).style.display).toBe('none');
  });
});

// ── LU-04-M3 — lazy destroy-vs-retain, pinned as documented ─────────────────

let probeCreated = 0;
let probeDestroyed = 0;

@Component({ selector: 'sv-expand-probe', standalone: true, template: 'probe' })
class ProbeComponent implements OnInit, OnDestroy {
  ngOnInit(): void { probeCreated++; }
  ngOnDestroy(): void { probeDestroyed++; }
}

@Component({
  standalone: true,
  imports: [SvExpandComponent, ProbeComponent],
  template: `<sv-expand [expanded]="expanded()" [duration]="0"><sv-expand-probe /></sv-expand>`,
})
class ProbeHostComponent {
  readonly expanded = signal(false);
}

describe('SvExpandComponent — lazy content lifecycle, as documented (LU-04-M3)', () => {
  it('lazy defers ATTACHING projected content, not creating it — the host instantiates it up front', () => {
    probeCreated = 0;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ProbeHostComponent] });
    const fixture = TestBed.createComponent(ProbeHostComponent);
    fixture.detectChanges();

    expect(probeCreated).toBe(1);
    expect((fixture.nativeElement as HTMLElement).querySelector('sv-expand-probe')).toBeNull();
  });

  it('retains the content after collapse — nothing is destroyed until sv-expand itself is', () => {
    probeDestroyed = 0;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ProbeHostComponent] });
    const fixture = TestBed.createComponent(ProbeHostComponent);
    fixture.detectChanges();

    vi.useFakeTimers();
    fixture.componentInstance.expanded.set(true);
    fixture.detectChanges();
    vi.advanceTimersByTime(100);
    fixture.componentInstance.expanded.set(false);
    fixture.detectChanges();
    vi.advanceTimersByTime(100);

    const el = (fixture.nativeElement as HTMLElement).querySelector('sv-expand-probe');
    expect(el).toBeTruthy();
    expect(probeDestroyed).toBe(0);
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('sv-expand > div')?.style.display).toBe('none');

    fixture.destroy();
    expect(probeDestroyed).toBe(1);
  });
});

describe('SvExpandComponent — reduced motion (X-7)', () => {
  /**
   * The audit listed Expand as already honouring reduced motion. It did not:
   * nothing in the component read the preference, and the height always
   * animated over `duration`. Pinned so the claim stays true.
   */
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');

  function reducedMotion(reduce: boolean): void {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: reduce && query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
  }

  afterEach(() => {
    if (original) Object.defineProperty(window, 'matchMedia', original);
    else Reflect.deleteProperty(window, 'matchMedia');
  });

  it('opens and closes with no height transition, and still settles and reports', async () => {
    reducedMotion(true);
    const v = await setup({ duration: 400 });
    const changes: boolean[] = [];
    instance(v).expandedChange.subscribe((e) => changes.push(e));

    vi.useFakeTimers();
    toggle(v, true);
    expect(panel(v).style.transition).toBe('none');
    vi.advanceTimersByTime(60); // far short of the 400ms duration
    expect(changes).toEqual([true]);

    toggle(v, false);
    expect(panel(v).style.transition).toBe('none');
    vi.advanceTimersByTime(60);
    expect(changes).toEqual([true, false]);
    expect(panel(v).style.display).toBe('none');
  });

  it('animates over the full duration when motion is allowed', async () => {
    reducedMotion(false);
    const v = await setup({ duration: 400 });
    vi.useFakeTimers();
    toggle(v, true);
    expect(panel(v).style.transition).toBe('height 400ms ease-in-out');
  });
});

// ── Re-verification — a control INSIDE the collapsing panel (LU-04-I1) ──────

/** A "Show less" button inside the content, and the real trigger AFTER the panel. */
@Component({
  standalone: true,
  imports: [SvExpandComponent],
  template: `
    <sv-expand [expanded]="expanded()" [duration]="200" panelId="p-2" [returnFocusTo]="returnTo()">
      <button id="show-less" type="button" aria-controls="p-2">Show less</button>
    </sv-expand>
    @if (withTrigger()) {
      <button id="after-trigger" type="button" aria-controls="p-2">Show more</button>
    }
  `,
})
class InPanelControlHost {
  readonly expanded = signal(true);
  readonly withTrigger = signal(true);
  readonly returnTo = signal<string | null>(null);
}

describe('SvExpandComponent — focus never lands inside the collapsing panel (LU-04-I1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function mountInPanel(init: (h: InPanelControlHost) => void = () => undefined) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [InPanelControlHost] });
    const fixture = TestBed.createComponent(InPanelControlHost);
    init(fixture.componentInstance);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const collapse = () => {
      fixture.componentInstance.expanded.set(false);
      fixture.detectChanges();
    };
    return { fixture, el, collapse };
  }

  it('skips an in-panel aria-controls button and moves to the trigger outside', async () => {
    const v = await mountInPanel();
    v.el.querySelector<HTMLElement>('#show-less')!.focus();
    v.collapse();
    expect(document.activeElement?.id).toBe('after-trigger');
  });

  it('falls back to the host when the only controller is inside the panel', async () => {
    const v = await mountInPanel((h) => h.withTrigger.set(false));
    v.el.querySelector<HTMLElement>('#show-less')!.focus();
    v.collapse();
    expect(document.activeElement).toBe(v.el.querySelector('sv-expand'));
  });

  it('ignores a returnFocusTo that points inside the panel', async () => {
    const v = await mountInPanel((h) => h.returnTo.set('show-less'));
    v.el.querySelector<HTMLElement>('#show-less')!.focus();
    v.collapse();
    expect(document.activeElement?.id).toBe('after-trigger');
  });
});
