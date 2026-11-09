import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { afterEach, vi } from 'vitest';
import { SvJsonViewerComponent } from './json-viewer.component';
import { binarySummary, classify, isBinary, redactedProjection } from './json-viewer.types';

/**
 * FL-J3-DD-04 — bytes are one leaf. A `Uint8Array` used to be walked as an
 * object (one row per byte) and an `ArrayBuffer` / `Blob` read as `{}`.
 */

async function setup(inputs: ComponentInput<SvJsonViewerComponent> = {}) {
  TestBed.resetTestingModule();
  const view = await render(SvJsonViewerComponent, { inputs });
  view.fixture.detectChanges();
  return view;
}

const rows = () => [...document.querySelectorAll<HTMLElement>('[data-sv-json-row]')];
const rowByKey = (key: string) =>
  rows().find((r) => r.textContent?.replace(/\s+/g, ' ').trim().startsWith(`${key}:`))!;
const valueText = (key: string) => {
  const spans = [...rowByKey(key).querySelectorAll('span')];
  return spans[spans.length - 1].textContent?.trim();
};

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
afterEach(() => {
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else delete (navigator as { clipboard?: unknown }).clipboard;
  vi.restoreAllMocks();
});

describe('json-viewer binary classification', () => {
  it.each([
    ['ArrayBuffer', new ArrayBuffer(8)],
    ['Uint8Array', new Uint8Array(4)],
    ['Float64Array', new Float64Array(2)],
    ['DataView', new DataView(new ArrayBuffer(3))],
    ['Blob', new Blob(['hello'])],
  ])('classifies a %s as binary', (_name, value) => {
    expect(isBinary(value)).toBe(true);
    expect(classify(value)).toBe('binary');
  });

  it('leaves arrays and plain objects alone', () => {
    expect(classify([1, 2])).toBe('array');
    expect(classify({ byteLength: 3 })).toBe('object');
  });

  it('summarises with the type and the byte length, plural-aware', () => {
    const label = '{type} · {n} {count, plural, one {byte} other {bytes}}';
    expect(binarySummary(new Uint8Array(1), label, 'en')).toBe('Uint8Array · 1 byte');
    expect(binarySummary(new Float64Array(128), label, 'en')).toBe('Float64Array · 1,024 bytes');
    expect(binarySummary(new Blob(['hello']), label, 'en')).toBe('Blob · 5 bytes');
  });

  it('projects bytes as their summary in a container copy', () => {
    const out = redactedProjection({ file: new ArrayBuffer(2) }, '', '$', {
      redact: null,
      redactedLabel: '•',
      getterNotReadLabel: 'g',
      getterThrewLabel: 't',
      evaluateGetters: false,
      sortKeys: false,
      binaryLabel: '{type}:{n}',
      locale: 'en',
    });
    expect(out).toEqual({ file: 'ArrayBuffer:2' });
  });
});

describe('SvJsonViewerComponent — binary leaves', () => {
  it('renders a typed array as ONE row, not one row per byte', async () => {
    await setup({ value: { bytes: new Uint8Array(5000) }, expandDepth: 5 });
    expect(rows()).toHaveLength(2); // the root + the leaf
    expect(valueText('bytes')).toBe('Uint8Array · 5,000 bytes');
    expect(rowByKey('bytes').getAttribute('aria-expanded')).toBeNull();
  });

  it('says what an ArrayBuffer and a Blob are instead of "{}"', async () => {
    await setup({ value: { buf: new ArrayBuffer(16), file: new Blob(['abc']) } });
    expect(valueText('buf')).toBe('ArrayBuffer · 16 bytes');
    expect(valueText('file')).toBe('Blob · 3 bytes');
  });

  it('"Copy value" gives the summary, never the bytes', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { fixture } = await setup({ value: { bytes: new Uint8Array([1, 2, 3]) } });
    rowByKey('bytes').click();
    fixture.detectChanges();
    document.querySelector<HTMLElement>('button[aria-label^="Copy value"]')!.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('Uint8Array · 3 bytes');
  });

  it('copies the root container with the bytes summarised', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { fixture } = await setup({ value: { bytes: new Uint8Array(2) } });
    rows()[0].click();
    fixture.detectChanges();
    document.querySelector<HTMLElement>('button[aria-label^="Copy value"]')!.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(JSON.parse(writeText.mock.calls[0][0] as string)).toEqual({ bytes: 'Uint8Array · 2 bytes' });
  });
});
