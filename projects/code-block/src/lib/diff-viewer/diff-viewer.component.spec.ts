import { render, fireEvent } from '@testing-library/angular';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SvDiffViewerComponent } from './diff-viewer.component';

/**
 * sv-diff-viewer, rendered: markers and sr-only words (not colour alone),
 * folding with "Show N unchanged lines", the split layout, word highlights,
 * patches, and the notices that disclose what was not compared.
 */

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

async function setup(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvDiffViewerComponent, { inputs });
  return fixture as ComponentFixture<SvDiffViewerComponent>;
}

const rows = (f: ComponentFixture<unknown>) => [...el(f).querySelectorAll<HTMLElement>('[data-sv-diff-row]')];
const lines = (n: number, p = 'line') => Array.from({ length: n }, (_, i) => `${p} ${i + 1}`);

describe('SvDiffViewerComponent — unified', () => {
  it('marks added and removed lines with a glyph AND a word, never colour alone', async () => {
    const f = await setup({ before: 'a\nold\nc', after: 'a\nnew\nc' });
    const del = rows(f).find((r) => r.dataset['svKind'] === 'del')!;
    const add = rows(f).find((r) => r.dataset['svKind'] === 'add')!;
    expect(del.querySelector('[aria-hidden="true"].font-semibold')?.textContent).toBe('−');
    expect(add.querySelector('[aria-hidden="true"].font-semibold')?.textContent).toBe('+');
    expect(del.querySelector('.sr-only')?.textContent).toBe('Removed:');
    expect(add.querySelector('.sr-only')?.textContent).toBe('Added:');
    // Unchanged lines stay silent.
    const ctx = rows(f).find((r) => r.dataset['svKind'] === 'context')!;
    expect(ctx.querySelector('.sr-only')).toBeNull();
  });

  it('shows both line numbers, hidden from a screen reader', async () => {
    const f = await setup({ before: 'a\nb', after: 'a\nc' });
    const add = rows(f).find((r) => r.dataset['svKind'] === 'add')!;
    const numbers = [...add.querySelectorAll('span[aria-hidden="true"]')].slice(0, 2).map((s) => s.textContent?.trim());
    expect(numbers).toEqual(['', '2']);
  });

  it('describes the region with a summary sentence', async () => {
    const f = await setup({ before: 'a\nb', after: 'a\nc\nd', title: 'notes.txt' });
    const region = el(f).querySelector('section')!;
    expect(region.getAttribute('aria-label')).toBe('Changes to notes.txt');
    const summary = el(f).querySelector(`#${region.getAttribute('aria-describedby')}`)!;
    expect(summary.textContent).toContain('2 added lines');
    expect(summary.textContent).toContain('1 removed line');
  });

  it('highlights the changed words inside a changed line', async () => {
    const f = await setup({ before: 'const total = price * qty;', after: 'const total = price * quantity;' });
    const marks = [...el(f).querySelectorAll('mark')].map((m) => m.textContent);
    expect(marks).toEqual(['qty', 'quantity']);
  });

  it('draws whole lines when the word highlight is off', async () => {
    const f = await setup({ before: 'a = 1', after: 'a = 2', wordDiff: false });
    expect(el(f).querySelector('mark')).toBeNull();
  });
});

describe('SvDiffViewerComponent — folding unchanged lines', () => {
  it('folds a long unchanged run behind "Show N unchanged lines" and opens it on click', async () => {
    const before = [...lines(12), 'old'].join('\n');
    const after = [...lines(12), 'new'].join('\n');
    const f = await setup({ before, after, context: 3 });
    const fold = el(f).querySelector<HTMLButtonElement>('[data-sv-diff-fold] button')!;
    expect(fold.textContent).toContain('Show 9 unchanged lines');
    expect(rows(f)).toHaveLength(5);

    fireEvent.click(fold);
    f.detectChanges();
    expect(el(f).querySelector('[data-sv-diff-fold]')).toBeNull();
    expect(rows(f)).toHaveLength(14);
  });

  it('says the texts are identical and folds them whole', async () => {
    const text = lines(5).join('\n');
    const f = await setup({ before: text, after: text });
    expect(el(f).querySelector('[data-sv-diff-notice="identical"]')).not.toBeNull();
    expect(el(f).querySelector('[data-sv-diff-fold] button')?.textContent).toContain('Show 5 unchanged lines');
  });

  it('closes the folds again when the texts change', async () => {
    const f = await setup({ before: [...lines(12), 'old'].join('\n'), after: [...lines(12), 'new'].join('\n') });
    fireEvent.click(el(f).querySelector('[data-sv-diff-fold] button')!);
    f.detectChanges();
    f.componentRef.setInput('after', [...lines(12), 'newer'].join('\n'));
    f.detectChanges();
    expect(el(f).querySelector('[data-sv-diff-fold]')).not.toBeNull();
  });
});

describe('SvDiffViewerComponent — split', () => {
  it('puts the old text on the left and the new on the right, in named panes', async () => {
    const f = await setup({ before: 'a\nx\ny\nb', after: 'a\nz\nb', view: 'split' });
    const panes = [...el(f).querySelectorAll<HTMLElement>('[role="group"][tabindex="0"]')];
    expect(panes.map((p) => p.getAttribute('aria-label'))).toEqual(['Before', 'After']);
    const left = [...panes[0]!.querySelectorAll<HTMLElement>('[data-sv-diff-row]')].map((r) => r.dataset['svKind']);
    const right = [...panes[1]!.querySelectorAll<HTMLElement>('[data-sv-diff-row]')].map((r) => r.dataset['svKind']);
    expect(left).toEqual(['context', 'del', 'del', 'context']);
    expect(right).toEqual(['context', 'add', 'pad', 'context']);
    // Padding is not a line: hidden from a screen reader.
    expect(panes[1]!.querySelector('[data-sv-kind="pad"]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('switches layout from the header and reports it through the model', async () => {
    const f = await setup({ before: 'a', after: 'b' });
    const views: string[] = [];
    f.componentInstance.view.subscribe((v) => views.push(v));
    const split = el(f).querySelector<HTMLButtonElement>('[data-sv-diff-view="split"]')!;
    expect(split.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(split);
    f.detectChanges();
    expect(split.getAttribute('aria-pressed')).toBe('true');
    expect(views).toEqual(['split']);
  });

  it('hides the switch when asked', async () => {
    const f = await setup({ before: 'a', after: 'b', showViewToggle: false });
    expect(el(f).querySelector('[data-sv-diff-view]')).toBeNull();
  });
});

describe('SvDiffViewerComponent — disclosed limits', () => {
  it('refuses past maxLines and says why, with both line counts', async () => {
    const f = await setup({ before: lines(30).join('\n'), after: lines(31).join('\n'), maxLines: 40 });
    const notice = el(f).querySelector('[data-sv-diff-notice="too-large"]')!;
    expect(notice.textContent).toContain('30 and 31 lines');
    expect(notice.textContent).toContain('40-line limit');
    expect(rows(f)).toHaveLength(0);
  });

  it('notes a CRLF / LF difference that it ignored', async () => {
    const f = await setup({ before: 'a\r\nb\r\n', after: 'a\nb\n' });
    expect(el(f).querySelector('[data-sv-diff-notice="line-endings"]')).not.toBeNull();
  });

  it('marks a line that lost its final newline', async () => {
    const f = await setup({ before: 'a\nb\n', after: 'a\nb' });
    expect(el(f).querySelector('[data-sv-no-eol]')?.textContent).toContain('No newline at end of file');
  });
});

describe('SvDiffViewerComponent — patch', () => {
  const PATCH = '--- a/app.ts\n+++ b/app.ts\n@@ -5,3 +5,3 @@\n keep\n-<b>old</b>\n+<i>new</i>\n keep\n';

  it('renders a unified patch, names the file, and counts the lines it left out', async () => {
    const f = await setup({ patch: PATCH });
    expect(el(f).querySelector('header')?.textContent).toContain('app.ts');
    expect(el(f).querySelector('[data-sv-diff-gap]')?.textContent).toContain('4 unchanged lines not in the patch');
    expect(rows(f).map((r) => r.dataset['svKind'])).toEqual(['context', 'del', 'add', 'context']);
  });

  it('draws markup in a patch as characters', async () => {
    const f = await setup({ patch: PATCH, wordDiff: false });
    expect(el(f).querySelector('b, i')).toBeNull();
    expect(el(f).textContent).toContain('<b>old</b>');
  });

  it('says when a patch cannot be read', async () => {
    const f = await setup({ patch: 'not a patch' });
    expect(el(f).querySelector('[data-sv-diff-notice="patch-invalid"]')).not.toBeNull();
  });
});
