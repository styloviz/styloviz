import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvLiveAnnouncer, type SvDataError } from '@styloviz/core';
import { SvResultComponent } from './result.component';

/**
 * `X-9` re-check (2026-09-29) — the copy confirmation speaks through the one
 * governed announcer, not a private `aria-live` span.
 */

const err: SvDataError = { message: 'Could not load the report.', retryable: true, reference: 'req-42' };

afterEach(() => {
  vi.unstubAllGlobals();
  document.querySelectorAll('[data-sv-live-region]').forEach((el) => el.remove());
});

describe('SvResultComponent — copy confirmation (X-9)', () => {
  it('★ clicking Copy is heard through SvLiveAnnouncer, and the component owns no live region', async () => {
    TestBed.resetTestingModule();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const view = await render(SvResultComponent, {
      inputs: { status: 'error', title: 'Could not load the report', error: err, copiedLabel: 'Reference copied' },
    });
    const live = TestBed.inject(SvLiveAnnouncer);
    live.clearHistory();
    const host = view.fixture.nativeElement as HTMLElement;

    host.querySelector<HTMLButtonElement>('[data-sv-copy-reference]')!.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(writeText).toHaveBeenCalledWith('req-42');
    expect(live.history().map((h) => h.message)).toEqual(['Reference copied']);
    expect(host.querySelector('[aria-live]')).toBeNull();
    live.reset();
  });

  it('says nothing when the clipboard refused', async () => {
    TestBed.resetTestingModule();
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) } });
    const view = await render(SvResultComponent, {
      inputs: { status: 'error', title: 'Could not load the report', error: err },
    });
    const live = TestBed.inject(SvLiveAnnouncer);
    live.clearHistory();

    await view.fixture.componentInstance.copyReference();
    expect(live.history()).toEqual([]);
    live.reset();
  });
});
