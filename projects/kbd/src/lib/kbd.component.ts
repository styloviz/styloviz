import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { svKbdChord, svKbdSpoken, type SvKbdKey } from './kbd.keys';

/**
 * Visual weight.
 * - `solid`  — bordered chip with a subtle fill and shadow (the default; the
 *   "you can press this" affordance). Matches the `.cp-kbd` style that
 *   `command-palette` had already converged on before this component existed.
 * - `ghost`  — border only, no fill — for a key hint sitting on top of an
 *   already-busy surface (an active list row, a colored banner).
 * - `plain`  — no border or fill at all, just monospaced text. For a shortcut
 *   hint inside a menu item where the row itself already reads as
 *   interactive, and a second chip would compete with it.
 */
export type KbdVariant = 'solid' | 'ghost' | 'plain';

/** @default 'sm' — `md` is for a hint standing alone (an empty-state footer, a tooltip), not inline in a sentence. */
export type KbdSize = 'sm' | 'md';

/**
 * SvKbdComponent — a styled keyboard-key chip for shortcut hints.
 *
 * Extracted after an audit found 26 hand-written `<kbd>` tags across 9 files
 * (search bars, the command palette, tag-input, dropdown menus, the docs
 * showcase) with 6 different combinations of border/background/padding/font —
 * none of them a single canonical look. This is the one component going
 * forward; `variant` + `size` cover the real spread that audit found.
 *
 * ```html
 * <sv-kbd>⌘K</sv-kbd>
 * <sv-kbd variant="ghost">Esc</sv-kbd>
 * <span class="text-xs text-gray-500 dark:text-gray-400">Press <sv-kbd size="md">↵</sv-kbd> to select</span>
 * ```
 */
@Component({
  selector: 'sv-kbd',
  standalone: true,
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kbd.component.html',
})
export class SvKbdComponent {
  /**
   * The key, by name or by glyph — `cmd`, `shift`, `esc`, `⌘`, `K`.
   *
   * ★★★ THE POINT OF THIS INPUT IS THE SPOKEN NAME. `⌘` is U+2318 PLACE OF
   * INTEREST SIGN and a screen reader says "place of interest sign", or nothing
   * at all; `⇧` is UPWARDS WHITE ARROW; `↵` is DOWNWARDS ARROW WITH CORNER
   * LEFTWARDS. None of those is the name of a key, and the entire content of a
   * shortcut hint is which keys to press — so a hint made of projected glyphs
   * is documentation nobody can hear.
   *
   * Given the key, the component draws the glyph AND knows what it is called,
   * so the symbol is hidden from assistive tech behind the word. Glyphs are
   * accepted as well as tokens because hosts already have `⌘` hard-coded in a
   * hundred templates, and a fix that requires rewriting all of them first is a
   * fix that never gets adopted.
   * @default ''
   */
  readonly key = input<string>('');

  /**
   * A whole chord — `"cmd+shift+K"` — rendered as one unbreakable group.
   *
   * ★ "Ctrl +" at the end of a line and "C" at the start of the next is not a
   * shortcut, it is two. A literal `+` is written `++`.
   * @default ''
   */
  readonly chord = input<string>('');

  /** Visual weight. @default 'solid' */
  readonly variant = input<KbdVariant>('solid');

  /** Chip size. @default 'sm' */
  readonly size = input<KbdSize>('sm');

  /**
   * Accessible label when the projected content is a symbol a screen reader
   * won't say usefully on its own (e.g. `↵`, `⌘`) — announced instead of the
   * glyph. Leave unset for plain text keys (`Esc`, `Tab`), which already read
   * fine.
   */
  readonly ariaLabel = input<string>('');

  /** Extra classes appended after the resolved variant/size classes. */
  readonly customClass = input<string>('');

  /** The keys this chip draws, empty when the host is projecting content. */
  protected readonly keys = computed<readonly SvKbdKey[]>(() => {
    const chord = this.chord().trim();
    if (chord) return svKbdChord(chord);
    const key = this.key().trim();
    return key ? svKbdChord(key) : [];
  });

  /** What the whole thing is announced as. */
  protected readonly spokenLabel = computed(
    () => this.ariaLabel().trim() || svKbdSpoken(this.keys()),
  );

  protected readonly classes = computed<string>(() => {
    const base = 'inline-flex items-center justify-center rounded border font-mono leading-none';

    const sizeClass: Record<KbdSize, string> = {
      sm: 'px-1.5 py-0.5 text-[10px]',
      md: 'px-2 py-1 text-xs',
    };

    const variantClass: Record<KbdVariant, string> = {
      solid:
        'border-gray-200 bg-white text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400',
      ghost: 'border-gray-200 bg-transparent text-gray-500 dark:border-gray-700 dark:text-gray-400',
      plain: 'border-transparent bg-transparent p-0 text-current',
    };

    // `plain` owns its own padding (none) — the shared size padding would
    // fight it, since the whole point of `plain` is to disappear into the
    // surrounding text.
    const sized = this.variant() === 'plain' ? '' : sizeClass[this.size()];

    return `${base} ${sized} ${variantClass[this.variant()]} ${this.customClass()}`.trim();
  });
}
