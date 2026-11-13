import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvCarouselComponent, DEMO_SLIDES } from './carousel/carousel.component';
import { SvDndListComponent } from './dnd-list/dnd-list.component';
import { SvJsonViewerComponent } from './json-viewer/json-viewer.component';
import { SvItemsWithMoreComponent } from './items-with-more/items-with-more.component';
import { SV_DISPLAY_LABELS } from './labels/display.labels';

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvCarouselComponent, {
    inputs: { slides: DEMO_SLIDES },
    providers: [provideRouter([]), ...providers] as never[],
  });
}

describe('SvCarouselComponent — accessible names', () => {
  it('names the controls in English by default', async () => {
    await setup();
    expect(screen.getByRole('button', { name: SV_DISPLAY_LABELS.nextSlide })).toBeTruthy();
  });

  it('renders the names an app provides', async () => {
    await setup([provideSvLabels({ display: { nextSlide: 'Nächste Folie', previousSlide: 'Vorherige Folie' } })]);
    expect(screen.getByRole('button', { name: 'Nächste Folie' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Vorherige Folie' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next slide' })).toBeNull();
  });
});

describe('SvDndListComponent — composed accessible names (FL-B1c)', () => {
  it('fills a translated template whose slot sits in a different position', async () => {
    TestBed.resetTestingModule();
    await render(SvDndListComponent, {
      inputs: { items: [{ id: 'a', label: 'Ada' }] },
      providers: [provideSvLabels({ display: { removeItem: '{name} entfernen' } })] as never[],
    });
    expect(screen.getAllByRole('button', { name: 'Ada entfernen' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Remove Ada' })).toBeNull();
  });
});

describe('display — visible text (FL-B1d)', () => {
  it('renders the empty-state copy an app provides', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvCarouselComponent, {
      inputs: { slides: [] },
      providers: [provideRouter([]), provideSvLabels({ display: { noSlides: 'Keine Folien vorhanden' } })] as never[],
    });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Keine Folien vorhanden');
    expect(text).not.toContain(SV_DISPLAY_LABELS.noSlides);
  });
});

describe('SvJsonViewerComponent — text built in TypeScript (FL-B1e)', () => {
  it('paints an unread getter with the placeholder an app provides', async () => {
    TestBed.resetTestingModule();
    const view = await render(SvJsonViewerComponent, {
      inputs: { value: { get lazy() { return 1; } } },
      providers: [provideSvLabels({ display: { jsonGetterNotRead: '(Getter — nicht gelesen)' } })],
    });
    view.fixture.detectChanges();
    const row = [...document.querySelectorAll<HTMLElement>('[data-sv-json-row]')].find((r) =>
      r.textContent?.replace(/\s+/g, ' ').trim().startsWith('lazy:'),
    )!;
    const spans = [...row.querySelectorAll('span')];
    expect(spans[spans.length - 1].textContent?.trim()).toBe('(Getter — nicht gelesen)');
  });
});

describe('SvItemsWithMoreComponent — a sentence glued around data (FL-B1e)', () => {
  it('names the hidden items from a translated plural template', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvItemsWithMoreComponent, {
      inputs: { items: ['Design', 'Engineering', 'Marketing', 'Sales', 'Support'], maxVisible: 3 },
      providers: [
        provideSvLabels({
          display: { moreNamed: '{count, plural, one {{n} weiterer Eintrag: {names}} other {{n} weitere Einträge: {names}}}' },
        }),
      ],
    });
    const button = (fixture.nativeElement as HTMLElement).querySelector('[data-trigger]');
    expect(button?.getAttribute('aria-label')).toBe('2 weitere Einträge: Sales, Support');
  });
});
