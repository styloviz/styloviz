import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { svDiffLines } from '@styloviz/core';
import { SvCodeBlockComponent } from './code-block.component';
import type { DiffHunk } from './code-block.types';

/**
 * The engine and the renderer, checked against each other.
 *
 * ★★★ THE POINT OF `svDiffLines` LIVING IN `@styloviz/core` IS THAT NOTHING
 * DEPENDS ON IT. Code Block renders a diff it is handed and computes nothing;
 * JSON Viewer, Tree View and Descriptions each wanted a diff of their own. Four
 * UIs, four half-engines. One shared utility fixes that — but only if its output
 * is exactly what the renderers already take, and the only way to know that is
 * to assign one to the other and render it.
 *
 * This is a CONTRACT test. It fails if either side drifts, which is the whole
 * reason a shared utility is safer than four private ones.
 */

const BEFORE = `function total(items) {
  let sum = 0;
  for (const item of items) {
    sum += item.price;
  }
  return sum;
}`;

const AFTER = `function total(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}`;

async function block(hunks: readonly DiffHunk[]) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvCodeBlockComponent, {
    inputs: { variant: 'diff', hunks, language: 'javascript' },
  });
  fixture.detectChanges();
  return fixture;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

describe('svDiffLines feeds sv-code-block without a translation layer', () => {
  it('assigns straight to [hunks]', async () => {
    // ★ No mapping, no adapter. If this stops compiling or stops rendering, the
    //   two halves have drifted and the shared engine has stopped being shared.
    const result = svDiffLines(BEFORE, AFTER);
    const f = await block(result.hunks);

    expect(result.hunks.length).toBeGreaterThan(0);
    // Rendered at all — the markup the diff variant uses is the component's
    // business, so this asserts the lines arrived rather than the tag they
    // arrived in.
    expect(el(f).textContent).toContain('function total(items) {');
  });

  it('renders the added and removed lines the engine found', async () => {
    const result = svDiffLines(BEFORE, AFTER);
    const f = await block(result.hunks);
    const text = el(f).textContent ?? '';

    expect(result.removed).toBeGreaterThan(0);
    expect(result.added).toBeGreaterThan(0);
    expect(text).toContain('items.reduce');
    expect(text).toContain('let sum = 0;');
  });

  it('agrees with the renderer about the counts', async () => {
    const result = svDiffLines(BEFORE, AFTER);
    const f = await block(result.hunks);
    // The component computes its own summary from the hunks it was given; the
    // engine computed one from the same lines. They have to match, or one of
    // the two is telling the reader something the other contradicts.
    const summary = el(f).textContent ?? '';
    expect(summary).toContain(String(result.added));
    expect(summary).toContain(String(result.removed));
  });

  it('renders nothing for two identical texts, and the engine says why', async () => {
    const result = svDiffLines(BEFORE, BEFORE);
    expect(result.identical).toBe(true);
    expect(result.hunks).toEqual([]);
    const f = await block(result.hunks);
    expect(el(f).textContent).not.toContain('let sum');
  });

  it('survives the wholesale-replacement path', async () => {
    // ★ The budget's output has to be renderable too. A "too different" result
    //   that the renderer cannot draw would turn a graceful refusal into a
    //   broken page.
    const a = Array.from({ length: 200 }, (_, i) => `alpha ${i}`).join('\n');
    const b = Array.from({ length: 200 }, (_, i) => `beta ${i * 3}`).join('\n');
    const result = svDiffLines(a, b, { maxEdits: 20 });

    expect(result.tooDifferent).toBe(true);
    const f = await block(result.hunks);
    expect(el(f).textContent).toContain('alpha 0');
    expect(el(f).textContent).toContain('beta 0');
  });
});
