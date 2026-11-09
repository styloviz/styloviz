import { DOCUMENT, NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { onReducedMotionChange, prefersReducedMotion, svRovingTarget, svUniqueId } from '@styloviz/core/a11y';
import {
  SvEmptyShellComponent,
  SvErrorShellComponent,
  SvSkeletonShellComponent,
  resolveItemKey,
  type SvDataError,
  type SvItemKey,
} from '@styloviz/core/data';
import { SV_MACHINE_LOCALE, injectSvLabels, svFormatLabel, svLocale } from '@styloviz/core/i18n';
import { svIsSafeUrl } from '@styloviz/core/security';
import { SvIconComponent } from '@styloviz/icons';
import { SV_DISPLAY_LABELS, type SvDisplayLabels } from '../display.labels';
import {
  svClampMedia,
  svFormatMediaTime,
  svMediaErrorCode,
  svMediaSources,
  svMediaTracks,
  type SvMediaChangeReason,
  type SvMediaErrorCode,
  type SvMediaErrorEvent,
  type SvMediaItem,
  type SvMediaKind,
  type SvMediaSeekEvent,
  type SvMediaTimeEvent,
  type SvMediaTrackChange,
} from './media-player.logic';

import { registerMediaPlayerIcons } from './media-player.component.icons';
// ─── Types ────────────────────────────────────────────────────────────────────

/** Where the playlist sits: under the player, or beside it once the player is wide enough. */
export type SvMediaPlaylistPosition = 'bottom' | 'end';

/** How much of the file the browser fetches before play is pressed. */
export type SvMediaPreload = 'none' | 'metadata' | 'auto';

/**
 * `default` is the full player. `compact` is one row for a short audio clip —
 * a voice note, a call recording, a dictated message: play, a seek bar, the
 * time and the speed. It applies to `kind="audio"`; video keeps the full player.
 */
export type SvMediaLayout = 'default' | 'compact';

/** `setSinkId` failed — the device is gone, or the page may not use it. */
export interface SvMediaSinkError {
  /** The output device that was asked for. */
  readonly sinkId: string;
  /** The browser's message, when it gave one. */
  readonly detail: string;
}

/** `HTMLMediaElement.setSinkId` — not in every browser, so it is feature-detected. */
interface SinkCapable {
  setSinkId(sinkId: string): Promise<void>;
}

/** The labels this component reads — the `media*` subset of the `display` namespace. */
export type SvMediaPlayerLabels = Pick<
  SvDisplayLabels,
  | 'mediaPlayer'
  | 'mediaPlayerTitled'
  | 'mediaControls'
  | 'mediaPlay'
  | 'mediaPause'
  | 'mediaReplay'
  | 'mediaPrevious'
  | 'mediaNext'
  | 'mediaSeek'
  | 'mediaTimeOf'
  | 'mediaMute'
  | 'mediaUnmute'
  | 'mediaVolume'
  | 'mediaVolumeValue'
  | 'mediaMutedValue'
  | 'mediaSpeed'
  | 'mediaSpeedValue'
  | 'mediaCaptions'
  | 'mediaCaptionsOn'
  | 'mediaCaptionsOff'
  | 'mediaFullscreen'
  | 'mediaExitFullscreen'
  | 'mediaPictureInPicture'
  | 'mediaExitPictureInPicture'
  | 'mediaPlaylist'
  | 'mediaNowPlaying'
  | 'mediaLoading'
  | 'mediaBuffering'
  | 'mediaErrorTitle'
  | 'mediaErrorNetwork'
  | 'mediaErrorDecode'
  | 'mediaErrorUnsupported'
  | 'mediaErrorAborted'
  | 'mediaErrorUnsafe'
  | 'mediaRetry'
  | 'mediaEmptyTitle'
  | 'mediaEmptyMessage'
  | 'mediaListLoading'
  | 'mediaShortcuts'
  | 'mediaUntitled'
>;

/** A control in the toolbar, in DOM order — the roving tabindex walks this list. */
type ControlId = 'previous' | 'play' | 'next' | 'mute' | 'volume' | 'speed' | 'captions' | 'pip' | 'fullscreen';

/** Where the media element is in its life. */
type MediaStatus = 'idle' | 'loading' | 'ready' | 'buffering' | 'error';

interface PlaylistRow {
  readonly key: string | number;
  readonly index: number;
  readonly title: string;
  readonly subtitle: string;
  readonly duration: string;
  readonly current: boolean;
}

const NETWORK_NO_SOURCE = 3;

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * `sv-media-player` — the kit's chrome around a native `<video>` or `<audio>`:
 * play / pause, a seek slider that speaks the time, volume and mute, playback
 * speed, captions from WebVTT tracks, full screen and picture in picture where
 * the browser has them, and a playlist with next / previous.
 *
 * The controls are one `role="toolbar"` — a single tab stop, ←/→ / Home / End
 * between controls (WAI-ARIA toolbar pattern) — and shortcuts work anywhere in
 * the player: Space or K, ←/→ on the picture, M, F, C, `<` / `>`. It never
 * starts with sound: `autoplay` plays muted, and not at all under reduced motion.
 *
 * `layout="compact"` draws an audio clip as a single row (play, seek, time,
 * speed) — the voice-note / call-recording shape — and `sinkId` routes the
 * sound to a chosen output device where the browser supports `setSinkId`.
 *
 * ```html
 * <sv-media-player [items]="lessons" [(index)]="current"
 *   (timeUpdate)="saveProgress($event)" (finished)="markWatched($event)" />
 * ```
 */
@Component({
  selector: 'sv-media-player',
  standalone: true,
  imports: [NgTemplateOutlet, SvIconComponent, SvSkeletonShellComponent, SvErrorShellComponent, SvEmptyShellComponent],
  templateUrl: './media-player.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class SvMediaPlayerComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerMediaPlayerIcons();

  private readonly registryText = injectSvLabels('display', SV_DISPLAY_LABELS);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // ── Data ──────────────────────────────────────────────────────────────────

  /** What to play — one item for a single clip, several for a playlist. @default [] */
  readonly items = input<readonly SvMediaItem[]>([]);

  /** The item playing, as an index into `items` (two-way). Out-of-range values are clamped. @default 0 */
  readonly index = model<number>(0);

  /** `video` draws the picture; `audio` draws the artwork and title, and shows captions as text. @default 'video' */
  readonly kind = input<SvMediaKind>('video');

  /**
   * `compact` draws an audio clip as one row — play, seek, time, speed — for a
   * voice note or a call recording. No artwork, volume slider or playlist (the
   * M key still mutes). Ignored for `kind="video"`. @default 'default'
   */
  readonly layout = input<SvMediaLayout>('default');

  /**
   * The output device (`MediaDeviceInfo.deviceId`, e.g. from
   * `sv-audio-device-select`'s `outputDeviceId`) the sound plays through.
   * Applied with `setSinkId` where the browser has it, and ignored where it
   * does not; null leaves the system default. @default null
   */
  readonly sinkId = input<string | null>(null);

  // ── Async contract ────────────────────────────────────────────────────────

  /** True while the host is still fetching the playlist. @default false */
  readonly loading = input<boolean>(false);

  /**
   * The playlist failed to load (a string or an `SvDataError`). Playback errors
   * are not this — they show inside the player and emit `mediaError`. @default null
   */
  readonly error = input<SvDataError | string | null>(null);

  /** Identity of an item, a property name or a function. @default 'id' */
  readonly itemKey = input<SvItemKey<SvMediaItem>>('id');

  // ── Playback ──────────────────────────────────────────────────────────────

  /** The caption / subtitle track shown, by `srclang`; null is off (two-way). @default null */
  readonly captionLanguage = model<string | null>(null);

  /** Volume from 0 to 1 (two-way). @default 1 */
  readonly volume = model<number>(1);

  /** Sound off (two-way). @default false */
  readonly muted = model<boolean>(false);

  /** Playback speed (two-way). @default 1 */
  readonly playbackRate = model<number>(1);

  /** The speeds the speed button steps through. @default [0.5, 0.75, 1, 1.25, 1.5, 2] */
  readonly playbackRates = input<readonly number[]>([0.5, 0.75, 1, 1.25, 1.5, 2]);

  /**
   * Start playing as soon as the first item can play — always muted (a viewer
   * turns the sound on), and never when the viewer prefers reduced motion. @default false
   */
  readonly autoplay = input<boolean>(false);

  /** When an item ends, go on to the next one. @default true */
  readonly autoAdvance = input<boolean>(true);

  /** Seconds the arrow keys skip. @default 5 */
  readonly seekStep = input<number>(5);

  /** How much to fetch before play: `none`, `metadata` (length and first frame) or `auto`. @default 'metadata' */
  readonly preload = input<SvMediaPreload>('metadata');

  /** CORS mode for the media and its tracks — set it when the `.vtt` files live on another origin. @default null */
  readonly crossOrigin = input<'anonymous' | 'use-credentials' | null>(null);

  /** Keyboard shortcuts inside the player (Space/K, ←/→, M, F, C, `<`/`>`). @default true */
  readonly shortcuts = input<boolean>(true);

  /** Show the playlist when there is more than one item. @default true */
  readonly showPlaylist = input<boolean>(true);

  /** `bottom` stacks the playlist under the player; `end` puts it beside the player when there is room. @default 'bottom' */
  readonly playlistPosition = input<SvMediaPlaylistPosition>('bottom');

  /** Least time between two `timeUpdate` emissions, in milliseconds. @default 1000 */
  readonly timeUpdateInterval = input<number>(1000);

  /** The player's accessible name. Null derives "<title> — media player". @default null */
  readonly ariaLabel = input<string | null>(null);

  /** BCP-47 locale for the speed figures. @default the kit's locale (`SV_LOCALE`) */
  readonly locale = input<string>(svLocale());

  /** Per-instance text, merged over the registry's `display` labels. @default {} */
  readonly labels = input<Partial<SvMediaPlayerLabels>>({});

  // ── Events ────────────────────────────────────────────────────────────────

  /** Playback started or resumed. */
  readonly played = output<SvMediaTimeEvent>();

  /** Playback paused — by the viewer, by `pause()`, or at the end. */
  readonly paused = output<SvMediaTimeEvent>();

  /** The item played to its end (before any `autoAdvance`). */
  readonly finished = output<SvMediaTimeEvent>();

  /** The playhead moved while playing — at most once per `timeUpdateInterval`, never during a seek. */
  readonly timeUpdate = output<SvMediaTimeEvent>();

  /** The viewer (or `seek()`) moved the playhead — `from` is where it was. Not emitted for an item's `startTime`. */
  readonly seekComplete = output<SvMediaSeekEvent>();

  /** The playlist moved to another item. `index` changes with it. */
  readonly trackChange = output<SvMediaTrackChange>();

  /** The current item could not be played. The player shows the reason and a Try again button. */
  readonly mediaError = output<SvMediaErrorEvent>();

  /** The host should re-run the failed playlist request (`error`). */
  readonly retry = output<void>();

  /** `sinkId` could not be applied — the device was unplugged, or the page is not allowed to choose one. Playback carries on through the default device. */
  readonly sinkError = output<SvMediaSinkError>();

  // ── Labels ────────────────────────────────────────────────────────────────

  /** @internal The labels in effect. */
  protected readonly text = computed<SvMediaPlayerLabels>(() => ({ ...this.registryText, ...this.labels() }));

  protected readonly uid = svUniqueId('sv-media-player');

  // ── Element refs ──────────────────────────────────────────────────────────

  private readonly rootRef = viewChild<ElementRef<HTMLElement>>('root');
  private readonly mediaRef = viewChild<ElementRef<HTMLMediaElement>>('media');
  private readonly toolbarRef = viewChild<ElementRef<HTMLElement>>('toolbar');

  // ── The current item ──────────────────────────────────────────────────────

  /** @internal `index`, clamped into the playlist. */
  protected readonly currentIndex = computed(() => {
    const count = this.items().length;
    if (count === 0) return 0;
    const at = Math.trunc(this.index());
    return Number.isFinite(at) ? Math.min(count - 1, Math.max(0, at)) : 0;
  });

  /** @internal The item on stage, or null for an empty playlist. */
  protected readonly current = computed<SvMediaItem | null>(() => this.items()[this.currentIndex()] ?? null);

  /**
   * @internal The current item in a one-element list, keyed by identity.
   *
   * ★★ The media element is rendered INSIDE this `@for`, so moving to another
   *    item destroys the element and creates a fresh one. That is deliberate:
   *    changing `<source>` children does nothing until `load()` is called, and
   *    a fresh element starts from a clean slate — no stale `error`, no stale
   *    text tracks, no `ended` flag carried over from the last item.
   */
  protected readonly stage = computed(() => {
    const item = this.current();
    if (!item) return [];
    return [{ item, key: resolveItemKey(item, this.itemKey(), this.currentIndex()) }];
  });

  /** @internal Sources that survived the URL check. */
  protected readonly sources = computed(() => svMediaSources(this.current()));

  /** @internal Text tracks that survived the URL check, one per language. */
  protected readonly tracks = computed(() => svMediaTracks(this.current()));

  /** @internal The poster, when its URL is safe (data images allowed). */
  protected readonly poster = computed(() => {
    const poster = this.current()?.poster ?? '';
    return poster && svIsSafeUrl(poster, true) ? poster : null;
  });

  /** @internal Display title. */
  protected readonly title = computed(() => this.current()?.title?.trim() || this.text().mediaUntitled);

  protected readonly regionLabel = computed(
    () =>
      this.ariaLabel() ??
      (this.current() ? svFormatLabel(this.text().mediaPlayerTitled, { title: this.title() }, this.locale()) : this.text().mediaPlayer),
  );

  // ── Playback state ────────────────────────────────────────────────────────

  protected readonly status = signal<MediaStatus>('idle');
  protected readonly isPaused = signal(true);
  protected readonly isEnded = signal(false);
  protected readonly started = signal(false);
  protected readonly time = signal(0);
  protected readonly duration = signal(Number.NaN);
  protected readonly bufferedTo = signal(0);
  protected readonly errorCode = signal<SvMediaErrorCode | null>(null);
  protected readonly isFullscreen = signal(false);
  protected readonly isPip = signal(false);
  /** @internal The active cue's text, for `audio` (video draws its own). */
  protected readonly cueText = signal('');
  /** @internal Polite announcement for changes a button label does not carry (captions, speed). */
  protected readonly announcement = signal('');

  /** True once the viewer has chosen the sound — `autoplay` stops forcing mute from then on. */
  private readonly soundChosen = signal(false);
  private readonly reducedMotion = signal(this.isBrowser && prefersReducedMotion());

  /** @internal What the element's `muted` is bound to. */
  protected readonly effectiveMuted = computed(() => this.muted() || (this.autoplay() && !this.soundChosen()));
  /** @internal `volume`, clamped — the element throws on anything outside 0–1. */
  protected readonly safeVolume = computed(() => svClampMedia(this.volume(), 0, 1, 1));
  /** @internal `playbackRate`, clamped to what every browser accepts. */
  protected readonly safeRate = computed(() => svClampMedia(this.playbackRate(), 0.0625, 16, 1));

  private readonly unsafe = computed(() => this.current() !== null && this.sources().length === 0);

  /** @internal The error on screen: a playback failure, or no playable source at all. */
  protected readonly failure = computed<SvMediaErrorCode | null>(() => (this.unsafe() ? 'unsafe' : this.errorCode()));

  protected readonly failureMessage = computed(() => {
    const t = this.text();
    switch (this.failure()) {
      case 'network':
        return t.mediaErrorNetwork;
      case 'decode':
        return t.mediaErrorDecode;
      case 'aborted':
        return t.mediaErrorAborted;
      case 'unsafe':
        return t.mediaErrorUnsafe;
      case 'unsupported':
        return t.mediaErrorUnsupported;
      default:
        return '';
    }
  });

  /** @internal One-row audio — the voice-note layout. */
  protected readonly compactAudio = computed(() => this.layout() === 'compact' && this.kind() === 'audio');

  /** @internal The compact row shows the length until playback starts, then the position. */
  protected readonly compactTimeText = computed(() => (this.started() ? this.timeText() : this.durationText()));

  protected readonly hasPrevious = computed(() => this.currentIndex() > 0);
  protected readonly hasNext = computed(() => this.currentIndex() < this.items().length - 1);
  protected readonly isPlaylist = computed(() => this.items().length > 1);
  protected readonly showList = computed(() => this.showPlaylist() && this.isPlaylist() && !this.compactAudio());
  /** @internal The playlist sits beside the player (from the container's `3xl` width up). */
  protected readonly listBeside = computed(() => this.showList() && this.playlistPosition() === 'end');

  protected readonly fullscreenSupported = this.isBrowser && this.document.fullscreenEnabled === true;
  protected readonly pipSupported =
    this.isBrowser && 'pictureInPictureEnabled' in this.document && this.document.pictureInPictureEnabled === true;

  // ── Derived text ──────────────────────────────────────────────────────────

  protected readonly timeText = computed(() => svFormatMediaTime(this.time()));
  protected readonly durationText = computed(() => svFormatMediaTime(this.duration()));
  protected readonly seekMax = computed(() => (Number.isFinite(this.duration()) && this.duration() > 0 ? this.duration() : 0));
  protected readonly seekValueText = computed(() =>
    svFormatLabel(this.text().mediaTimeOf, { current: this.timeText(), duration: this.durationText() }, this.locale()),
  );
  /** @internal Played and buffered, as percentages of the bar. */
  protected readonly playedPct = computed(() => (this.seekMax() > 0 ? Math.min(100, (this.time() / this.seekMax()) * 100) : 0));
  protected readonly bufferedPct = computed(() => (this.seekMax() > 0 ? Math.min(100, (this.bufferedTo() / this.seekMax()) * 100) : 0));
  protected readonly volumePct = computed(() => (this.effectiveMuted() ? 0 : Math.round(this.safeVolume() * 100)));
  protected readonly volumeValueText = computed(() =>
    this.effectiveMuted()
      ? this.text().mediaMutedValue
      : svFormatLabel(this.text().mediaVolumeValue, { pct: this.volumePct() }, this.locale()),
  );

  protected readonly rateText = computed(() => this.formatRate(this.safeRate()));
  protected readonly speedLabel = computed(() =>
    svFormatLabel(this.text().mediaSpeed, { rate: this.rateText() }, this.locale()),
  );

  protected readonly activeTrack = computed(() => {
    const lang = this.captionLanguage();
    return lang === null ? null : (this.tracks().find((track) => track.srclang === lang) ?? null);
  });

  protected readonly playLabel = computed(() => {
    const t = this.text();
    if (!this.isPaused()) return t.mediaPause;
    return this.isEnded() ? t.mediaReplay : t.mediaPlay;
  });

  protected readonly shortcutsText = computed(() =>
    svFormatLabel(this.text().mediaShortcuts, { seconds: this.step() }, this.locale()),
  );

  protected readonly playlistRows = computed<readonly PlaylistRow[]>(() => {
    const items = this.items();
    const at = this.currentIndex();
    const key = this.itemKey();
    const t = this.text();
    return items.map((item, index) => {
      const known = index === at && Number.isFinite(this.duration()) ? this.duration() : (item.duration ?? Number.NaN);
      return {
        key: resolveItemKey(item, key, index),
        index,
        title: item.title?.trim() || t.mediaUntitled,
        subtitle: item.subtitle ?? '',
        duration: Number.isFinite(known) ? svFormatMediaTime(known) : '',
        current: index === at,
      };
    });
  });

  /** @internal The toolbar's controls, in DOM order — the list the arrow keys walk. */
  protected readonly controls = computed<readonly ControlId[]>(() => {
    const list: ControlId[] = [];
    const playlist = this.isPlaylist();
    if (playlist) list.push('previous');
    list.push('play');
    if (playlist) list.push('next');
    list.push('mute', 'volume', 'speed');
    if (this.tracks().length > 0) list.push('captions');
    if (this.kind() === 'video' && this.pipSupported) list.push('pip');
    if (this.kind() === 'video' && this.fullscreenSupported) list.push('fullscreen');
    return list;
  });

  private readonly activeControl = signal<ControlId>('play');

  /** @internal The control holding the toolbar's one tab stop. */
  protected readonly tabStop = computed<ControlId>(() =>
    this.controls().includes(this.activeControl()) ? this.activeControl() : 'play',
  );

  // ── Bookkeeping that never reaches the template ───────────────────────────

  private seeking = false;
  private seekFrom = 0;
  private lastTime = 0;
  private lastEmit = Number.NEGATIVE_INFINITY;
  /** Play as soon as the next element can — set by next/previous mid-play and by Try again. */
  private playOnLoad = false;
  /** Where the next element should start; null uses the item's own `startTime`. */
  private resumeAt: number | null = null;
  /** The seek to `startTime` is the player's, not the viewer's — `seekComplete` stays quiet for it. */
  private restoring = false;
  /** Autoplay happens for the first item only; after that playback follows the viewer. */
  private autoplayDone = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    if (this.isBrowser) {
      const stopMotion = onReducedMotionChange((reduced) => this.reducedMotion.set(reduced));
      const onFullscreen = (): void => {
        const root = this.rootRef()?.nativeElement;
        this.isFullscreen.set(root !== undefined && this.document.fullscreenElement === root);
      };
      this.document.addEventListener('fullscreenchange', onFullscreen);
      destroyRef.onDestroy(() => {
        stopMotion();
        this.document.removeEventListener('fullscreenchange', onFullscreen);
        const root = this.rootRef()?.nativeElement;
        if (root && this.document.fullscreenElement === root) void this.document.exitFullscreen().catch(() => undefined);
      });
    }

    // Captions follow `captionLanguage` — and are re-applied whenever a new
    // element is created, because a fresh element starts with every track off.
    effect(() => {
      const lang = this.captionLanguage();
      const el = this.mediaRef()?.nativeElement;
      const asText = this.kind() === 'audio';
      this.tracks();
      if (!el?.textTracks) return;
      for (const track of Array.from(el.textTracks)) {
        track.mode = lang !== null && track.language === lang ? (asText ? 'hidden' : 'showing') : 'disabled';
      }
      if (lang === null) this.cueText.set('');
    });

    // The output device. A fresh element (a new item) starts on the default
    // device, so this re-runs whenever the element changes.
    effect(() => {
      const sinkId = this.sinkId();
      const el = this.mediaRef()?.nativeElement;
      if (!el || sinkId === null || !this.isBrowser || !('setSinkId' in el)) return;
      void (el as HTMLMediaElement & SinkCapable).setSinkId(sinkId).catch((err: unknown) => {
        untracked(() => this.sinkError.emit({ sinkId, detail: err instanceof Error ? err.message : '' }));
      });
    });

    // An item with no playable source never reaches the element's own `error`
    // event (nothing is requested), so the host hears about it here.
    // Once per item: a host that re-binds a fresh array is not told again.
    let reported: string | number | null = null;
    effect(() => {
      const entry = this.stage()[0];
      if (!entry || !this.unsafe()) {
        reported = null;
        return;
      }
      if (entry.key === reported) return;
      reported = entry.key;
      const index = this.currentIndex();
      untracked(() => this.mediaError.emit({ item: entry.item, index, code: 'unsafe', detail: '' }));
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Start or resume playback. Resolves once playing, or when the browser refused (it stays paused). */
  async play(): Promise<void> {
    const el = this.mediaRef()?.nativeElement;
    if (!el || this.failure()) return;
    try {
      await el.play();
    } catch {
      // NotAllowedError (no user gesture) or an aborted load — stay paused.
    }
  }

  /** Pause playback. */
  pause(): void {
    this.mediaRef()?.nativeElement.pause();
  }

  /** Play when paused, pause when playing. */
  togglePlay(): void {
    if (this.isPaused()) void this.play();
    else this.pause();
  }

  /** Move the playhead to `seconds` (clamped to the item). Emits `seekComplete`. */
  seek(seconds: number): void {
    const el = this.mediaRef()?.nativeElement;
    if (!el) return;
    const max = this.seekMax();
    el.currentTime = svClampMedia(seconds, 0, max > 0 ? max : Number.MAX_SAFE_INTEGER, 0);
  }

  /** Go to the next item, if there is one. */
  next(): void {
    if (this.hasNext()) this.goTo(this.currentIndex() + 1, 'next');
  }

  /** Go to the previous item, if there is one. */
  previous(): void {
    if (this.hasPrevious()) this.goTo(this.currentIndex() - 1, 'previous');
  }

  /** Play item `index` of the playlist. */
  select(index: number): void {
    if (index !== this.currentIndex() && index >= 0 && index < this.items().length) this.goTo(index, 'select', true);
  }

  // ── Controls ──────────────────────────────────────────────────────────────

  protected toggleMute(): void {
    // Read before choosing the sound: choosing it lifts autoplay's forced mute.
    const nowMuted = this.effectiveMuted();
    this.soundChosen.set(true);
    this.muted.set(!nowMuted);
    if (nowMuted && this.safeVolume() === 0) this.volume.set(0.5);
  }

  protected onVolumeInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value) / 100;
    this.soundChosen.set(true);
    this.volume.set(svClampMedia(value, 0, 1, 1));
    this.muted.set(value === 0);
  }

  protected cycleRate(direction: 1 | -1 = 1): void {
    const rates = [...new Set(this.playbackRates().filter((r) => Number.isFinite(r) && r > 0))].sort((a, b) => a - b);
    if (rates.length === 0) return;
    const now = this.safeRate();
    let next: number;
    if (direction > 0) next = rates.find((r) => r > now + 1e-9) ?? rates[0];
    else next = [...rates].reverse().find((r) => r < now - 1e-9) ?? rates[rates.length - 1];
    this.playbackRate.set(next);
    this.announce(svFormatLabel(this.text().mediaSpeed, { rate: this.formatRate(next) }, this.locale()));
  }

  /** Off → each track in turn → off. */
  protected cycleCaptions(): void {
    const tracks = this.tracks();
    if (tracks.length === 0) return;
    const at = tracks.findIndex((track) => track.srclang === this.captionLanguage());
    const next = at + 1 < tracks.length ? tracks[at + 1] : null;
    this.captionLanguage.set(next?.srclang ?? null);
    this.announce(
      next
        ? svFormatLabel(this.text().mediaCaptionsOn, { label: next.label }, this.locale())
        : this.text().mediaCaptionsOff,
    );
  }

  protected toggleFullscreen(): void {
    const root = this.rootRef()?.nativeElement;
    if (!root || !this.fullscreenSupported) return;
    if (this.document.fullscreenElement === root) void this.document.exitFullscreen().catch(() => undefined);
    else void root.requestFullscreen().catch(() => undefined);
  }

  protected togglePictureInPicture(): void {
    const el = this.mediaRef()?.nativeElement;
    if (!(el instanceof HTMLVideoElement) || !this.pipSupported) return;
    if (this.document.pictureInPictureElement === el) void this.document.exitPictureInPicture().catch(() => undefined);
    else void el.requestPictureInPicture().catch(() => undefined);
  }

  /** Try the failed item again, from where it stopped. */
  protected reload(): void {
    const el = this.mediaRef()?.nativeElement;
    if (!el || this.unsafe()) return;
    this.resumeAt = this.lastTime > 0 ? this.lastTime : null;
    this.playOnLoad = this.started();
    this.errorCode.set(null);
    el.load();
  }

  private goTo(index: number, reason: SvMediaChangeReason, play = !this.isPaused()): void {
    const previousIndex = this.currentIndex();
    const item = this.items()[index];
    if (!item) return;
    this.playOnLoad = play;
    this.resumeAt = null;
    this.index.set(index);
    this.trackChange.emit({ item, index, previousIndex, reason });
  }

  // ── Media element events ──────────────────────────────────────────────────

  protected onLoadStart(): void {
    this.status.set('loading');
    this.errorCode.set(null);
    this.isPaused.set(true);
    this.isEnded.set(false);
    this.time.set(0);
    this.duration.set(Number.NaN);
    this.bufferedTo.set(0);
    this.cueText.set('');
    this.seeking = false;
    this.lastTime = 0;
    this.lastEmit = Number.NEGATIVE_INFINITY;
  }

  protected onLoadedMetadata(el: HTMLMediaElement): void {
    this.duration.set(el.duration);
    if (this.status() === 'loading') this.status.set('ready');
    const start = this.resumeAt ?? this.current()?.startTime ?? 0;
    this.resumeAt = null;
    if (start > 0 && (!Number.isFinite(el.duration) || start < el.duration)) {
      this.restoring = true;
      el.currentTime = start;
      this.time.set(start);
      this.lastTime = start;
    }
    const autoplayNow = this.autoplay() && !this.autoplayDone && !this.reducedMotion();
    this.autoplayDone = true;
    if (this.playOnLoad || autoplayNow) {
      this.playOnLoad = false;
      void this.play();
    }
  }

  protected onDurationChange(el: HTMLMediaElement): void {
    this.duration.set(el.duration);
  }

  protected onTimeUpdate(el: HTMLMediaElement): void {
    const at = el.currentTime;
    this.time.set(at);
    if (this.seeking) return;
    this.lastTime = at;
    if (el.paused) return;
    const now = Date.now();
    if (now - this.lastEmit >= Math.max(0, this.timeUpdateInterval())) {
      this.lastEmit = now;
      this.timeUpdate.emit(this.timeEvent(el));
    }
  }

  protected onPlay(el: HTMLMediaElement): void {
    this.isPaused.set(false);
    this.isEnded.set(false);
    this.started.set(true);
    this.lastEmit = Date.now();
    this.played.emit(this.timeEvent(el));
  }

  protected onPlaying(): void {
    this.status.set('ready');
  }

  protected onPause(el: HTMLMediaElement): void {
    this.isPaused.set(true);
    this.paused.emit(this.timeEvent(el));
  }

  protected onWaiting(): void {
    if (this.status() !== 'error') this.status.set('buffering');
  }

  protected onCanPlay(): void {
    if (this.status() === 'buffering' || this.status() === 'loading') this.status.set('ready');
  }

  protected onSeeking(): void {
    if (this.seeking) return;
    this.seeking = true;
    this.seekFrom = this.lastTime;
  }

  protected onSeeked(el: HTMLMediaElement): void {
    this.seeking = false;
    const to = el.currentTime;
    this.time.set(to);
    const from = this.seekFrom;
    this.lastTime = to;
    if (this.restoring) {
      this.restoring = false;
      return;
    }
    const item = this.current();
    if (item) this.seekComplete.emit({ item, index: this.currentIndex(), from, to });
  }

  protected onEnded(el: HTMLMediaElement): void {
    this.isEnded.set(true);
    this.isPaused.set(true);
    this.finished.emit(this.timeEvent(el));
    if (this.autoAdvance() && this.hasNext()) this.goTo(this.currentIndex() + 1, 'ended', true);
  }

  protected onProgress(el: HTMLMediaElement): void {
    const ranges = el.buffered;
    const at = el.currentTime;
    for (let i = 0; i < ranges.length; i++) {
      if (ranges.start(i) <= at + 0.5 && ranges.end(i) >= at) {
        this.bufferedTo.set(ranges.end(i));
        return;
      }
    }
  }

  protected onVolumeChange(el: HTMLMediaElement): void {
    if (el.muted !== this.effectiveMuted()) this.muted.set(el.muted);
    if (Math.abs(el.volume - this.safeVolume()) > 0.001) this.volume.set(el.volume);
  }

  protected onRateChange(el: HTMLMediaElement): void {
    if (Math.abs(el.playbackRate - this.safeRate()) > 0.001) this.playbackRate.set(el.playbackRate);
  }

  protected onMediaError(el: HTMLMediaElement): void {
    this.fail(svMediaErrorCode(el.error?.code), el.error?.message ?? '');
  }

  /**
   * ★★ A failing `<source>` fires `error` on the SOURCE, not on the media
   *    element — `el.error` stays null and the element just gives up. Only the
   *    last source failing means nothing can play, which `networkState` says.
   */
  protected onSourceError(el: HTMLMediaElement, last: boolean): void {
    if (last && el.networkState === NETWORK_NO_SOURCE) this.fail('unsupported', '');
  }

  protected onPictureInPicture(active: boolean): void {
    this.isPip.set(active);
  }

  protected onCueChange(event: Event): void {
    const track = (event.target as HTMLTrackElement).track;
    if (track.mode === 'disabled') return;
    const cues = track.activeCues;
    const lines: string[] = [];
    for (let i = 0; cues && i < cues.length; i++) {
      const cue = cues[i] as VTTCue;
      // Plain text only — cue markup (<b>, <v Speaker>) is dropped, never rendered.
      lines.push((cue.text ?? '').replace(/<[^>]*>/g, ''));
    }
    this.cueText.set(lines.join('\n'));
  }

  /** Enter on the picture itself plays or pauses — not Enter on a button inside it. */
  protected onStageEnter(event: Event): void {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    this.togglePlay();
  }

  // ── Seek slider ───────────────────────────────────────────────────────────

  protected onSeekInput(event: Event): void {
    this.seek(Number((event.target as HTMLInputElement).value));
  }

  /** The slider's keys skip by `seekStep` (native steps would be a hundredth of the item). */
  protected onSeekKeydown(event: KeyboardEvent): void {
    const max = this.seekMax();
    if (max <= 0) return;
    const step = this.step();
    const page = Math.max(step, max / 10);
    const at = this.time();
    let to: number;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        to = at - step;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        to = at + step;
        break;
      case 'PageDown':
        to = at - page;
        break;
      case 'PageUp':
        to = at + page;
        break;
      case 'Home':
        to = 0;
        break;
      case 'End':
        to = max;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.seek(to);
  }

  // ── Toolbar (WAI-ARIA toolbar pattern) ────────────────────────────────────

  protected tabIndexFor(id: ControlId): 0 | -1 {
    return this.tabStop() === id ? 0 : -1;
  }

  protected onToolbarFocusIn(event: FocusEvent): void {
    const id = (event.target as HTMLElement).closest('[data-sv-media-control]')?.getAttribute('data-sv-media-control');
    if (id && (this.controls() as readonly string[]).includes(id)) this.activeControl.set(id as ControlId);
  }

  /**
   * ←/→ / Home / End move between controls. On the volume slider ↑/↓ still
   * change the volume — the horizontal keys belong to the toolbar, so no
   * control traps focus (APG: a toolbar control that needs arrow keys).
   */
  protected onToolbarKeydown(event: KeyboardEvent): void {
    let key = event.key;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;
    const toolbar = this.toolbarRef()?.nativeElement;
    if (!toolbar) return;
    if (this.isRtl() && (key === 'ArrowLeft' || key === 'ArrowRight')) key = key === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
    const list = this.controls();
    const id = (event.target as HTMLElement).closest('[data-sv-media-control]')?.getAttribute('data-sv-media-control') ?? '';
    const next = svRovingTarget(key, list.length, list.indexOf(id as ControlId));
    if (next === null) return;
    event.preventDefault();
    this.activeControl.set(list[next]);
    toolbar.querySelector<HTMLElement>(`[data-sv-media-control="${list[next]}"]`)?.focus();
  }

  // ── Shortcuts ─────────────────────────────────────────────────────────────

  /** Player-wide shortcuts. Keys a focused control already uses are left to it. */
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.shortcuts() || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!this.current() || this.failure()) return;
    const target = event.target as HTMLElement;
    const tag = target.tagName;
    const isButton = tag === 'BUTTON';
    const isRange = target instanceof HTMLInputElement && target.type === 'range';
    if ((tag === 'INPUT' && !isRange) || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
    const onPicture = target.hasAttribute('data-sv-media-stage');

    switch (event.key) {
      case ' ':
        if (isButton) return;
        this.togglePlay();
        break;
      case 'k':
      case 'K':
        this.togglePlay();
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        if (!onPicture) return;
        this.seek(this.time() + (event.key === 'ArrowRight' ? this.step() : -this.step()));
        break;
      case 'm':
      case 'M':
        this.toggleMute();
        break;
      case 'f':
      case 'F':
        if (this.kind() !== 'video' || !this.fullscreenSupported) return;
        this.toggleFullscreen();
        break;
      case 'c':
      case 'C':
        if (this.tracks().length === 0) return;
        this.cycleCaptions();
        break;
      case '>':
        this.cycleRate(1);
        break;
      case '<':
        this.cycleRate(-1);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  protected step(): number {
    return svClampMedia(this.seekStep(), 1, 600, 5);
  }

  private timeEvent(el: HTMLMediaElement): SvMediaTimeEvent {
    return {
      item: this.current() as SvMediaItem,
      index: this.currentIndex(),
      currentTime: el.currentTime,
      duration: el.duration,
    };
  }

  private fail(code: SvMediaErrorCode, detail: string): void {
    this.status.set('error');
    this.errorCode.set(code);
    this.isPaused.set(true);
    const item = this.current();
    if (item) this.mediaError.emit({ item, index: this.currentIndex(), code, detail });
  }

  private announce(message: string): void {
    // Clear first so the same message twice in a row is still spoken.
    this.announcement.set('');
    queueMicrotask(() => this.announcement.set(message));
  }

  private formatRate(rate: number): string {
    let figure: string;
    try {
      figure = new Intl.NumberFormat(this.locale() || SV_MACHINE_LOCALE, { maximumFractionDigits: 2 }).format(rate);
    } catch {
      figure = String(rate);
    }
    return svFormatLabel(this.text().mediaSpeedValue, { rate: figure }, this.locale());
  }

  private isRtl(): boolean {
    const root = this.rootRef()?.nativeElement;
    return !!root && typeof getComputedStyle === 'function' && getComputedStyle(root).direction === 'rtl';
  }
}
