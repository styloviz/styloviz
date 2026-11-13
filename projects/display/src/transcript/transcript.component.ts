import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  afterRenderEffect,
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
import { svUniqueId } from '@styloviz/core/a11y';
import {
  SvEmptyShellComponent,
  SvErrorShellComponent,
  SvSkeletonShellComponent,
  createDebouncer,
  resolveItemKey,
  type SvDataError,
  type SvItemKey,
} from '@styloviz/core/data';
import { svDownloadText } from '@styloviz/core/export';
import { injectSvLabels, svFormatLabel, svLocale } from '@styloviz/core/i18n';
import { SvIconComponent } from '@styloviz/icons/core';
import { SV_DISPLAY_LABELS, type SvDisplayLabels } from '@styloviz/display/labels';
import { svFormatMediaTime } from '@styloviz/display/media-player';
import {
  svActiveSegmentIndex,
  svSafeSeconds,
  svTranscriptFilename,
  svTranscriptMatcher,
  svTranscriptParts,
  svTranscriptSpeakers,
  svTranscriptToText,
  svTranscriptToVtt,
  svWriteTranscriptClipboard,
  type SvTranscriptExportEvent,
  type SvTranscriptExportFormat,
  type SvTranscriptPart,
  type SvTranscriptPlayer,
  type SvTranscriptSeekEvent,
  type SvTranscriptSegment,
  type SvTranscriptSpeaker,
  type SvTranscriptTone,
} from './transcript.logic';

import { registerTranscriptIcons } from './transcript.component.icons';

// ─── Types ────────────────────────────────────────────────────────────────────

/** The labels this component reads — the `transcript*` subset of the `display` namespace. */
export type SvTranscriptLabels = Pick<
  SvDisplayLabels,
  | 'transcript'
  | 'transcriptLive'
  | 'transcriptSearch'
  | 'transcriptSearchPlaceholder'
  | 'transcriptMatchCount'
  | 'transcriptNoMatches'
  | 'transcriptPreviousMatch'
  | 'transcriptNextMatch'
  | 'transcriptClearSearch'
  | 'transcriptActions'
  | 'transcriptCopy'
  | 'transcriptCopied'
  | 'transcriptCopyFailed'
  | 'transcriptDownloadText'
  | 'transcriptDownloadVtt'
  | 'transcriptPlayFrom'
  | 'transcriptJumpTo'
  | 'transcriptInterim'
  | 'transcriptSpeakerSaid'
  | 'transcriptNowPlaying'
  | 'transcriptJumpToLatest'
  | 'transcriptLoading'
  | 'transcriptEmptyTitle'
  | 'transcriptEmptyMessage'
  | 'transcriptLiveEmptyMessage'
  | 'transcriptNoResultsTitle'
  | 'transcriptNoResultsMessage'
  | 'transcriptFilteredMessage'
>;

interface TranscriptRow {
  readonly key: string | number;
  readonly index: number;
  readonly segment: SvTranscriptSegment;
  readonly start: number;
  readonly time: string;
  readonly speaker: string;
  readonly toneClass: string;
  /** Shown only when the speaker changes (or `collapseSpeakers` is off). */
  readonly showSpeaker: boolean;
  readonly final: boolean;
  readonly parts: readonly SvTranscriptPart[];
  readonly matches: number;
  /** The timestamp button's name: "Play from 0:05, Jordan Lee". */
  readonly seekLabel: string;
}

const TONE_CLASS: Readonly<Record<SvTranscriptTone, string>> = {
  primary: 'text-primary-700 dark:text-primary-300',
  accent: 'text-accent-700 dark:text-accent-300',
  info: 'text-info-700 dark:text-info-300',
  warning: 'text-warning-800 dark:text-warning-300',
  danger: 'text-danger-700 dark:text-danger-300',
  gray: 'text-gray-700 dark:text-gray-300',
};

/** A CSS length the scroll area accepts — anything else falls back to the default. */
const CSS_LENGTH = /^(none|\d+(\.\d+)?(px|rem|em|vh|dvh|svh|%))$/;

const COPY_FEEDBACK_MS = 2000;

/** Within this many pixels of the bottom counts as "at the latest line". */
const END_SLACK_PX = 24;

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * `sv-transcript` — a speech transcript: speaker-labelled segments with
 * timestamps, interim (still-changing) text shown apart from final text, the
 * line playing highlighted, a timestamp that seeks a linked player, search with
 * highlighted matches, and copy / download as plain text or WebVTT.
 *
 * In `live` mode new final lines are announced politely (interim text never
 * is), and the view follows the latest line until the reader scrolls up.
 *
 * ```html
 * <sv-media-player #player kind="audio" [items]="[call]" (timeUpdate)="t.set($event.currentTime)" />
 * <sv-transcript [segments]="segments" [speakers]="speakers" [player]="player" [currentTime]="t()" />
 * ```
 */
@Component({
  selector: 'sv-transcript',
  standalone: true,
  imports: [SvIconComponent, SvSkeletonShellComponent, SvErrorShellComponent, SvEmptyShellComponent],
  templateUrl: './transcript.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class SvTranscriptComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerTranscriptIcons();

  private readonly registryText = injectSvLabels('display', SV_DISPLAY_LABELS);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);

  // ── Data ──────────────────────────────────────────────────────────────────

  /** The segments, in time order. Interim ones (`final: false`) are revised in place by the host. @default [] */
  readonly segments = input<readonly SvTranscriptSegment[]>([]);

  /** Who speaks — names and tones for the ids segments use. Unlisted ids show as themselves. @default [] */
  readonly speakers = input<readonly SvTranscriptSpeaker[]>([]);

  /** True while the host is still fetching the transcript. @default false */
  readonly loading = input<boolean>(false);

  /** The transcript failed to load (a string or an `SvDataError`). @default null */
  readonly error = input<SvDataError | string | null>(null);

  /** Identity of a segment, a property name or a function. @default 'id' */
  readonly itemKey = input<SvItemKey<SvTranscriptSegment>>('id');

  /**
   * The host has a filter or a server-side search applied, so an empty
   * `segments` means "nothing matches" rather than "nothing transcribed". @default false
   */
  readonly filtered = input<boolean>(false);

  // ── Playback ──────────────────────────────────────────────────────────────

  /** The player's position in seconds — the matching line is highlighted. Null highlights nothing. @default null */
  readonly currentTime = input<number | null>(null);

  /** A player to seek when a timestamp is pressed — `sv-media-player` fits, or anything with `seek(seconds)`. @default null */
  readonly player = input<SvTranscriptPlayer | null>(null);

  /** After seeking the linked player, also start it playing. @default true */
  readonly playOnSeek = input<boolean>(true);

  /** Scroll the line playing into view as playback moves. @default true */
  readonly followPlayback = input<boolean>(true);

  // ── Live ──────────────────────────────────────────────────────────────────

  /**
   * Transcription is happening now: new final lines are announced politely
   * (interim text never is), a Live badge shows, and the view stays on the
   * latest line until the reader scrolls up. @default false
   */
  readonly live = input<boolean>(false);

  // ── Display ───────────────────────────────────────────────────────────────

  /** Show each segment's timestamp (a button that seeks). @default true */
  readonly showTimestamps = input<boolean>(true);

  /** Show speaker names. @default true */
  readonly showSpeakers = input<boolean>(true);

  /** Show a speaker's name only when the speaker changes. @default true */
  readonly collapseSpeakers = input<boolean>(true);

  /** Height cap of the scrolling list, as a CSS length (`24rem`, `60vh`, `none`). @default '24rem' */
  readonly maxHeight = input<string>('24rem');

  // ── Search ────────────────────────────────────────────────────────────────

  /** Show the search box. @default true */
  readonly searchable = input<boolean>(true);

  /** The search text (two-way). Matches are highlighted; it settles after `debounceMs`. @default '' */
  readonly query = model<string>('');

  /** Only show segments that match the search, instead of highlighting them in place. @default false */
  readonly filterOnSearch = input<boolean>(false);

  /** Milliseconds the search waits after the last keystroke before it settles (and `queryChange` fires). @default 250 */
  readonly debounceMs = input<number>(250);

  // ── Export ────────────────────────────────────────────────────────────────

  /** Show the Copy button. @default true */
  readonly copyable = input<boolean>(true);

  /** The download buttons to offer: plain `text` (`[1:04] Ana: …`) and `vtt` (WebVTT with voice spans). @default ['text', 'vtt'] */
  readonly exportFormats = input<readonly SvTranscriptExportFormat[]>(['text', 'vtt']);

  /** Download file name, without the extension. @default 'transcript' */
  readonly exportFilename = input<string>('transcript');

  // ── Text ──────────────────────────────────────────────────────────────────

  /** The transcript's accessible name. @default the `transcript` label */
  readonly ariaLabel = input<string | null>(null);

  /** BCP-47 locale for the match count. @default the kit's locale (`SV_LOCALE`) */
  readonly locale = input<string>(svLocale());

  /** Per-instance text, merged over the registry's `display` labels. @default {} */
  readonly labels = input<Partial<SvTranscriptLabels>>({});

  // ── Events ────────────────────────────────────────────────────────────────

  /** A timestamp was pressed. Emitted whether or not a `player` is linked. */
  readonly seek = output<SvTranscriptSeekEvent>();

  /** The transcript was copied to the clipboard (only when the write succeeded). */
  readonly copied = output<SvTranscriptExportEvent>();

  /** A text or WebVTT file was downloaded. */
  readonly exported = output<SvTranscriptExportEvent>();

  /** The host should re-run the failed transcript request (`error`). */
  readonly retry = output<void>();

  /** "Clear filters" was pressed on a `filtered` empty result — the host should drop its filter. */
  readonly clearFilters = output<void>();

  // ── Labels ────────────────────────────────────────────────────────────────

  /** @internal The labels in effect. */
  protected readonly text = computed<SvTranscriptLabels>(() => ({ ...this.registryText, ...this.labels() }));

  protected readonly uid = svUniqueId('sv-transcript');

  /** @internal The download buttons' visible format names — file extensions, the same in every language. */
  protected readonly formatNames = { text: 'TXT', vtt: 'VTT' } as const; // sv-i18n-ignore: file-format names

  private readonly scrollRef = viewChild<ElementRef<HTMLElement>>('scroller');

  // ── Search ────────────────────────────────────────────────────────────────

  /** @internal What the box shows (raw) and what the highlight uses (settled). */
  protected readonly search = createDebouncer('', { delayMs: this.debounceMs, destroyRef: this.destroyRef });

  /** @internal The match the arrows are on, by ordinal. */
  protected readonly matchCursor = signal(0);

  private readonly matcher = computed(() => svTranscriptMatcher(this.search.value()));

  // ── Rows ──────────────────────────────────────────────────────────────────

  private readonly speakerMap = computed(() => svTranscriptSpeakers(this.segments(), this.speakers()));

  /** @internal Every segment, resolved for display, with its search runs. */
  private readonly allRows = computed<readonly TranscriptRow[]>(() => {
    const segments = this.segments();
    const names = this.speakerMap();
    const key = this.itemKey();
    const matcher = this.matcher();
    let ordinal = 0;
    return segments.map((segment, index) => {
      const parts = svTranscriptParts(segment.text ?? '', matcher, ordinal);
      const matches = parts.filter((p) => p.match).length;
      ordinal += matches;
      const who = segment.speaker ? names.get(segment.speaker) : undefined;
      const start = svSafeSeconds(segment.start);
      return {
        key: resolveItemKey(segment, key, index),
        index,
        segment,
        start,
        time: svFormatMediaTime(start),
        speaker: who?.name ?? '',
        toneClass: TONE_CLASS[who?.tone ?? 'gray'],
        showSpeaker: false,
        final: segment.final !== false,
        parts,
        matches,
        seekLabel: '',
      };
    });
  });

  /** @internal The rows on screen — all of them, or only matches under `filterOnSearch`. */
  protected readonly rows = computed<readonly TranscriptRow[]>(() => {
    const filtering = this.filterOnSearch() && this.matcher() !== null;
    const source = filtering ? this.allRows().filter((r) => r.matches > 0) : this.allRows();
    const collapse = this.collapseSpeakers() && !filtering;
    const speakers = this.showSpeakers();
    const t = this.text();
    const template = this.player() && this.playOnSeek() ? t.transcriptPlayFrom : t.transcriptJumpTo;
    const locale = this.locale();
    return source.map((row, i) => {
      const time = svFormatLabel(template, { time: row.time }, locale);
      return {
        ...row,
        showSpeaker: speakers && row.speaker !== '' && (!collapse || i === 0 || source[i - 1].speaker !== row.speaker),
        seekLabel: row.speaker ? `${time}, ${row.speaker}` : time,
      };
    });
  });

  /** @internal Matches across the whole transcript. */
  protected readonly matchCount = computed(() => this.allRows().reduce((n, r) => n + r.matches, 0));

  protected readonly hasQuery = computed(() => this.matcher() !== null);

  protected readonly matchText = computed(() => {
    const count = this.matchCount();
    if (!this.hasQuery()) return '';
    if (count === 0) return this.text().transcriptNoMatches;
    return svFormatLabel(this.text().transcriptMatchCount, { current: this.safeCursor() + 1, count }, this.locale());
  });

  /** @internal `matchCursor`, kept inside the match count. */
  protected readonly safeCursor = computed(() => {
    const count = this.matchCount();
    return count === 0 ? 0 : Math.min(count - 1, Math.max(0, this.matchCursor()));
  });

  // ── Playback ──────────────────────────────────────────────────────────────

  /** @internal Key of the segment playing, or null. */
  protected readonly activeKey = computed<string | number | null>(() => {
    const at = svActiveSegmentIndex(this.segments(), this.currentTime());
    return at < 0 ? null : (this.allRows()[at]?.key ?? null);
  });

  // ── Empty states ──────────────────────────────────────────────────────────

  /** @internal No rows to draw: nothing transcribed, or nothing matching. */
  protected readonly emptyReason = computed<'no-data' | 'no-results' | null>(() => {
    if (this.rows().length > 0) return null;
    return this.filtered() || (this.segments().length > 0 && this.hasQuery()) ? 'no-results' : 'no-data';
  });

  protected readonly emptyMessage = computed(() => {
    const t = this.text();
    if (this.emptyReason() === 'no-results') {
      return this.hasQuery()
        ? svFormatLabel(t.transcriptNoResultsMessage, { query: this.search.value().trim() }, this.locale())
        : t.transcriptFilteredMessage;
    }
    return this.live() ? t.transcriptLiveEmptyMessage : t.transcriptEmptyMessage;
  });

  // ── Toolbar ───────────────────────────────────────────────────────────────

  protected readonly regionLabel = computed(() => this.ariaLabel() ?? this.text().transcript);

  protected readonly scrollMax = computed(() => {
    const value = this.maxHeight().trim();
    return CSS_LENGTH.test(value) ? value : '24rem';
  });

  protected readonly canExport = computed(() => this.segments().some((s) => s.final !== false && (s.text ?? '').trim() !== ''));
  protected readonly offersText = computed(() => this.exportFormats().includes('text'));
  protected readonly offersVtt = computed(() => this.exportFormats().includes('vtt'));
  protected readonly showToolbar = computed(
    () => this.searchable() || this.copyable() || this.offersText() || this.offersVtt() || this.live(),
  );

  protected readonly copyState = signal<'idle' | 'done' | 'failed'>('idle');
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Live ──────────────────────────────────────────────────────────────────

  /** @internal The polite announcement — the latest final line, never interim text. */
  protected readonly liveAnnouncement = signal('');

  /** @internal The reader is at the latest line (live) — new lines keep the view there. */
  protected readonly atEnd = signal(true);

  /** @internal New final lines arrived while the reader was scrolled up. */
  protected readonly unseen = signal(0);

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.copyTimer !== null) clearTimeout(this.copyTimer);
    });

    // query ⇄ the debouncer. A host write lands at once; typing settles first.
    effect(() => {
      const q = this.query();
      untracked(() => {
        if (q !== this.search.raw()) {
          this.search.set(q);
          this.search.flush();
        }
      });
    });
    effect(() => {
      const settled = this.search.value();
      untracked(() => {
        this.matchCursor.set(0);
        if (settled !== this.query()) this.query.set(settled);
      });
    });

    // Live announcements: each segment's FIRST final version, once. The lines
    // already there when live mode starts are history, not news.
    const announced = new Set<string | number>();
    let primed = false;
    effect(() => {
      const rows = this.allRows();
      const live = this.live();
      untracked(() => {
        const fresh: TranscriptRow[] = [];
        for (const row of rows) {
          if (!row.final || announced.has(row.key)) continue;
          announced.add(row.key);
          fresh.push(row);
        }
        if (!live || !primed) {
          primed = live;
          return;
        }
        if (fresh.length === 0) return;
        const last = fresh[fresh.length - 1];
        const said = (last.segment.text ?? '').trim();
        this.liveAnnouncement.set(
          last.speaker ? svFormatLabel(this.text().transcriptSpeakerSaid, { speaker: last.speaker, text: said }, this.locale()) : said,
        );
        if (!this.atEnd()) this.unseen.update((n) => n + fresh.length);
      });
    });

    // Live: stay on the latest line while the reader is there — after the DOM has it.
    afterRenderEffect(() => {
      const rows = this.rows();
      const scroller = this.scrollRef()?.nativeElement;
      if (!this.live() || !scroller || rows.length === 0) return;
      if (untracked(() => this.atEnd())) scroller.scrollTop = scroller.scrollHeight;
    });

    // Playback: keep the line playing in view, each time it changes.
    afterRenderEffect(() => {
      const active = this.activeKey();
      const scroller = this.scrollRef()?.nativeElement;
      if (active === null || !scroller || this.live() || !this.followPlayback()) return;
      untracked(() => this.reveal(scroller, active));
    });

    // The current search match is kept in view.
    afterRenderEffect(() => {
      const cursor = this.safeCursor();
      const count = this.matchCount();
      const scroller = this.scrollRef()?.nativeElement;
      if (!scroller || count === 0) return;
      const mark = scroller.querySelector<HTMLElement>(`[data-sv-match="${cursor}"]`);
      const row = mark?.closest<HTMLElement>('[data-sv-segment]');
      if (row) untracked(() => this.revealElement(scroller, row));
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Copy the final text to the clipboard as plain text. Resolves whether it landed. */
  async copy(): Promise<boolean> {
    const content = svTranscriptToText(this.segments(), this.speakers());
    if (!content) return false;
    const ok = await svWriteTranscriptClipboard(content);
    this.copyState.set(ok ? 'done' : 'failed');
    if (ok) this.copied.emit({ format: 'text', content, filename: null });
    if (this.copyTimer !== null) clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => {
      this.copyState.set('idle');
      this.copyTimer = null;
    }, COPY_FEEDBACK_MS);
    return ok;
  }

  /** Download the final text as `.txt` or WebVTT `.vtt`. */
  download(format: SvTranscriptExportFormat): void {
    const content =
      format === 'vtt'
        ? svTranscriptToVtt(this.segments(), this.speakers())
        : svTranscriptToText(this.segments(), this.speakers());
    if (format === 'text' && !content) return;
    const filename = svTranscriptFilename(this.exportFilename(), format);
    if (this.isBrowser) {
      svDownloadText(this.document, filename, content, format === 'vtt' ? 'text/vtt;charset=utf-8' : 'text/plain;charset=utf-8');
    }
    this.exported.emit({ format, content, filename });
  }

  /** Back to the latest line, and following it again (live). */
  jumpToLatest(): void {
    const scroller = this.scrollRef()?.nativeElement;
    this.atEnd.set(true);
    this.unseen.set(0);
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }

  // ── Template handlers ─────────────────────────────────────────────────────

  protected onSeek(row: TranscriptRow): void {
    const player = this.player();
    if (player) {
      player.seek(row.start);
      if (this.playOnSeek()) void player.play?.();
    }
    this.seek.emit({ segment: row.segment, index: row.index, seconds: row.start });
  }

  protected onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      const wasPending = this.search.pending();
      this.search.flush();
      if (!wasPending) this.stepMatch(event.shiftKey ? -1 : 1);
    } else if (event.key === 'Escape' && this.search.raw() !== '') {
      event.preventDefault();
      this.clearSearch();
    }
  }

  protected clearSearch(): void {
    this.search.set('');
    this.search.flush();
  }

  protected onEmptyAction(): void {
    if (this.hasQuery()) this.clearSearch();
    else this.clearFilters.emit();
  }

  protected stepMatch(direction: 1 | -1): void {
    const count = this.matchCount();
    if (count === 0) return;
    this.matchCursor.set((this.safeCursor() + direction + count) % count);
  }

  protected onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight <= END_SLACK_PX;
    this.atEnd.set(atEnd);
    if (atEnd) this.unseen.set(0);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private reveal(scroller: HTMLElement, key: string | number): void {
    const row = Array.from(scroller.querySelectorAll<HTMLElement>('[data-sv-segment]')).find(
      (el) => el.dataset['svSegment'] === String(key),
    );
    if (row) this.revealElement(scroller, row);
  }

  /** Scroll only the list — never the page — and only when the row is out of view. The list is `relative`, so `offsetTop` is measured from it. */
  private revealElement(scroller: HTMLElement, row: HTMLElement): void {
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < scroller.scrollTop) scroller.scrollTop = top;
    else if (bottom > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = bottom - scroller.clientHeight;
  }
}
