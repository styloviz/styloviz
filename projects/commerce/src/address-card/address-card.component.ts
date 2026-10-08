import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgClass } from '@angular/common';
import {
  svFirstFocusableWithin,
  svIsFocusable,
  svMaskTail,
  svRecoverFocus,
  svRequestKey,
  toSvDataError,
  type SvDataError,
  svUniqueId,
} from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AddressKind = 'shipping' | 'billing' | 'both';

/**
 * How much of the address the card prints.
 *
 * - `none` — everything, as entered.
 * - `partial` — house / flat numbers in the street lines, the inward half of
 *   the postcode and all but the last four digits of the phone are masked; the
 *   street name, city and country stay legible so the person can still tell
 *   their addresses apart.
 */
export type AddressMaskLevel = 'none' | 'partial';

const MASK = '•';

/** Mask every token that carries a digit — house and flat numbers — and keep the words. */
function maskNumberedTokens(line: string): string {
  return line.replace(/\S*\d\S*/g, (token) => token.replace(/[\p{L}\p{N}]/gu, MASK));
}

/** Keep the first half of a postcode (the outward / area part) and mask the rest. */
function maskPostcode(code: string): string {
  const total = [...code].filter((c) => /[\p{L}\p{N}]/u.test(c)).length;
  return svMaskTail([...code].reverse().join(''), Math.ceil(total / 2), MASK).split('').reverse().join('');
}

export interface Address {
  readonly id?: string;
  /** Short label, e.g. 'Home' or 'Work'. */
  readonly label?: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly line1: string;
  readonly line2?: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
  readonly phone?: string;
  readonly isDefault?: boolean;
  readonly kind?: AddressKind;
}

/**
 * A write against this one address — deleting it, or making it the default.
 *
 * ★ There is deliberately NO `rollback()`, for the same reason as
 *   `FileRemoveEvent` in `@styloviz/commerce`: this component renders ONE
 *   address out of a book that belongs to the host, so it has nothing to put
 *   the address back into. What it owes instead is a confirmation before the
 *   irreversible half, a lock while the write is in flight, and somewhere to
 *   report the failure. Nothing is applied optimistically here: `isDefault`
 *   comes from `address()`, so the badge moves when the host says it has.
 */
export interface AddressActionEvent {
  /** The address the action was taken on. */
  readonly address: Address;
  /**
   * Client-generated key for this write, stable across retries of it. Send it
   * and ignore a key already applied, so a retried delete cannot remove a
   * second address that has since taken the same id.
   */
  readonly requestKey: string;
  /**
   * This address was the default when the action was taken.
   *
   * On a `remove`, that makes it the case the host has to have an answer for —
   * and the reason it is here rather than left to be re-derived is that by the
   * time the host handles the event it may already have dropped the record.
   */
  readonly wasDefault: boolean;
  /**
   * On a `remove` of the default address: which of `defaultCandidates` should
   * take the badge. The confirmation offers the choice and preselects the first,
   * so this is set even when the person left the dropdown alone.
   *
   * `undefined` means there is no successor — the address was not the default,
   * or no candidates were supplied, in which case the strip said out loud that
   * there would be no default afterwards.
   */
  readonly nextDefaultId?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SvAddressCardComponent — A saved address, elegantly displayed.
 *
 * Shows the label, default / shipping-billing badges, the recipient and the
 * formatted address, with optional edit / remove / set-default actions. In
 * `selectable` mode it behaves as a radio option (checkout address picker):
 * the whole card is clickable, shows a check indicator, and emits `select`.
 *
 * ## Sensitive-value boundary
 *
 * This component is **display-only**: it renders an address the host already
 * holds and never geocodes, validates, stores or transmits it. A home address is
 * personal data, so `maskLevel="partial"` prints it with the house number, the
 * inward postcode and the phone masked — for a shared screen, a support view or
 * a picker that only needs the person to recognise the address. See
 * `docs/sensitive-value-policy.md`.
 *
 * Features:
 * - Label chip + default badge + kind badge
 * - Edit / remove / set-default actions (individually toggleable)
 * - Selectable (radio) mode with a stretched click target + check indicator
 * - Accessible: role="radio" / aria-checked in selectable mode; dark-mode ready
 */
@Component({
  selector: 'sv-address-card',
  standalone: true,
  imports: [SvIconComponent, NgClass],
  templateUrl: './address-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvAddressCardComponent {
  // ── Focus (X-12) ──────────────────────────────────────────────────────────

  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _injector = inject(Injector);
  private readonly _root = viewChild<ElementRef<HTMLElement>>('root');
  private readonly _removeButton = viewChild<ElementRef<HTMLButtonElement>>('removeButton');

  /**
   * Captured when `remove` is emitted from inside this card. If the host then
   * takes the card out, focus moves to the next card, else the previous one,
   * else the list — never <body>.
   */
  private _removalNeighbours: { next: Element | null; previous: Element | null; container: Element | null } | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      const neighbours = this._removalNeighbours;
      if (!neighbours) return;
      const doc = this._host.nativeElement.ownerDocument;
      // After the host's view is detached, so we can see where focus fell.
      queueMicrotask(() => {
        const active = doc.activeElement;
        if (active && active !== doc.body && active.isConnected) return;
        const target = (el: Element | null) => (svIsFocusable(el) ? el : svFirstFocusableWithin(el));
        svRecoverFocus({
          to: [target(neighbours.next), target(neighbours.previous)],
          fallback: neighbours.container,
        });
      });
    });
  }

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** The address to display. */
  address = input.required<Address>();

  /** Radio-style selection mode (checkout address picker). @default false */
  selectable = input<boolean>(false);

  /** Selected state (parent-controlled in a radio group). @default false */
  selected = input<boolean>(false);

  /** Show the action row. @default true */
  showActions = input<boolean>(true);

  /** Show the edit action. @default true */
  canEdit = input<boolean>(true);

  /** Show the remove action. @default true */
  canRemove = input<boolean>(true);

  /** Show the "Set as default" action (hidden when already default). @default true */
  canSetDefault = input<boolean>(true);

  /**
   * Print the address in full, or with its identifying parts masked — house and
   * flat numbers, the inward half of the postcode and all but the last four
   * phone digits. @default 'none'
   */
  maskLevel = input<AddressMaskLevel>('none');

  // ── Writes against this address ─────────────────────────────────────────────

  /**
   * Ask before deleting.
   *
   * ★ Defaults to ON, and the previous behaviour was a single click straight
   *   through to `remove`. A saved address is not something the component can
   *   put back — see {@link AddressActionEvent} — and the trash button is a
   *   32px icon sitting next to an edit button of the same size in a grid of
   *   near-identical cards. Turn it off only where the host runs its own
   *   confirmation dialog.
   * @default true
   */
  confirmRemove = input<boolean>(true);

  /**
   * True while a write against this address is being sent. Freezes the actions,
   * so a slow round-trip cannot be turned into two deletes.
   * @default false
   */
  saving = input<boolean>(false);

  /**
   * The last write failed. Reported on the card, because the card is still here
   * — the host never took it out, and the badge never moved.
   * @default null
   */
  actionError = input<SvDataError | string | null>(null);

  /**
   * The other addresses that could take over as default, offered as a choice in
   * the confirmation when THIS address is the default one being removed.
   *
   * ★ Removing the default address used to have no defined transition: the card
   *   emitted `remove` and the host was left to guess whether a new default was
   *   wanted, which one, and whether the person had any say. The card cannot see
   *   the address book, so it cannot pick — but given the candidates it can ask,
   *   and the answer rides back on `nextDefaultId`.
   *
   *   Left empty, the confirmation says plainly that there will be no default
   *   afterwards, which is the outcome the host then has to handle. Ignored
   *   entirely when this address is not the default.
   * @default []
   */
  defaultCandidates = input<readonly Address[]>([]);

  // ── Outputs ───────────────────────────────────────────────────────────────

  /**
   * Emitted when the card is chosen in selectable mode.
   *
   * Named `addressSelected`, not `select`: `select` is a native DOM event name
   * (@angular-eslint/no-output-native), so an `(select)` binding is ambiguous
   * with the native one, and `selected` is already taken by the input above.
   * Matches the kit's `<thing>Selected` pattern (see search-bar's
   * `suggestionSelected`).
   */
  addressSelected = output<Address>();

  /** Emitted when the edit action is pressed. */
  edit = output<Address>();

  /**
   * The user confirmed deleting this address. Bind this or nothing happens: the
   * component only asks, it never deletes.
   */
  remove = output<AddressActionEvent>();

  /** "Set as default" was pressed. Persist it — the badge follows `address()`. */
  setDefault = output<AddressActionEvent>();

  // ── Computed ──────────────────────────────────────────────────────────────

  readonly fullName = computed(() => {
    const a = this.address();
    return `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim();
  });

  /** Masking is on. */
  private readonly masked = computed(() => this.maskLevel() === 'partial');

  readonly cityLine = computed(() => {
    const a = this.address();
    const cityState = [a.city, a.state].filter(Boolean).join(', ');
    const postcode = this.masked() && a.postalCode ? maskPostcode(a.postalCode) : a.postalCode;
    return [cityState, postcode].filter(Boolean).join(' ');
  });

  /** The street line as printed — house number masked under `maskLevel="partial"`. */
  readonly displayLine1 = computed(() => this.#maskLine(this.address().line1));

  /** The second street line as printed, or '' when there is none. */
  readonly displayLine2 = computed(() => this.#maskLine(this.address().line2 ?? ''));

  /** The phone as printed — all but the last four digits masked under `maskLevel="partial"`. */
  readonly displayPhone = computed(() => {
    const phone = this.address().phone ?? '';
    return this.masked() ? svMaskTail(phone, 4, MASK) : phone;
  });

  #maskLine(line: string): string {
    return this.masked() ? maskNumberedTokens(line) : line;
  }

  readonly isDefault = computed(() => this.address().isDefault === true);

  readonly kindLabel = computed(() => {
    switch (this.address().kind) {
      case 'shipping': return 'Shipping';
      case 'billing': return 'Billing';
      case 'both': return 'Shipping & billing';
      default: return '';
    }
  });

  readonly showSetDefault = computed(
    () =>
      this.canSetDefault() &&
      !this.isDefault() &&
      this.showActions() &&
      !this.selectable(),
  );

  /** The failed write's message, normalized from either accepted shape. */
  readonly actionErrorMessage = computed<string>(() => {
    const error = this.actionError();
    return error ? toSvDataError(error).message : '';
  });

  // ── Confirmation ────────────────────────────────────────────────────────────

  /** True once the trash button has been pressed and the confirm strip is up. */
  readonly awaitingConfirm = signal(false);

  /** Candidates worth offering: only when this address is the one holding the badge. */
  readonly promotable = computed<readonly Address[]>(() =>
    this.isDefault()
      ? this.defaultCandidates().filter((a) => a.id !== undefined && a.id !== this.address().id)
      : [],
  );

  /**
   * Removing the default with nowhere for the badge to go. Said out loud rather
   * than left as a surprise the person discovers on the next screen.
   */
  readonly losingDefault = computed(
    () => this.isDefault() && this.promotable().length === 0,
  );

  /**
   * The chosen successor. Seeded from the first candidate via `linkedSignal`, so
   * confirming without touching the select still promotes something — an
   * unselected dropdown that silently means "no new default" is the same trap
   * the whole input is here to close.
   */
  readonly nextDefaultId = linkedSignal<readonly Address[], string>({
    source: this.promotable,
    computation: (candidates, previous) => {
      const chosen = previous?.value;
      if (chosen !== undefined && candidates.some((a) => a.id === chosen)) return chosen;
      return candidates[0]?.id ?? '';
    },
  });

  /**
   * Id of the successor select, unique to this card — a page of these renders
   * the strip once per card, and a shared literal would point every `<label for>`
   * at the first one.
   */
  successorId(): string { return `${this._uid}-next-default`; }

  private readonly _uid = svUniqueId('sv-address-card');

  /** A one-line description of a candidate, for the successor dropdown. */
  candidateLabel(candidate: Address): string {
    const who = `${candidate.firstName ?? ''} ${candidate.lastName ?? ''}`.trim();
    return [candidate.label, who, this.#maskLine(candidate.line1)].filter(Boolean).join(' · ');
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  onSelect(): void {
    if (this.selectable()) this.addressSelected.emit(this.address());
  }

  /** Keyboard select (Enter / Space) when the whole card is a radio. */
  onKeydownSelect(event: Event): void {
    if (!this.selectable()) return;
    event.preventDefault();
    this.onSelect();
  }

  onEdit(): void {
    this.edit.emit(this.address());
  }

  /**
   * The trash button pressed. Discloses the confirmation, or withdraws it on a
   * second press.
   *
   * The button stays where it is rather than being replaced by the strip, so the
   * keyboard focus that pressed it still has somewhere to be.
   */
  onRemove(): void {
    if (this.saving()) return;
    if (!this.confirmRemove()) {
      this.emitRemove();
      return;
    }
    this.awaitingConfirm.update(open => !open);
  }

  /** "Keep" pressed, or the trash button pressed a second time. */
  cancelRemove(): void {
    if (this.saving()) return;
    this.restoreFocusToTrigger();
    this.awaitingConfirm.set(false);
  }

  /** "Remove" pressed inside the confirm strip. */
  confirmRemoval(): void {
    if (this.saving()) return;
    this.restoreFocusToTrigger();
    this.awaitingConfirm.set(false);
    this.emitRemove();
  }

  /**
   * The confirm strip is closing and takes its focused button with it. Focus
   * goes back to the trash button that opened it, else the card itself.
   */
  private restoreFocusToTrigger(): void {
    const active = this._host.nativeElement.ownerDocument.activeElement;
    if (!active || !this._host.nativeElement.contains(active)) return;
    afterNextRender(
      () => svRecoverFocus({ to: [this._removeButton()?.nativeElement], fallback: this._root()?.nativeElement }),
      { injector: this._injector },
    );
  }

  private emitRemove(): void {
    const el = this._host.nativeElement;
    const active = el.ownerDocument.activeElement;
    this._removalNeighbours =
      active && el.contains(active)
        ? { next: el.nextElementSibling, previous: el.previousElementSibling, container: el.parentElement }
        : null;
    this.emit(this.remove);
  }

  onSetDefault(): void {
    if (this.saving()) return;
    this.emit(this.setDefault);
  }

  private emit(target: { emit(event: AddressActionEvent): void }): void {
    const successor = this.nextDefaultId();
    target.emit({
      address: this.address(),
      requestKey: svRequestKey('addr'),
      wasDefault: this.isDefault(),
      nextDefaultId: successor === '' ? undefined : successor,
    });
  }
}
