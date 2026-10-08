import { TestBed } from '@angular/core/testing';
import { SvLiveAnnouncer } from './live-announcer';

/**
 * `N-2` re-check (2026-09-29) — the test hook.
 *
 * ★★★ The backlog's own words: "what did the screen reader hear" is otherwise
 *     unassertable. `regionFor()` exposes only the CURRENT text, so a burst
 *     could be checked for its last word and nothing else — and dedupe,
 *     throttling, replacement and cancellation are all claims about what was
 *     NOT spoken. `history()` is the whole record.
 */

function announcer(): SvLiveAnnouncer {
  TestBed.resetTestingModule();
  return TestBed.inject(SvLiveAnnouncer);
}

const said = (a: SvLiveAnnouncer) => a.history().map((h) => `${h.priority}:${h.message}`);

afterEach(() => {
  document.querySelectorAll('[data-sv-live-region]').forEach((el) => el.remove());
});

describe('SvLiveAnnouncer.history() — what was actually heard', () => {
  it('★ records a burst in order, with its priority', () => {
    const a = announcer();
    a.announce('Saved');
    a.announce('Upload failed', { priority: 'assertive' });
    a.announce('3 new notifications');

    expect(said(a)).toEqual([
      'polite:Saved',
      'assertive:Upload failed',
      'polite:3 new notifications',
    ]);
    a.reset();
  });

  it('★★ leaves out a deduplicated repeat — the proof that it was NOT spoken', () => {
    const a = announcer();
    a.announce('Saved');
    a.announce('Saved');
    expect(said(a)).toEqual(['polite:Saved']);

    // …but a forced repeat is a deliberate second announcement.
    a.announce('Saved', { force: true });
    expect(said(a)).toEqual(['polite:Saved', 'polite:Saved']);
    a.reset();
  });

  it('★★ a throttled value that was superseded never appears; the latest does, once', async () => {
    const a = announcer();
    a.announce('41%', { key: 'upload', throttleMs: 40 });
    a.announce('42%', { key: 'upload', throttleMs: 40 });
    a.announce('43%', { key: 'upload', throttleMs: 40 });

    await new Promise<void>((r) => setTimeout(r, 70));

    expect(said(a)).toEqual(['polite:41%', 'polite:43%']);
    a.reset();
  });

  it('a cancelled held message never appears', async () => {
    const a = announcer();
    a.announce('10%', { key: 'job', throttleMs: 40 });
    a.announce('20%', { key: 'job', throttleMs: 40 });
    a.cancel('job');

    await new Promise<void>((r) => setTimeout(r, 70));
    expect(said(a)).toEqual(['polite:10%']);
    a.reset();
  });

  it('is a copy, is bounded, and clears without removing the regions', () => {
    const a = announcer();
    for (let i = 0; i < 60; i++) a.announce(`Item ${i}`);

    const record = a.history();
    expect(record.length).toBe(50);
    expect(record[0].message).toBe('Item 10');           // the oldest ten dropped
    expect(record[49].message).toBe('Item 59');
    expect(typeof record[0].at).toBe('number');

    a.clearHistory();
    expect(a.history()).toEqual([]);
    expect(record.length).toBe(50);                      // the earlier copy is untouched
    expect(a.regionFor('polite')).not.toBeNull();        // regions stay

    a.reset();
    expect(a.history()).toEqual([]);
  });
});
