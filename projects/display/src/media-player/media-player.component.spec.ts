import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeAsyncContract } from '@testing/async-contract';
import { SvMediaPlayerComponent } from './media-player.component';
import { svDemoAudio, svDemoCaptions, svDemoVideo } from './media-player.demo';
import { readBlobText } from '../../../../src/testing/blob';
import {
  svFormatMediaTime,
  svIsSafeMediaUrl,
  svMediaSources,
  svMediaTracks,
  type SvMediaErrorEvent,
  type SvMediaItem,
  type SvMediaSeekEvent,
  type SvMediaTimeEvent,
  type SvMediaTrackChange,
} from './media-player.logic';

/**
 * `sv-media-player` — jsdom plays nothing, so each test drives the element the
 * way a browser would: it fakes the element's clock (`currentTime`, `duration`,
 * `paused`) and dispatches the media events in the order a browser fires them.
 * What is pinned is what a host wires to: the outputs, the toolbar's keyboard
 * model, the URL check, and every failure saying itself in words.
 */

const ITEMS: readonly SvMediaItem[] = [
  {
    id: 'intro',
    title: 'Welcome to the course',
    subtitle: 'Module 1',
    src: '/media/intro.webm',
    duration: 120,
    tracks: [
      { src: '/media/intro.en.vtt', srclang: 'en', label: 'English' },
      { src: '/media/intro.es.vtt', srclang: 'es', label: 'Español', kind: 'subtitles' },
    ],
  },
  { id: 'setup', title: 'Setting up', src: '/media/setup.webm', duration: 300 },
  { id: 'recap', title: 'Recap', src: '/media/recap.webm' },
];

interface FakeClock {
  currentTime: number;
  duration: number;
  paused: boolean;
  error: { code: number; message: string } | null;
  networkState: number;
  readonly load: ReturnType<typeof vi.fn>;
}

/** Give a jsdom media element a clock the test controls. */
function wire(media: HTMLMediaElement, duration = 120): FakeClock {
  const clock: FakeClock = { currentTime: 0, duration, paused: true, error: null, networkState: 1, load: vi.fn() };
  Object.defineProperty(media, 'currentTime', {
    configurable: true,
    get: () => clock.currentTime,
    set: (v: number) => {
      clock.currentTime = v;
    },
  });
  Object.defineProperty(media, 'duration', { configurable: true, get: () => clock.duration });
  Object.defineProperty(media, 'paused', { configurable: true, get: () => clock.paused });
  Object.defineProperty(media, 'error', { configurable: true, get: () => clock.error });
  Object.defineProperty(media, 'networkState', { configurable: true, get: () => clock.networkState });
  media.play = () => {
    clock.paused = false;
    media.dispatchEvent(new Event('play'));
    return Promise.resolve();
  };
  media.pause = () => {
    clock.paused = true;
    media.dispatchEvent(new Event('pause'));
  };
  media.load = clock.load as unknown as () => void;
  return clock;
}

const fire = (media: HTMLMediaElement, ...types: string[]) => {
  for (const type of types) media.dispatchEvent(new Event(type));
};

async function mount(inputs: Record<string, unknown> = {}, providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const result = await render(SvMediaPlayerComponent, {
    inputs: { items: ITEMS, locale: 'en-US', ...inputs } as never,
    providers: providers as never[],
  });
  result.fixture.detectChanges();
  await result.fixture.whenStable();
  return result.fixture;
}

type Fixture = Awaited<ReturnType<typeof mount>>;
const el = (f: Fixture) => f.nativeElement as HTMLElement;
const media = (f: Fixture) => el(f).querySelector<HTMLMediaElement>('video, audio')!;
const toolbar = (f: Fixture) => el(f).querySelector<HTMLElement>('[role="toolbar"]')!;
const control = (f: Fixture, id: string) => el(f).querySelector<HTMLElement>(`[data-sv-media-control="${id}"]`);
const seekbar = (f: Fixture) => el(f).querySelector<HTMLInputElement>('input[type="range"]:not([data-sv-media-control])')!;
const key = (target: Element, k: string, init: KeyboardEventInit = {}) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));

/** Mount, wire the element, and bring it to "metadata loaded". */
async function ready(inputs: Record<string, unknown> = {}, duration = 120) {
  const f = await mount(inputs);
  const m = media(f);
  const clock = wire(m, duration);
  fire(m, 'loadstart', 'loadedmetadata', 'canplay');
  f.detectChanges();
  return { f, m, clock };
}

afterEach(() => vi.restoreAllMocks());

// ─── Pure logic ──────────────────────────────────────────────────────────────

describe('media player logic', () => {
  it('accepts http(s), relative, blob: and media data URIs, and nothing that runs', () => {
    expect(svIsSafeMediaUrl('https://cdn.example.com/a.mp4')).toBe(true);
    expect(svIsSafeMediaUrl('/media/a.webm')).toBe(true);
    expect(svIsSafeMediaUrl('blob:https://app.example.com/1f2e')).toBe(true);
    expect(svIsSafeMediaUrl('data:video/webm;base64,GkXfow==')).toBe(true);
    expect(svIsSafeMediaUrl('javascript:alert(1)')).toBe(false);
    expect(svIsSafeMediaUrl(' javascript:alert(1)')).toBe(false);
    expect(svIsSafeMediaUrl('java\tscript:alert(1)')).toBe(false);
    expect(svIsSafeMediaUrl('mailto:a@b.c')).toBe(false);
    expect(svIsSafeMediaUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(svIsSafeMediaUrl('')).toBe(false);
    expect(svIsSafeMediaUrl(null)).toBe(false);
    // Tracks take WebVTT data, not media data.
    expect(svIsSafeMediaUrl('data:text/vtt,WEBVTT', 'track')).toBe(true);
    expect(svIsSafeMediaUrl('data:video/webm;base64,GkXfow==', 'track')).toBe(false);
  });

  it('prefers `sources` over `src`, drops unsafe ones, and keeps one track per language', () => {
    expect(svMediaSources({ title: 'x', src: '/a.mp4', sources: [{ src: '/b.webm', type: 'video/webm' }] })).toEqual([
      { src: '/b.webm', type: 'video/webm' },
    ]);
    expect(svMediaSources({ title: 'x', src: 'javascript:alert(1)' })).toEqual([]);
    expect(svMediaSources(null)).toEqual([]);
    const tracks = svMediaTracks({
      title: 'x',
      tracks: [
        { src: '/en.vtt', srclang: 'en', label: 'English' },
        { src: '/en2.vtt', srclang: 'en', label: 'English again' },
        { src: 'javascript:x', srclang: 'de', label: 'Deutsch' },
      ],
    });
    expect(tracks.map((t) => t.label)).toEqual(['English']);
  });

  it('formats time as a clock and never prints NaN', () => {
    expect(svFormatMediaTime(0)).toBe('0:00');
    expect(svFormatMediaTime(65.9)).toBe('1:05');
    expect(svFormatMediaTime(3725)).toBe('1:02:05');
    expect(svFormatMediaTime(Number.NaN)).toBe('--:--');
    expect(svFormatMediaTime(Number.POSITIVE_INFINITY)).toBe('--:--');
    expect(svFormatMediaTime(-1)).toBe('--:--');
  });
});

describe('demo media', () => {
  it('writes a WebM clip of any length, small enough to make in the browser', () => {
    const short = svDemoVideo({ seconds: 95, scene: 'teal' });
    expect(short.type).toBe('video/webm');
    const long = svDemoVideo({ seconds: 5400 });
    expect(long.size).toBeGreaterThan(short.size);
    expect(long.size).toBeLessThan(400_000);
  });

  it('writes a WAV whose length matches its duration', () => {
    const wav = svDemoAudio({ seconds: 3 });
    expect(wav.type).toBe('audio/wav');
    expect(wav.size).toBe(44 + 3 * 8000);
  });

  it('escapes cue text so it cannot add markup or end a cue early', async () => {
    const vtt = await readBlobText(
      svDemoCaptions([
        { start: 0, end: 2.5, text: 'Hello <b>there</b> & --> bye' },
        { start: 5, end: 5, text: 'zero length is dropped' },
      ]),
    );
    expect(vtt.startsWith('WEBVTT')).toBe(true);
    expect(vtt).toContain('00:00:00.000 --> 00:00:02.500');
    expect(vtt).toContain('Hello &lt;b&gt;there&lt;/b&gt; &amp; --&gt; bye');
    expect(vtt).not.toContain('zero length');
  });
});

// ─── Rendering ───────────────────────────────────────────────────────────────

describe('SvMediaPlayerComponent', () => {
  it('names the player after the item and renders only safe sources and tracks', async () => {
    const f = await mount({
      items: [
        {
          id: 'a',
          title: 'Lesson one',
          sources: [{ src: 'javascript:alert(1)' }, { src: '/a.webm', type: 'video/webm' }],
          tracks: [{ src: '/a.en.vtt', srclang: 'en', label: 'English' }],
        },
      ],
    });
    const region = el(f).querySelector('[role="region"]')!;
    expect(region.getAttribute('aria-label')).toBe('Lesson one — media player');
    const sources = [...el(f).querySelectorAll('video source')].map((s) => s.getAttribute('src'));
    expect(sources).toEqual(['/a.webm']);
    expect(el(f).querySelectorAll('video track')).toHaveLength(1);
    expect(el(f).querySelector('video')?.hasAttribute('controls')).toBe(false);
  });

  it('is one toolbar with one tab stop, walked with the arrow keys, Home and End', async () => {
    const f = await mount();
    const bar = toolbar(f);
    expect(bar.getAttribute('aria-label')).toBe('Player controls');
    const stops = [...bar.querySelectorAll('[data-sv-media-control]')].filter((n) => n.getAttribute('tabindex') === '0');
    expect(stops.map((n) => n.getAttribute('data-sv-media-control'))).toEqual(['play']);

    control(f, 'play')!.focus();
    key(control(f, 'play')!, 'ArrowRight');
    f.detectChanges();
    expect(document.activeElement?.getAttribute('data-sv-media-control')).toBe('next');
    expect(control(f, 'next')!.getAttribute('tabindex')).toBe('0');
    expect(control(f, 'play')!.getAttribute('tabindex')).toBe('-1');

    key(control(f, 'next')!, 'Home');
    f.detectChanges();
    expect(document.activeElement?.getAttribute('data-sv-media-control')).toBe('previous');
    key(control(f, 'previous')!, 'End');
    f.detectChanges();
    const last = [...bar.querySelectorAll('[data-sv-media-control]')].pop();
    expect(document.activeElement).toBe(last);
  });

  it('lets ←/→ leave the volume slider, so the toolbar never traps focus', async () => {
    const f = await mount();
    const volume = control(f, 'volume')!;
    volume.focus();
    const handled = !key(volume, 'ArrowRight');
    f.detectChanges();
    expect(handled).toBe(true);
    expect(document.activeElement?.getAttribute('data-sv-media-control')).toBe('speed');
  });

  it('speaks the time on the seek slider, and its arrow keys skip by seekStep', async () => {
    const { f, m, clock } = await ready({ seekStep: 10 });
    clock.currentTime = 30;
    fire(m, 'timeupdate');
    f.detectChanges();
    const seek = seekbar(f);
    expect(seek.getAttribute('aria-label')).toBe('Seek');
    expect(seek.getAttribute('aria-valuetext')).toBe('0:30 of 2:00');
    key(seek, 'ArrowRight');
    expect(clock.currentTime).toBe(40);
    key(seek, 'End');
    expect(clock.currentTime).toBe(120);
  });

  it('emits played and paused with the playhead, and throttles timeUpdate', async () => {
    const { f, m, clock } = await ready();
    const played: SvMediaTimeEvent[] = [];
    const paused: SvMediaTimeEvent[] = [];
    const updates: SvMediaTimeEvent[] = [];
    f.componentInstance.played.subscribe((e) => played.push(e));
    f.componentInstance.paused.subscribe((e) => paused.push(e));
    f.componentInstance.timeUpdate.subscribe((e) => updates.push(e));

    let now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    control(f, 'play')!.click();
    await f.whenStable();
    expect(played).toHaveLength(1);
    expect(played[0].item.id).toBe('intro');

    for (const t of [0.25, 0.5, 0.75]) {
      clock.currentTime = t;
      now += 250;
      fire(m, 'timeupdate');
    }
    expect(updates).toHaveLength(0);
    now += 300;
    clock.currentTime = 1.05;
    fire(m, 'timeupdate');
    expect(updates.map((u) => u.currentTime)).toEqual([1.05]);

    m.pause();
    expect(paused[0].currentTime).toBe(1.05);
  });

  it('reports a seek with where it came from, and says nothing about time while seeking', async () => {
    const { f, m, clock } = await ready();
    const seeks: SvMediaSeekEvent[] = [];
    const updates: SvMediaTimeEvent[] = [];
    f.componentInstance.seekComplete.subscribe((e) => seeks.push(e));
    f.componentInstance.timeUpdate.subscribe((e) => updates.push(e));
    await m.play();
    clock.currentTime = 12;
    vi.spyOn(Date, 'now').mockReturnValue(5_000_000);
    fire(m, 'timeupdate');
    updates.length = 0;

    fire(m, 'seeking');
    clock.currentTime = 90;
    fire(m, 'timeupdate', 'seeked');
    expect(updates).toHaveLength(0);
    expect(seeks).toEqual([expect.objectContaining({ from: 12, to: 90 })]);
  });

  it('starts at the item’s startTime without reporting it as a seek', async () => {
    const f = await mount({ items: [{ id: 'a', title: 'A', src: '/a.webm', startTime: 40 }] });
    const m = media(f);
    const clock = wire(m, 120);
    const seeks: SvMediaSeekEvent[] = [];
    f.componentInstance.seekComplete.subscribe((e) => seeks.push(e));
    fire(m, 'loadstart', 'loadedmetadata', 'seeking', 'seeked');
    expect(clock.currentTime).toBe(40);
    expect(seeks).toHaveLength(0);
  });

  it('marks the current playlist entry and moves on select, next and at the end', async () => {
    const f = await mount();
    const changes: SvMediaTrackChange[] = [];
    f.componentInstance.trackChange.subscribe((e) => changes.push(e));
    const rows = () => [...el(f).querySelectorAll<HTMLButtonElement>('ol button')];
    expect(rows().map((b) => b.getAttribute('aria-current'))).toEqual(['true', null, null]);
    expect(rows()[0].textContent).toContain('Now playing');
    expect(rows()[1].textContent).toContain('5:00');

    rows()[2].click();
    f.detectChanges();
    expect(f.componentInstance.index()).toBe(2);
    expect(changes.at(-1)).toEqual(expect.objectContaining({ index: 2, previousIndex: 0, reason: 'select' }));
    expect(control(f, 'next')!.getAttribute('aria-disabled')).toBe('true');

    control(f, 'previous')!.click();
    f.detectChanges();
    expect(f.componentInstance.index()).toBe(1);

    const m = media(f);
    wire(m, 300);
    fire(m, 'ended');
    f.detectChanges();
    expect(f.componentInstance.index()).toBe(2);
    expect(changes.at(-1)?.reason).toBe('ended');
  });

  it('stays on the item at the end when autoAdvance is off', async () => {
    const { f, m } = await ready({ autoAdvance: false });
    const ended: SvMediaTimeEvent[] = [];
    f.componentInstance.finished.subscribe((e) => ended.push(e));
    fire(m, 'ended');
    f.detectChanges();
    expect(ended).toHaveLength(1);
    expect(f.componentInstance.index()).toBe(0);
    expect(control(f, 'play')!.getAttribute('aria-label')).toBe('Replay');
  });

  it('says why playback failed and retries from where it stopped', async () => {
    const { f, m, clock } = await ready();
    const errors: SvMediaErrorEvent[] = [];
    f.componentInstance.mediaError.subscribe((e) => errors.push(e));
    clock.currentTime = 33;
    fire(m, 'timeupdate');
    clock.error = { code: 2, message: 'net::ERR' };
    fire(m, 'error');
    f.detectChanges();

    const alert = el(f).querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('This media could not be played');
    expect(alert.textContent).toContain('The connection dropped while it was downloading.');
    expect(errors).toEqual([expect.objectContaining({ code: 'network', detail: 'net::ERR' })]);
    expect(control(f, 'play')!.getAttribute('aria-disabled')).toBe('true');

    (alert.querySelector('button') as HTMLButtonElement).click();
    f.detectChanges();
    expect(clock.load).toHaveBeenCalledTimes(1);
    expect(el(f).querySelector('[role="alert"]')).toBeNull();
  });

  it('reports a source the browser cannot play when the last <source> fails', async () => {
    const { f, m, clock } = await ready();
    clock.networkState = 3;
    m.querySelector('source')!.dispatchEvent(new Event('error'));
    f.detectChanges();
    expect(el(f).querySelector('[role="alert"]')?.textContent).toContain('This browser cannot play this file');
  });

  it('refuses an unsafe address without requesting it, and offers no retry', async () => {
    const errors: SvMediaErrorEvent[] = [];
    const f = await mount({ items: [{ id: 'x', title: 'X', src: 'javascript:alert(1)' }] });
    f.componentInstance.mediaError.subscribe((e) => errors.push(e));
    f.componentRef.setInput('items', [{ id: 'y', title: 'Y', src: 'javascript:alert(2)' }]);
    f.detectChanges();
    await f.whenStable();
    const alert = el(f).querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('The address of this media is not allowed.');
    expect(alert.querySelector('button')).toBeNull();
    expect(el(f).querySelectorAll('video source')).toHaveLength(0);
    expect(errors.at(-1)?.code).toBe('unsafe');
  });

  it('cycles captions off → each language → off, and announces it', async () => {
    const f = await mount();
    const captions = control(f, 'captions')!;
    expect(captions.getAttribute('aria-pressed')).toBe('false');
    captions.click();
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    expect(f.componentInstance.captionLanguage()).toBe('en');
    expect(captions.getAttribute('aria-pressed')).toBe('true');
    expect(el(f).querySelector('[role="status"]')?.textContent).toContain('Captions: English');
    captions.click();
    expect(f.componentInstance.captionLanguage()).toBe('es');
    captions.click();
    f.detectChanges();
    expect(f.componentInstance.captionLanguage()).toBeNull();
  });

  it('has no captions button when the item has no tracks', async () => {
    const f = await mount({ index: 1 });
    expect(control(f, 'captions')).toBeNull();
  });

  it('answers the shortcuts inside the player, and leaves Space to a focused button', async () => {
    const { f, m, clock } = await ready();
    const play = vi.spyOn(m, 'play');
    const region = el(f).querySelector('[role="region"]')!;
    key(region, 'k');
    expect(play).toHaveBeenCalledTimes(1);

    key(control(f, 'mute')!, ' ');
    expect(play).toHaveBeenCalledTimes(1);

    key(region, 'm');
    f.detectChanges();
    expect(f.componentInstance.muted()).toBe(true);

    clock.currentTime = 50;
    fire(m, 'timeupdate');
    key(el(f).querySelector('[data-sv-media-stage]')!, 'ArrowLeft');
    expect(clock.currentTime).toBe(45);

    key(region, '>');
    expect(f.componentInstance.playbackRate()).toBe(1.25);
    key(region, 'c');
    expect(f.componentInstance.captionLanguage()).toBe('en');
    // Modifier chords stay the browser's.
    key(region, 'k', { ctrlKey: true });
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('turns shortcuts off with [shortcuts]="false"', async () => {
    const { f, m } = await ready({ shortcuts: false });
    const play = vi.spyOn(m, 'play');
    key(el(f).querySelector('[role="region"]')!, 'k');
    expect(play).not.toHaveBeenCalled();
  });

  it('mutes when autoplaying, and never forces the sound on', async () => {
    const f = await mount({ autoplay: true });
    expect((media(f) as HTMLVideoElement).muted).toBe(true);
    expect(control(f, 'mute')!.getAttribute('aria-pressed')).toBe('true');
    control(f, 'mute')!.click();
    f.detectChanges();
    expect((media(f) as HTMLVideoElement).muted).toBe(false);
  });

  it('draws audio as artwork and title, without full screen or picture in picture', async () => {
    const f = await mount({ kind: 'audio', items: [{ id: 'ep', title: 'Episode 12', subtitle: 'The podcast', src: '/ep12.mp3' }] });
    expect(el(f).querySelector('audio')).toBeTruthy();
    expect(el(f).querySelector('video')).toBeNull();
    expect(el(f).textContent).toContain('Episode 12');
    expect(control(f, 'fullscreen')).toBeNull();
    expect(control(f, 'pip')).toBeNull();
    expect(el(f).querySelector('ol')).toBeNull();
  });

  it('takes per-instance and registry labels', async () => {
    const own = await mount({ labels: { mediaControls: 'Lesson controls' } });
    expect(toolbar(own).getAttribute('aria-label')).toBe('Lesson controls');
    const registry = await mount({}, [provideSvLabels({ display: { mediaPlaylist: 'Up next' } })]);
    expect(el(registry).textContent).toContain('Up next');
  });
});

describeAsyncContract({
  component: SvMediaPlayerComponent,
  collection: 'items',
  rows: ITEMS,
  inputs: { locale: 'en-US' },
  loadedSelector: 'video',
  skip: {
    twoEmpties:
      'a player plays what the host gives it — it has no filter or search of its own, so every empty playlist is `no-data`.',
  },
});
