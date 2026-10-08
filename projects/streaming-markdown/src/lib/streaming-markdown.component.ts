import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SvCodeBlockComponent } from '@styloviz/code-block';
import type { CodeLanguage } from '@styloviz/code-block';
import type { MdBlock, MdInline } from './streaming-markdown.types';
import { parseMarkdown } from './markdown-parser';
import { SvIconComponent } from '@styloviz/icons';

/** Density preset for the rendered prose. */
export type MarkdownDensity = 'sm' | 'md';

/** Payload of the `linkClick` output. */
export interface MarkdownLinkClick {
  readonly href: string;
  readonly text: string;
}

const CODE_LANGUAGES: readonly string[] = [
  'typescript', 'javascript', 'html', 'css', 'json', 'bash', 'python', 'plaintext',
];

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * StreamingMarkdown — safe Markdown renderer built for token-by-token output.
 *
 * Features:
 * - Renders a parsed **token model** through Angular bindings — no `innerHTML`,
 *   no `bypassSecurityTrust*`, so untrusted content can never become markup
 * - Streaming-safe: a pure parser re-run on a growing buffer, with an optional
 *   caret and graceful handling of half-received syntax
 * - Headings, paragraphs, lists (incl. `- [x]` tasks), blockquotes, tables with
 *   alignment, thematic breaks, and inline strong/em/code/strike/links
 * - Fenced code delegates to `sv-code-block`, so highlighting and copy come free
 * - `javascript:` / `data:` URLs are rejected at parse time and render as text
 * - `headingOffset` demotes headings for use inside a chat bubble or card
 */
@Component({
  selector: 'sv-streaming-markdown',
  standalone: true,
  imports: [NgTemplateOutlet, SvCodeBlockComponent, SvIconComponent],
  templateUrl: './streaming-markdown.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvStreamingMarkdownComponent {
  // ── Content ───────────────────────────────────────────────────────────────

  /** Markdown source. Safe to update on every streamed token. @default '' */
  content = input<string>('');

  /** Render a blinking caret after the last block, for in-flight responses. @default false */
  streaming = input<boolean>(false);

  // ── Appearance ────────────────────────────────────────────────────────────

  /** Text density. @default 'md' */
  density = input<MarkdownDensity>('md');

  /**
   * Added to every heading level, so `#` becomes `<h3>` at an offset of 2.
   * Use it to keep document headings from competing with the surrounding page.
   * @default 0
   */
  headingOffset = input<number>(0);

  /** Show line numbers in fenced code blocks. @default false */
  codeLineNumbers = input<boolean>(false);

  /** Max height of a fenced code block, as a CSS length. @default '20rem' */
  codeMaxHeight = input<string>('20rem');

  /** Accessible label for the rendered region. @default '' */
  ariaLabel = input<string>('');

  /**
   * What a screen reader is told when a streamed response finishes.
   *
   * ★★★ A LIVE REGION UPDATED PER TOKEN IS UNUSABLE, which is why this component
   *     has never had one — but the silence had its own cost: a screen-reader
   *     user got no signal at all that generation had finished, and had to poll
   *     the region by hand to find out. The answer is not a quieter live region,
   *     it is a DIFFERENT event: `aria-busy` while the text is arriving, and one
   *     announcement at the moment it stops.
   *
   * Set to `''` to announce nothing at all.
   * @default 'Response complete'
   */
  completionMessage = input<string>('Response complete');

  // ── Events ────────────────────────────────────────────────────────────────

  /** Emits when a rendered link is activated. Call `preventDefault` upstream to intercept. */
  linkClick = output<MarkdownLinkClick>();

  /** Emits the copied text when a fenced code block is copied. */
  codeCopied = output<string>();

  // ── Derived ───────────────────────────────────────────────────────────────

  /**
   * The completion announcement, published only once the stream has stopped.
   *
   * ★ It is empty WHILE streaming, so the live region has nothing to read out
   *   until there is something worth saying. A region that carried the text as
   *   it grew would announce every token, which is the defect this replaces.
   *
   * ★ It also stays empty when nothing ever streamed. A static document that
   *   announced "Response complete" on first render would be talking about an
   *   event that did not happen.
   */
  private readonly hasStreamed = signal(false);

  /**
   * ★ An EFFECT, not a write inside the computed. A computed must be pure —
   *   Angular may evaluate it more than once per change, or not at all, so a
   *   side effect there fires an unpredictable number of times. The transition
   *   is what matters here, and an effect is the thing that observes one.
   */
  protected readonly watchStream = effect(() => {
    if (this.streaming()) this.hasStreamed.set(true);
  });

  /** True while tokens are still arriving. */
  readonly busy = computed(() => this.streaming());

  /**
   * What the live region says. Empty while streaming, and empty for a document
   * that never streamed — announcing "Response complete" on the first render of
   * a static document would be reporting an event that did not happen.
   */
  readonly announcement = computed(() =>
    this.streaming() || !this.hasStreamed() ? '' : this.completionMessage(),
  );

  protected readonly blocks = computed<readonly MdBlock[]>(() => parseMarkdown(this.content()));

  protected readonly rootClass = computed(() =>
    this.density() === 'sm'
      ? 'text-[13px] leading-[1.65] text-gray-700 dark:text-gray-300'
      : 'text-sm leading-[1.7] text-gray-700 dark:text-gray-300',
  );

  /** Heading tag level after `headingOffset`, clamped to 1–6. */
  protected headingLevel(level: number | undefined): number {
    return Math.min(6, Math.max(1, (level ?? 1) + this.headingOffset()));
  }

  protected headingClass(level: number | undefined): string {
    switch (this.headingLevel(level)) {
      case 1: return 'mt-5 mb-2 text-xl font-bold text-gray-900 first:mt-0 dark:text-white';
      case 2: return 'mt-5 mb-2 text-lg font-bold text-gray-900 first:mt-0 dark:text-white';
      case 3: return 'mt-4 mb-1.5 text-base font-semibold text-gray-900 first:mt-0 dark:text-white';
      case 4: return 'mt-4 mb-1.5 text-sm font-semibold text-gray-900 first:mt-0 dark:text-white';
      default: return 'mt-3 mb-1 text-[13px] font-semibold text-gray-800 first:mt-0 dark:text-gray-200';
    }
  }

  protected alignClass(index: number, align: readonly string[] | undefined): string {
    const a = align?.[index] ?? 'left';
    return a === 'center' ? 'text-center' : a === 'right' ? 'text-right' : 'text-left';
  }

  /** Indent for a nested list item, capped so deep nesting can't run off-screen. */
  protected indent(depth: number): string {
    return `${Math.min(depth, 4) * 1.25}rem`;
  }

  /** Narrow a fence's info string to a language the code block understands. */
  protected language(raw: string | undefined): CodeLanguage {
    const l = (raw ?? '').toLowerCase();
    const alias: Record<string, string> = { ts: 'typescript', js: 'javascript', sh: 'bash', shell: 'bash', py: 'python', yml: 'plaintext', yaml: 'plaintext' };
    const name = alias[l] ?? l;
    return (CODE_LANGUAGES.includes(name) ? name : 'plaintext') as CodeLanguage;
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  protected onLink(event: MouseEvent, span: MdInline): void {
    if (!span.href) return;
    this.linkClick.emit({ href: span.href, text: span.text });
    void event;
  }
}
