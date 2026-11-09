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
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { SvArrowDownIcon } from '@styloviz/icons/glyph/arrow-down';
import { SvCheckIcon } from '@styloviz/icons/glyph/check';
import { SvCopyIcon } from '@styloviz/icons/glyph/copy';
import type { TerminalLine } from './code-block.types';
import type { TerminalCommand, TerminalLive, TerminalRanEvent, TerminalResult } from './terminal.types';
import { svUniqueId } from '@styloviz/core/a11y';
import { injectSvLabels, svFormatLabel } from '@styloviz/core/i18n';
import { SV_CODE_BLOCK_LABELS } from './code-block.labels';
import { svParseAnsi, svAnsiPlainText, type SvAnsiColor, type SvAnsiSegment } from './ansi';
import { svIsScrolledToEnd } from './terminal-scroll';
import { svWriteClipboard } from './clipboard';

/** One styled run of a line, with its classes worked out once. */
interface RenderedSegment {
  readonly text: string;
  readonly color: SvAnsiColor | null;
  readonly cls: string;
}

/** One line as the template draws it: its kind, its classes and its segments. */
interface RenderedLine {
  readonly kind: TerminalLine['kind'];
  readonly cls: string;
  readonly segments: readonly RenderedSegment[];
}

/** How long the copy button shows its tick (or its failure). */
const COPY_FEEDBACK_MS = 2000;

/**
 * ============================================================
 *  SvTerminalComponent — an interactive shell
 * ============================================================
 *  Install: npm install @styloviz/code-block
 *
 *  `<sv-code-block variant="terminal">` renders a transcript. This renders a
 *  PROMPT: history, tab-completion, a command registry, and output produced by
 *  handlers the host supplies.
 *
 *  ★★★ NOTHING TYPED HERE IS EVER EVALUATED.
 *
 *      A terminal on a public page is an input box that looks like it executes
 *      code, which makes `eval` (or `new Function`, or a `srcdoc` iframe) feel
 *      like the natural implementation and is exactly why it must not be. The
 *      first word is looked up in `commands` by exact, case-insensitive match.
 *      A miss prints an error. There is no branch in this file that turns
 *      visitor text into executed code, and `TerminalCommand.run` is a function
 *      reference the host wrote at build time.
 *
 *  ★★★ IT IS A REAL `<input>`, NOT A `contenteditable` DIV.
 *
 *      Almost every web terminal renders a fake caret next to a styled span and
 *      listens on `document`. That loses: dictation, autocorrect, IME
 *      composition for anyone typing a non-Latin script, the on-screen keyboard
 *      on a phone, and any assistive technology that expects a text field. An
 *      `<input>` with a transparent caret costs nothing and keeps all of it.
 *
 *  ★★ OUTPUT IS ANNOUNCED ONCE. The scrollback is `role="log"` with
 *     `aria-live="polite"`, so a screen reader hears new lines as they arrive
 *     rather than re-reading the whole session on every keystroke. The prompt
 *     input carries its own label.
 *
 *  ★ Reduced motion is honoured by the typing animation, which is the only
 *    animation here: `intro` lines type character by character unless the OS
 *    asks otherwise, in which case they print immediately. The content is
 *    identical either way.
 *
 *  ★★ IT IS ALSO A LOG VIEWER. `[lines]` is an append-only stream the host
 *     owns — a build, a deploy, an agent's tool run — printed as it grows, with
 *     the ANSI colour subset honoured (SGR 30–37, 90–97, bold; everything else
 *     dropped, never rendered as markup). `[interactive]="false"` removes the
 *     prompt. Autoscroll follows the output only while the reader is at the
 *     bottom; scrolling up to read an error pauses it and shows "jump to
 *     latest" with a count of what arrived meanwhile.
 *
 *  Usage:
 *
 *    <sv-terminal
 *      [commands]="commands"
 *      [intro]="intro"
 *      prompt="visitor@styloviz:~$"
 *      (ran)="onRan($event)"
 *    />
 *
 *    <sv-terminal [lines]="buildLog()" [interactive]="false" title="build #4812" />
 * ============================================================
 */
@Component({
  selector: 'sv-terminal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, SvArrowDownIcon, SvCheckIcon, SvCopyIcon],
  templateUrl: './terminal.component.html',
  host: {
    // ★★ ON THE HOST, NOT ON AN INNER DIV. Clicking anywhere in the terminal
    //    focuses the prompt — but a `(click)` in the template puts an
    //    interaction handler on a non-focusable element, and the honest fixes
    //    for that are both wrong here: making the wrapper focusable adds a
    //    redundant tab stop in front of the real input, and adding a key
    //    handler duplicates what the input already does. The behaviour belongs
    //    to the component's own element, so that is where it lives.
    '(click)': 'focusPrompt()',
  },
})
export class SvTerminalComponent {
  protected readonly labels = injectSvLabels('codeBlock', SV_CODE_BLOCK_LABELS);
  private readonly uid = svUniqueId('sv-term');

  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** The command registry. Anything not in here does not run. */
  readonly commands = input<readonly TerminalCommand[]>([]);

  /** Lines printed before the visitor's first keystroke. */
  readonly intro = input<readonly TerminalLine[]>([]);

  /** Prompt string, e.g. `visitor@styloviz:~$`. */
  readonly prompt = input<string>('$');

  /** Accessible label for the prompt input. */
  readonly inputLabel = input<string>(this.labels.terminalInput);

  /** Max height of the scrollback. */
  readonly maxHeight = input<string>('22rem');

  /**
   * Minimum height of the scrollback.
   *
   * ★ For a hero, where the terminal is a design element as much as a control:
   *   sized to its content, a five-line intro renders as a small box with the
   *   column's remaining height empty beneath it. A floor makes it read as a
   *   window that happens to be mostly unused, which is what a real one looks
   *   like before you type.
   */
  readonly minHeight = input<string>('0');

  /**
   * Scrollback cap, in lines.
   *
   * ★ A cap, not virtualisation. A session someone actually types is a few
   *   hundred lines at the outside; carrying a virtual scroller for a case
   *   that does not occur costs more than it saves. The oldest lines drop.
   */
  readonly maxLines = input<number>(400);

  /** Show the window chrome (three dots + title). */
  readonly chrome = input<boolean>(true);

  /** Title in the chrome bar. */
  readonly title = input<string>('');

  /**
   * Type the intro out character by character.
   *
   * ★ Ignored under `prefers-reduced-motion`, where the intro prints at once.
   */
  readonly typeIntro = input<boolean>(true);

  /** Milliseconds per character while typing the intro. */
  readonly typeSpeedMs = input<number>(18);

  /**
   * Output the host owns — a build log, a deploy stream, an agent's tool run.
   *
   * ★ APPEND-ONLY. Lines added to the end are printed as they arrive, after
   *   whatever is already on screen. A SHORTER array means a new run: the
   *   screen clears and the new array prints from the top. Pass a new array
   *   each time (signals do), never a mutated one.
   *
   * While this is non-empty the intro prints at once rather than typing, so a
   * log is never held back behind an animation.
   * @default []
   */
  readonly lines = input<readonly TerminalLine[]>([]);

  /**
   * Show the prompt. `false` makes a read-only log viewer: no input, no
   * history, no click-to-focus — `[lines]` and `intro` are all it shows.
   * @default true
   */
  readonly interactive = input<boolean>(true);

  /**
   * Honour the ANSI colour subset in line text: SGR 0 / 1 / 22 / 39, 30–37 and
   * 90–97. Other sequences (cursor moves, erase, OSC titles) are always removed.
   * `stderr` keeps its own colour — an escape code cannot paint an error green —
   * but may still be bold. `false` strips every sequence and colours by `kind`
   * only.
   * @default true
   */
  readonly ansi = input<boolean>(true);

  /**
   * Follow new output to the bottom — but only while the reader is already
   * there. Scrolling up pauses it and shows "jump to latest"; `false` never
   * scrolls on its own (submitting a command still does).
   * @default true
   */
  readonly autoScroll = input<boolean>(true);

  /** Show a button that copies the whole scrollback as plain text, escape codes removed. @default true */
  readonly copyable = input<boolean>(true);

  /**
   * How the log announces new lines. `polite` (the `role="log"` default) reads
   * each line as it arrives; `off` is for a fast stream a screen reader could
   * never keep up with — the reader moves into the log to read it.
   * @default 'polite'
   */
  readonly live = input<TerminalLive>('polite');

  /** Accessible name of the scrollback region. @default 'Terminal output' */
  readonly logLabel = input<string>(this.labels.terminalLog);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  /** Fired after every submitted line, matched or not. */
  readonly ran = output<TerminalRanEvent>();

  /** Emits the copied text after a successful clipboard write. */
  readonly copied = output<string>();

  // ── State ───────────────────────────────────────────────────────────────────

  private readonly scrollback = signal<readonly TerminalLine[]>([]);

  protected readonly value = signal('');
  protected readonly busy = signal(false);

  /** True while the reader is at the bottom, so new output is followed. */
  protected readonly following = signal(true);
  /** Lines that arrived while autoscroll was paused — the count on "jump to latest". */
  protected readonly unseen = signal(0);
  protected readonly copyState = signal<'idle' | 'done' | 'failed'>('idle');
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  /** Host lines already printed, so the next change prints only the tail. */
  private consumed = 0;
  /** Once true the intro is on screen in full and is never re-printed by `settleIntro`. */
  private introSettled = false;
  /** Parsed segments per line object: a push re-renders the list, not every parse. */
  private readonly parsed = new WeakMap<TerminalLine, readonly SvAnsiSegment[]>();

  /** The scrollback as the template draws it. */
  protected readonly rendered = computed<readonly RenderedLine[]>(() => {
    const ansi = this.ansi();
    return this.scrollback().map((line) => ({
      kind: line.kind,
      cls: this.lineClass(line.kind),
      segments: this.segmentsOf(line, ansi).map((segment) => ({
        text: segment.text,
        color: segment.color,
        cls: this.segmentClass(line.kind, segment),
      })),
    }));
  });

  protected readonly jumpLabel = computed(() => {
    const count = this.unseen();
    return count ? svFormatLabel(this.labels.terminalJumpNew, { count }) : this.labels.terminalJumpToLatest;
  });

  /** Submitted lines, newest last. Drives ↑/↓. */
  private readonly history = signal<readonly string[]>([]);

  /**
   * Where ↑/↓ currently sits. `null` means "on the live line".
   *
   * ★ Kept separate from the input value so that arrowing up, editing, then
   *   arrowing down does not silently discard the edit — the draft is stashed
   *   in `draft` and restored on the way back.
   */
  private readonly historyIndex = signal<number | null>(null);
  private draft = '';

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('promptInput');
  private readonly scrollEl = viewChild<ElementRef<HTMLElement>>('scrollEl');

  protected readonly visibleCommands = computed(() =>
    this.commands().filter((c) => !c.hidden),
  );

  protected inputId(): string {
    return `${this.uid}-input`;
  }

  protected logId(): string {
    return `${this.uid}-log`;
  }

  /**
   * Bumped to abandon an in-flight intro animation.
   *
   * ★★★ `typeOut` HAD NO WAY TO BE CANCELLED, AND THE EFFECT ABOVE ADVERTISES
   *     RE-RUNNING IT.
   *
   *     Typing the intro is one `setTimeout` per character, so a run stays
   *     alive for seconds. When the intro's identity changed mid-flight — a
   *     host deriving it from data that arrives after the first paint, which is
   *     exactly what the dev-portfolio hero does — the effect cleared the
   *     scrollback and started a SECOND typer while the first was still
   *     appending to it. The two interleaved and the transcript came out
   *     doubled, line for line.
   *
   *     A token, not an `AbortController`: there is nothing to abort, only a
   *     loop to stop writing. A stale run returns without touching the
   *     scrollback, because by then the new run owns it.
   */
  private typeRun = 0;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    // A destroyed terminal stops typing: `typeOut` checks `typeRun` after every
    // character, so bumping it ends the loop instead of writing into a dead view.
    inject(DestroyRef).onDestroy(() => {
      this.typeRun++;
      if (this.copyTimer !== null) clearTimeout(this.copyTimer);
    });

    // Print the intro whenever it changes identity — a host swapping the intro
    // for a different persona should not have to destroy the component.
    effect(() => {
      const intro = this.intro();
      const typeIntro = this.typeIntro();
      const maxLines = this.maxLines();
      const run = ++this.typeRun;
      // ★ The host stream is read untracked: its own effect below prints what
      //   is new, and re-running this one on every appended line would clear
      //   the screen each time.
      untracked(() => {
        this.scrollback.set([]);
        this.consumed = 0;
        this.introSettled = intro.length === 0;
        const hostLines = this.lines();
        if (intro.length) {
          // ★★ On the server the intro is printed whole: typing it schedules one
          //    timer per character, which a zone-based SSR render waits out
          //    (1.0 audit, H2) — and the HTML it sends should be the finished text.
          //    A host log on screen also prints it whole: output must not wait.
          if (typeIntro && !this.prefersReducedMotion() && this.isBrowser && !hostLines.length) {
            void this.typeOut(intro, run);
          } else {
            this.scrollback.set(intro.slice(-maxLines));
            this.introSettled = true;
          }
        }
        this.printHostLines(hostLines);
      });
    });

    // The host's stream: print what is new; a shorter array is a new run.
    effect(() => {
      const hostLines = this.lines();
      untracked(() => {
        if (hostLines.length < this.consumed) {
          this.consumed = 0;
          this.settleIntro();
          this.scrollback.set(this.intro().slice(-this.maxLines()));
          this.following.set(true);
          this.unseen.set(0);
        }
        this.printHostLines(hostLines);
      });
    });
  }

  /** Print the host lines not yet on screen. */
  private printHostLines(hostLines: readonly TerminalLine[]): void {
    if (hostLines.length <= this.consumed) return;
    const fresh = hostLines.slice(this.consumed);
    this.consumed = hostLines.length;
    this.settleIntro();
    this.push(fresh);
  }

  private segmentsOf(line: TerminalLine, ansi: boolean): readonly SvAnsiSegment[] {
    if (!ansi) return [{ text: svAnsiPlainText(line.text), color: null, bright: false, bold: false }];
    let segments = this.parsed.get(line);
    if (!segments) {
      segments = svParseAnsi(line.text);
      this.parsed.set(line, segments);
    }
    return segments;
  }

  /**
   * Stop any intro animation and show the whole thing at once.
   *
   * ★ Called the moment the visitor submits anything. A terminal that keeps
   *   politely typing its own introduction over the top of the command you
   *   just ran is the single most irritating thing an animated prompt can do.
   */
  private settleIntro(): void {
    // ★ Once settled, never again: after Ctrl+L or a `clear` the scrollback is
    //   shorter than the intro, and "re-print the intro" would bring back the
    //   very lines the visitor just cleared.
    if (this.introSettled) return;
    this.introSettled = true;
    if (this.typeRun === 0) return;
    const intro = this.intro();
    if (!intro.length) return;
    const typed = this.scrollback().length;
    if (typed >= intro.length) return;
    this.typeRun++;
    this.scrollback.set(intro.slice(-this.maxLines()));
  }

  // ── Printing ────────────────────────────────────────────────────────────────

  private push(lines: readonly TerminalLine[]): void {
    if (!lines.length) return;
    this.scrollback.update((all) => [...all, ...lines].slice(-this.maxLines()));
    if (this.autoScroll() && this.following()) {
      this.scrollToEnd();
    } else {
      // ★ Paused: the reader is somewhere above, reading. Count what they are
      //   missing instead of yanking them down to it.
      this.unseen.update((n) => n + lines.length);
    }
  }

  private scrollToEnd(): void {
    // `afterNextRender` would be wrong here: this runs many times per session,
    // not once. A microtask is enough — the DOM is written by the time it runs.
    queueMicrotask(() => {
      const el = this.scrollEl()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  /**
   * The log box scrolled — by the reader, or by `scrollToEnd`.
   *
   * ★ Decided from WHERE the box is, not from who moved it: a programmatic
   *   scroll to the end lands at the end and reads as "following", and a wheel
   *   or a drag that leaves the bottom reads as "paused". No flag to keep in
   *   step with the browser's own scroll events.
   */
  protected onScroll(): void {
    const el = this.scrollEl()?.nativeElement;
    if (!el) return;
    const atEnd = svIsScrolledToEnd(el);
    this.following.set(atEnd);
    if (atEnd) this.unseen.set(0);
  }

  /** "Jump to latest": back to the bottom, and following again. */
  jumpToLatest(): void {
    this.following.set(true);
    this.unseen.set(0);
    this.scrollToEnd();
  }

  /** Copy the scrollback as plain text — escape codes removed — and confirm it. */
  protected async copy(): Promise<void> {
    const text = this.scrollback().map((l) => svAnsiPlainText(l.text)).join('\n');
    if (!text) return;
    const ok = await svWriteClipboard(text);
    this.copyState.set(ok ? 'done' : 'failed');
    if (ok) this.copied.emit(text);
    if (this.copyTimer !== null) clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => {
      this.copyState.set('idle');
      this.copyTimer = null;
    }, COPY_FEEDBACK_MS);
  }

  /** Type the intro out, one character at a time. */
  private async typeOut(lines: readonly TerminalLine[], run: number): Promise<void> {
    const speed = Math.max(1, this.typeSpeedMs());
    // No supersede check at the top of each line: the only way `typeRun` moves
    // is code that runs while this loop is parked at an `await`, and every
    // await is followed by the check below — between lines there is none.
    for (const line of lines) {
      // Start the line empty, then grow it in place.
      this.scrollback.update((all) => [...all, { kind: line.kind, text: '' }]);
      for (let i = 1; i <= line.text.length; i++) {
        await new Promise((r) => setTimeout(r, speed));
        // ★ Checked AFTER the await, not only before the loop: the supersede
        //   almost always lands during one of these waits, and a run that
        //   keeps writing past it is the doubling bug itself.
        if (run !== this.typeRun) return;
        const partial = line.text.slice(0, i);
        this.scrollback.update((all) => {
          const next = all.slice();
          next[next.length - 1] = { kind: line.kind, text: partial };
          return next;
        });
      }
      if (this.autoScroll() && this.following()) this.scrollToEnd();
    }
    // Typed out in full: from here on nothing re-prints it.
    if (run === this.typeRun) this.introSettled = true;
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  // ── Running ─────────────────────────────────────────────────────────────────

  /**
   * Run a line as though it had been typed and submitted.
   *
   * ★★ THIS IS WHAT MAKES THE COMPONENT USABLE WITHOUT A KEYBOARD. A host can
   *    offer tappable command chips on a phone, or a "try this" button beside
   *    the prompt, and get identical behaviour — same registry, same echo,
   *    same history — rather than reimplementing dispatch and drifting from it.
   *
   * ★ It goes through `submit()` on purpose. A shortcut that pushed straight
   *   to the scrollback would skip the prompt echo and the history entry, so
   *   pressing ↑ after tapping a chip would not find it.
   */
  async runLine(input: string): Promise<void> {
    this.value.set(input);
    await this.submit();
  }

  protected async submit(): Promise<void> {
    this.settleIntro();
    const input = this.value().trim();
    // ★ Somebody who just pressed Return wants to see the answer: a submit
    //   always follows, even from a paused log.
    this.following.set(true);
    this.unseen.set(0);

    // Echo the prompt line even when it is empty — a bare Return should move
    // the cursor down, as it does in any shell.
    this.push([{ kind: 'command', text: `${this.prompt()} ${input}` }]);
    this.value.set('');
    this.historyIndex.set(null);
    this.draft = '';

    if (!input) return;

    this.history.update((h) => [...h, input]);

    // `split` always yields at least one entry, and `input` is non-empty here.
    const [word, ...args] = input.split(/\s+/) as [string, ...string[]];
    const command =
      this.commands().find((c) => c.name.toLowerCase() === word.toLowerCase()) ?? null;

    if (!command) {
      this.push([
        { kind: 'stderr', text: svFormatLabel(this.labels.commandNotFound, { command: word }) },
        { kind: 'stdout', text: this.labels.commandHelpHint },
      ]);
      this.ran.emit({ input, command: null, result: null, unknown: true });
      return;
    }

    this.busy.set(true);
    let result: TerminalResult;
    try {
      result = await command.run(args);
    } catch {
      // ★ A handler that throws prints an error rather than taking the page
      //   down. The host's own bug is not the visitor's problem, and a dead
      //   prompt with no explanation is the worst version of it.
      this.push([{ kind: 'stderr', text: svFormatLabel(this.labels.commandFailed, { command: command.name }) }]);
      this.ran.emit({ input, command, result: null, unknown: false });
      this.busy.set(false);
      return;
    }
    this.busy.set(false);

    if (result.clear) this.scrollback.set([]);
    this.push(result.lines ?? []);
    if (result.code) {
      this.push([{ kind: 'exit', text: `exit ${result.code}` }]);
    }
    this.ran.emit({ input, command, result, unknown: false });
  }

  // ── Keyboard ────────────────────────────────────────────────────────────────

  protected onKeydown(event: KeyboardEvent): void {
    // ★ Ctrl+C and Ctrl+L are claimed; everything else is left alone. A
    //   handler that calls preventDefault() on every key traps the visitor in
    //   the field — Tab has to keep leaving when there is nothing to complete.
    if (event.ctrlKey && (event.key === 'c' || event.key === 'C')) {
      event.preventDefault();
      this.push([{ kind: 'command', text: `${this.prompt()} ${this.value()}^C` }]);
      this.value.set('');
      this.historyIndex.set(null);
      return;
    }

    if (event.ctrlKey && (event.key === 'l' || event.key === 'L')) {
      event.preventDefault();
      this.scrollback.set([]);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.stepHistory(-1);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.stepHistory(1);
      return;
    }

    if (event.key === 'Tab') {
      const completion = this.completion();
      // ★ Only swallow Tab when there is something to complete. Otherwise it
      //   moves focus on, which is the whole reason a keyboard user can get
      //   back out of this control.
      if (completion === null) return;
      event.preventDefault();
      this.value.set(completion);
      return;
    }
  }

  private stepHistory(direction: -1 | 1): void {
    const history = this.history();
    if (!history.length) return;

    const current = this.historyIndex();
    if (current === null) {
      if (direction === 1) return; // already on the live line
      this.draft = this.value();
      this.historyIndex.set(history.length - 1);
      this.value.set(history[history.length - 1]!);
      return;
    }

    const next = current + direction;
    if (next < 0) return;
    if (next >= history.length) {
      // Back to the live line, restoring whatever was half-typed.
      this.historyIndex.set(null);
      this.value.set(this.draft);
      return;
    }
    this.historyIndex.set(next);
    this.value.set(history[next]!);
  }

  /**
   * What Tab would complete to, or `null` when there is nothing to do.
   *
   * ★ Completes the longest COMMON prefix rather than the first match, which
   *   is what a shell does: with `co` matching `contact` and `copy`, jumping
   *   straight to `contact` silently picks one and hides the other.
   */
  private completion(): string | null {
    const raw = this.value();
    const parts = raw.split(/\s+/);
    const commands = this.visibleCommands();

    if (parts.length <= 1) {
      const word = parts[0]!.toLowerCase();
      if (!word) return null;
      const matches = commands
        .map((c) => c.name)
        .filter((n) => n.toLowerCase().startsWith(word));
      const prefix = commonPrefix(matches);
      return prefix && prefix.length > word.length ? prefix : null;
    }

    const command = commands.find((c) => c.name.toLowerCase() === parts[0]!.toLowerCase());
    if (!command?.args) return null;
    const partial = parts[parts.length - 1]!.toLowerCase();
    const matches = command.args().filter((a) => a.toLowerCase().startsWith(partial));
    const prefix = commonPrefix(matches);
    if (!prefix || prefix.length <= partial.length) return null;
    return [...parts.slice(0, -1), prefix].join(' ');
  }

  // ── Focus ───────────────────────────────────────────────────────────────────

  /**
   * Clicking the body focuses the prompt — but only when the visitor is not
   * selecting text.
   *
   * ★ Without the selection check, dragging to copy an error message jumps
   *   focus to the input and collapses the selection on mouseup, which makes
   *   the output impossible to copy — on the component whose output people
   *   most want to copy.
   */
  protected focusPrompt(): void {
    if (!this.interactive()) return;
    if (typeof window !== 'undefined') {
      const selection = window.getSelection?.();
      if (selection && !selection.isCollapsed) return;
    }
    this.inputEl()?.nativeElement.focus();
  }

  protected lineClass(kind: TerminalLine['kind']): string {
    switch (kind) {
      case 'command':
        return 'text-gray-900 dark:text-gray-100';
      case 'stderr':
        return 'text-danger-600 dark:text-danger-400';
      case 'exit':
        return 'text-warning-700 dark:text-warning-400';
      case 'info':
        return 'italic text-info-700 dark:text-info-300';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  }

  /**
   * The classes for one segment. Colour comes from the kit's tokens, one step
   * darker in light mode than in dark, so every ANSI colour keeps its contrast
   * on the terminal's own surface in both themes. `stderr` ignores the colour.
   */
  protected segmentClass(kind: TerminalLine['kind'], segment: SvAnsiSegment): string {
    const bold = segment.bold ? 'font-bold' : '';
    if (!segment.color || kind === 'stderr') return bold;
    const palette = segment.bright ? ANSI_BRIGHT : ANSI_NORMAL;
    return `${palette[segment.color]} ${bold}`.trim();
  }
}

/**
 * ANSI colour → token classes. `white` and `black` map to the gray ramp so a
 * "white" segment is still visible on the light theme's white surface.
 */
const ANSI_NORMAL: Readonly<Record<SvAnsiColor, string>> = {
  black: 'text-gray-900 dark:text-gray-400',
  red: 'text-danger-700 dark:text-danger-400',
  green: 'text-accent-700 dark:text-accent-400',
  yellow: 'text-warning-700 dark:text-warning-400',
  blue: 'text-primary-700 dark:text-primary-400',
  magenta: 'text-brand-700 dark:text-brand-400',
  cyan: 'text-info-700 dark:text-info-400',
  white: 'text-gray-600 dark:text-gray-200',
};

const ANSI_BRIGHT: Readonly<Record<SvAnsiColor, string>> = {
  black: 'text-gray-700 dark:text-gray-300',
  red: 'text-danger-600 dark:text-danger-300',
  green: 'text-accent-700 dark:text-accent-300',
  yellow: 'text-warning-700 dark:text-warning-300',
  blue: 'text-primary-600 dark:text-primary-300',
  magenta: 'text-brand-600 dark:text-brand-300',
  cyan: 'text-info-700 dark:text-info-300',
  white: 'text-gray-500 dark:text-gray-50',
};

/** Longest prefix shared by every entry. `''` when they share nothing. */
function commonPrefix(values: readonly string[]): string {
  if (!values.length) return '';
  let prefix = values[0]!;
  for (const value of values.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < value.length && prefix[i] === value[i]) i++;
    prefix = prefix.slice(0, i);
    if (!prefix) break;
  }
  return prefix;
}
