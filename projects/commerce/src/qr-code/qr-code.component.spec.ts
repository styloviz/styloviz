import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import { beforeEach, vi } from 'vitest';
import { SvQrCodeComponent } from './qr-code.component';

/**
 * The code is drawn to a canvas, so nothing about it is inspectable from the
 * DOM — which is exactly why the interesting case is the one where it draws
 * NOTHING. Rendering used to bail out before clearing, so a component whose
 * value was cleared went on displaying the previous code: still crisp, still
 * scannable, and pointing at something that no longer existed.
 */

interface Recorded {
  clears: number;
  fills: number;
  lastFillStyle: string;
}

let recorded: Recorded;

beforeEach(() => {
  recorded = { clears: 0, fills: 0, lastFillStyle: '' };
  const ctx = {
    scale: vi.fn(),
    clearRect: vi.fn(() => { recorded.clears += 1; }),
    fillRect: vi.fn(() => { recorded.fills += 1; }),
    drawImage: vi.fn(),
    set fillStyle(v: string) { recorded.lastFillStyle = v; },
    get fillStyle() { return recorded.lastFillStyle; },
  };
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn(() => ctx),
    configurable: true,
  });
});

async function setup(inputs: Partial<ComponentInput<SvQrCodeComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvQrCodeComponent, {
    inputs: inputs as ComponentInput<SvQrCodeComponent>,
  });
}

const canvas = (f: { nativeElement: unknown }) =>
  (f.nativeElement as HTMLElement).querySelector('canvas')!;

describe('SvQrCodeComponent — drawing', () => {
  it('draws modules for a value', async () => {
    const { fixture } = await setup({ value: 'https://example.test' });
    expect(canvas(fixture)).toBeTruthy();
    expect(recorded.fills).toBeGreaterThan(10);
  });

  it('clears the canvas rather than leaving the last code up', async () => {
    // The whole point: a code for a value that no longer exists is still
    // scannable, and points somewhere the user did not ask to go.
    const { fixture } = await setup({ value: 'https://example.test' });
    const drawnFirst = recorded.fills;
    expect(drawnFirst).toBeGreaterThan(10);

    recorded.fills = 0;
    recorded.clears = 0;
    fixture.componentRef.setInput('value', '');
    fixture.detectChanges();

    expect(recorded.clears).toBeGreaterThan(0);
    expect(recorded.fills).toBe(0);
  });

  it('redraws when the value changes', async () => {
    const { fixture } = await setup({ value: 'one' });
    recorded.fills = 0;
    fixture.componentRef.setInput('value', 'a completely different value');
    fixture.detectChanges();
    expect(recorded.fills).toBeGreaterThan(10);
  });

  it('redraws when only the look changes', async () => {
    const { fixture } = await setup({ value: 'one' });
    recorded.fills = 0;
    fixture.componentRef.setInput('foreground', '#ff0000');
    fixture.detectChanges();
    expect(recorded.fills).toBeGreaterThan(10);
    expect(recorded.lastFillStyle).toBe('#ff0000');
  });

  it('skips the background fill when asked for a transparent one', async () => {
    const { fixture } = await setup({ value: 'one', background: 'transparent' });
    expect(recorded.lastFillStyle).toBe('#000000');
    expect(canvas(fixture)).toBeTruthy();
  });

  it('sizes the canvas for the display, and for the device pixel ratio', async () => {
    const { fixture } = await setup({ value: 'one', size: 240 });
    const c = canvas(fixture);
    expect(c.style.width).toBe('240px');
    expect(c.style.height).toBe('240px');
    expect(c.width).toBeGreaterThanOrEqual(240);
  });

  it.each(['L', 'M', 'Q', 'H'] as const)('encodes at correction level %s', async (errorCorrection) => {
    recorded.fills = 0;
    await setup({ value: 'https://example.test/a-reasonably-long-url', errorCorrection });
    expect(recorded.fills).toBeGreaterThan(10);
  });
});

describe('SvQrCodeComponent — what it announces', () => {
  it('is an image that says what it encodes', async () => {
    await setup({ value: 'https://example.test' });
    expect(screen.getByRole('img', { name: 'QR code for: https://example.test' })).toBeTruthy();
  });

  it('does not claim to encode something when it encodes nothing', async () => {
    await setup({ value: '' });
    expect(screen.getByRole('img', { name: 'QR code: no value' })).toBeTruthy();
  });

  it('defers to a human label for an opaque value', async () => {
    await setup({ value: 'lnbc1p3k...opaque', ariaLabel: 'Scan to pay' });
    expect(screen.getByRole('img', { name: 'Scan to pay' })).toBeTruthy();
  });
});

describe('SvQrCodeComponent — exporting', () => {
  it('downloads a PNG under the name it was given', async () => {
    const { fixture } = await setup({ value: 'one' });
    const c = canvas(fixture);
    c.toDataURL = vi.fn(() => 'data:image/png;base64,AAA');

    const clicks: HTMLAnchorElement[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const node = realCreate(tag) as HTMLElement;
      if (tag === 'a') {
        node.click = () => { clicks.push(node as HTMLAnchorElement); };
      }
      return node;
    });

    fixture.componentInstance.download('ticket.png');
    expect(clicks.length).toBe(1);
    expect(clicks[0].download).toBe('ticket.png');
    expect(clicks[0].href).toContain('data:image/png');
    vi.restoreAllMocks();
  });
});

/**
 * A code that renders is not the same as a code that scans.
 *
 * ★★★ THIS IS THE ONLY COMPONENT IN THE KIT WHOSE OUTPUT IS READ BY A MACHINE.
 *     A human glancing at pale grey on white with a big logo sees a QR code; a
 *     scanner sees nothing. The component used to render it and say nothing —
 *     the same class of failure as a chart clamping a negative into a plausible
 *     bar.
 */
describe('SvQrCodeComponent — scannability', () => {
  async function mount(inputs: Record<string, unknown>) {
    TestBed.resetTestingModule();
    const r = await render(SvQrCodeComponent, { inputs: inputs as never });
    return {
      ...r,
      c: r.fixture.componentInstance as unknown as {
        warnings: () => readonly { kind: string; message: string }[];
        overCapacity: () => boolean;
        payloadFill: () => number;
        payloadLabel: () => string;
      },
      host: r.fixture.nativeElement as HTMLElement,
    };
  }

  const kinds = async (inputs: Record<string, unknown>) =>
    (await mount({ value: 'https://example.com', ...inputs })).c.warnings().map(w => w.kind);

  it('says nothing about a code that is fine', async () => {
    const { c, host } = await mount({ value: 'https://example.com' });
    expect(c.warnings()).toEqual([]);
    expect(host.querySelector('[data-sv-notice]')).toBeNull();
  });

  it('defaults the quiet zone to the four modules the specification requires', async () => {
    // ★ It was 2, which is not a smaller margin but a code a scanner may not be
    //   able to find the edges of.
    expect(await kinds({})).not.toContain('quiet-zone');
    expect(await kinds({ quietZone: 2 })).toContain('quiet-zone');
  });

  it('warns about a contrast a camera cannot separate', async () => {
    expect(await kinds({ foreground: '#cccccc' })).toContain('contrast');
  });

  it('warns about an inverted code even though its contrast is fine', async () => {
    // ★ White on black is 21:1 and still fails on scanners that assume dark on
    //   light. Folding it into the contrast check would hide it entirely.
    const out = await kinds({ foreground: '#ffffff', background: '#000000' });
    expect(out).toContain('inverted');
    expect(out).not.toContain('contrast');
  });

  it('warns when a logo eats more than the correction level can recover', async () => {
    // 80px on 200px is 16% of the AREA; L recovers 7%.
    expect(await kinds({ logo: '/x.png', logoSize: 80, size: 200, errorCorrection: 'L' }))
      .toContain('logo');
  });

  it('accepts the same logo at a level that can carry it', async () => {
    // ★ The same 16%, against H's 30% budget. Coverage is by area, not by edge
    //   length — which is why a logo "half the width" is a quarter of the code
    //   and a logo 60% of the width is more than a third of it.
    expect(await kinds({ logo: '/x.png', logoSize: 80, size: 200, errorCorrection: 'H' }))
      .not.toContain('logo');
  });

  it('ignores logoSize when there is no logo', async () => {
    expect(await kinds({ logoSize: 180, size: 200 })).not.toContain('logo');
  });

  it('renders the warnings where a developer will see them', async () => {
    const { host } = await mount({ value: 'x', quietZone: 0, foreground: '#ddd' });
    const notice = host.querySelector('[data-sv-notice]');
    expect(notice).not.toBeNull();
    expect(notice!.querySelectorAll('li').length).toBeGreaterThanOrEqual(2);
  });
});

/**
 * The one failure that refuses to draw.
 *
 * ★★★ EXCEEDING CAPACITY DOES NOT FAIL. The encoder slices the byte array to
 *     capacity, so an over-long payload produces a code that scans perfectly and
 *     returns truncated data — and a truncated URL is still a URL. Every other
 *     warning lowers the odds of a scan; this one guarantees the wrong answer.
 */
describe('SvQrCodeComponent — a payload that will not fit', () => {
  async function mount(inputs: Record<string, unknown>) {
    TestBed.resetTestingModule();
    const r = await render(SvQrCodeComponent, { inputs: inputs as never });
    return {
      ...r,
      c: r.fixture.componentInstance as unknown as {
        overCapacity: () => boolean;
        payloadFill: () => number;
        payloadLabel: () => string;
      },
      host: r.fixture.nativeElement as HTMLElement,
    };
  }

  const long = 'x'.repeat(5000);

  it('accepts a payload that fits', async () => {
    const { c } = await mount({ value: 'https://example.com/a/b/c' });
    expect(c.overCapacity()).toBe(false);
  });

  it('refuses one that does not', async () => {
    const { c } = await mount({ value: long });
    expect(c.overCapacity()).toBe(true);
  });

  it('draws nothing rather than a code with the wrong data in it', async () => {
    const { host } = await mount({ value: long });
    expect(host.querySelector('canvas')).toBeNull();
    expect(host.textContent).toContain('Payload too long');
  });

  it('still names the problem for a screen reader', async () => {
    const { host } = await mount({ value: long });
    const label = host.querySelector('[role="img"]')?.getAttribute('aria-label') ?? '';
    expect(label).toContain('Cannot encode');
    expect(label).toContain('bytes');
  });

  it('reports how full the payload is', async () => {
    const empty = await mount({ value: '' });
    const some = await mount({ value: 'https://example.com' });
    expect(empty.c.payloadFill()).toBe(0);
    expect(some.c.payloadFill()).toBeGreaterThan(0);
    expect(some.c.payloadFill()).toBeLessThan(1);
    expect(some.c.payloadLabel()).toMatch(/\d+ \/ \d+ bytes/);
  });

  it('shrinks the capacity as the correction level rises', async () => {
    // ★ Higher correction means MORE redundancy and therefore LESS room — the
    //   opposite way round to intuition, and the trade a host makes to survive
    //   a logo.
    const atL = await mount({ value: 'x'.repeat(200), errorCorrection: 'L' });
    const atH = await mount({ value: 'x'.repeat(200), errorCorrection: 'H' });
    expect(atH.c.payloadFill()).toBeGreaterThan(atL.c.payloadFill());
  });
});

describe('SvQrCodeComponent — payload meter (DD-28-M2)', () => {
  it('renders no meter by default', async () => {
    const { fixture } = await setup({ value: 'https://example.test' });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('meter')).toBeNull();
  });

  it.each(['L', 'M', 'Q', 'H'] as const)(
    'renders a <meter> of bytes against the %s capacity with its label',
    async (ec) => {
      const { fixture } = await setup({
        value: 'https://example.test',
        errorCorrection: ec,
        showPayloadMeter: true,
      });
      const cmp = fixture.componentInstance;
      const host = fixture.nativeElement as HTMLElement;
      const meter = host.querySelector('meter') as HTMLMeterElement;
      expect(meter).toBeTruthy();
      expect(meter.value).toBe(cmp.payloadBytes());
      expect(meter.getAttribute('max')).toBe(String(cmp.capacityBytes()));
      expect(meter.getAttribute('aria-label')).toBe(`Payload size: ${cmp.payloadLabel()}`);
      expect(host.querySelector('[data-sv-qr-payload]')!.textContent).toContain(cmp.payloadLabel());
    },
  );

  it('still shows the meter when the payload is over capacity', async () => {
    const { fixture } = await setup({ value: 'x'.repeat(4000), showPayloadMeter: true });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('canvas')).toBeNull();
    expect(host.querySelector('meter')).toBeTruthy();
  });
});
