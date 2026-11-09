import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DOCUMENT, NgClass } from '@angular/common';
import { svUniqueId } from '@styloviz/core/a11y';
import { injectSvLabels } from '@styloviz/core/i18n';
import { SV_LINK_ADAPTER, svNavRecorder, type SvLinkTarget } from '@styloviz/core/nav';
import { SvIconComponent } from '@styloviz/icons';
import { SV_JUMP_MENU_LABELS } from './jump-menu.labels';

import { registerJumpMenuIcons } from './jump-menu.component.icons';
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

/**
 * Where a chosen destination is scrolled to — see `scrollTarget`.
 * `'none'`: nothing (the host handles `jump`). `'id'`: the page element whose
 * id is the item's id. An element: the same id, inside that scroll container.
 */
export type JumpMenuScrollTarget = 'none' | 'id' | HTMLElement;

/** A destination that was scrolled to, and the element it landed on. */
export interface JumpMenuJumpedEvent extends JumpMenuChangeEvent {
  readonly element: HTMLElement;
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
 * announced in advance or avoided. The tradeoffs, in order of preference:
 *
 *   · Where a destination is a new page, set `[goButton]="true"`: choosing only
 *     marks a destination, and nothing happens until Go (or Enter) — the
 *     "avoided" half of 3.2.2 (`SR-19`).
 *   · Keep the visible `label` saying what the control does ("Jump to section")
 *     — the "advised in advance" half of 3.2.2.
 *   · For an in-page menu (no `href`), the jump is a scroll, not a new page, so
 *     arrowing through options stays on the page and is recoverable.
 *   · Keyboard users can open the list first (Alt+↓ / F4 / Space), where arrows
 *     move without committing and Enter chooses.
 *
 * ## Features
 * - Native `<select>`: the OS picker on touch, full keyboard and AT support free
 * - Grouped destinations via `<optgroup>`
 * - Two-way `value` binding via `model()`
 * - Navigates through `SvLinkAdapter` when a destination has an `href`
 * - Scrolls to an in-page destination itself with `scrollTarget`, and follows a
 *   scroll-spy through `activeId`, so the select and the page agree both ways
 * - An opt-in Go button for WCAG 3.2.2
 * - 3 sizes, dark-mode ready, RTL-aware
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
  // ★ A block, like every other form control here: an inline custom element
  //   gives `w-full` nothing to be the width of (`SR-25`).
  host: { class: 'block' },
})
export class SvJumpMenuComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerJumpMenuIcons();

  /** @internal Visible text — English unless `provideSvLabels({ jumpMenu })` says otherwise. */
  protected readonly labels = injectSvLabels('jumpMenu', SV_JUMP_MENU_LABELS);

  private readonly links = inject(SV_LINK_ADAPTER);
  private readonly doc = inject(DOCUMENT);

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
  label = input<string>(this.labels.label);

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
  placeholder = input<string>(this.labels.placeholder);

  /** Additional CSS classes on the root wrapper. */
  customClass = input<string>('');

  // ── Scrolling and the round trip (`SR-19`) ────────────────────────────────

  /**
   * Scroll to the chosen destination, by id. `'none'` leaves it to the host's
   * `(jump)`; `'id'` scrolls the page to the element with the item's id; an
   * element scrolls THAT container to the matching id inside it. Emits
   * `jumped` once the scroll has started. @default 'none'
   *
   * ★ Smooth unless the user prefers reduced motion. Focus stays on the
   *   select: on Windows arrowing a closed select is a run of `change`
   *   events, and moving focus on the first would take the control away
   *   mid-arrow.
   */
  scrollTarget = input<JumpMenuScrollTarget>('none');

  /** Pixels left above the destination — a sticky header's height. @default 0 */
  scrollOffset = input<number>(0);

  /**
   * The destination something else says is current — typically a scroll-spy's
   * `activeId()`. When set, the select follows it, so scrolling the content
   * moves the control. `null` leaves `value` alone. @default null
   *
   * ★★ IGNORED WHILE A JUMP THIS MENU STARTED IS STILL SCROLLING. A smooth
   *    scroll passes every section between here and there, and a spy reports
   *    each one, so without the hold the select flickers through them and
   *    lands on the wrong one if the last report wins the race.
   */
  activeId = input<string | null>(null);

  /**
   * Choosing marks a destination; nothing happens until the Go button (or
   * Enter on the select) — WCAG 3.2.2 for menus whose destinations are new
   * pages. @default false
   */
  goButton = input<boolean>(false);

  /** The Go button's label. @default 'Go' */
  goLabel = input<string>(this.labels.go);

  /**
   * Names this menu in the shared navigation-analytics stream
   * when a page has more than one — a static name, never a record
   * id. Ignored unless `provideSvNavTelemetry()` is wired up.
   * @default null
   */
  surfaceId = input<string | null>(null);

  /*
   * FL-J3-NV-07: every destination taken is a `jump` (index = its position in
   * `items`). Consent and retention belong to the sink (`svNavRecorder`).
   */
  private readonly nav = svNavRecorder('jump-menu', () => this.surfaceId());

  // ── Outputs ───────────────────────────────────────────────────────────────

  /**
   * Emitted whenever a destination is chosen — always, because a `<select>` is
   * not a link and the browser does not navigate from it. Fires on every
   * `change`, which on Windows includes each arrow key pressed on the closed
   * control (WCAG 3.2.2); set `[goButton]="true"` to emit only on Go or Enter.
   */
  jump = output<JumpMenuChangeEvent>();

  /** Emitted after `scrollTarget` scrolled to a destination, with the element. */
  jumped = output<JumpMenuJumpedEvent>();

  // ── State ─────────────────────────────────────────────────────────────────

  /** Under `goButton`: the destination chosen but not yet taken. */
  protected readonly pending = signal<string | null>(null);

  /** What the select shows — the pending choice, else the current destination. */
  protected readonly shown = computed<string>(() => this.pending() ?? this.value());

  /** A jump this menu started, and until when `activeId` is held off. */
  private hold: { id: string; until: number } | null = null;

  /** How long a programmatic smooth scroll may take before the spy wins again. */
  private static readonly HOLD_MS = 900;

  constructor() {
    effect(() => {
      const id = this.activeId();
      if (id === null) return;
      untracked(() => {
        const hold = this.hold;
        if (hold && Date.now() < hold.until && id !== hold.id) return;
        this.hold = null;
        if (id !== this.value() && this.items().some((i) => i.id === id)) this.value.set(id);
      });
    });
  }

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
    this.items().some((item) => item.id === this.shown()),
  );

  protected readonly selectClasses = computed<string>(() => {
    const sizing = {
      // Logical padding: the chevron sits at the END, which is the left in RTL.
      sm: 'py-1 ps-2 pe-7 text-xs',
      md: 'py-1.5 ps-3 pe-8 text-sm',
      lg: 'py-2 ps-3.5 pe-9 text-base',
    }[this.size()];

    return [
      'w-full appearance-none rounded-lg border bg-white font-medium text-gray-900 transition-colors',
      'border-gray-300 hover:border-gray-400',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1',
      'disabled:cursor-not-allowed disabled:opacity-50', // sv-i18n-ignore: Tailwind class list
      'dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:border-gray-600',
      sizing,
    ].join(' ');
  });

  protected readonly goClasses = computed<string>(() => {
    const sizing = { sm: 'px-2.5 py-1 text-xs', md: 'px-3 py-1.5 text-sm', lg: 'px-3.5 py-2 text-base' }[this.size()];
    return [
      'shrink-0 rounded-lg bg-primary-600 font-medium text-white transition-colors hover:bg-primary-700',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1',
      'disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-gray-900',
      sizing,
    ].join(' ');
  });

  protected readonly labelClasses = computed<string>(() =>
    this.labelHidden()
      ? 'sr-only'
      : 'mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400',
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

    this.pending.set(null);
    this.value.set(item.id);
    this.nav.record({ intent: 'jump', key: item.id, label: item.label, index: this.items().indexOf(item) });

    if (item.href !== undefined) this.follow(item.href);

    const group = item.group ?? null;
    this.jump.emit({ item, group });

    const element = this.scrollToId(item.id);
    if (element) this.jumped.emit({ item, group, element });
  }

  /** Under `goButton`: take the pending destination (or re-take the current one). */
  go(): void {
    if (this.disabled()) return;
    const id = this.shown();
    if (id) this.onSelect(id);
  }

  /**
   * Scroll `scrollTarget` to the element with this id; `null` when there is
   * nothing to scroll or nothing with that id. SSR-safe.
   */
  private scrollToId(id: string): HTMLElement | null {
    const target = this.scrollTarget();
    if (target === 'none' || typeof window === 'undefined') return null;
    const container = target === 'id' ? null : target;
    const el = this.doc.getElementById(id);
    if (!el || (container && !container.contains(el))) return null;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth';
    const offset = this.scrollOffset();
    this.hold = { id, until: Date.now() + (reduce ? 0 : SvJumpMenuComponent.HOLD_MS) };

    if (container) {
      const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - offset;
      container.scrollTo({ top: Math.max(0, top), behavior });
    } else {
      window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset), behavior });
    }
    return el;
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
    const id = (event.target as HTMLSelectElement).value;
    if (this.goButton()) {
      const item = this.items().find((candidate) => candidate.id === id);
      if (item && !item.disabled) this.pending.set(id);
      return;
    }
    this.onSelect(id);
  }

  /** Enter on the select takes the pending destination, under `goButton`. */
  protected onEnter(event: Event): void {
    if (!this.goButton()) return;
    event.preventDefault();
    this.go();
  }
}
