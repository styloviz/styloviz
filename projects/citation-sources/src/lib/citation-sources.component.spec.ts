import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import {
  DEMO_ANSWER,
  DEMO_CITATIONS,
  DEMO_SOURCES,
  SvCitationSourcesComponent,
} from './citation-sources.component';
import type { CitationSpan, SourceRef } from './citation-sources.types';

/**
 * `sv-citation-sources`, through the component.
 *
 * The attribution arithmetic has its own spec in
 * `citation-sources.attribution.spec.ts`. This file is about what reaches the
 * DOM: which chips are drawn, what a chip resolves to, and what the coverage
 * strip says about the parts of the answer nobody sourced.
 */

const source = (id: string, extra: Partial<SourceRef> = {}): SourceRef => ({
  id,
  title: `Source ${id}`,
  kind: 'document',
  ...extra,
});

const cite = (id: string, sourceId: string, start: number, end: number, quote = 'the quoted passage'): CitationSpan => ({
  id,
  sourceId,
  start,
  end,
  quote,
});

async function cited(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvCitationSourcesComponent, { inputs });
  fixture.detectChanges();
  return fixture;
}

afterEach(() => TestBed.resetTestingModule());

const q = (f: { nativeElement: HTMLElement }, sel: string) => f.nativeElement.querySelector(sel);
const all = (f: { nativeElement: HTMLElement }, sel: string) =>
  Array.from(f.nativeElement.querySelectorAll<HTMLElement>(sel));
const text = (el: Element | null | undefined) => el?.textContent?.trim() ?? '';

const ANSWER = 'Refunds run for thirty days. We usually stretch that for good customers. Escalate to billing.';

describe('SvCitationSourcesComponent — chips', () => {
  it('marks the cited run and leaves the rest plain', async () => {
    const f = await cited({
      answer: ANSWER,
      citations: [cite('c1', 'policy', 0, 27)],
      sources: [source('policy')],
    });

    expect(text(q(f, '[data-sv-cited]'))).toBe('Refunds run for thirty days');
    expect(all(f, '[data-sv-chip]')).toHaveLength(1);
    expect(text(q(f, '[data-sv-chip]'))).toBe('[1]');
  });

  /**
   * ★★★ ONE SOURCE, ONE NUMBER, HOWEVER OFTEN IT IS CITED. Numbering per
   * occurrence turns one page quoted three times into [1][2][3], and a reader
   * scanning the answer sees three sources agreeing where there is one.
   */
  it('reuses one number for a source cited three times', async () => {
    const f = await cited({
      answer: ANSWER,
      citations: [
        cite('c1', 'policy', 0, 27),
        cite('c2', 'policy', 28, 70),
        cite('c3', 'policy', 71, ANSWER.length),
      ],
      sources: [source('policy')],
    });

    expect(all(f, '[data-sv-chip]').map((n) => text(n))).toEqual(['[1]', '[1]', '[1]']);
    expect(all(f, '[data-sv-source]')).toHaveLength(1);
    expect(text(q(f, '[data-sv-source-spans]'))).toBe('×3');
  });

  /**
   * ★★★ THE ANSWER THE READER SEES IS THE ANSWER THE MODEL WROTE. Overlapping
   * citations are ordinary — chunks overlap — and emitting a segment per
   * citation renders the overlap twice.
   */
  it('renders the answer exactly once however the citations overlap', async () => {
    const f = await cited({
      answer: ANSWER,
      citations: [cite('c1', 'a', 0, 50), cite('c2', 'b', 30, 80)],
      sources: [source('a'), source('b')],
    });

    const rendered = all(f, '[data-sv-answer] span')
      .filter((n) => n.hasAttribute('data-sv-cited') || n.hasAttribute('data-sv-uncited'))
      .map((n) => n.textContent)
      .join('');
    expect(rendered).toBe(ANSWER);
  });

  /**
   * ★★ THE CHIP IS A BUTTON, NOT A SUPERSCRIPT. Its whole purpose is to take
   * the reader to the passage; a `<sup>` that does nothing when clicked is the
   * commonest form this component takes and the least useful.
   */
  it('opens the passage when a chip is activated', async () => {
    const f = await cited({
      answer: ANSWER,
      citations: [cite('c1', 'policy', 0, 27, 'A refund may be requested within thirty days.')],
      sources: [source('policy')],
    });

    expect(q(f, '[data-sv-source-passage]')).toBeNull();
    (q(f, '[data-sv-chip]') as HTMLButtonElement).click();
    f.detectChanges();

    expect(text(q(f, '[data-sv-quote]'))).toContain('A refund may be requested');
  });

  /**
   * ★★ A CHIP READS OUT AS "[1]" AND NOTHING ELSE. The number indexes a list the
   * reader cannot see from there, so the label has to carry the source —
   * otherwise the whole mechanism is decorative to anybody not using their eyes.
   */
  it('says which source a chip resolves to, out loud', async () => {
    const f = await cited({
      answer: ANSWER,
      citations: [cite('c1', 'policy', 0, 27)],
      sources: [source('policy', { title: 'Refunds policy', locator: 'p.4' })],
    });

    expect(q(f, '[data-sv-chip]')?.getAttribute('aria-label')).toBe(
      'Cited from Refunds policy · p.4',
    );
  });
});

describe('SvCitationSourcesComponent — sources', () => {
  /**
   * ★★ THE LOCATOR IS PART OF THE CITATION. "Refunds policy" sends the reader to
   * a document; "Refunds policy · p.4" sends them to the paragraph, which is the
   * only version that lets them check anything.
   */
  it('names the passage, not just the document', async () => {
    const f = await cited({
      answer: ANSWER,
      citations: [cite('c1', 'policy', 0, 27)],
      sources: [source('policy', { title: 'Refunds policy', locator: 'p.4' })],
    });

    expect(text(q(f, '[data-sv-source-label]'))).toBe('Refunds policy · p.4');
  });

  it('offers a link out when the source has one', async () => {
    const f = await cited({
      answer: ANSWER,
      citations: [cite('c1', 'policy', 0, 27)],
      sources: [source('policy', { url: 'https://example.test/doc' })],
    });

    (q(f, '[data-sv-source]') as HTMLElement).querySelector('button')!.click();
    f.detectChanges();

    expect(q(f, '[data-sv-source-link]')?.getAttribute('href')).toBe('https://example.test/doc');
    expect(q(f, '[data-sv-source-link]')?.getAttribute('rel')).toContain('noopener');
  });

  it('numbers the sources in the order the reader meets them', async () => {
    const f = await cited({
      answer: ANSWER,
      citations: [cite('c2', 'second', 40, 70), cite('c1', 'first', 0, 27)],
      sources: [source('second'), source('first')],
    });

    expect(all(f, '[data-sv-source-number]').map((n) => text(n))).toEqual(['1', '2']);
    expect(all(f, '[data-sv-source]').map((n) => n.getAttribute('data-sv-source'))).toEqual([
      'first',
      'second',
    ]);
  });
});

describe('SvCitationSourcesComponent — coverage', () => {
  /**
   * ★★★ THE UNCITED SENTENCE IN A CITED ANSWER IS THE DANGEROUS ONE. The
   * component draws attention to what is NOT sourced, which is the one thing a
   * wall of chips cannot do.
   */
  it('quotes the passages that rest on nothing', async () => {
    const f = await cited({
      answer: ANSWER,
      citations: [cite('c1', 'policy', 0, 27), cite('c2', 'policy', 71, ANSWER.length)],
      sources: [source('policy')],
    });

    expect(text(q(f, '[data-sv-uncited-list]'))).toContain('stretch that for good customers');
    expect(text(q(f, '[data-sv-coverage-label]'))).toContain('rest');
  });

  /**
   * ★★ THE BAR IS COLOURED BY HOW MUCH IS *NOT* ATTRIBUTED. A green bar at 60 %
   * reads as a pass mark, and the reader's question is whether the missing 40 %
   * matters.
   */
  it('does not colour a half-sourced answer as healthy', async () => {
    const f = await cited({
      answer: ANSWER,
      citations: [cite('c1', 'policy', 0, 27)],
      sources: [source('policy')],
    });

    const bar = q(f, '[data-sv-coverage-bar]');
    expect(bar?.className).not.toContain('accent');
  });

  it('colours a fully attributed answer as healthy', async () => {
    const f = await cited({
      answer: ANSWER,
      citations: [cite('c1', 'policy', 0, ANSWER.length)],
      sources: [source('policy')],
    });

    expect(q(f, '[data-sv-coverage-bar]')?.className).toContain('accent');
    expect(text(q(f, '[data-sv-coverage-pct]'))).toBe('100%');
  });

  it('can be turned off', async () => {
    const f = await cited({
      answer: ANSWER,
      citations: [cite('c1', 'policy', 0, 27)],
      sources: [source('policy')],
      showCoverage: false,
    });
    expect(q(f, '[data-sv-coverage]')).toBeNull();
  });

  /**
   * ★★★ AN ANSWER WITH NO SOURCES IS THE HEADLINE, NOT AN EMPTY STATE. Hiding
   * it behind "nothing to show" is how an unsourced answer passes for a missing
   * one — and an unsourced answer is the one worth stopping on.
   */
  it('says an unsourced answer is unsourced, rather than showing an empty shell', async () => {
    const f = await cited({ answer: ANSWER, citations: [], sources: [] });

    expect(text(q(f, '[data-sv-answer]'))).toContain('Refunds run for thirty days');
    expect(text(q(f, '[data-sv-unsourced]'))).toContain('Nothing in this answer is attributed');
    expect(f.nativeElement.textContent).not.toContain('No answer yet');
  });

  it('shows the shell only when there is no answer at all', async () => {
    const f = await cited({ answer: '', citations: [], sources: [] });
    expect(q(f, '[data-sv-citations]')).toBeNull();
    expect(f.nativeElement.textContent).toContain('No answer yet');
  });
});

describe('SvCitationSourcesComponent — the shipped sample', () => {
  /**
   * ★★ THE SAMPLE CARRIES AN UNCITED PARAGRAPH ON PURPOSE. A demo where every
   * sentence has a chip shows a tidy wall of blue and argues the opposite case:
   * the coverage figure exists for the passage nobody sourced.
   */
  it('has something uncited, and a source cited more than once', async () => {
    const f = await cited({
      answer: DEMO_ANSWER,
      citations: DEMO_CITATIONS,
      sources: DEMO_SOURCES,
    });

    expect(text(q(f, '[data-sv-uncited-list]'))).toContain('enterprise customers');
    expect(text(q(f, '[data-sv-source-spans]'))).toBe('×2');
    // Three citations, two sources — the distinction the numbering exists for.
    expect(all(f, '[data-sv-source]')).toHaveLength(2);
  });
});
