import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvAnchorComponent, type AnchorItem } from './anchor.component';
import { SV_ANCHOR_LABELS } from './anchor.labels';

/** jsdom has no `IntersectionObserver`; the anchor only needs one to construct. */
class InertIntersectionObserver {
  observe(): void { /* inert — no section is ever reported */ }
  unobserve(): void { /* inert */ }
  disconnect(): void { /* inert */ }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

const ITEMS: readonly AnchorItem[] = [
  { id: 'intro', label: 'Introduction' },
  { id: 'usage', label: 'Usage' },
];

/** FL-B1d: the landmark's default name is a label an app can translate. */
describe('SvAnchorComponent — labels', () => {
  let originalIO: typeof IntersectionObserver | undefined;

  beforeEach(() => {
    TestBed.resetTestingModule();
    originalIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = InertIntersectionObserver as unknown as typeof IntersectionObserver;
    for (const item of ITEMS) {
      const el = document.createElement('div');
      el.id = item.id;
      document.body.appendChild(el);
    }
  });

  afterEach(() => {
    globalThis.IntersectionObserver = originalIO as typeof IntersectionObserver;
    document.body.innerHTML = '';
  });

  it('names the landmark in English by default', async () => {
    await render(SvAnchorComponent, { inputs: { items: ITEMS } });
    expect(screen.getByRole('navigation', { name: SV_ANCHOR_LABELS.onThisPage })).toBeTruthy();
  });

  it('renders the name an app provides', async () => {
    await render(SvAnchorComponent, {
      inputs: { items: ITEMS },
      providers: [provideSvLabels({ anchor: { onThisPage: 'Auf dieser Seite' } })],
    });
    expect(screen.getByRole('navigation', { name: 'Auf dieser Seite' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'On this page' })).toBeNull();
  });
});
