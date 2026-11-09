import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvLineClampComponent } from './line-clamp.component';
import { until } from '../../../../src/testing/async';

/**
 * FL-J3-DD-33 — a web font swapping in changes where the text wraps without
 * resizing the clamped box, so the ResizeObserver never fires. The clamp
 * re-measures on `document.fonts.ready` and on every later `loadingdone`.
 */
class FakeFontSet extends EventTarget {
  private resolve!: () => void;
  readonly ready = new Promise<void>((r) => (this.resolve = r));
  settle(): void { this.resolve(); }
}

const doc = document;
const original = Object.getOwnPropertyDescriptor(doc, 'fonts');
let fonts: FakeFontSet;

beforeEach(() => {
  fonts = new FakeFontSet();
  Object.defineProperty(doc, 'fonts', { configurable: true, value: fonts });
});
afterEach(() => {
  if (original) Object.defineProperty(doc, 'fonts', original);
  else delete (doc as { fonts?: unknown }).fonts;
});

async function setup() {
  TestBed.resetTestingModule();
  const view = await render(`<sv-line-clamp [lines]="2">Some text that wraps differently in the web font</sv-line-clamp>`, {
    imports: [SvLineClampComponent],
  });
  const clamp = view.fixture.debugElement.children[0].componentInstance as SvLineClampComponent;
  const content = clamp.contentRef()!.nativeElement as HTMLElement;
  let full = 40;
  Object.defineProperty(content, 'scrollHeight', { configurable: true, get: () => full });
  Object.defineProperty(content, 'clientHeight', { configurable: true, get: () => 40 });
  await new Promise((r) => setTimeout(r, 0)); // the first, fallback-font measurement
  return { ...view, clamp, grow: (h: number) => (full = h) };
}

describe('SvLineClampComponent — web fonts (DD-23-I3)', () => {
  it('re-measures when the fonts are ready', async () => {
    const v = await setup();
    expect(v.clamp.isClamped()).toBe(false); // the fallback font fitted in two lines
    v.grow(80); // the web font is wider: now it wraps to four
    fonts.settle();
    await until(() => v.clamp.isClamped(), { label: 're-measured after fonts.ready' });
  });

  it('re-measures when a later font finishes loading', async () => {
    const v = await setup();
    fonts.settle();
    await new Promise((r) => setTimeout(r, 0));
    v.grow(80);
    fonts.dispatchEvent(new Event('loadingdone'));
    await until(() => v.clamp.isClamped(), { label: 're-measured after loadingdone' });
  });

  it('stops listening once destroyed', async () => {
    const v = await setup();
    v.fixture.destroy();
    v.grow(80);
    fonts.dispatchEvent(new Event('loadingdone'));
    await new Promise((r) => setTimeout(r, 0));
    expect(v.clamp.isClamped()).toBe(false);
  });
});
