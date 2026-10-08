import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { NgClass } from '@angular/common';
import {
  SV_LINK_ADAPTER,
  svUniqueId,
  type SvLinkTarget,
} from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

// ─── Types ────────────────────────────────────────────────────────────────────

/** One destination the menu can jump to. */
export interface JumpMenuItem {
  /** Unique key — the value this menu holds when the destination is current. */
  id: string;
  /** Display label. */
  label: string;
  /**
   * Where it goes, for a host with a link adapter wired up.
   *
   * Omit it for an in-page destination the host handles itself from `jump` —
   * a section id, a tab, a step.
   */
  href?: SvLinkTarget;
  /** Optional group heading; destinations sharing one are rendered together. */
  group?: string;
  /** Prevents this destination from being chosen. @default false */
  disabled?: boolean;
}

/** Visual size of the control. */
export type JumpMenuSize = 'sm' | 'md' | 'lg';

/** A destination, and the group it was rendered under. */
export interface JumpMenuChangeEvent {
  readonly item: JumpMenuItem;
  readonly group: string | null;
}

interface JumpGroup {
  readonly label: string | null;
  readonly items: readonly JumpMenuItem[];
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Jump Menu — compact navigation as a single control, for places a row of
 * destinations does not fit.
 *
 * ## ★★ Why this is a native `<select>`
 *
 * This component exists to be the **small** form of other navigation — `X-11`'s
 * swap target, `X-7`'s shared answer, and the thing `sv-tabs` and `sv-anchor`
 * become on a phone. So the question is not *"what is the nicest dropdown?"* but
 * *"what works best on a phone, one-handed?"* — and the answer is the platform's
 * own picker: a wheel on iOS, a dialog on Android, the OS's own font scaling and
 * accessibility settings, with zero of the kit's JavaScript between the user and
 * the choice.
 *
 * A custom listbox would give visual control over the one surface where visual
 * control matters least and platform behaviour matters most. It would also need a
 * body portal, a focus trap, viewport clamping, and an answer for what happens
 * when the software keyboard covers the panel — all of which the native control
 * already has, and none of which the kit can do better on a device it cannot see.
 *
 * `docs/native-element-rule.md` is the standing version of this argument. This is
 * the component where it is most obviously right.
 *
 * ## ★ Why it navigates AND emits, unlike `sv-mega-menu`
 *
 * The mega menu's rule is *"the output fires exactly when this component stopped
 * the browser from navigating"*, because its entries are real anchors the browser
 * might follow. A `<select>` is not a link and never navigates on its own, so
 * there is nothing to stop and the output **always** fires. Same principle — one
 * navigation, and the component says which — applied to a control where the
 * browser was never a participant.
 *
 * ★ Which is also why a declined navigation is followed HERE. An anchor whose
 * adapter returns `false` is followed by the browser; a `<select>` has no
 * browser behaviour to fall back on, so under the default `svHrefLinkAdapter` —
 * which renders hrefs and navigates nothing — a destination with an `href` did
 * nothing at all. When the adapter declines, the menu assigns the adapter's own
 * `href` to `location`: the full page load an anchor would have made.
 *
 * ## ⚠️ Navigate-on-change, and WCAG 3.2.2 (On Input)
 *
 * A destination is taken on the `<select>`'s `change` event. On Windows, arrow
 * keys on a CLOSED select change its value — and fire `change` — one option at
 * a time, so a keyboard user arrowing towards the fourth destination is taken to
 * the first. That is a change of context on input, which 3.2.2 asks to be
 * announced in advance or avoided. This component offers no "Go" button mode;
 * the tradeoffs, in order of preference:
 *
 *   · Keep the visible `label` saying what the control does ("Jump to section")
 *     — the "advised in advance" half of 3.2.2.
 *   · For an in-page menu (no `href`), the jump is a scroll, not a new page, so
 *     arrowing through options stays on the page and is recoverable.
 *   · Where a destination is a new page and that is not acceptable, omit `href`
 *     and navigate from your own "Go" button using the two-way `value`.
 *   · Keyboard users can open the list first (Alt+↓ / F4 / Space), where arrows
 *     move without committing and Enter chooses.
 *
 * ## Features
 * - Native `<select>`: the OS picker on touch, full keyboard and AT support free
 * - Grouped destinations via `<optgroup>`
 * - Two-way `value` binding via `model()`
 * - Navigates through `SvLinkAdapter` when a destination has an `href`
 * - 3 sizes, dark-mode ready
 *
 * @example
 * ```html
 * <sv-jump-menu
 *   [items]="sections"
 *   [(value)]="activeSection"
 *   label="Jump to section"
 *   (jump)="scrollTo($event.item.id)" />
 * ```
 */
@Component({
  selector: 'sv-jump-menu',
  standalone: true,
  imports: [NgClass, SvIconComponent],
  templateUrl: './jump-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvJumpMenuComponent {
  private readonly links = inject(SV_LINK_ADAPTER);

  /** Per-instance id prefix, stable across hydration. */
  private readonly uid = svUniqueId('sv-jump-menu');

  /** DOM id of the `<select>`, for the label to point at. */
  readonly selectId = `${this.uid}-select`;

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Destinations, in display order. @default [] */
  items = input<readonly JumpMenuItem[]>([]);

  /** Id of the current destination. Use `[(value)]` for two-way binding. @default '' */
  value = model<string>('');

  /**
   * Visible label above the control.
   *
   * ★ Not optional in practice: a bare `<select>` in a navigation bar reads as
   * *"combo box, Overview"* and nothing tells a screen-reader user it moves them.
   * @default 'Jump to'
   */
  label = input<string>('Jump to');

  /** Hide the label visually, keeping it for assistive technology. @default false */
  labelHidden = input<boolean>(false);

  /** Control size. @default 'md' */
  size = input<JumpMenuSize>('md');

  /** Prevents any destination from being chosen. @default false */
  disabled = input<boolean>(false);

  /**
   * Text for the placeholder option shown while `value` matches no destination.
   * Empty string removes the placeholder entirely. @default 'Select…'
   */
  placeholder = input<string>('Select…');

  /** Additional CSS classes on the root wrapper. */
  customClass = input<string>('');

  // ── Outputs ───────────────────────────────────────────────────────────────

  /**
   * Emitted whenever a destination is chosen — always, because a `<select>` is
   * not a link and the browser was never going to navigate. See the class note.
   * Fires on every `change`, which on Windows includes each arrow key pressed on
   * the closed control (WCAG 3.2.2) — see the class note for the tradeoff.
   */
  jump = output<JumpMenuChangeEvent>();

  // ── Computed ──────────────────────────────────────────────────────────────

  /**
   * Destinations, grouped for `<optgroup>`.
   *
   * ★ Grouped in **encounter order**, not alphabetically and not by first
   * appearance of each group name across the whole list. A jump menu's order is
   * the document's order — sections down a page, steps through a wizard — and
   * re-sorting it would put the control's idea of "next" out of step with the
   * page's. Ungrouped destinations keep their place in the sequence rather than
   * being swept to the end.
   */
  protected readonly groups = computed<readonly JumpGroup[]>(() => {
    const out: JumpGroup[] = [];
    let current: { label: string | null; items: JumpMenuItem[] } | null = null;

    for (const item of this.items()) {
      const group = item.group ?? null;
      if (!current || current.label !== group) {
        current = { label: group, items: [] };
        out.push(current);
      }
      current.items.push(item);
    }
    return out;
  });

  /** Whether `value` names a destination this menu can show. */
  protected readonly hasSelection = computed<boolean>(() =>
    this.items().some((item) => item.id === this.value()),
  );

  protected readonly selectClasses = computed<string>(() => {
    const sizing = {
      sm: 'py-1 pl-2 pr-7 text-xs',
      md: 'py-1.5 pl-3 pr-8 text-sm',
      lg: 'py-2 pl-3.5 pr-9 text-base',
    }[this.size()];

    return [
      'w-full appearance-none rounded-lg border bg-white font-medium text-gray-900 transition-colors',
      'border-gray-300 hover:border-gray-400',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:border-gray-600',
      sizing,
    ].join(' ');
  });

  protected readonly labelClasses = computed<string>(() =>
    this.labelHidden()
      ? 'sr-only'
      : 'mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400',
  );

  // ── Interaction ───────────────────────────────────────────────────────────

  /**
   * Take the chosen destination.
   *
   * ★ The `value` is set before anything else, so a host binding `[(value)]`
   * sees the new state whether or not it listens to `jump` — and so a navigation
   * that replaces this component leaves the control showing where the user asked
   * to go rather than where they were.
   */
  protected onSelect(id: string): void {
    const item = this.items().find((candidate) => candidate.id === id);
    if (!item || item.disabled) return;

    this.value.set(item.id);

    if (item.href !== undefined) this.follow(item.href);

    this.jump.emit({ item, group: item.group ?? null });
  }

  /**
   * Navigate through the adapter, and when it declines, load the adapter's own
   * `href` — see the class note. SSR-safe: a server has no `location` to assign.
   */
  private follow(target: SvLinkTarget): void {
    if (this.links.navigate(target)) return;
    const url = this.links.href(target);
    if (url === null || typeof window === 'undefined') return;
    window.location.assign(url);
  }

  /** The `<select>`'s change handler; narrows the event target for the template. */
  protected onChange(event: Event): void {
    this.onSelect((event.target as HTMLSelectElement).value);
  }
}
