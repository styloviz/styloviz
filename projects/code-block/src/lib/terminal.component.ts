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
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { TerminalLine } from './code-block.types';
import type { TerminalCommand, TerminalRanEvent, TerminalResult } from './terminal.types';
import { svUniqueId } from '@styloviz/core';

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
 *  Usage:
 *
 *    <sv-terminal
 *      [commands]="commands"
 *      [intro]="intro"
 *      prompt="visitor@styloviz:~$"
 *      (ran)="onRan($event)"
 *    />
 * ============================================================
 */
@Component({
  selector: 'sv-terminal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  private readonly uid = svUniqueId('sv-term');

  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** The command registry. Anything not in here does not run. */
  readonly commands = input<readonly TerminalCommand[]>([]);

  /** Lines printed before the visitor's first keystroke. */
  readonly intro = input<readonly TerminalLine[]>([]);

  /** Prompt string, e.g. `visitor@styloviz:~$`. */
  readonly prompt = input<string>('$');

  /** Accessible label for the prompt input. */
  readonly inputLabel = input<string>('Terminal input');

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

  // ── Outputs ─────────────────────────────────────────────────────────────────

  /** Fired after every submitted line, matched or not. */
  readonly ran = output<TerminalRanEvent>();

  // ── State ───────────────────────────────────────────────────────────────────

  private readonly scrollback = signal<readonly TerminalLine[]>([]);
  protected readonly lines = this.scrollback.asReadonly();

  protected readonly value = signal('');
  protected readonly busy = signal(false);

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
    inject(DestroyRef).onDestroy(() => this.typeRun++);

    // Print the intro whenever it changes identity — a host swapping the intro
    // for a different persona should not have to destroy the component.
    effect(() => {
      const intro = this.intro();
      const run = ++this.typeRun;
      this.scrollback.set([]);
      if (!intro.length) return;
      // ★★ On the server the intro is printed whole: typing it schedules one
      //    timer per character, which a zone-based SSR render waits out
      //    (1.0 audit, H2) — and the HTML it sends should be the finished text.
      if (this.typeIntro() && !this.prefersReducedMotion() && this.isBrowser) {
        void this.typeOut(intro, run);
      } else {
        this.scrollback.set(intro.slice(-this.maxLines()));
      }
    });
  }

  /**
   * Stop any intro animation and show the whole thing at once.
   *
   * ★ Called the moment the visitor submits anything. A terminal that keeps
   *   politely typing its own introduction over the top of the command you
   *   just ran is the single most irritating thing an animated prompt can do.
   */
  private settleIntro(): void {
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
    this.scrollToEnd();
  }

  private scrollToEnd(): void {
    // `afterNextRender` would be wrong here: this runs many times per session,
    // not once. A microtask is enough — the DOM is written by the time it runs.
    queueMicrotask(() => {
      const el = this.scrollEl()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
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
      this.scrollToEnd();
    }
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
        { kind: 'stderr', text: `${word}: command not found` },
        { kind: 'stdout', text: `Type \`help\` to see what this terminal knows.` },
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
      this.push([{ kind: 'stderr', text: `${command.name}: command failed` }]);
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
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  }
}

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
