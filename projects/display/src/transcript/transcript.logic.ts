import { svFormatMediaTime } from '@styloviz/display/media-player';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A colour for a speaker's name. Unset, speakers take these in turn. */
export type SvTranscriptTone = 'primary' | 'accent' | 'info' | 'warning' | 'danger' | 'gray';

/** Someone who speaks in the transcript. */
export interface SvTranscriptSpeaker {
  /** What a segment's `speaker` refers to. */
  readonly id: string;
  /** The name shown above their lines. */
  readonly name: string;
  /** Colour of the name. @default by order of appearance */
  readonly tone?: SvTranscriptTone;
}

/** One stretch of speech — what a speech-to-text service calls a segment, an utterance or a result. */
export interface SvTranscriptSegment {
  /** Stable identity — `itemKey` reads it. */
  readonly id?: string | number;
  /** A speaker's `id` (or, with no `speakers` list, the name itself). Omit when nobody is labelled. */
  readonly speaker?: string;
  /** Where it starts in the recording, in seconds. */
  readonly start: number;
  /** Where it ends, in seconds. Unset, it runs until the next segment starts. */
  readonly end?: number;
  /** What was said. Plain text — never rendered as markup. */
  readonly text: string;
  /**
   * False while the recogniser is still revising it (an interim / partial
   * result). Interim text is shown muted and is never announced or exported.
   * @default true
   */
  readonly final?: boolean;
}

/** The two export formats: plain text with timestamps, and WebVTT captions. */
export type SvTranscriptExportFormat = 'text' | 'vtt';

/** What a linked player must offer — `sv-media-player` already does. */
export interface SvTranscriptPlayer {
  /** Move the playhead to `seconds`. */
  seek(seconds: number): void;
  /** Start playing. Optional: a seek alone is enough. */
  play?(): Promise<void> | void;
}

/** A timestamp was pressed. */
export interface SvTranscriptSeekEvent {
  readonly segment: SvTranscriptSegment;
  /** The segment's index in `segments`. */
  readonly index: number;
  /** Where the player was sent, in seconds. */
  readonly seconds: number;
}

/** The transcript was copied or downloaded. */
export interface SvTranscriptExportEvent {
  readonly format: SvTranscriptExportFormat;
  /** Exactly what was written. */
  readonly content: string;
  /** The download's file name, or null for a copy. */
  readonly filename: string | null;
}

/** A run of text, matched by the search or not. */
export interface SvTranscriptPart {
  /** Offset in the segment's text — a stable key for the run. */
  readonly at: number;
  readonly text: string;
  /** This run matched the search. */
  readonly match: boolean;
  /** For a match: its position among every match in the transcript, from 0. */
  readonly ordinal: number;
}

// ─── Speakers ─────────────────────────────────────────────────────────────────

const TONES: readonly SvTranscriptTone[] = ['primary', 'accent', 'info', 'warning', 'danger', 'gray'];

/** A speaker resolved for display: a name and a tone, whatever the input gave. */
export interface SvResolvedSpeaker {
  readonly id: string;
  readonly name: string;
  readonly tone: SvTranscriptTone;
}

/**
 * Every speaker the segments name, in order of first appearance — the listed
 * ones with their own name and tone, unlisted ids as their own name. Tones not
 * given are handed out in turn, so two people never share one by accident.
 */
export function svTranscriptSpeakers(
  segments: readonly SvTranscriptSegment[],
  speakers: readonly SvTranscriptSpeaker[],
): ReadonlyMap<string, SvResolvedSpeaker> {
  const listed = new Map(speakers.map((s) => [s.id, s] as const));
  const out = new Map<string, SvResolvedSpeaker>();
  let turn = 0;
  const add = (id: string): void => {
    if (out.has(id)) return;
    const known = listed.get(id);
    const tone = known?.tone ?? TONES[turn % TONES.length];
    if (!known?.tone) turn++;
    out.set(id, { id, name: known?.name?.trim() || id, tone });
  };
  for (const s of speakers) add(s.id);
  for (const seg of segments) if (seg.speaker) add(seg.speaker);
  return out;
}

// ─── Time ─────────────────────────────────────────────────────────────────────

/** A finite, non-negative number of seconds, or 0. */
export function svSafeSeconds(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/** WebVTT's `hh:mm:ss.ttt`. */
export function svVttTimestamp(seconds: number): string {
  const ms = Math.round(svSafeSeconds(seconds) * 1000);
  const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

/**
 * The index of the segment playing at `time`: the last one that has started,
 * unless it has an `end` that has passed (a pause between speakers). -1 when
 * nothing is playing, or `time` is null.
 */
export function svActiveSegmentIndex(segments: readonly SvTranscriptSegment[], time: number | null): number {
  if (time === null || !Number.isFinite(time)) return -1;
  let found = -1;
  for (let i = 0; i < segments.length; i++) {
    if (svSafeSeconds(segments[i].start) <= time) found = i;
    else break;
  }
  if (found < 0) return -1;
  const end = segments[found].end;
  return typeof end === 'number' && Number.isFinite(end) && time >= end ? -1 : found;
}

// ─── Search ───────────────────────────────────────────────────────────────────

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

/** A case-insensitive matcher for `query`, or null when the query is blank. */
export function svTranscriptMatcher(query: string): RegExp | null {
  const q = query.trim();
  if (!q) return null;
  return new RegExp(q.replace(REGEX_SPECIALS, '\\$&'), 'giu');
}

/**
 * `text` cut into matched and unmatched runs. `first` is the ordinal the
 * first match takes — pass the running count to number matches across rows.
 */
export function svTranscriptParts(text: string, matcher: RegExp | null, first = 0): SvTranscriptPart[] {
  if (!matcher || !text) return [{ at: 0, text, match: false, ordinal: -1 }];
  const parts: SvTranscriptPart[] = [];
  let last = 0;
  let ordinal = first;
  matcher.lastIndex = 0;
  for (const m of text.matchAll(matcher)) {
    const at = m.index ?? 0;
    if (m[0].length === 0) continue;
    if (at > last) parts.push({ at: last, text: text.slice(last, at), match: false, ordinal: -1 });
    parts.push({ at, text: m[0], match: true, ordinal: ordinal++ });
    last = at + m[0].length;
  }
  if (last < text.length) parts.push({ at: last, text: text.slice(last), match: false, ordinal: -1 });
  return parts.length ? parts : [{ at: 0, text, match: false, ordinal: -1 }];
}

// ─── Export ───────────────────────────────────────────────────────────────────

const isFinal = (s: SvTranscriptSegment): boolean => s.final !== false && s.text.trim().length > 0;

/**
 * Plain text, one line per final segment: `[1:04] Ana: Thanks for calling.`
 * Interim text is left out — it may still change.
 */
export function svTranscriptToText(
  segments: readonly SvTranscriptSegment[],
  speakers: readonly SvTranscriptSpeaker[] = [],
): string {
  const names = svTranscriptSpeakers(segments, speakers);
  return segments
    .filter(isFinal)
    .map((s) => {
      const who = s.speaker ? `${names.get(s.speaker)?.name ?? s.speaker}: ` : '';
      return `[${svFormatMediaTime(svSafeSeconds(s.start))}] ${who}${s.text.trim()}`;
    })
    .join('\n');
}

/** Escape for a WebVTT cue: `&`, `<`, `>` (which also defuses a `-->`). */
function vttEscape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * A WebVTT file of the final segments, each speaker as a `<v Name>` voice
 * span. A segment with no `end` runs to the next one's start (or four seconds,
 * for the last). Text is escaped, so a transcript cannot change the file's
 * structure.
 */
export function svTranscriptToVtt(
  segments: readonly SvTranscriptSegment[],
  speakers: readonly SvTranscriptSpeaker[] = [],
): string {
  const names = svTranscriptSpeakers(segments, speakers);
  const finals = segments.filter(isFinal);
  const cues = finals.map((s, i) => {
    const start = svSafeSeconds(s.start);
    const next = finals[i + 1];
    const given = typeof s.end === 'number' && Number.isFinite(s.end) && s.end > start ? s.end : null;
    const end = given ?? (next && svSafeSeconds(next.start) > start ? svSafeSeconds(next.start) : start + 4);
    const name = s.speaker ? (names.get(s.speaker)?.name ?? s.speaker) : '';
    // A voice name ends at the first `>`, so it is escaped like the text.
    const body = name ? `<v ${vttEscape(name).replace(/\s+/g, ' ')}>${vttEscape(s.text.trim())}` : vttEscape(s.text.trim());
    return `${i + 1}\n${svVttTimestamp(start)} --> ${svVttTimestamp(end)}\n${body.replace(/\n{2,}/g, '\n')}`;
  });
  return ['WEBVTT', ...cues].join('\n\n') + '\n';
}

/** A file name safe on every OS: no path separators or reserved characters. @default 'transcript' */
export function svTranscriptFilename(base: string, format: SvTranscriptExportFormat): string {
  const printable = Array.from(base, (c) => (c.charCodeAt(0) < 32 ? '-' : c)).join('');
  const clean = printable
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
    .slice(0, 120);
  return `${clean || 'transcript'}.${format === 'vtt' ? 'vtt' : 'txt'}`;
}

/** Write text to the clipboard and say whether it landed (absent on the server and over plain HTTP). */
export async function svWriteTranscriptClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
