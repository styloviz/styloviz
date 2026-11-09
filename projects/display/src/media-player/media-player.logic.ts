/**
 * The DOM-free half of `sv-media-player`: its data types, the URL check every
 * source, track and poster goes through, and time formatting.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Which native element the player drives. */
export type SvMediaKind = 'video' | 'audio';

/** One encoding of an item, for a `<source>` element. */
export interface SvMediaSource {
  /** URL of the file — http(s), relative, `blob:` or a `data:audio|video` URI. */
  readonly src: string;
  /** MIME type with codecs, so the browser can skip what it cannot play, e.g. `'video/webm; codecs="vp9"'`. */
  readonly type?: string;
}

/** A WebVTT text track. */
export interface SvMediaTextTrack {
  /** URL of the `.vtt` file — http(s), relative, `blob:` or a `data:text/vtt` URI. */
  readonly src: string;
  /** BCP-47 language of the text; also its identity in `captionLanguage`. */
  readonly srclang: string;
  /** Name shown to the viewer, e.g. "English" or "Español (CC)". */
  readonly label: string;
  /** `captions` include sound descriptions; `subtitles` translate dialogue only. @default 'captions' */
  readonly kind?: 'captions' | 'subtitles';
}

/** One entry of the playlist. */
export interface SvMediaItem {
  /** Stable identity (see `itemKey`). */
  readonly id?: string | number;
  /** Shown in the playlist and used in the player's accessible name. */
  readonly title: string;
  /** Second line — a speaker, an artist, a chapter. */
  readonly subtitle?: string;
  /** A single URL. Use `sources` instead to offer several encodings. */
  readonly src?: string;
  /** Several encodings, best first. Takes precedence over `src`. */
  readonly sources?: readonly SvMediaSource[];
  /** Picture shown before playback (video) or as the artwork (audio). */
  readonly poster?: string;
  /** Text tracks — captions or subtitles. */
  readonly tracks?: readonly SvMediaTextTrack[];
  /** Known length in seconds, shown in the playlist before the file's metadata arrives. */
  readonly duration?: number;
  /** Where playback starts when this item loads, in seconds — a resume point. */
  readonly startTime?: number;
}

/** Why the current item changed. */
export type SvMediaChangeReason = 'next' | 'previous' | 'select' | 'ended';

/** Payload of `played`, `paused`, `finished` and `timeUpdate`. */
export interface SvMediaTimeEvent {
  readonly item: SvMediaItem;
  readonly index: number;
  /** Seconds. */
  readonly currentTime: number;
  /** Seconds; `NaN` until the metadata has loaded, `Infinity` for a live stream. */
  readonly duration: number;
}

/** Payload of `seekComplete`. */
export interface SvMediaSeekEvent {
  readonly item: SvMediaItem;
  readonly index: number;
  /** Where playback was before the seek, in seconds. */
  readonly from: number;
  /** Where it is now. */
  readonly to: number;
}

/** Payload of `trackChange`. */
export interface SvMediaTrackChange {
  readonly item: SvMediaItem;
  readonly index: number;
  readonly previousIndex: number;
  readonly reason: SvMediaChangeReason;
}

/**
 * Why playback failed. The first four are `MediaError` codes; `unsafe` means
 * no source survived the URL check and nothing was requested at all.
 */
export type SvMediaErrorCode = 'aborted' | 'network' | 'decode' | 'unsupported' | 'unsafe';

/** Payload of `mediaError`. */
export interface SvMediaErrorEvent {
  readonly item: SvMediaItem;
  readonly index: number;
  readonly code: SvMediaErrorCode;
  /** The browser's own diagnostic, when it gave one — for logs, not for people. */
  readonly detail: string;
}

// ─── URLs ─────────────────────────────────────────────────────────────────────

const DATA_MEDIA = /^data:(audio|video)\/[\w.+-]+(;[\w=.+-]+)*;base64,/i;
const DATA_VTT = /^data:text\/vtt(;[\w=.+-]+)*[;,]/i;

/**
 * Is this URL safe to hand a `<source>` or a `<track>`?
 *
 * ★★★ RESOLVED, NOT PREFIX-MATCHED — the same reason as core's `svIsSafeUrl`:
 *     ` javascript:` and `java\tscript:` survive a `startsWith` test and the
 *     browser still runs them. Unlike `svIsSafeUrl` this does NOT accept
 *     `mailto:` / `tel:` (nothing to play there) and DOES accept `blob:`, which
 *     is how a recording, an upload or a generated clip reaches a player and is
 *     same-origin by construction. `data:` is accepted only as audio/video
 *     (sources) or WebVTT (tracks).
 */
export function svIsSafeMediaUrl(value: string | null | undefined, purpose: 'media' | 'track' = 'media'): boolean {
  const raw = (value ?? '').trim();
  if (raw === '') return false;
  let url: URL;
  try {
    url = new URL(raw, 'https://styloviz.invalid/');
  } catch {
    return false;
  }
  if (url.protocol === 'data:') return purpose === 'media' ? DATA_MEDIA.test(raw) : DATA_VTT.test(raw);
  return url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'blob:';
}

/** The item's playable sources, unsafe URLs dropped. `sources` wins over `src`. */
export function svMediaSources(item: SvMediaItem | null): readonly SvMediaSource[] {
  if (!item) return [];
  const list = item.sources && item.sources.length > 0 ? item.sources : item.src ? [{ src: item.src }] : [];
  return list.filter((source) => svIsSafeMediaUrl(source.src, 'media'));
}

/** The item's text tracks, unsafe URLs and repeated languages dropped. */
export function svMediaTracks(item: SvMediaItem | null): readonly SvMediaTextTrack[] {
  if (!item?.tracks) return [];
  const seen = new Set<string>();
  return item.tracks.filter((track) => {
    if (!track.srclang || seen.has(track.srclang) || !svIsSafeMediaUrl(track.src, 'track')) return false;
    seen.add(track.srclang);
    return true;
  });
}

// ─── Time ─────────────────────────────────────────────────────────────────────

/**
 * Seconds as a clock: `0:07`, `4:05`, `1:02:09`. Anything not finite or below
 * zero — no metadata yet, a live stream — is `--:--`, never `NaN:NaN`.
 */
export function svFormatMediaTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** `value` clamped into `[min, max]`; a non-number becomes `fallback`. */
export function svClampMedia(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/** The `MediaError` code as the kit's vocabulary. */
export function svMediaErrorCode(code: number | undefined): SvMediaErrorCode {
  switch (code) {
    case 1:
      return 'aborted';
    case 2:
      return 'network';
    case 3:
      return 'decode';
    default:
      return 'unsupported';
  }
}
