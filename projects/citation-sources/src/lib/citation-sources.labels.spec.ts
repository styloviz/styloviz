import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { DEMO_ANSWER, DEMO_CITATIONS, DEMO_SOURCES, SvCitationSourcesComponent } from './citation-sources.component';
import { SV_CITATION_SOURCES_LABELS } from './citation-sources.labels';

/** FL-B1d: the visible text is the package's English until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvCitationSourcesComponent, {
    inputs: { answer: 'Refunds run for thirty days.', citations: [], sources: [] },
    providers: providers as never[],
  });
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

afterEach(() => TestBed.resetTestingModule());

describe('SvCitationSourcesComponent — visible text (FL-B1d)', () => {
  it('says an unsourced answer in English by default', async () => {
    const host = await setup();
    expect(host.querySelector('[data-sv-unsourced]')?.textContent).toContain(SV_CITATION_SOURCES_LABELS.unsourced);
  });

  it('renders the text an app provides', async () => {
    const host = await setup([
      provideSvLabels({ citationSources: { unsourced: 'Nichts in dieser Antwort ist einer Quelle zugeordnet.' } }),
    ]);
    expect(host.querySelector('[data-sv-unsourced]')?.textContent).toContain('Nichts in dieser Antwort ist einer Quelle zugeordnet.');
    // Scoped to the notice: the coverage chip's sentence is built in TS (svCoverageLabel) — FL-B1e.
    expect(host.querySelector('[data-sv-unsourced]')?.textContent).not.toContain(SV_CITATION_SOURCES_LABELS.unsourced);
  });
});

describe('SvCitationSourcesComponent — text built in TypeScript (FL-B1e)', () => {
  it('describes coverage with the sentence an app provides', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvCitationSourcesComponent, {
      inputs: { answer: DEMO_ANSWER, sources: DEMO_SOURCES, citations: DEMO_CITATIONS },
      providers: [
        provideSvLabels({
          citationSources: {
            coveragePartial: 'Teilweise belegt: {uncited, plural, one {# Abschnitt} other {# Abschnitte}} ohne Quelle.',
          },
        }),
      ],
    });
    fixture.detectChanges();
    const label = (fixture.nativeElement as HTMLElement).querySelector('[data-sv-coverage-label]')?.textContent?.trim();
    expect(label).toMatch(/^Teilweise belegt: \d+ Abschnitte? ohne Quelle\.$/);
  });
});

describe('SvCitationSourcesComponent — names built in TypeScript (FL-B1e wave 4)', () => {
  it('names a citation chip with the template an app provides', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvCitationSourcesComponent, {
      inputs: {
        answer: 'Refunds run for thirty days. We usually stretch that for good customers. Escalate to billing.',
        citations: [{ id: 'c1', sourceId: 'policy', start: 0, end: 27, quote: 'the quoted passage' }],
        sources: [{ id: 'policy', title: 'Refunds policy', kind: 'document', locator: 'p.4' }],
      },
      providers: [provideSvLabels({ citationSources: { chipCitedFrom: 'Zitiert aus {sources}' } })],
    });
    fixture.detectChanges();
    const chip = (fixture.nativeElement as HTMLElement).querySelector('[data-sv-chip]');
    expect(chip?.getAttribute('aria-label')).toBe('Zitiert aus Refunds policy · p.4');
  });
});
