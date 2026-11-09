import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import {
  DEMO_ANSWER,
  DEMO_CITATIONS,
  DEMO_SOURCES,
  DEMO_SOURCES_RESTRICTED,
  SvCitationSourcesComponent,
} from './citation-sources.component';
import { svSourceAccess, svSourceFreshness } from './citation-sources.attribution';
import { SV_CITATION_SOURCES_LABELS as L } from './citation-sources.labels';
import type { SourceAccess, SourceRef } from './citation-sources.types';

/**
 * FL-J3-AI-12 (citation half, `AI-16-I4`) and FL-J3-AI-13 (`AI-16-M3`, `AI-16-M4`):
 * the coverage figure says attribution is not support; every source says how
 * old its evidence is; and a source the reader cannot open renders a named
 * state instead of a broken link.
 */

async function cited(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvCitationSourcesComponent, { inputs });
  fixture.detectChanges();
  return fixture;
}
afterEach(() => TestBed.resetTestingModule());

const q = (f: { nativeElement: HTMLElement }, sel: string) => f.nativeElement.querySelector(sel) as HTMLElement | null;
const all = (f: { nativeElement: HTMLElement }, sel: string) =>
  Array.from(f.nativeElement.querySelectorAll<HTMLElement>(sel));
const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const NOW = Date.parse('2026-10-24T12:00:00Z');

/** Open a source's passage by clicking its entry. */
function open(f: { nativeElement: HTMLElement; detectChanges(): void }, id: string): void {
  (f.nativeElement.querySelector(`[data-sv-source="${id}"] button`) as HTMLButtonElement).click();
  f.detectChanges();
}

const withSources = (sources: readonly SourceRef[]) =>
  cited({ variant: 'cards', answer: DEMO_ANSWER, citations: DEMO_CITATIONS, sources });

// ── AI-16-I4 — attribution is not support ───────────────────────────────────

describe('coverage — attributed is not verified as supported', () => {
  it('says so under the coverage figure, and the progress bar is described by it', async () => {
    const f = await withSources(DEMO_SOURCES);
    const caveat = q(f, '[data-sv-coverage] [data-sv-coverage-caveat]');
    expect(text(caveat)).toBe(L.coverageAttributionCaveat);
    expect(L.coverageAttributionCaveat).toContain('Attributed is not verified as supported');
    const bar = q(f, '[data-sv-coverage] [role="progressbar"]');
    expect(bar?.getAttribute('aria-describedby')).toBe(caveat?.id);
    expect(caveat?.id).toBeTruthy();
  });

  it('says it at 100% too — a fully attributed answer is the one that most looks checked', async () => {
    const answer = 'Refunds run for thirty days.';
    const f = await cited({
      answer,
      citations: [{ id: 'c', sourceId: 's', start: 0, end: answer.length, quote: 'thirty days' }],
      sources: [{ id: 's', title: 'Policy', kind: 'document' }],
    });
    expect(text(q(f, '[data-sv-coverage-pct]'))).toBe('100%');
    expect(q(f, '[data-sv-coverage-caveat]')).toBeTruthy();
  });

  it('is not rendered when the coverage strip is turned off', async () => {
    const f = await cited({ answer: DEMO_ANSWER, citations: DEMO_CITATIONS, sources: DEMO_SOURCES, showCoverage: false });
    expect(q(f, '[data-sv-coverage-caveat]')).toBeNull();
  });
});

// ── AI-16-M3 — freshness ────────────────────────────────────────────────────

describe('svSourceFreshness', () => {
  it('turns an ISO timestamp into a relative age and an absolute date', () => {
    const f = svSourceFreshness('2026-10-21T12:00:00Z', 'en-US', NOW);
    expect(f?.relative).toBe('3 days ago');
    expect(f?.datetime).toBe('2026-10-21T12:00:00.000Z');
    expect(f?.absolute).toContain('2026');
  });

  it('picks the unit that reads naturally', () => {
    expect(svSourceFreshness('2026-10-24T11:56:00Z', 'en-US', NOW)?.relative).toBe('4 minutes ago');
    expect(svSourceFreshness('2026-10-24T09:00:00Z', 'en-US', NOW)?.relative).toBe('3 hours ago');
    expect(svSourceFreshness('2026-07-24T12:00:00Z', 'en-US', NOW)?.relative).toBe('3 months ago');
    expect(svSourceFreshness('2024-10-24T12:00:00Z', 'en-US', NOW)?.relative).toBe('2 years ago');
  });

  it('accepts epoch milliseconds', () => {
    expect(svSourceFreshness(String(NOW - 2 * 86_400_000), 'en-US', NOW)?.relative).toBe('2 days ago');
  });

  it('localises the age', () => {
    expect(svSourceFreshness('2026-10-21T12:00:00Z', 'de', NOW)?.relative).toBe('vor 3 Tagen');
  });

  it('renders free text verbatim rather than guessing a date from it', () => {
    expect(svSourceFreshness('09:41', 'en-US', NOW)).toEqual({ datetime: null, relative: '09:41', absolute: '' });
    expect(svSourceFreshness('last sync', 'en-US', NOW)?.datetime).toBeNull();
  });

  it('is null when the host did not say', () => {
    expect(svSourceFreshness(undefined, 'en-US', NOW)).toBeNull();
    expect(svSourceFreshness('  ', 'en-US', NOW)).toBeNull();
  });
});

describe('freshness in the source list', () => {
  it('renders a <time datetime> with the absolute date as its title', async () => {
    const iso = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const f = await withSources([{ ...DEMO_SOURCES[0], retrievedAt: iso }, DEMO_SOURCES[1]]);
    const time = q(f, '[data-sv-source="policy"] [data-sv-source-retrieved] time');
    expect(time?.getAttribute('datetime')).toBe(iso);
    expect(time?.getAttribute('title')).toBeTruthy();
    expect(text(time)).toBe('Retrieved 3 days ago');
  });

  it('renders free text verbatim, with no <time> element claiming a date', async () => {
    const f = await withSources([{ ...DEMO_SOURCES[0], retrievedAt: '09:41' }, DEMO_SOURCES[1]]);
    const line = q(f, '[data-sv-source="policy"] [data-sv-source-retrieved]');
    expect(text(line)).toBe('Retrieved 09:41');
    expect(line?.querySelector('time')).toBeNull();
  });

  it('puts the age in the source entry’s accessible name', async () => {
    const f = await withSources([{ ...DEMO_SOURCES[0], retrievedAt: '09:41' }, DEMO_SOURCES[1]]);
    const name = q(f, '[data-sv-source="policy"] button')?.getAttribute('aria-label') ?? '';
    expect(name).toContain('Retrieved 09:41');
  });

  it('renders nothing when no retrievedAt is given', async () => {
    const f = await withSources(DEMO_SOURCES.map(({ retrievedAt: _r, ...s }) => s));
    expect(q(f, '[data-sv-source-retrieved]')).toBeNull();
  });
});

// ── AI-16-M4 — access states ────────────────────────────────────────────────

describe('svSourceAccess', () => {
  it('links an available or undeclared source', () => {
    expect(svSourceAccess({ id: 'a', title: 'A', kind: 'web' }, L)).toBeNull();
    expect(svSourceAccess({ id: 'a', title: 'A', kind: 'web', access: 'available' }, L)).toBeNull();
  });

  it('names each of the three states with a distinct chip and sentence', () => {
    const states = (['paywalled', 'dead', 'denied'] as const).map((access) =>
      svSourceAccess({ id: 'a', title: 'A', kind: 'web', access }, L)!,
    );
    expect(states.map((s) => s.access)).toEqual(['paywalled', 'dead', 'denied']);
    expect(new Set(states.map((s) => s.label)).size).toBe(3);
    expect(new Set(states.map((s) => s.note)).size).toBe(3);
  });

  it('treats an unknown value as denied — not as a link', () => {
    const s = svSourceAccess({ id: 'a', title: 'A', kind: 'web', access: 'gone' as SourceAccess }, L);
    expect(s?.access).toBe('denied');
  });
});

describe('access states in the source list', () => {
  for (const access of ['paywalled', 'dead', 'denied'] as const) {
    it(`a ${access} source renders its state and the address as text, never a link`, async () => {
      const f = await withSources([DEMO_SOURCES[0], { ...DEMO_SOURCES[1], access }]);
      const entry = q(f, '[data-sv-source="disputes"]');
      expect(entry?.querySelector(`[data-sv-source-access="${access}"]`)).toBeTruthy();
      expect(entry?.querySelector('button')?.getAttribute('aria-label')).toContain(
        svSourceAccess({ ...DEMO_SOURCES[1], access }, L)!.label,
      );

      open(f, 'disputes');
      const note = q(f, `[data-sv-source="disputes"] [data-sv-access-note="${access}"]`);
      expect(note).toBeTruthy();
      expect(text(note)).toContain(DEMO_SOURCES[1].url!);
      expect(q(f, '[data-sv-source="disputes"] [data-sv-source-link]')).toBeNull();
      // The quoted passage still renders — the evidence is not hidden with the link.
      expect(all(f, '[data-sv-source="disputes"] [data-sv-quote]').length).toBeGreaterThan(0);
    });
  }

  it('an available source keeps its link', async () => {
    const f = await withSources(DEMO_SOURCES_RESTRICTED);
    open(f, 'policy');
    expect(q(f, '[data-sv-source="policy"] [data-sv-source-link]')?.getAttribute('href')).toBe(DEMO_SOURCES[0].url);
    expect(q(f, '[data-sv-source="policy"] [data-sv-access-note]')).toBeNull();
  });

  it('DEMO_SOURCES_RESTRICTED shows a paywalled, old source', async () => {
    const f = await withSources(DEMO_SOURCES_RESTRICTED);
    expect(q(f, '[data-sv-source="disputes"] [data-sv-source-access="paywalled"]')).toBeTruthy();
    expect(q(f, '[data-sv-source="disputes"] time')?.getAttribute('datetime')).toBe('2025-03-02T14:05:00.000Z');
  });
});
