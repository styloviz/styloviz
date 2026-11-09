import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvSkeletonLoaderComponent } from './skeleton-loader.component';
import { SV_SKELETON_LOADER_LABELS } from './skeleton-loader.labels';

/** FL-B1d: the escalation copy is the package's English until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvSkeletonLoaderComponent, {
    inputs: { slowAfterMs: 1_000 },
    providers: providers as never[],
  });
}

const message = () =>
  (document.querySelector('[data-sv-state="escalation"]') as HTMLElement | null)?.textContent?.trim() ?? null;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('SvSkeletonLoaderComponent — visible text (FL-B1d)', () => {
  it('says it is slow in English by default', async () => {
    const view = await setup();
    vi.advanceTimersByTime(1_000);
    view.fixture.detectChanges();
    expect(message()).toBe(SV_SKELETON_LOADER_LABELS.slow);
  });

  it('renders the slow message an app provides', async () => {
    const view = await setup([provideSvLabels({ skeletonLoader: { slow: 'Das dauert länger als üblich…' } })]);
    vi.advanceTimersByTime(1_000);
    view.fixture.detectChanges();
    expect(message()).toBe('Das dauert länger als üblich…');
  });
});
