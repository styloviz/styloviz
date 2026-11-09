import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SvCheckIcon } from '@styloviz/icons/glyph/check';
import { SvChevronRightIcon } from '@styloviz/icons/glyph/chevron-right';
import { SvCopyIcon } from '@styloviz/icons/glyph/copy';
import { svUniqueId } from '@styloviz/core/a11y';
import { injectSvLabels, svFormatLabel } from '@styloviz/core/i18n';
import { SV_CODE_BLOCK_LABELS } from '../code-block.labels';
import { svWriteClipboard } from '../clipboard';
import {
  svIsLibraryFrame,
  svParseStackTrace,
  svStackFrameLocation,
  type SvParsedStackTrace,
  type SvStackFrame,
} from './stack-trace.logic';

/** A frame as the list draws it. */
interface FrameItem {
  readonly type: 'frame';
  readonly id: string;
  readonly frame: SvStackFrame;
  readonly library: boolean;
  readonly location: string | null;
}

/** A run of library frames, folded behind one toggle. */
interface LibraryGroup {
  readonly type: 'library';
  readonly id: string;
  readonly frames: readonly FrameItem[];
}

type StackItem = FrameItem | LibraryGroup;

/** A library group as the template draws it: open or not, its toggle text and list id. */
interface DrawnGroup extends LibraryGroup {
  readonly open: boolean;
  readonly label: string;
  readonly domId: string;
}

type DrawnItem = FrameItem | DrawnGroup;

/** How long the copy button shows its tick (or its failure). */
const COPY_FEEDBACK_MS = 2000;

/**
 * ============================================================
 *  SvStackTraceComponent — an error, read
 * ============================================================
 *  Install: npm install @styloviz/code-block
 *
 *  Pass an `Error` or the text of a stack trace. It shows the error's name and
 *  message, then one row per frame — function, file, line and column — with
 *  runs of library frames (`node_modules`, Node internals, bundler runtimes,
 *  native code) folded behind "Show N library frames", so the frames in YOUR
 *  code are the ones on screen.
 *
 *  ★★ PARSED, NOT RENDERED. `svParseStackTrace()` (exported) reads V8,
 *     SpiderMonkey and JavaScriptCore traces plus a generic `at file:line:col`
 *     line into strings and numbers; every one is drawn as text. A trace that
 *     carries `<script>` in a message prints those characters.
 *
 *  ★ `frameClickable` turns each frame with a file into a button that emits
 *    `frameClick` — open it in an editor, jump to the source map, file a bug.
 *    Off by default: a row that looks clickable and is not is worse than text.
 *
 *  Usage:
 *
 *    <sv-stack-trace [trace]="error" />
 *    <sv-stack-trace [trace]="loggedStack" [frameClickable]="true" (frameClick)="open($event)" />
 * ============================================================
 */
@Component({
  selector: 'sv-stack-trace',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, SvCheckIcon, SvChevronRightIcon, SvCopyIcon],
  templateUrl: './stack-trace.component.html',
})
export class SvStackTraceComponent {
  protected readonly labels = injectSvLabels('codeBlock', SV_CODE_BLOCK_LABELS);
  private readonly uid = svUniqueId('sv-stack');

  // ── Inputs ──────────────────────────────────────────────────────────────────

  /**
   * The trace: an `Error` (its `stack`, `name` and `message` are read) or the
   * text of a stack trace, as logged. @default null
   */
  readonly trace = input<string | Error | null>(null);

  /** Fold each run of library frames behind a "Show N library frames" toggle. @default true */
  readonly collapseLibraryFrames = input<boolean>(true);

  /**
   * Decides which frames are library code. The default, `svIsLibraryFrame`,
   * matches `node_modules`, `node:` and `internal/` paths, webpack and Vite
   * runtimes, zone.js, polyfills and native frames. @default svIsLibraryFrame
   */
  readonly isLibraryFrame = input<(frame: SvStackFrame) => boolean>(svIsLibraryFrame);

  /** Render each frame that has a file as a button that emits `frameClick`. @default false */
  readonly frameClickable = input<boolean>(false);

  /** Show a button that copies the trace as text. @default true */
  readonly copyable = input<boolean>(true);

  /** Max height of the frame list, e.g. `'24rem'`; it scrolls past that. `''` for none. @default '' */
  readonly maxHeight = input<string>('');

  /** Accessible name of the region. @default 'Stack trace' */
  readonly ariaLabel = input<string>(this.labels.stackTraceLabel);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  /** A frame was activated (only while `frameClickable`). Payload: the parsed frame. */
  readonly frameClick = output<SvStackFrame>();

  /** Emits the copied text after a successful clipboard write. */
  readonly copied = output<string>();

  // ── Derived ─────────────────────────────────────────────────────────────────

  /** The text the trace was read from — also what copy takes. */
  protected readonly source = computed<string>(() => {
    const trace = this.trace();
    if (trace === null) return '';
    if (typeof trace === 'string') return trace;
    return trace.stack ?? `${trace.name}: ${trace.message}`;
  });

  protected readonly parsed = computed<SvParsedStackTrace>(() => {
    const trace = this.trace();
    const parsed = svParseStackTrace(this.source());
    // ★ Firefox and Safari put no header in `stack`; the Error object still
    //   knows its name and message, so a missing header is filled from it.
    if (trace instanceof Error) {
      return {
        name: parsed.name ?? trace.name,
        message: parsed.message || trace.message,
        frames: parsed.frames,
      };
    }
    return parsed;
  });

  protected readonly items = computed<readonly StackItem[]>(() => {
    const isLibrary = this.isLibraryFrame();
    const collapse = this.collapseLibraryFrames();
    const out: StackItem[] = [];
    let run: FrameItem[] = [];
    const flush = (): void => {
      if (run.length >= 2) out.push({ type: 'library', id: `lib-${run[0]!.id}`, frames: run });
      else out.push(...run);
      run = [];
    };
    this.parsed().frames.forEach((frame, index) => {
      const item: FrameItem = {
        type: 'frame',
        id: `f${index}`,
        frame,
        library: isLibrary(frame),
        location: svStackFrameLocation(frame),
      };
      if (collapse && item.library) {
        run.push(item);
      } else {
        flush();
        out.push(item);
      }
    });
    flush();
    return out;
  });

  /** Library groups the reader opened. Cleared when the trace changes. */
  protected readonly expanded = linkedSignal<readonly StackItem[], ReadonlySet<string>>({
    source: this.items,
    computation: () => new Set<string>(),
  });

  /** The list as drawn — each group's open state and toggle text worked out once. */
  protected readonly drawn = computed<readonly DrawnItem[]>(() => {
    const open = this.expanded();
    return this.items().map((item) => {
      if (item.type === 'frame') return item;
      const isOpen = open.has(item.id);
      return {
        ...item,
        open: isOpen,
        domId: `${this.uid}-${item.id}`,
        label: svFormatLabel(isOpen ? this.labels.stackTraceHideLibrary : this.labels.stackTraceShowLibrary, {
          count: item.frames.length,
        }),
      };
    });
  });

  protected readonly framesLabel = computed(() =>
    svFormatLabel(this.labels.stackTraceFrames, { count: this.parsed().frames.length }),
  );

  protected readonly copyState = signal<'idle' | 'done' | 'failed'>('idle');
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.copyTimer !== null) clearTimeout(this.copyTimer);
    });
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  protected toggle(group: LibraryGroup): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(group.id)) next.delete(group.id);
      else next.add(group.id);
      return next;
    });
  }

  protected open(frame: SvStackFrame): void {
    if (this.frameClickable() && frame.file) this.frameClick.emit(frame);
  }

  protected async copy(): Promise<void> {
    const text = this.source().trim();
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
}
