import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core';
import { SvWatermarkComponent } from './watermark.component';
import { svLooksLikeEmail, svViewerToken } from './watermark.tile';

/**
 * `LU-12` — the watermark's threat model, its privacy, and its geometry.
 *
 *  - I1/M1: `tampered` reports a client-side DOM mutation — and says it is no more.
 *  - I2/M3: a mark can carry an opaque viewer token instead of a name or email.
 *  - I3/M2: the tiling follows the box (ResizeObserver via `svElementSize`) and
 *    re-tiles when web fonts load.
 *
 * These are regression tests for defects that shipped: a watermark that never
 * tiled until the host called `measure()`, and a `tampered` JSDoc that claimed a
 * restore the component never did.
 */

type Fixture = Awaited<ReturnType<typeof render<SvWatermarkComponent>>>['fixture'];

async function mark(inputs: Record<string, unknown> = {}, on: Record<string, () => void> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvWatermarkComponent, { inputs, on });
  fixture.detectChanges();
  return fixture;
}

const q = (f: Fixture, sel: string) => f.nativeElement.querySelector(sel) as HTMLElement | null;
const marks = (f: Fixture) => Array.from(f.nativeElement.querySelectorAll('[data-sv-mark]')) as HTMLElement[];

function rect(width: number, height: number): DOMRect {
  return { width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
}

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

afterEach(() => {
  TestBed.resetTestingModule();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── I1 / M1 — the threat model ───────────────────────────────────────────────

describe('SvWatermarkComponent — what `tampered` proves (LU-12-I1/M1)', () => {
  async function captured() {
    let tampered = 0;
    const f = await mark({ text: 'Confidential', angle: 30, opacity: 0.1 }, { tampered: () => (tampered += 1) });
    const sig = q(f, '[data-sv-overlay]')?.getAttribute('data-sv-signature') ?? '';
    return { f, sig, count: () => tampered };
  }

  it('reports an overlay removed from the DOM, not just a changed configuration', async () => {
    const { f, sig, count } = await captured();
    expect(f.componentInstance.checkIntegrity(sig)).toBe(true);
    q(f, '[data-sv-overlay]')?.remove();
    expect(f.componentInstance.checkIntegrity(sig)).toBe(false);
    expect(count()).toBe(1);
  });

  it('reports an overlay hidden with display:none', async () => {
    const { f, sig } = await captured();
    (q(f, '[data-sv-overlay]') as HTMLElement).style.display = 'none';
    expect(f.componentInstance.checkIntegrity(sig)).toBe(false);
  });

  it('reports an overlay whose opacity or signature was edited in place', async () => {
    const a = await captured();
    (q(a.f, '[data-sv-overlay]') as HTMLElement).style.opacity = '0';
    expect(a.f.componentInstance.checkIntegrity(a.sig)).toBe(false);

    const b = await captured();
    q(b.f, '[data-sv-overlay]')?.setAttribute('data-sv-signature', '["Public",30,0.1,14]');
    expect(b.f.componentInstance.checkIntegrity(b.sig)).toBe(false);
  });

  /** The overlay alone was checked: its children could be emptied with the container untouched. */
  it('reports marks that were deleted, blanked or hidden inside an intact overlay', async () => {
    const edits: ((m: HTMLElement) => void)[] = [
      (m) => m.remove(),
      (m) => (m.textContent = ''),
      (m) => (m.textContent = 'Public'),
      (m) => (m.style.color = 'transparent'),
      (m) => (m.style.fontSize = '0px'),
      (m) => (m.style.visibility = 'hidden'),
    ];
    for (const edit of edits) {
      TestBed.resetTestingModule();
      const f = await mark({ text: 'Confidential', variant: 'single' });
      const sig = q(f, '[data-sv-overlay]')?.getAttribute('data-sv-signature') ?? '';
      expect(f.componentInstance.checkIntegrity(sig)).toBe(true);
      edit(marks(f)[0]);
      expect(f.componentInstance.checkIntegrity(sig)).toBe(false);
    }
  });

  it('reports an overlay shrunk away with a transform', async () => {
    const { f, sig } = await captured();
    (q(f, '[data-sv-overlay]') as HTMLElement).style.transform = 'scale(0)';
    expect(f.componentInstance.checkIntegrity(sig)).toBe(false);
  });

  it('keeps the "deterrence, not security" caveat and adds what a tamper report is not', async () => {
    const f = await mark({ variant: 'inspect' });
    const caveat = q(f, '[data-sv-inspect-caveat]')?.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(caveat).toContain('not a security control');
    expect(caveat).toContain('not a compliance control');
  });
});

// ── I2 / M3 — privacy-safe marks ────────────────────────────────────────────

describe('svViewerToken (LU-12-I2/M3)', () => {
  it('is stable, short and opaque', () => {
    const t = svViewerToken('jane.doe@acme.com');
    expect(svViewerToken('jane.doe@acme.com')).toBe(t);
    expect(t).toMatch(/^[0-9a-z]{7}$/);
    expect(t).not.toContain('jane');
  });

  it('differs per id and per salt', () => {
    expect(svViewerToken('u-1')).not.toBe(svViewerToken('u-2'));
    expect(svViewerToken('u-1', 'deploy-a')).not.toBe(svViewerToken('u-1', 'deploy-b'));
    expect(svViewerToken(42)).toBe(svViewerToken('42'));
  });

  it('recognises email-shaped text, and not ordinary marks', () => {
    expect(svLooksLikeEmail('Viewed by jane.doe@acme.com')).toBe(true);
    expect(svLooksLikeEmail('Confidential')).toBe(false);
    expect(svLooksLikeEmail('@handle')).toBe(false);
  });
});

describe('SvWatermarkComponent — viewerId (LU-12-I2/M3)', () => {
  it('warns once, without the id, when viewerId has no salt', async () => {
    svResetWarnOnce();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await mark({ text: 'Internal', viewerId: 1041 });
    const ours = warn.mock.calls.filter(([m]) => String(m).includes('without [viewerSalt]'));
    expect(ours).toHaveLength(1);
    expect(String(ours[0][0])).not.toContain('1041');
  });

  it('does not warn when a salt is bound', async () => {
    svResetWarnOnce();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await mark({ text: 'Internal', viewerId: 1041, viewerSalt: 'acme-prod' });
    expect(warn.mock.calls.filter(([m]) => String(m).includes('without [viewerSalt]'))).toHaveLength(0);
  });

  it('draws the token, never the raw id, in every mark, the label and the signature', async () => {
    const f = await mark({ text: 'Confidential', viewerId: 'jane.doe@acme.com', viewerSalt: 's1', observeResize: false });
    const box = q(f, '[data-sv-watermark]') as HTMLElement;
    box.getBoundingClientRect = () => rect(600, 400);
    f.componentInstance.measure();
    f.detectChanges();

    const token = svViewerToken('jane.doe@acme.com', 's1');
    expect(marks(f).length).toBeGreaterThan(1);
    for (const m of marks(f)) expect(m.textContent).toBe(`Confidential · ${token}`);
    expect(f.nativeElement.innerHTML).not.toContain('jane');
    expect(q(f, '[data-sv-overlay]')?.getAttribute('data-sv-signature')).toContain(token);
  });

  it('leaves the mark untouched when no viewer id is bound', async () => {
    const f = await mark({ text: 'Confidential' });
    expect(f.componentInstance.markText()).toBe('Confidential');
    expect(f.componentInstance.viewerToken()).toBeNull();
  });

  it('warns once in dev mode when the mark looks like an email address', async () => {
    svResetWarnOnce();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await mark({ text: 'Viewed by jane.doe@acme.com' });
    await mark({ text: 'Viewed by jane.doe@acme.com' });
    const hits = warn.mock.calls.filter((c) => String(c[0]).includes('email address'));
    expect(hits).toHaveLength(1);

    warn.mockClear();
    await mark({ text: 'Confidential', viewerId: 'jane.doe@acme.com' });
    expect(warn.mock.calls.some((c) => String(c[0]).includes('email address'))).toBe(false);
  });

  it('redacts the address: never logged, and keyed by a constant rather than the value', async () => {
    svResetWarnOnce();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await mark({ text: 'Viewed by jane.doe@acme.com' });
      // A DIFFERENT address: a value-derived key would warn again (and retain it).
      await mark({ text: 'Viewed by john.roe@example.org' });
      const hits = warn.mock.calls.filter((c) => String(c[0]).includes('email address'));
      expect(hits).toHaveLength(1);
      expect(String(hits[0][0])).toContain('redacted');
      const logged = warn.mock.calls.flat().map(String).join('\n');
      expect(logged).not.toContain('jane');
      expect(logged).not.toContain('acme.com');
      expect(logged).not.toContain('john.roe');
      expect(logged).not.toContain('@');
    } finally {
      warn.mockRestore();
    }
  });
});

// ── I3 / M2 — resize and font loading ───────────────────────────────────────

/** A controllable ResizeObserver, installed as the global `svElementSize` reaches for. */
function fakeResizeObserver() {
  const created: { callback: ResizeObserverCallback; targets: Element[]; disconnected: boolean }[] = [];
  class FakeRO {
    private readonly rec: (typeof created)[number];
    constructor(callback: ResizeObserverCallback) {
      this.rec = { callback, targets: [], disconnected: false };
      created.push(this.rec);
    }
    observe(el: Element): void { this.rec.targets.push(el); }
    unobserve(): void { /* not used */ }
    disconnect(): void { this.rec.disconnected = true; }
  }
  vi.stubGlobal('ResizeObserver', FakeRO);
  const fire = (width: number, height: number) => {
    for (const rec of created) {
      if (rec.disconnected) continue;
      const entries = rec.targets.map(
        (target) =>
          ({
            target,
            borderBoxSize: [{ inlineSize: width, blockSize: height }],
            contentRect: rect(width, height),
          }) as unknown as ResizeObserverEntry,
      );
      rec.callback(entries, {} as ResizeObserver);
    }
  };
  return { created, fire };
}

describe('SvWatermarkComponent — automatic re-tiling (LU-12-I3/M2)', () => {
  it('tiles on first render without the host calling measure()', async () => {
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return this.hasAttribute('data-sv-watermark') ? rect(600, 400) : rect(0, 0);
    });
    const f = await mark({ angle: 0 });
    f.detectChanges();
    expect(marks(f).length).toBeGreaterThan(1);
    spy.mockRestore();
  });

  it('re-tiles when the observed box resizes, one measurement per frame', async () => {
    const ro = fakeResizeObserver();
    const f = await mark({ angle: 0 });
    expect(ro.created.length).toBe(1);
    expect(ro.created[0].targets[0]).toBe(q(f, '[data-sv-watermark]'));

    ro.fire(300, 200);
    await frame();
    f.detectChanges();
    const small = marks(f).length;
    expect(small).toBeGreaterThan(0);

    ro.fire(1200, 900);
    await frame();
    f.detectChanges();
    expect(marks(f).length).toBeGreaterThan(small);
    expect(f.componentInstance.boxWidth()).toBe(1200);
  });

  it('observes nothing with observeResize off, and disconnects on destroy', async () => {
    const ro = fakeResizeObserver();
    await mark({ observeResize: false });
    expect(ro.created.length).toBe(0);

    const f = await mark();
    expect(ro.created.length).toBe(1);
    f.destroy();
    expect(ro.created[0].disconnected).toBe(true);
  });
});

describe('SvWatermarkComponent — font loading (LU-12-I3)', () => {
  function fakeFonts() {
    const listeners = new Set<() => void>();
    let resolveReady: () => void = () => undefined;
    const ready = new Promise<void>((r) => (resolveReady = r));
    const fonts = {
      ready,
      addEventListener: (type: string, fn: () => void) => type === 'loadingdone' && listeners.add(fn),
      removeEventListener: (type: string, fn: () => void) => type === 'loadingdone' && listeners.delete(fn),
    };
    Object.defineProperty(document, 'fonts', { configurable: true, value: fonts });
    return { listeners, resolveReady };
  }

  afterEach(() => {
    Reflect.deleteProperty(document, 'fonts');
  });

  it('replaces the width estimate with the measured mark once fonts are ready', async () => {
    const fonts = fakeFonts();
    let probeWidth = 0;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.hasAttribute('data-sv-probe')) return rect(probeWidth, 20);
      return this.hasAttribute('data-sv-watermark') ? rect(800, 600) : rect(0, 0);
    });
    const f = await mark({ text: 'Confidential', fontSize: 14, angle: 0 });
    const estimate = f.componentInstance.textWidth();
    expect(estimate).toBeCloseTo('Confidential'.length * 14 * 0.58);

    probeWidth = 200; // the web font arrived and is wider than the estimate
    fonts.resolveReady();
    await Promise.resolve();
    await Promise.resolve();
    f.detectChanges();
    expect(f.componentInstance.textWidth()).toBe(200);
    expect(f.componentInstance.tile().width).toBe(200 + 80);
  });

  it('re-measures on a later loadingdone, and stops listening on destroy', async () => {
    const fonts = fakeFonts();
    const f = await mark();
    expect(fonts.listeners.size).toBe(1);
    const measure = vi.spyOn(f.componentInstance, 'measure');
    for (const fn of fonts.listeners) fn();
    expect(measure).toHaveBeenCalledTimes(1);
    f.destroy();
    expect(fonts.listeners.size).toBe(0);
  });

  it('is a no-op where there is no document.fonts (SSR, old engines)', async () => {
    const f = await mark();
    expect(f.componentInstance.markCount()).toBe(0);
  });
});
