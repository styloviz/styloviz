import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { describe, expect, it, vi } from 'vitest';
import { describeAsyncContract } from '@testing/async-contract';
import { SvTranscriptComponent } from './transcript.component';
import {
  svActiveSegmentIndex,
  svTranscriptFilename,
  svTranscriptMatcher,
  svTranscriptParts,
  svTranscriptSpeakers,
  svTranscriptToText,
  svTranscriptToVtt,
  svVttTimestamp,
  type SvTranscriptExportEvent,
  type SvTranscriptSeekEvent,
  type SvTranscriptSegment,
  type SvTranscriptSpeaker,
} from './transcript.logic';

/**
 * `sv-transcript` — what is pinned is what a host wires to: timestamps seek a
 * linked player, finals (never interim text) are announced in live mode, the
 * search highlights and counts, the exports are well-formed and leave interim
 * text out, and the async states render.
 */

const SPEAKERS: readonly SvTranscriptSpeaker[] = [
  { id: 'agent', name: 'Maya (Support)' },
  { id: 'caller', name: 'Jordan Lee', tone: 'accent' },
];

const SEGMENTS: readonly SvTranscriptSegment[] = [
  { id: 's1', speaker: 'agent', start: 0, end: 4.5, text: 'Thanks for calling, this is Maya.' },
  { id: 's2', speaker: 'caller', start: 5, end: 11, text: 'Hi Maya — my export is stuck at queued.' },
  { id: 's3', speaker: 'caller', start: 11, end: 14, text: 'It has been queued since eight.' },
  { id: 's4', speaker: 'agent', start: 15, text: 'Let me check the export queue', final: false },
];

async function mount(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  return render(SvTranscriptComponent, { inputs: { segments: SEGMENTS, speakers: SPEAKERS, locale: 'en-US', ...inputs } });
}

// ─── Logic ────────────────────────────────────────────────────────────────────

describe('transcript logic', () => {
  it('formats WebVTT timestamps, and clamps nonsense to zero', () => {
    expect(svVttTimestamp(0)).toBe('00:00:00.000');
    expect(svVttTimestamp(3725.5)).toBe('01:02:05.500');
    expect(svVttTimestamp(Number.NaN)).toBe('00:00:00.000');
    expect(svVttTimestamp(-4)).toBe('00:00:00.000');
  });

  it('finds the segment under the playhead, and none in a gap', () => {
    expect(svActiveSegmentIndex(SEGMENTS, null)).toBe(-1);
    expect(svActiveSegmentIndex(SEGMENTS, 2)).toBe(0);
    expect(svActiveSegmentIndex(SEGMENTS, 4.7)).toBe(-1); // after s1's end, before s2
    expect(svActiveSegmentIndex(SEGMENTS, 12)).toBe(2);
    expect(svActiveSegmentIndex(SEGMENTS, 99)).toBe(3); // no end: runs on
  });

  it('resolves speakers in order of appearance, giving each untoned one its own tone', () => {
    const map = svTranscriptSpeakers([...SEGMENTS, { start: 20, speaker: 'guest', text: 'Hello' }], SPEAKERS);
    expect(map.get('agent')?.name).toBe('Maya (Support)');
    expect(map.get('caller')?.tone).toBe('accent');
    expect(map.get('guest')?.name).toBe('guest');
    expect(map.get('agent')?.tone).not.toBe(map.get('guest')?.tone);
  });

  it('cuts text into matched runs, case-insensitively, treating the query literally', () => {
    const parts = svTranscriptParts('Export (CSV) and export', svTranscriptMatcher('export'), 3);
    expect(parts.filter((p) => p.match).map((p) => [p.text, p.ordinal])).toEqual([
      ['Export', 3],
      ['export', 4],
    ]);
    expect(parts.map((p) => p.text).join('')).toBe('Export (CSV) and export');
    expect(svTranscriptParts('a (b) c', svTranscriptMatcher('(b)')).some((p) => p.match && p.text === '(b)')).toBe(true);
    expect(svTranscriptMatcher('   ')).toBeNull();
  });

  it('exports plain text of the finals only', () => {
    expect(svTranscriptToText(SEGMENTS, SPEAKERS)).toBe(
      ['[0:00] Maya (Support): Thanks for calling, this is Maya.', '[0:05] Jordan Lee: Hi Maya — my export is stuck at queued.', '[0:11] Jordan Lee: It has been queued since eight.'].join('\n'),
    );
  });

  it('exports WebVTT with voice spans, escaped text, and ends filled in', () => {
    const vtt = svTranscriptToVtt(
      [
        { start: 1, speaker: 'a<b', text: 'x --> y & <script>' },
        { start: 6, text: 'last' },
      ],
      [],
    );
    expect(vtt.startsWith('WEBVTT\n\n1\n00:00:01.000 --> 00:00:06.000\n')).toBe(true);
    expect(vtt).toContain('<v a&lt;b>x --&gt; y &amp; &lt;script&gt;');
    expect(vtt).toContain('2\n00:00:06.000 --> 00:00:10.000\nlast');
    expect(vtt).not.toContain('<script>');
  });

  it('makes a safe file name', () => {
    expect(svTranscriptFilename('call/2026:10', 'vtt')).toBe('call-2026-10.vtt');
    expect(svTranscriptFilename('../', 'text')).toBe('transcript.txt');
  });
});

// ─── Component ───────────────────────────────────────────────────────────────

describe('SvTranscriptComponent', () => {
  it('labels speakers once per turn and marks interim text', async () => {
    const { container } = await mount();
    const rows = container.querySelectorAll('[data-sv-segment]');
    expect(rows).toHaveLength(4);
    // s3 continues Jordan's turn: no visible name, but a screen reader still hears it.
    expect(rows[2].querySelector('p.text-xs')).toBeNull();
    expect(rows[2].textContent).toContain('Jordan Lee:');
    expect(rows[3].getAttribute('data-final')).toBe('false');
    expect(rows[3].textContent).toContain('(still transcribing)');
  });

  it('seeks and plays a linked player from a timestamp, and emits seek', async () => {
    const player = { seek: vi.fn(), play: vi.fn() };
    const seek = vi.fn<(e: SvTranscriptSeekEvent) => void>();
    const { cmp } = await mountWithOutputs({ player }, { seek });
    const stamp = cmp.container.querySelector('[data-sv-segment="s2"] button') as HTMLButtonElement;
    expect(stamp.getAttribute('aria-label')).toBe('Play from 0:05, Jordan Lee');
    stamp.click();
    expect(player.seek).toHaveBeenLastCalledWith(5);
    expect(player.play).toHaveBeenCalled();
    expect(seek).toHaveBeenCalledWith(expect.objectContaining({ index: 1, seconds: 5 }));
  });

  it('says "Go to" when no player is linked', async () => {
    const { container } = await mount();
    expect(container.querySelector('[data-sv-segment="s1"] button')?.getAttribute('aria-label')).toBe('Go to 0:00, Maya (Support)');
  });

  it('highlights the line under the playhead', async () => {
    const { container } = await mount({ currentTime: 12 });
    expect(container.querySelector('[aria-current="time"]')?.getAttribute('data-sv-segment')).toBe('s3');
  });

  it('highlights and counts search matches, and steps through them', async () => {
    const { container, fixture } = await mount({ query: 'queued', debounceMs: 0 });
    fixture.detectChanges();
    expect(container.querySelectorAll('mark')).toHaveLength(2);
    expect(container.textContent).toContain('1 of 2');
    const next = Array.from(container.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === 'Next match') as HTMLButtonElement;
    next.click();
    fixture.detectChanges();
    expect(container.textContent).toContain('2 of 2');
    expect(container.querySelector('mark[data-sv-match="1"]')?.className).toContain('ring-2');
  });

  it('filters to matching lines, and says no-results when none match', async () => {
    const { container, fixture } = await mount({ query: 'zebra', debounceMs: 0, filterOnSearch: true });
    fixture.detectChanges();
    const empty = container.querySelector('[data-sv-state="empty"]');
    expect(empty?.getAttribute('data-sv-empty-reason')).toBe('no-results');
    expect(container.textContent).toContain('Nothing in the transcript matches “zebra”.');
  });

  it('announces new FINAL lines in live mode — never interim ones, never history', async () => {
    const { container, fixture } = await mount({ live: true });
    const live = container.querySelector('[aria-live="polite"][aria-atomic="true"]') as HTMLElement;
    expect(live.textContent?.trim()).toBe('');
    fixture.componentRef.setInput('segments', [...SEGMENTS, { id: 's5', speaker: 'caller', start: 18, text: 'Still typing', final: false }]);
    fixture.detectChanges();
    expect(live.textContent?.trim()).toBe('');
    fixture.componentRef.setInput('segments', [
      ...SEGMENTS.slice(0, 3),
      { id: 's4', speaker: 'agent', start: 15, text: 'Let me check the export queue.' },
    ]);
    fixture.detectChanges();
    expect(live.textContent?.trim()).toBe('Maya (Support): Let me check the export queue.');
  });

  it('copies the finals and confirms only when the clipboard took them', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const copied = vi.fn<(e: SvTranscriptExportEvent) => void>();
    const { cmp } = await mountWithOutputs({}, { copied });
    const ok = await cmp.fixture.componentInstance.copy();
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith(expect.not.stringContaining('Let me check'));
    expect(copied).toHaveBeenCalledWith(expect.objectContaining({ format: 'text', filename: null }));

    writeText.mockRejectedValueOnce(new Error('denied'));
    expect(await cmp.fixture.componentInstance.copy()).toBe(false);
    cmp.fixture.detectChanges();
    expect(cmp.container.querySelector('[role="status"]')?.textContent).toContain('Could not copy');
  });

  it('downloads text and WebVTT and reports what it wrote', async () => {
    const exported = vi.fn<(e: SvTranscriptExportEvent) => void>();
    const { cmp } = await mountWithOutputs({ exportFilename: 'call 42' }, { exported });
    cmp.fixture.componentInstance.download('vtt');
    expect(exported).toHaveBeenCalledWith(expect.objectContaining({ format: 'vtt', filename: 'call 42.vtt' }));
    expect(exported.mock.calls[0][0].content.startsWith('WEBVTT')).toBe(true);
  });

  it('shows the live empty message before anything is said', async () => {
    const { container } = await mount({ segments: [], live: true });
    expect(container.querySelector('[data-sv-state="empty"]')?.getAttribute('data-sv-empty-reason')).toBe('no-data');
    expect(container.textContent).toContain('Listening');
  });
});

/** Render with output spies attached through `on`. */
async function mountWithOutputs(inputs: Record<string, unknown>, on: Record<string, (e: never) => void>) {
  TestBed.resetTestingModule();
  const cmp = await render(SvTranscriptComponent, {
    inputs: { segments: SEGMENTS, speakers: SPEAKERS, locale: 'en-US', ...inputs },
    on,
  });
  return { cmp };
}

// ─── Async contract ──────────────────────────────────────────────────────────

describeAsyncContract({
  component: SvTranscriptComponent,
  collection: 'segments',
  rows: SEGMENTS,
  inputs: { locale: 'en-US' },
  loadedSelector: '[data-sv-segment]',
});
