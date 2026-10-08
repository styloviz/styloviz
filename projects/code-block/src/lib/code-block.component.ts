import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  model,
  output,
  signal,
  OnDestroy,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SvCheckIcon, SvCopyIcon } from '@styloviz/icons';
import type {
  CodeBlockDiffMode,
  CodeBlockVariant,
  CodeFile,
  CodeLanguage,
  CodeLine,
  CodeTokenKind,
  DiffHunk,
  DiffHunkAction,
  DiffHunkEvent,
  DiffLine,
  TerminalLine,
} from './code-block.types';
import { inferLanguage, revealBidi, stripAnsi, tokenize } from './code-highlighter';
import { svUniqueId } from '@styloviz/core';

/** One row of a side-by-side diff. Either side may be absent. */
interface SplitRow {
  readonly id: string;
  readonly left: DiffLine | null;
  readonly right: DiffLine | null;
}

/** How long the "Copied" confirmation stays visible (ms). */
const COPY_FEEDBACK_MS = 1600;

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * CodeBlock — read-only source display with syntax highlighting.
 *
 * Features:
 * - 4 variants: block · tabs (multi-file) · diff (unified / split) · terminal
 * - Zero-dependency highlighter for 9 languages, inferred from the file name
 * - Streaming-safe: re-tokenises a growing buffer, with an optional caret
 * - Copy to clipboard, line numbers, soft wrap, line highlighting
 * - Per-hunk accept / reject actions in diff mode
 * - Renders a token model through Angular bindings — no `innerHTML`
 * - Truncates past `maxRenderedLines` rather than building rows nobody scrolls to
 * - States what it did not do: unhighlighted languages, and invisible bidi controls
 * - Accessible: labelled scroll region, keyboard-reachable, `aria-live` copy status
 */

@Component({
  selector: 'sv-code-block',
  standalone: true,
  imports: [SvCopyIcon, SvCheckIcon, DecimalPipe],
  templateUrl: './code-block.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvCodeBlockComponent implements OnDestroy {
  /** Per-instance suffix for every id this component puts in the document. */
  readonly _uid = svUniqueId('sv-code-block');

  // ── Content ───────────────────────────────────────────────────────────────

  /** Layout preset. @default 'block' */
  variant = input<CodeBlockVariant>('block');

  /** Source text — the quickest way to render a single snippet. @default '' */
  code = input<string>('');

  /** Language for `code`. Inferred from `filename` when left unset. @default 'plaintext' */
  language = input<CodeLanguage | null>(null);

  /** File name shown in the header and used for language inference. @default '' */
  filename = input<string>('');

  /** Files for the `tabs` variant. Overrides `code` / `filename` when non-empty. @default [] */
  files = input<readonly CodeFile[]>([]);

  /** Hunks for the `diff` variant. @default [] */
  hunks = input<readonly DiffHunk[]>([]);

  /** Lines for the `terminal` variant. @default [] */
  terminalLines = input<readonly TerminalLine[]>([]);

  // ── Appearance ────────────────────────────────────────────────────────────

  /** Diff layout. Ignored unless `variant` is `'diff'`. @default 'unified' */
  diffMode = input<CodeBlockDiffMode>('unified');

  /** Show the gutter with line numbers. @default true */
  lineNumbers = input<boolean>(true);

  /** Soft-wrap long lines instead of scrolling horizontally. @default false */
  wrap = input<boolean>(false);

  /** Show the header bar (file name, language badge, copy button). @default true */
  showHeader = input<boolean>(true);

  /** Show the copy-to-clipboard button. @default true */
  copyable = input<boolean>(true);

  /** 1-based line numbers to emphasise. @default [] */
  highlightLines = input<readonly number[]>([]);

  /** Max height of the scroll region, as a CSS length. @default '24rem' */
  maxHeight = input<string>('24rem');

  /**
   * Rendering threshold, in lines. Beyond it the block truncates and offers a
   * "show all" control. `0` renders everything, however long.
   *
   * Applies to `block` and `tabs`. A diff is bounded by its hunks and the
   * terminal transcript by `terminalLines`, so neither needs a cap the caller
   * has not already applied.
   *
   * "Show all" holds until the tab changes or the content is replaced; a buffer
   * that only grows (a streamed answer) stays expanded.
   *
   * @default 600
   */
  maxRenderedLines = input<number>(600);

  /** Render a blinking caret after the last line, for in-flight responses. @default false */
  streaming = input<boolean>(false);

  /** Accessible name for the scroll region. Falls back to the file name. @default '' */
  ariaLabel = input<string>('');

  /** Show per-hunk accept / reject buttons in diff mode. @default false */
  reviewable = input<boolean>(false);

  // ── Two-way state ─────────────────────────────────────────────────────────

  /** Index of the visible tab in the `tabs` variant. @default 0 */
  activeTab = model<number>(0);

  // ── Events ────────────────────────────────────────────────────────────────

  /** Emits the copied text after a successful clipboard write. */
  copied = output<string>();

  /** Emits the newly selected file when the user switches tab. */
  tabChange = output<CodeFile>();

  /** Emits when a diff hunk is accepted or rejected. */
  hunkAction = output<DiffHunkEvent>();

  // ── Internal state ────────────────────────────────────────────────────────

  protected readonly copyDone = signal(false);
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Token kind → Tailwind classes. A map, not a method, so the template does no
   * work.
   *
   * ── Why these specific shades ───────────────────────────────────────────────
   * Every colour here clears WCAG AA (4.5:1) against *all* backgrounds a token
   * can land on, in both themes — plain white/gray-900, the `bg-primary-50`
   * highlighted line, and the `bg-danger-50/70` / `bg-accent-50/70` diff rows.
   * The highlighted-line and diff backgrounds are the binding constraint: they
   * are darker than white, so a shade that passes on white alone can still fail
   * inside a highlighted line.
   *
   * The previous light-mode shades were one step too light and failed:
   * sky-600 4.02, emerald-600 3.67, teal-600 3.66, amber-600 3.19,
   * gray-400 2.60 (comment/punct), rose-600 4.14 on a highlighted line.
   * In dark mode gray-500 (comment/punct) sat at 3.67 on gray-900.
   *
   * Worst ratio in the current set is amber-700 at 4.64:1. If you re-theme
   * these, re-check the number rather than eyeballing it — light-mode 600
   * shades look fine and are not.
   *
   * ── Why these stay literal while the rest of the component moved ────────────
   * ★★ A SYNTAX PALETTE IS THE MEANING, NOT A ROLE. A keyword is not a brand and
   *    a string literal is not a success, so these cannot be pointed at token
   *    families without saying something false — and a buyer who rebranded would
   *    fold `keyword`, `function` and `tag` into one colour, which is precisely
   *    the difference the reader is reading. Editors treat their syntax theme as
   *    separate from their UI theme for the same reason.
   *
   *    Everything AROUND the code did move: the diff rows, the copy button, the
   *    line-number rail, the file tabs and the terminal's stderr line. The
   *    contrast note above is the constraint that ties the two halves together —
   *    if a rebrand darkens `danger-50`/`accent-50`, re-check these ratios,
   *    because the diff rows are what the token colours sit on.
   *    Recorded in `scripts/theme-literal.allow.json`.
   */
  protected readonly tokenClass: Readonly<Record<CodeTokenKind, string>> = {
    plain:    'text-gray-800 dark:text-gray-200',
    keyword:  'text-violet-600 dark:text-violet-400',
    builtin:  'text-sky-700 dark:text-sky-400',
    string:   'text-emerald-700 dark:text-emerald-400',
    comment:  'text-gray-600 dark:text-gray-400 italic',
    number:   'text-amber-700 dark:text-amber-400',
    function: 'text-blue-600 dark:text-blue-400',
    property: 'text-teal-700 dark:text-teal-400',
    tag:      'text-rose-700 dark:text-rose-400',
    attr:     'text-amber-700 dark:text-amber-400',
    operator: 'text-gray-600 dark:text-gray-400',
    punct:    'text-gray-600 dark:text-gray-400',
    // Not a syntax colour — a warning. `danger` on a ring is the one thing in
    // this map that should stop the reader rather than help them skim.
    bidi:     'rounded bg-danger-100 px-0.5 font-bold text-danger-800 dark:bg-danger-950 dark:text-danger-300',
  };

  // ── Derived: files & lines ────────────────────────────────────────────────

  /** Normalised file list — `files` when supplied, otherwise a single synthetic file. */
  protected readonly resolvedFiles = computed<readonly CodeFile[]>(() => {
    const given = this.files();
    if (given.length > 0) return given;
    return [{
      name: this.filename(),
      language: this.language() ?? undefined,
      content: this.code(),
    }];
  });

  /** The clamped index of the tab actually shown. */
  private readonly activeTabIndex = computed<number>(() =>
    Math.min(Math.max(this.activeTab(), 0), this.resolvedFiles().length - 1),
  );

  protected readonly activeFile = computed<CodeFile>(() => this.resolvedFiles()[this.activeTabIndex()]);

  protected readonly activeLanguage = computed<CodeLanguage>(() => {
    const file = this.activeFile();
    return file.language ?? this.language() ?? (file.name ? inferLanguage(file.name) : 'plaintext');
  });

  protected readonly allLines = computed<readonly CodeLine[]>(() =>
    tokenize(this.activeFile().content, this.activeLanguage()),
  );

  /**
   * Set by the "show all" control.
   *
   * ★ A `linkedSignal`, so switching tab or receiving a NEW buffer puts the cap
   *   back. Held as a plain signal it would stay expanded for the rest of the
   *   component's life, and the guard would silently apply to the first big file
   *   only.
   *
   * ★★ But a STREAMED buffer is not a new buffer. An AI response grows by
   *    appending, and resetting on every chunk re-collapsed the block the reader
   *    had just expanded — dozens of times a second, while they were reading it.
   *    So the cap returns only when the tab changes or the new content is not
   *    an append to the previous content (a replacement, an edit, a clear).
   */
  private readonly expanded = linkedSignal<{ readonly tab: number; readonly content: string }, boolean>({
    source: () => ({ tab: this.activeTabIndex(), content: this.activeFile().content }),
    computation: (next, previous) => {
      if (!previous || !previous.value) return false;
      const sameTab = next.tab === previous.source.tab;
      return sameTab && next.content.startsWith(previous.source.content);
    },
  });

  /**
   * The lines actually rendered.
   *
   * ★★ A 12,000-LINE FILE BUILT 12,000 ROWS AND EVERY TOKEN SPAN IN THEM.
   *
   *    Nothing was capped, so the cost of a big file was paid in full on first
   *    paint whether or not the reader ever scrolled — and this is the component
   *    an AI response streams into, where "big" is not the rare case.
   *
   *    A cap with a way past it, not virtualisation: a windowed scroller has to
   *    own scroll position, row height and the gutter's alignment, and it breaks
   *    find-in-page for the rows it has not built. Truncating is honest about
   *    what it did and leaves the whole file one button away. `maxRenderedLines`
   *    is published in the docs rather than left as a magic number, because the
   *    only useful threshold is one the caller can see and change.
   */
  protected readonly lines = computed<readonly CodeLine[]>(() => {
    const all = this.allLines();
    const cap = this.maxRenderedLines();
    if (this.expanded() || cap <= 0 || all.length <= cap) return all;
    return all.slice(0, cap);
  });

  /** How many lines the cap is holding back. `0` when everything is rendered. */
  protected readonly hiddenLineCount = computed(() => this.allLines().length - this.lines().length);

  protected showAllLines(): void {
    this.expanded.set(true);
  }

  /** Gutter width scales with the largest line number so digits never clip. */
  protected readonly gutterWidth = computed(() =>
    `${Math.max(2, String(this.allLines().length).length)}ch`,
  );

  private readonly highlightSet = computed(() => new Set(this.highlightLines()));

  /** Whether a 1-based line number is emphasised. Backed by a memoised Set. */
  protected isHighlighted(lineNo: number): boolean {
    return this.highlightSet().has(lineNo);
  }

  // ── Derived: diff ─────────────────────────────────────────────────────────

  /**
   * The hunks as rendered, with invisible bidi controls made visible.
   *
   * ★★ `tokenize` is not in the diff's path — diff lines render as raw text — so
   *    the reordering `revealBidi` exists to expose would have been exposed
   *    everywhere EXCEPT the one variant where code gets approved.
   *
   *    Returns the input array untouched when there is nothing to reveal, which
   *    is every real diff, so the common path allocates nothing.
   */
  protected readonly displayHunks = computed<readonly DiffHunk[]>(() => {
    const hunks = this.hunks();
    const dirty = hunks.some((h) => h.lines.some((l) => revealBidi(l.text) !== l.text));
    if (!dirty) return hunks;

    return hunks.map((hunk) => ({
      ...hunk,
      lines: hunk.lines.map((line) => {
        const text = revealBidi(line.text);
        return text === line.text ? line : { ...line, text };
      }),
    }));
  });

  /**
   * Terminal lines as rendered: escape sequences stripped, bidi controls shown.
   *
   * Pasted tool output arrives full of SGR codes whose ESC is non-printing, so
   * what reached the screen was the leftover `[31m`.
   */
  protected readonly displayTerminalLines = computed<readonly TerminalLine[]>(() =>
    this.terminalLines().map((line) => {
      const text = revealBidi(stripAnsi(line.text));
      return text === line.text ? line : { ...line, text };
    }),
  );

  /** Side-by-side rows, pairing removals with additions where they align. */
  protected readonly splitRows = computed<readonly (readonly SplitRow[])[]>(() =>
    this.displayHunks().map((hunk) => this.toSplitRows(hunk)),
  );

  protected readonly diffStats = computed(() => {
    let added = 0;
    let removed = 0;
    for (const hunk of this.hunks()) {
      for (const line of hunk.lines) {
        if (line.kind === 'add') added += 1;
        else if (line.kind === 'del') removed += 1;
      }
    }
    return { hunks: this.hunks().length, added, removed };
  });

  /** Target for the region's `aria-describedby`. Per-instance — see `_uid`. */
  protected readonly diffSummaryId = `sv-diff-summary-${this._uid}`;

  /**
   * How big the change is, in words.
   *
   * ★ The scale of a diff reaches the page only as geometry: the header's
   *   `+12 −4` chips and the per-line tint. Without this a screen-reader user
   *   has to walk every line to learn there are three hunks — so it is a
   *   DESCRIPTION rather than part of the region's name, which lets a
   *   host-supplied `ariaLabel` keep naming the region while still carrying it.
   *   The chips are `aria-hidden` precisely because this says it better.
   */
  protected readonly diffSummary = computed(() => {
    const { hunks, added, removed } = this.diffStats();
    if (hunks === 0) return '';
    const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
    return `Diff: ${count(hunks, 'hunk')}, ${count(added, 'added line')}, ${count(removed, 'removed line')}.`;
  });

  // ── Derived: misc ─────────────────────────────────────────────────────────

  protected readonly regionLabel = computed(
    () => this.ariaLabel() || this.activeFile().name || `${this.activeLanguage()} code`,
  );

  /**
   * Said out loud when highlighting did not happen.
   *
   * ★★ AN UNSUPPORTED LANGUAGE LOOKED IDENTICAL TO A BORING ONE. `inferLanguage`
   *    falls back to `plaintext`, and `languageLabel` then rendered NOTHING for
   *    plaintext — so a `.rb` file came out as flat monospace with no badge and
   *    no explanation, indistinguishable from Ruby that happens to contain no
   *    keywords the reader recognised. The failure mode of a highlighter is
   *    quiet by nature, which is exactly why it has to announce itself.
   *
   *    Only for a fallback. `language="plaintext"` and a name with no extension
   *    are both requests for plain text, and answering a request with a notice
   *    that it was not honoured would be false.
   */
  protected readonly highlightNote = computed(() => {
    if (this.activeLanguage() !== 'plaintext') return '';
    if ((this.activeFile().language ?? this.language()) === 'plaintext') return '';

    const name = this.activeFile().name;
    const dot = name.lastIndexOf('.');
    // `> 0`, not `>= 0`: a dotfile's leading dot is not a failed claim.
    const ext = dot > 0 ? name.slice(dot + 1) : '';
    if (!ext) return '';

    return `Not syntax highlighted: no rules for .${ext}. Shown as plain text.`;
  });

  protected readonly highlightNoteId = `sv-cb-note-${this._uid}`;

  protected readonly languageLabel = computed(() => {
    const lang = this.activeLanguage();
    if (lang !== 'plaintext') return lang;
    // A badge reading "plain text" is the visible half of `highlightNote`.
    return this.highlightNote() ? 'plain text' : '';
  });

  /**
   * Everything describing the region, in one attribute.
   *
   * A second `aria-describedby` binding would have replaced the first rather
   * than joined it, so the diff summary and the highlighting notice — which can
   * both apply at once — are composed here instead.
   */
  protected readonly regionDescribedBy = computed(() => {
    const ids: string[] = [];
    if (this.variant() === 'diff' && this.diffSummary()) ids.push(this.diffSummaryId);
    if (this.highlightNote()) ids.push(this.highlightNoteId);
    return ids.length ? ids.join(' ') : null;
  });

  /**
   * What the copy button will actually put on the clipboard.
   *
   * ★★ THE BUTTON SAID "Copy code to clipboard" AND MEANT FOUR DIFFERENT THINGS.
   *    Whether a copy carries the line numbers, the `+`/`−` markers, the `$`
   *    prompt, or the other tabs is not guessable from an icon, and every one of
   *    those answers is a thing someone pastes into a terminal. The behaviour was
   *    already right and already tested — it was simply never stated.
   */
  protected readonly copyLabel = computed(() => {
    if (this.copyDone()) return 'Copied to clipboard';

    switch (this.variant()) {
      case 'diff':
        return 'Copy the updated code — additions and context, without the + and − markers';
      case 'terminal':
        return 'Copy the transcript, without the prompt';
      case 'tabs': {
        const name = this.activeFile().name;
        return name ? `Copy ${name} — the open file only` : 'Copy the open file only';
      }
      default:
        return this.lineNumbers() ? 'Copy code, without the line numbers' : 'Copy code';
    }
  });

  /**
   * Everything the copy button puts on the clipboard for the current variant.
   * `copyLabel` is the sentence that states this to the user.
   *
   * ★★ BUILT FROM THE RAW INPUT, NOT FROM WHAT IS RENDERED, AND THAT DISTINCTION
   *    IS DELIBERATE IN BOTH DIRECTIONS.
   *
   *    Bidi controls are kept: they are legitimate content in an Arabic or
   *    Hebrew string literal, and a component that quietly rewrote source on its
   *    way to the clipboard would corrupt real code to defend against rare code.
   *    Revealing them on screen is the honest half of that trade — the reader is
   *    told, and the bytes are left alone.
   *
   *    ANSI escapes are dropped: they are terminal control noise, never content,
   *    and they are not on screen either — so keeping them would paste debris
   *    that matches nothing the user saw.
   *
   *    Truncation does not apply. `maxRenderedLines` is a rendering budget, and
   *    copying only the part that fit would be a silent, unrecoverable loss.
   */
  private readonly copyPayload = computed<string>(() => {
    switch (this.variant()) {
      case 'diff':
        return this.hunks()
          .flatMap((h) => h.lines.filter((l) => l.kind !== 'del').map((l) => l.text))
          .join('\n');
      case 'terminal':
        return this.terminalLines().map((l) => stripAnsi(l.text)).join('\n');
      default:
        return this.activeFile().content;
    }
  });

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Select a tab by index and emit `tabChange`. */
  protected selectTab(index: number): void {
    const files = this.resolvedFiles();
    if (index < 0 || index >= files.length || index === this.activeTab()) return;
    this.activeTab.set(index);
    this.tabChange.emit(files[index]);
  }

  /** Roving arrow-key navigation across the tab strip. */
  protected onTabKeydown(event: KeyboardEvent, index: number): void {
    const last = this.resolvedFiles().length - 1;
    let next: number | null = null;

    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;

    if (next === null) return;
    event.preventDefault();
    this.selectTab(next);
  }

  /** Copy the current payload to the clipboard and flash a confirmation. */
  protected async copy(): Promise<void> {
    const text = this.copyPayload();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard unavailable (insecure context, denied permission) — fail quietly
      // rather than throwing inside a click handler.
      return;
    }

    this.copied.emit(text);
    this.copyDone.set(true);

    if (this.copyTimer !== null) clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => {
      this.copyDone.set(false);
      this.copyTimer = null;
    }, COPY_FEEDBACK_MS);
  }

  /**
   * Emit accept / reject for the hunk at `index`.
   *
   * Takes the index rather than the rendered hunk so the event carries the
   * caller's own object — `displayHunks` may hold a rewritten copy, and a host
   * cannot apply a hunk whose text is not the text it supplied.
   */
  protected act(index: number, action: DiffHunkAction): void {
    this.hunkAction.emit({ hunk: this.hunks()[index], action });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnDestroy(): void {
    if (this.copyTimer !== null) {
      clearTimeout(this.copyTimer);
      this.copyTimer = null;
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private toSplitRows(hunk: DiffHunk): readonly SplitRow[] {
    const rows: SplitRow[] = [];
    let dels: DiffLine[] = [];
    let adds: DiffLine[] = [];
    let seq = 0;

    const flush = (): void => {
      const count = Math.max(dels.length, adds.length);
      for (let i = 0; i < count; i++) {
        rows.push({
          id: `${hunk.id}-p${seq++}`,
          left: dels[i] ?? null,
          right: adds[i] ?? null,
        });
      }
      dels = [];
      adds = [];
    };

    for (const line of hunk.lines) {
      if (line.kind === 'del') {
        dels.push(line);
      } else if (line.kind === 'add') {
        adds.push(line);
      } else {
        flush();
        rows.push({ id: `${hunk.id}-c${seq++}`, left: line, right: line });
      }
    }
    flush();
    return rows;
  }
}
