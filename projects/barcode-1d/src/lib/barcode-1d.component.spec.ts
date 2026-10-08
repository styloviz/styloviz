import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvBarcode1dComponent } from './barcode-1d.component';
import { svEncode } from './barcode-1d.encode';

/**
 * `sv-barcode-1d`, through the component.
 *
 * The encoding arithmetic has its own spec in `barcode-1d.encode.spec.ts`. This
 * file is about what reaches the DOM, and about the three things a barcode
 * renderer normally gets wrong: drawing something for an input it cannot encode,
 * dropping the quiet zone, and letting a module land on a fraction of a pixel.
 */

async function code(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvBarcode1dComponent, { inputs });
  fixture.detectChanges();
  return fixture;
}

afterEach(() => TestBed.resetTestingModule());

const q = (f: { nativeElement: HTMLElement }, sel: string) => f.nativeElement.querySelector(sel);
const all = (f: { nativeElement: HTMLElement }, sel: string) =>
  Array.from(f.nativeElement.querySelectorAll<Element>(sel));
const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

// ── Shells ──────────────────────────────────────────────────────────────────

describe('SvBarcode1dComponent — shells', () => {
  it('shows the skeleton while loading', async () => {
    const f = await code({ loading: true, value: 'HELLO' });
    expect(q(f, '[data-sv-state="loading"]')).toBeTruthy();
    expect(q(f, '[data-sv-barcode]')).toBeNull();
  });

  it('shows the error shell over the symbol', async () => {
    const f = await code({ error: 'label service unreachable', value: 'HELLO' });
    expect(q(f, '[data-sv-state="error"]')).toBeTruthy();
  });
});

// ── Refusal ─────────────────────────────────────────────────────────────────

describe('SvBarcode1dComponent — what it refuses to draw', () => {
  /**
   * ★★★ A COMPONENT THAT RENDERS SOMETHING FOR EVERY INPUT SHIPS AN UNSCANNABLE
   * LABEL TO A WAREHOUSE.
   */
  it('draws nothing and says why for a short EAN', async () => {
    const f = await code({ value: '123', symbology: 'ean13' });
    expect(q(f, '[data-sv-svg]')).toBeNull();
    expect(text(q(f, '[data-sv-refused]'))).toContain('needs 12 digits');
  });

  it('refuses a wrong check digit and names what it should have been', async () => {
    const f = await code({ value: '5901234123458', symbology: 'ean13' });
    const why = text(q(f, '[data-sv-refused]'));
    expect(why).toContain('checks to 7');
    expect(why).toContain('different article number');
  });

  it('emits the reason so a host can log it', async () => {
    TestBed.resetTestingModule();
    const errors: string[] = [];
    const { fixture } = await render(SvBarcode1dComponent, {
      inputs: { value: '123', symbology: 'ean13' },
      on: { encodeError: (e: string) => errors.push(e) },
    });
    fixture.detectChanges();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('needs 12 digits');
  });

  it('says so in the accessible name too, rather than announcing a barcode', async () => {
    const f = await code({ value: '123', symbology: 'ean13', variant: 'inspect' });
    expect(text(q(f, '[data-sv-inspect-encoding]'))).toBe('EAN-13 · cannot encode');
  });

  it('draws the symbol once the value is encodable', async () => {
    const f = await code({ value: '590123412345', symbology: 'ean13' });
    expect(q(f, '[data-sv-refused]')).toBeNull();
    expect(q(f, '[data-sv-svg]')).toBeTruthy();
  });
});

// ── The drawn symbol ────────────────────────────────────────────────────────

describe('SvBarcode1dComponent — the drawn symbol', () => {
  it('draws one rect per bar and none per space', async () => {
    const e = svEncode('590123412345', 'ean13');
    const f = await code({ value: '590123412345', symbology: 'ean13' });
    expect(all(f, '[data-sv-bar]')).toHaveLength(e.modules.filter((m) => m.bar).length);
  });

  /**
   * ★★★ THE QUIET ZONE IS PART OF THE SYMBOL. The first bar starts a full quiet
   * zone in from the left edge, and the drawn width accounts for both margins —
   * flush against a border, a perfect set of bars stops scanning.
   */
  it('offsets the first bar by the full left quiet zone', async () => {
    const f = await code({ value: '590123412345', symbology: 'ean13', requestedModuleWidth: 2 });
    const first = all(f, '[data-sv-bar]')[0];
    expect(Number(first.getAttribute('x'))).toBe(11 * 2);
  });

  it('sizes the canvas to include both quiet zones', async () => {
    const f = await code({ value: '590123412345', symbology: 'ean13', requestedModuleWidth: 2 });
    expect(Number(q(f, '[data-sv-svg]')!.getAttribute('width'))).toBe((11 + 95 + 7) * 2);
  });

  it('uses the asymmetric EAN margins, not one number for both', async () => {
    const f = await code({ value: '590123412345', symbology: 'ean13', requestedModuleWidth: 1 });
    const bars = all(f, '[data-sv-bar]');
    const last = bars[bars.length - 1];
    const rightEdge = Number(last.getAttribute('x')) + Number(last.getAttribute('width'));
    expect(Number(q(f, '[data-sv-svg]')!.getAttribute('width')) - rightEdge).toBe(7);
  });

  it('paints on a white background, because a barcode on a tint does not scan', async () => {
    const f = await code({ value: 'HELLO' });
    expect(q(f, '[data-sv-background]')!.getAttribute('fill')).toBe('#ffffff');
  });

  it('renders bars with crisp edges rather than letting them antialias', async () => {
    const f = await code({ value: 'HELLO' });
    expect(all(f, '[data-sv-bar]')[0].getAttribute('shape-rendering')).toBe('crispEdges');
  });

  /**
   * ★★ THE LONG GUARDS ARE HOW A HUMAN RECOGNISES AN EAN. Every bar the same
   * height still scans and no operator recognises it.
   */
  it('extends the guard bars below the others on an EAN', async () => {
    const f = await code({ value: '590123412345', symbology: 'ean13', barHeight: 60 });
    const guards = all(f, '[data-sv-guard="true"]');
    const normal = all(f, '[data-sv-guard="false"]');

    expect(guards.length).toBeGreaterThan(0);
    expect(Number(guards[0].getAttribute('height')))
      .toBeGreaterThan(Number(normal[0].getAttribute('height')));
  });

  it('has no extended guards on Code 128, which has no such thing', async () => {
    const f = await code({ value: 'HELLO', symbology: 'code128' });
    expect(all(f, '[data-sv-guard="true"]')).toHaveLength(0);
  });
});

// ── Module width ────────────────────────────────────────────────────────────

describe('SvBarcode1dComponent — module width', () => {
  /**
   * ★★★ A SUB-PIXEL MODULE IS AN UNSCANNABLE BARCODE THAT LOOKS FINE.
   */
  it('snaps a fractional request to whole device pixels', async () => {
    const f = await code({ value: 'HELLO', requestedModuleWidth: 1.7, variant: 'inspect' });
    expect(text(q(f, '[data-sv-inspect-width]'))).toContain('2px');
  });

  it('says that it adjusted, and why', async () => {
    const f = await code({ value: 'HELLO', requestedModuleWidth: 1.7, variant: 'inspect' });
    const note = text(q(f, '[data-sv-inspect-snapped]'));
    expect(note).toContain('snapped from 1.7px');
    expect(note).toContain('antialiases');
  });

  it('says nothing when the request was already achievable', async () => {
    const f = await code({ value: 'HELLO', requestedModuleWidth: 2, variant: 'inspect' });
    expect(q(f, '[data-sv-inspect-snapped]')).toBeNull();
  });

  it('snaps in device pixels on a retina screen', async () => {
    const f = await code({
      value: 'HELLO', requestedModuleWidth: 1.7, devicePixelRatio: 2, variant: 'inspect',
    });
    expect(text(q(f, '[data-sv-inspect-width]'))).toContain('1.5px');
  });
});

// ── Text and accessibility ──────────────────────────────────────────────────

describe('SvBarcode1dComponent — the human-readable text', () => {
  it('prints the encoded text including the check digit it appended', async () => {
    const f = await code({ value: '590123412345', symbology: 'ean13' });
    expect(text(q(f, '[data-sv-text]'))).toBe('5901234123457');
  });

  it('omits the text in the bare variant', async () => {
    const f = await code({ value: '590123412345', symbology: 'ean13', variant: 'bare' });
    expect(q(f, '[data-sv-text]')).toBeNull();
  });

  it('is shorter without the text, so the bare variant is not just the text hidden', async () => {
    const a = await code({ value: 'HELLO', variant: 'labelled', barHeight: 50 });
    const b = await code({ value: 'HELLO', variant: 'bare', barHeight: 50 });
    expect(Number(q(b, '[data-sv-svg]')!.getAttribute('height')))
      .toBeLessThan(Number(q(a, '[data-sv-svg]')!.getAttribute('height')));
  });

  /**
   * ★★★ THE ACCESSIBLE NAME IS THE ENCODED TEXT, NOT "barcode". A screen-reader
   * user cannot scan the symbol, and the whole content of this graphic is the
   * string inside it.
   */
  it('names the symbology and the encoded number', async () => {
    const f = await code({ value: '590123412345', symbology: 'ean13' });
    expect(q(f, '[data-sv-svg]')!.getAttribute('aria-label')).toBe('EAN-13 barcode: 5901234123457');
  });

  it('names Code 128 and its payload', async () => {
    const f = await code({ value: 'SKU-4821', symbology: 'code128' });
    expect(q(f, '[data-sv-svg]')!.getAttribute('aria-label')).toBe('Code 128 barcode: SKU-4821');
  });
});

// ── The inspect variant ─────────────────────────────────────────────────────

describe('SvBarcode1dComponent — the inspect variant', () => {
  it('reports the symbology, the text and the check', async () => {
    const f = await code({ value: '590123412345', symbology: 'ean13', variant: 'inspect' });
    expect(text(q(f, '[data-sv-inspect-encoding]'))).toBe('EAN-13 · 5901234123457 · check 7');
  });

  it('reports the module count and both quiet zones separately', async () => {
    const f = await code({ value: '590123412345', symbology: 'ean13', variant: 'inspect' });
    expect(text(q(f, '[data-sv-inspect-modules]'))).toBe('95 + 11/7 quiet');
  });

  /**
   * ★★ SUBSET C HALVES A NUMERIC PAYLOAD, and the report says so — because the
   * usual symptom of an encoder that never switches is a label that will not fit
   * and an operator shrinking the module width until it stops scanning.
   */
  it('reports what subset C saved on a numeric payload', async () => {
    const f = await code({ value: '01234567890123456789', variant: 'inspect' });
    const s = text(q(f, '[data-sv-inspect-savings]'));
    expect(s).toContain('subset B alone would need 21');
    expect(s.startsWith('11')).toBe(true);
  });

  it('says nothing about savings when there were none to make', async () => {
    const f = await code({ value: 'ABCDEF', variant: 'inspect' });
    expect(text(q(f, '[data-sv-inspect-savings]'))).toBe('7');
  });

  it('reports nothing about subset C for an EAN, which has no subsets', async () => {
    const f = await code({ value: '590123412345', symbology: 'ean13', variant: 'inspect' });
    expect(q(f, '[data-sv-inspect-savings]')).toBeNull();
  });

  it('does not draw the report outside the inspect variant', async () => {
    const f = await code({ value: 'HELLO', variant: 'labelled' });
    expect(q(f, '[data-sv-inspect]')).toBeNull();
  });

  /**
   * ★★ THE QUIET ZONE IS INVISIBLE BY NATURE, which is exactly why people lay a
   * barcode flush against a border and cannot see what broke it.
   */
  it('can outline where the symbol ends and the margin begins', async () => {
    const f = await code({ value: 'HELLO', showQuietZone: true, requestedModuleWidth: 2 });
    const outline = q(f, '[data-sv-quiet-outline]')!;
    expect(Number(outline.getAttribute('x'))).toBe(10 * 2);
  });

  it('does not draw the outline unless asked', async () => {
    const f = await code({ value: 'HELLO' });
    expect(q(f, '[data-sv-quiet-outline]')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('SvBarcode1dComponent — physical size and print', () => {
  it('warns in place when the module falls under the scannable floor', async () => {
    const { fixture } = await render(SvBarcode1dComponent, {
      inputs: {
        value: '4006381333931', symbology: 'ean13',
        requestedModuleWidth: 0.5, devicePixelRatio: 2,
      },
    });
    const el = fixture.nativeElement as HTMLElement;

    // ★ The only failure that survives every arithmetic check: bars in perfect
    // proportion, too small to read. Said here rather than in a warehouse.
    expect(el.querySelector('[data-sv-scan-warning]')).not.toBeNull();
    expect(el.textContent).toContain('may not scan');
  });

  it('is reachable only because a finer device grid allows a smaller module', async () => {
    // ★★ THE PIXEL-SNAP WAS PROTECTING THIS BY ACCIDENT AND STOPS ON RETINA.
    //    `svSnapModuleWidth` floors at ONE DEVICE pixel — which at dpr 1 is
    //    1 CSS px, or 0.2646 mm: a hair above EAN's 0.264 mm floor. At dpr 2 the
    //    same floor is half a CSS pixel, 0.132 mm, and well under it. A finer
    //    screen lets the symbol get physically smaller, so the better display is
    //    the one that produces the unscannable label.
    const one = await render(SvBarcode1dComponent, {
      inputs: { value: '4006381333931', symbology: 'ean13', requestedModuleWidth: 0.1 },
    });
    expect(one.fixture.componentInstance.moduleWidth()).toBe(1);
    expect(one.fixture.componentInstance.scanSize().belowMinimum).toBe(false);

    TestBed.resetTestingModule();
    const two = await render(SvBarcode1dComponent, {
      inputs: {
        value: '4006381333931', symbology: 'ean13',
        requestedModuleWidth: 0.1, devicePixelRatio: 2,
      },
    });
    expect(two.fixture.componentInstance.moduleWidth()).toBe(0.5);
    expect(two.fixture.componentInstance.scanSize().belowMinimum).toBe(true);
  });

  it('says nothing when the size is fine', async () => {
    const { fixture } = await render(SvBarcode1dComponent, {
      inputs: { value: '4006381333931', symbology: 'ean13', requestedModuleWidth: 2 },
    });
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-sv-scan-warning]')).toBeNull();
  });

  it('emits the measurements so a label pipeline can refuse the job', async () => {
    const seen: { xMm: number; belowMinimum: boolean }[] = [];
    // Starts at a size that is fine, so the emission under test is the
    // transition into trouble rather than the first render.
    const { fixture } = await render(SvBarcode1dComponent, {
      inputs: { value: '4006381333931', symbology: 'ean13', requestedModuleWidth: 2 },
    });
    fixture.componentInstance.scanSizeWarning.subscribe((s) => seen.push(s));
    expect(seen).toHaveLength(0);

    fixture.componentRef.setInput('devicePixelRatio', 2);
    fixture.componentRef.setInput('requestedModuleWidth', 0.5);
    fixture.detectChanges();

    expect(seen).toHaveLength(1);
    expect(seen[0].belowMinimum).toBe(true);
  });

  it('pins the printed width in millimetres, not pixels', async () => {
    const { fixture } = await render(SvBarcode1dComponent, {
      inputs: { value: '4006381333931', symbology: 'ean13', printModuleWidthMm: 0.33 },
    });
    const el = fixture.nativeElement as HTMLElement;
    const wrapper = el.querySelector('[data-sv-barcode]') as HTMLElement;

    // ★ CSS pixels do not survive a print dialog's "fit to page"; the
    // X-dimension is what a scanner measures, so it is stated in mm.
    expect(wrapper.style.getPropertyValue('--sv-bc-print-width')).toMatch(/mm$/);
    expect(fixture.componentInstance.scanSize().xMm).toBe(0.33);
    expect(fixture.componentInstance.scanSize().magnification).toBe(100);
  });

  it('leaves the printed width alone when the host has not pinned one', async () => {
    const { fixture } = await render(SvBarcode1dComponent, {
      inputs: { value: '4006381333931', symbology: 'ean13' },
    });
    const wrapper = (fixture.nativeElement as HTMLElement)
      .querySelector('[data-sv-barcode]') as HTMLElement;
    expect(wrapper.style.getPropertyValue('--sv-bc-print-width')).toBe('');
  });

  it('reports the paper measurements in the inspect view', async () => {
    const { fixture } = await render(SvBarcode1dComponent, {
      inputs: { value: '4006381333931', symbology: 'ean13', variant: 'inspect' },
    });
    const row = (fixture.nativeElement as HTMLElement)
      .querySelector('[data-sv-inspect-physical]')!;
    expect(row.textContent).toContain('mm/module');
    expect(row.textContent).toContain('%');
  });

  it('keeps the print stylesheet with the component that needs it', async () => {
    await render(SvBarcode1dComponent, { inputs: { value: 'ABC' } });
    const css = Array.from(document.styleSheets)
      .flatMap((sheet) => {
        try { return Array.from(sheet.cssRules).map((r) => r.cssText); } catch { return []; }
      })
      .join('\n');

    // Three ways a print path destroys a correct symbol: stripped backgrounds
    // (the white is half the contrast a scanner measures), rescaling (which
    // changes the X-dimension), and a page break through the middle of it.
    expect(css).toContain('@media print');
    expect(css).toMatch(/print-color-adjust:\s*exact/);
    expect(css).toMatch(/break-inside:\s*avoid/);
    expect(css).toContain('--sv-bc-print-width');
  });

  it('makes the host a block box in print, so break-inside actually applies', async () => {
    await render(SvBarcode1dComponent, { inputs: { value: 'ABC' } });
    const printRules = Array.from(document.styleSheets)
      .flatMap((sheet) => {
        try { return Array.from(sheet.cssRules); } catch { return []; }
      })
      .filter((r): r is CSSMediaRule => r instanceof CSSMediaRule && r.conditionText.includes('print'))
      .flatMap((m) => Array.from(m.cssRules).map((r) => r.cssText));
    // ★ A custom element is inline by default and break-inside is ignored on
    //   an inline box — the page-break rule was a no-op without this.
    const hostRule = printRules.find((t) => /break-inside:\s*avoid/.test(t));
    expect(hostRule).toBeDefined();
    expect(hostRule).toMatch(/display:\s*block/);
  });
});
