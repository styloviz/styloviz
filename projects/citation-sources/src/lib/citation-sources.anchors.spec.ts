import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvCitationSourcesComponent } from './citation-sources.component';
import {
  SV_SOURCE_URL_PROTOCOLS,
  svAnchoredCitations,
  svPlaceCitations,
  svPlacementLabel,
  svSourceLink,
} from './citation-sources.attribution';
import type { CitationSpan, SourceRef } from './citation-sources.types';

/**
 * ============================================================================
 *  `AI-16-I1` / `AI-16-M1` / `AI-16-I2`
 * ============================================================================
 *
 * Two silent failures. Character offsets go wrong the moment anything touches
 * the answer after the citations were computed — and the old code clipped the
 * wreckage away, so an answer whose chips had all slid one sentence to the left
 * looked exactly like a correctly cited one. And a source URL is model output,
 * which is untrusted input.
 */

const ANSWER = 'Refunds run for thirty days. We usually stretch that for good customers.';

const source = (id: string, extra: Partial<SourceRef> = {}): SourceRef => ({
  id,
  title: `Source ${id}`,
  kind: 'document',
  ...extra,
});

const cite = (over: Partial<CitationSpan> & { id: string }): CitationSpan => ({
  sourceId: 'policy',
  start: 0,
  end: 27,
  quote: 'thirty days from the invoice date',
  ...over,
});

async function cited(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvCitationSourcesComponent, { inputs });
  fixture.detectChanges();
  return fixture;
}

afterEach(() => TestBed.resetTestingModule());

const q = (f: { nativeElement: HTMLElement }, sel: string) => f.nativeElement.querySelector(sel);
const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

// ── Placement ───────────────────────────────────────────────────────────────

describe('svPlaceCitations', () => {
  it('uses the offsets as given when there is no anchor text', () => {
    const p = svPlaceCitations(ANSWER, [cite({ id: 'c1', start: 0, end: 27 })]);
    expect(p.placed).toHaveLength(1);
    expect(p.placed[0]).toMatchObject({ start: 0, end: 27, placement: 'offsets' });
    expect(p.drifted).toBe(0);
    expect(p.unplaced).toEqual([]);
  });

  it('finds the anchor text and agrees with correct offsets', () => {
    const p = svPlaceCitations(ANSWER, [
      cite({ id: 'c1', start: 0, end: 27, anchorText: 'Refunds run for thirty days.' }),
    ]);
    // 'Refunds run for thirty days.' is 28 characters, so the supplied end of 27
    // is one short — which is exactly the kind of off-by-one the anchor fixes.
    expect(p.placed[0].placement).toBe('drifted');
    expect(p.placed[0].end).toBe(28);
  });

  it('re-anchors a citation the pipeline shifted, and counts the drift', () => {
    // The classic: a greeting is prepended after the citations were computed, so
    // every offset is short by its length and every chip slides left.
    const shifted = `Sure! ${ANSWER}`;
    const p = svPlaceCitations(shifted, [
      cite({ id: 'c1', start: 0, end: 28, anchorText: 'Refunds run for thirty days.' }),
    ]);
    expect(p.drifted).toBe(1);
    expect(p.placed[0].start).toBe(6);
    expect(p.placed[0].end).toBe(34);
    expect(shifted.slice(p.placed[0].start, p.placed[0].end)).toBe('Refunds run for thirty days.');
  });

  it('reports a citation whose words are gone rather than dropping it quietly', () => {
    // The old behaviour clipped this into nothing and said not a word, which is
    // how an answer with fabricated support passes for a checked one.
    const p = svPlaceCitations(ANSWER, [
      cite({ id: 'c1', anchorText: 'the refund window is ninety days' }),
    ]);
    expect(p.placed).toEqual([]);
    expect(p.unplaced.map((c) => c.id)).toEqual(['c1']);
  });

  it('takes the first occurrence of a repeated anchor, every render', () => {
    // A repeated sentence is genuinely ambiguous and any choice is a guess. The
    // first is at least the SAME guess each paint, so the chip does not wander.
    const answer = 'It is thirty days. It is thirty days.';
    const p = svPlaceCitations(answer, [cite({ id: 'c1', anchorText: 'It is thirty days.' })]);
    expect(p.placed[0].start).toBe(0);
  });

  it('clips offset-placed citations to the answer and drops empty ranges', () => {
    const p = svPlaceCitations(ANSWER, [
      cite({ id: 'in', start: -20, end: 5 }),
      cite({ id: 'past', start: 10, end: 9_999 }),
      cite({ id: 'empty', start: 7, end: 7 }),
      cite({ id: 'inverted', start: 12, end: 4 }),
    ]);
    expect(p.placed.map((x) => x.citation.id)).toEqual(['in', 'past']);
    expect(p.placed[0].start).toBe(0);
    expect(p.placed[1].end).toBe(ANSWER.length);
  });

  it('does not count an offset-placed citation as drift', () => {
    // Nothing to compare against: without anchor text the offsets are all there
    // is, and calling that "drift" would flag every unmigrated host.
    const p = svPlaceCitations(ANSWER, [cite({ id: 'c1', start: 3, end: 8 })]);
    expect(p.drifted).toBe(0);
  });
});

describe('svAnchoredCitations', () => {
  it('writes the resolved offsets back onto the span', () => {
    const shifted = `Sure! ${ANSWER}`;
    const [c] = svAnchoredCitations(shifted, [
      cite({ id: 'c1', start: 0, end: 28, anchorText: 'Refunds run for thirty days.' }),
    ]);
    expect(c.start).toBe(6);
    expect(c.end).toBe(34);
    // The rest of the span survives, so numbering and quoting are unaffected.
    expect(c.quote).toBe('thirty days from the invoice date');
  });

  it('omits the ones that could not be placed', () => {
    const list = svAnchoredCitations(ANSWER, [
      cite({ id: 'ok', start: 0, end: 10 }),
      cite({ id: 'gone', anchorText: 'nowhere in this answer' }),
    ]);
    expect(list.map((c) => c.id)).toEqual(['ok']);
  });
});

describe('svPlacementLabel', () => {
  it('says nothing when everything landed where it said it would', () => {
    expect(svPlacementLabel({ placed: [], unplaced: [], drifted: 0 })).toBe('');
  });

  it('names the count and blames the pipeline, not the reader', () => {
    const label = svPlacementLabel({ placed: [], unplaced: [cite({ id: 'c1' })], drifted: 0 });
    expect(label).toContain('1 citation could not be located');
    expect(label).toContain('changed after the citations were computed');
  });

  it('reports drift and loss together', () => {
    const label = svPlacementLabel({
      placed: [],
      unplaced: [cite({ id: 'a' }), cite({ id: 'b' })],
      missingClaims: 0,
      drifted: 3,
    });
    expect(label).toContain('2 citations');
    expect(label).toContain('3 were re-anchored');
  });

  it('gets the singular right for one drift', () => {
    expect(svPlacementLabel({ placed: [], unplaced: [], drifted: 1 })).toContain(
      '1 was re-anchored to its quoted text',
    );
  });
});

describe('the component says so in the surface', () => {
  it('renders no notice for a cleanly placed answer', async () => {
    const f = await cited({
      answer: ANSWER,
      citations: [cite({ id: 'c1', start: 0, end: 27 })],
      sources: [source('policy')],
    });
    expect(q(f, '[data-sv-placement-notice]')).toBeNull();
  });

  it('renders the notice when the answer moved under the citations', async () => {
    const f = await cited({
      answer: `Sure! ${ANSWER}`,
      citations: [cite({ id: 'c1', start: 0, end: 28, anchorText: 'Refunds run for thirty days.' })],
      sources: [source('policy')],
    });
    expect(text(q(f, '[data-sv-placement-notice]'))).toContain('re-anchored');
  });

  it('still draws the chip on the right words after the shift', async () => {
    const f = await cited({
      answer: `Sure! ${ANSWER}`,
      citations: [cite({ id: 'c1', start: 0, end: 28, anchorText: 'Refunds run for thirty days.' })],
      sources: [source('policy')],
    });
    // The point of the anchor: the highlight follows the claim, not the number.
    expect(text(q(f, '[data-sv-cited]'))).toBe('Refunds run for thirty days.');
  });
});

// ── Claim ids (`AI-16-M1`) ──────────────────────────────────────────────────

describe('claim ids are the first anchor', () => {
  const claims = [
    { id: 'k-window', text: 'Refunds run for thirty days.' },
    { id: 'k-stretch', text: 'We usually stretch that for good customers.' },
  ];

  it('places a citation on its claim, ahead of anchor text and offsets', () => {
    const p = svPlaceCitations(`Sure! ${ANSWER}`, [
      // Offsets and anchor text both point at the wrong words on purpose.
      cite({ id: 'c1', claimId: 'k-stretch', start: 0, end: 5, anchorText: 'Refunds' }),
    ], claims);
    expect(p.placed[0]).toMatchObject({
      placement: 'anchor',
      claimId: 'k-stretch',
      start: 35,
      end: 78,
    });
    expect(p.drifted).toBe(0);
  });

  it('reports a claim the answer no longer contains, rather than falling back', () => {
    const p = svPlaceCitations(ANSWER, [
      cite({ id: 'c1', claimId: 'k-gone', anchorText: 'Refunds run for thirty days.' }),
    ], claims);
    expect(p.placed).toEqual([]);
    expect(p.missingClaims).toBe(1);
    expect(svPlacementLabel(p)).toContain('1 citation names a claim that is not in this answer');
  });

  it('treats the id as identity only when the host supplied no claims', () => {
    const p = svPlaceCitations(ANSWER, [cite({ id: 'c1', claimId: 'k-window', start: 0, end: 27 })]);
    expect(p.placed[0].placement).toBe('offsets');
    expect(p.placed[0].claimId).toBeUndefined();
    expect(p.missingClaims).toBe(0);
  });

  it('draws the chip on the claim and marks how each quote was placed', async () => {
    const f = await cited({
      answer: `Sure! ${ANSWER}`,
      claims,
      citations: [cite({ id: 'c1', claimId: 'k-window', start: 0, end: 3 })],
      sources: [source('policy')],
    });
    expect(text(q(f, '[data-sv-cited]'))).toBe('Refunds run for thirty days.');
    expect(q(f, '[data-sv-placement-notice]')).toBeNull();
    (q(f, '[data-sv-source="policy"] button') as HTMLButtonElement).click();
    f.detectChanges();
    const quote = q(f, '[data-sv-quote]') as HTMLElement;
    expect(quote.getAttribute('data-sv-placement')).toBe('claim');
    expect(quote.getAttribute('data-sv-claim')).toBe('k-window');
  });

  it('says so in the surface when a cited claim has gone from the answer', async () => {
    const f = await cited({
      answer: ANSWER,
      claims,
      citations: [
        cite({ id: 'c1', claimId: 'k-window', start: 0, end: 28 }),
        cite({ id: 'c2', claimId: 'k-removed', start: 29, end: 72 }),
      ],
      sources: [source('policy')],
    });
    expect(text(q(f, '[data-sv-placement-notice]'))).toContain(
      '1 citation names a claim that is not in this answer',
    );
    expect(f.nativeElement.querySelectorAll('[data-sv-cited]')).toHaveLength(1);
  });

  it('hands the claim ids back when the reader opens the passage, and not on close', async () => {
    const f = await cited({
      answer: ANSWER,
      claims,
      citations: [
        cite({ id: 'c1', claimId: 'k-window' }),
        cite({ id: 'c2', claimId: 'k-stretch' }),
        cite({ id: 'c3', claimId: 'k-window', anchorText: 'thirty days' }),
      ],
      sources: [source('policy')],
    });
    const opened: (readonly string[])[] = [];
    f.componentInstance.claimsOpened.subscribe((ids) => opened.push(ids));
    const chip = q(f, '[data-sv-chip]') as HTMLButtonElement;
    chip.click();
    f.detectChanges();
    chip.click();
    f.detectChanges();
    expect(opened).toEqual([['k-window', 'k-stretch']]);
  });
});

// ── Link safety ─────────────────────────────────────────────────────────────

describe('svSourceLink', () => {
  it('passes http, https and mailto through unchanged', () => {
    for (const url of ['http://a.test/x', 'https://a.test/x#p4', 'mailto:legal@a.test']) {
      expect(svSourceLink(url).href, url).toBe(url);
    }
  });

  it('refuses javascript: and names the scheme', () => {
    const link = svSourceLink('javascript:fetch("/api/keys")');
    expect(link.href).toBeNull();
    expect(link.protocol).toBe('javascript:');
    expect(link.reason).toContain('javascript:');
  });

  it('refuses data:, because a citation has to be checkable against something', () => {
    expect(svSourceLink('data:text/html,<h1>source</h1>').href).toBeNull();
    expect(svSourceLink('data:image/png;base64,AAAA').href).toBeNull();
  });

  it('refuses file: and tel:', () => {
    // A `file:` path is the reader's own disk; a phone number is not a thing you
    // can go and read.
    expect(svSourceLink('file:///etc/passwd').href).toBeNull();
    expect(svSourceLink('tel:+15551234').href).toBeNull();
  });

  it('refuses a relative or protocol-relative URL rather than resolving it', () => {
    // This component does not know the host's base URL, and guessing it is how a
    // citation ends up pointing at the app's own routes.
    expect(svSourceLink('/handbook/refunds').href).toBeNull();
    expect(svSourceLink('//evil.test/x').href).toBeNull();
    expect(svSourceLink('handbook/refunds').reason).toContain('not a complete URL');
  });

  it('is quiet about a source that simply has no URL', () => {
    // No link and no complaint: a source without an address is ordinary.
    for (const url of [undefined, '', '   ']) {
      const link = svSourceLink(url);
      expect(link.href).toBeNull();
      expect(link.reason).toBe('');
    }
  });

  it('is case-insensitive about the scheme', () => {
    expect(svSourceLink('HTTPS://a.test/x').href).toBe('HTTPS://a.test/x');
    expect(svSourceLink('JavaScript:alert(1)').href).toBeNull();
  });

  it('honours a host allow-list, with or without colons', () => {
    expect(svSourceLink('ipfs://cid/x', ['ipfs:']).href).toBe('ipfs://cid/x');
    expect(svSourceLink('ipfs://cid/x', ['ipfs']).href).toBe('ipfs://cid/x');
    expect(svSourceLink('https://a.test/x', ['ipfs:']).href).toBeNull();
  });

  it('falls back to the default list rather than linking everything on an empty one', () => {
    // An empty array is a host that meant to configure this and did not. Reading
    // it as "allow all" would turn a misconfiguration into a javascript: link.
    expect(svSourceLink('javascript:alert(1)', []).href).toBeNull();
    expect(svSourceLink('https://a.test/x', []).href).toBe('https://a.test/x');
  });

  it('keeps the default list to the three schemes a source can actually be', () => {
    expect([...SV_SOURCE_URL_PROTOCOLS]).toEqual(['http:', 'https:', 'mailto:']);
  });
});

describe('the component refuses the link but keeps the evidence', () => {
  const withUrl = (url: string) => ({
    answer: ANSWER,
    variant: 'panel',
    citations: [cite({ id: 'c1', start: 0, end: 27 })],
    sources: [source('policy', { url })],
  });

  /** The passage — and the link inside it — renders once the source is open. */
  const opened = async (url: string) => {
    const f = await cited(withUrl(url));
    f.componentInstance.toggleSource(source('policy', { url }));
    f.detectChanges();
    return f;
  };

  it('links a real source', async () => {
    const f = await opened('https://a.test/handbook#p4');
    expect(q(f, '[data-sv-source-link]')?.getAttribute('href')).toBe('https://a.test/handbook#p4');
  });

  it('draws no anchor at all for a javascript: URL', async () => {
    const f = await opened('javascript:alert(1)');
    expect(q(f, '[data-sv-source-link]')).toBeNull();
    expect(q(f, '[data-sv-link-refused="javascript:"]')).toBeTruthy();
  });

  it('shows the refused URL as text, because it is evidence about the answer', async () => {
    const f = await opened('javascript:alert(1)');
    // Not hidden: a source with a silently missing link is indistinguishable
    // from a source that never had one.
    expect(text(q(f, '[data-sv-link-refused]'))).toContain('javascript:alert(1)');
  });
});
