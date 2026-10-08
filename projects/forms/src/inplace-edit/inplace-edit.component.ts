import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';
import {
  SvSpinnerArcComponent,
  createOptimisticEdit,
  svRequestKey,
  toSvDataError,
  type SvDataError,
  svUniqueId,
} from '@styloviz/core';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * What the editor is.
 * - `text`     — a single-line `<input>`; Enter commits
 * - `textarea` — a multi-line `<textarea>`; Enter inserts a NEWLINE and
 *                Ctrl/Cmd+Enter commits (see `onKeydown`)
 * - `select`   — a native `<select>` over `options`; picking commits at once
 */
export type InplaceEditMode = 'text' | 'textarea' | 'select';

/** Type scale and padding of both the read view and the editor. */
export type InplaceEditSize = 'sm' | 'md' | 'lg';

/**
 * How the read view offers itself.
 * - `click`  — the whole value is one button; clicking anywhere on it edits
 * - `button` — the value is static text with a small pencil button beside it,
 *              for a row where the text itself is already a link or is
 *              selectable and a click-to-edit target would fight it
 */
export type InplaceEditTrigger = 'auto' | 'click' | 'button';

/**
 * One committed edit the host is expected to persist.
 *
 * Emitted by `(saveRequest)` alongside the plain `(save)`. Bind whichever
 * matches the work: `save` when the new value is the whole story, this when a
 * server has to agree with it.
 */
export interface InplaceEditSave {
  /** The committed value — already written through to `value`. */
  readonly value: string;
  /** What it was before, for a host that wants to diff or log it. */
  readonly previous: string;
  /**
   * Idempotency key for this write. Send it, and have the server ignore a key
   * it has already applied: without one, an interceptor retrying a flaky
   * request writes the same edit twice.
   */
  readonly requestKey: string;
  /**
   * Put the old value back. Refuses — with a dev-mode warning — if the user has
   * edited again since, because restoring a value from before their newer edit
   * would throw it away silently. Bind `[saving]` so it cannot arise.
   */
  readonly rollback: () => void;
}

/**
 * Someone else changed this field while it was being edited.
 *
 * Two people editing one field is the normal case in any collaborative app, and
 * the usual answers are both wrong: last-write-wins destroys work without
 * telling anyone, and refusing the save leaves the user holding text they
 * cannot put anywhere. So the component shows both and lets the person who is
 * actually there decide.
 */
export interface InplaceEditConflict {
  /** The value now on the server. */
  readonly theirs: string;
  /** Who changed it, if you know — "Priya", "another session". @default '' */
  readonly by?: string;
  /** When, as text you have already formatted. @default '' */
  readonly at?: string;
}

/** Which value the user kept when a conflict was resolved. */
export interface InplaceEditConflictChoice {
  readonly choice: 'mine' | 'theirs';
  /** The value that won. Already written through to `value`. */
  readonly value: string;
}

/** One choice in `select` mode. */
export interface InplaceEditOption {
  /** The value committed when this is chosen. */
  readonly value: string;
  /** What the user reads. */
  readonly label: string;
  /** Greyed out and unpickable. @default false */
  readonly disabled?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * InplaceEdit — edit one field where it is displayed.
 *
 * The control every settings page, profile panel and editable table cell needs
 * and usually rebuilds: a value that reads as text until you click it, then
 * becomes an input, then goes back to being text.
 *
 * ★★★ WHAT IT ACTUALLY HAS TO GET RIGHT
 *
 * The rendering is the easy half. Three things are what separate this from a
 * `@if (editing)` in a host template, and each one is a bug that ships:
 *
 * 1. **Clicking "Cancel" must not save.** The action buttons sit outside the
 *    input, so pressing one blurs the input — and with commit-on-blur (which
 *    every host wants) the blur handler commits BEFORE the click handler runs.
 *    The user presses Cancel and the edit is saved. The fix is `mousedown`
 *    prevention on the buttons so focus never leaves the field; see the
 *    template.
 * 2. **A failed save must not lose the typing.** The draft outlives the close,
 *    and a non-null `error` re-opens the editor with the draft intact, so a
 *    500 costs the user a retry rather than a paragraph.
 * 3. **Focus must go somewhere on the way out.** Leaving edit mode returns
 *    focus to the trigger. Without that it lands on `<body>` and a keyboard
 *    user is dropped at the top of the page.
 *
 * Also: committing an unchanged value emits NOTHING. A save that saves nothing
 * still costs a request, a toast and an audit-log row.
 *
 * @example The common case — optimistic, two-way bound
 * ```html
 * <sv-inplace-edit label="Display name" [(value)]="name" (save)="persist($event)" />
 * ```
 *
 * @example Host-owned save, with the failure handed back
 * ```html
 * <sv-inplace-edit
 *   label="Display name"
 *   [value]="name()"
 *   [saving]="pending()"
 *   [error]="failure()"
 *   (save)="persist($event)" />
 * ```
 */
@Component({
  selector: 'sv-inplace-edit',
  standalone: true,
  imports: [NgClass, SvIconComponent, SvSpinnerArcComponent],
  templateUrl: './inplace-edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvInplaceEditComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Instance-scoped id root, e.g. `sv-inplace-edit-3`. */
  protected readonly uid = svUniqueId('sv-inplace-edit');
  /** Id of the message region, referenced by the editor's `aria-describedby`. */
  protected readonly messageId = `${this.uid}-message`;
  protected readonly lockReasonId = `${this.uid}-lock`;

  /** Monotonic commit counter, so a stale `rollback()` handle can be refused. */
  private readonly _revision = signal(0);

  private readonly _edit = createOptimisticEdit({
    revision: () => this._revision(),
    selector: 'sv-inplace-edit',
    superseded:
      'the field has been edited again since, so putting the old value back ' +
      'would discard the newer edit. Bind [saving] so it cannot be re-opened ' +
      'while the write is in flight.',
  });

  /** The editor element, once it exists. Focused and selected on open. */
  private readonly editorRef =
    viewChild<ElementRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>>('editor');

  // ── Value ─────────────────────────────────────────────────────────────────

  /**
   * The field's value. Two-way bindable.
   *
   * ★ `[(value)]` is the optimistic wiring: the component writes the new value
   * through on commit and the host persists in the background. `[value]` one-way
   * plus `(save)` is the pessimistic wiring: the host writes it only once the
   * server has agreed, and pushes the old value back if it has not.
   *
   * @default ''
   */
  readonly value = model<string>('');

  // ── Configuration ─────────────────────────────────────────────────────────

  /**
   * Accessible name of the field, e.g. `Display name`.
   *
   * ★ Not decoration. The read view is a button whose text is the VALUE, so
   * without this a screen reader announces "Ada Lovelace, button" and never
   * says what pressing it edits.
   */
  readonly label = input<string>('');

  /** What the editor is. @default 'text' */
  readonly mode = input<InplaceEditMode>('text');

  /** Choices for `select` mode. Ignored in the other modes. @default [] */
  readonly options = input<readonly InplaceEditOption[]>([]);

  /** Type scale and padding. @default 'md' */
  readonly size = input<InplaceEditSize>('md');

  /**
   * How the read view offers itself.
   *
   * - `auto` (default) — a pencil button that is **always visible on a touch
   *   screen** and appears on hover or focus on a mouse-driven one.
   * - `click` — the value alone, with a hover underline. ⚠️ **On touch this has
   *   no affordance at all**: Tailwind compiles `hover:` to
   *   `@media (hover: hover)`, so the underline never renders on a phone and
   *   nothing indicates the text can be edited. Kept because it is the right
   *   density inside a table of many fields, but choose it deliberately.
   * - `button` — the pencil, always visible everywhere.
   *
   * @default 'auto'
   */
  readonly trigger = input<InplaceEditTrigger>('auto');

  /** Placeholder inside the editor. @default '' */
  readonly placeholder = input<string>('');

  /**
   * Read-view text when the value is empty.
   *
   * ★ It has to be SOMETHING. An empty value renders an empty button, and a
   * zero-width target cannot be clicked or seen — the field silently becomes
   * uneditable exactly when it most needs editing.
   *
   * @default 'Empty'
   */
  readonly emptyText = input<string>('Empty');

  /** Rows for `textarea` mode. @default 3 */
  readonly rows = input<number>(3);

  /** Native `maxlength` on the editor. 0 leaves it off. @default 0 */
  readonly maxlength = input<number>(0);

  /** Refuse to commit an empty value, and say why. @default false */
  readonly required = input<boolean>(false);

  /** Message shown when a `required` field is committed empty. */
  readonly requiredMessage = input<string>('This field cannot be empty');

  /** Not editable — the read view renders as plain text. @default false */
  readonly disabled = input<boolean>(false);

  /** Show the save / cancel buttons. Never shown in `select` mode. @default true */
  readonly showActions = input<boolean>(true);

  /**
   * Commit when the editor loses focus.
   *
   * `false` makes an outside click discard the edit — safer for a destructive
   * field, and surprising everywhere else, which is why it defaults on.
   *
   * @default true
   */
  readonly commitOnBlur = input<boolean>(true);

  /** Extra classes on the root element. @default '' */
  readonly customClass = input<string>('');

  // ── Save lifecycle ────────────────────────────────────────────────────────

  /** The host is persisting the value — the editor stays open and goes busy. @default false */
  readonly saving = input<boolean>(false);

  /**
   * The save failed. Re-opens the editor with the draft intact.
   *
   * Accepts an `SvDataError` or a plain string, so an `HttpErrorResponse`
   * normalized with `toSvDataError()` can be bound without unwrapping it.
   * @default null
   */
  readonly error = input<SvDataError | string | null>(null);

  /**
   * Why this field cannot be edited — a permission, a plan, a workflow state.
   *
   * Non-empty renders the value as static text with the reason beside it, and
   * no way in. Distinct from `disabled`, deliberately, and named to match
   * `sv-toggle-switch`'s input of the same name: a disabled field tells the
   * user "not you, not now" and leaves them to guess, and the guess they most
   * often make is that the page is broken. The alternative it replaces is
   * worse — letting them type, then failing on save, which costs them the edit
   * as well as the answer.
   * @default ''
   */
  readonly lockReason = input<string>('');

  /**
   * Someone else changed this field while it was open.
   *
   * Setting it puts the editor into a two-value choice: their text, the user's
   * text, and a button each. Clear it (back to `null`) when the choice has been
   * made — `(conflictResolved)` tells you which one won and has already written
   * it through to `value`.
   * @default null
   */
  readonly conflict = input<InplaceEditConflict | null>(null);

  /** Whether the editor is open. Two-way bindable, so a host can open it. @default false */
  readonly editing = model<boolean>(false);

  /** A new value was committed. Not emitted when the value did not change. */
  readonly save = output<string>();

  /**
   * The same commit, carrying what a server write needs: an idempotency key and
   * a guarded way back.
   *
   * Additive, not a replacement — `save` still fires, and a field that writes
   * only to local state has no use for either of these. Both are emitted for
   * one commit, in this order.
   */
  readonly saveRequest = output<InplaceEditSave>();

  /**
   * The user chose which side of a conflict to keep. The winning value has
   * already been written through to `value`; persist it, and clear `conflict`.
   */
  readonly conflictResolved = output<InplaceEditConflictChoice>();

  /** The user backed out — Escape, or the Cancel button. */
  //
  // ★ The rationale below is deliberately NOT in the JSDoc above.
  // `generate-component-docs` publishes that block verbatim as this output's
  // row in the public API table, so an internal lint argument written there
  // ships to buyers as the documentation for `(cancel)`.
  //
  // ★ Same reasoning as `search` on `sv-tree-select`: `cancel` is a native DOM
  // event name, but it is fired only by `<dialog>` and `<input type="file">`,
  // and this component renders neither. No native `cancel` can bubble to a
  // consumer's binding, so the collision `no-output-native` guards is
  // theoretical — and renaming a shipped output is not.
  //
  // ⚠️ Revisit if this ever renders a `<dialog>` or a file input.
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly cancel = output<void>();

  // ── Internal state ────────────────────────────────────────────────────────

  /**
   * What is in the editor right now.
   *
   * ★ Deliberately NOT cleared when the editor closes: a failed save re-opens
   * with this, which is the difference between costing the user a click and
   * costing them everything they typed.
   */
  protected readonly draft = signal<string>('');

  /** The value as it was when editing began — what Escape restores. */
  private readonly original = signal<string>('');

  /**
   * Whether the editor has ever been opened, i.e. whether `draft` holds
   * anything the user typed.
   *
   * ★★ `draft` starts as `''`, not as the value. A `conflict` pushed at a field
   *    nobody had opened (a realtime update, a host re-sync) used to show
   *    "Yours" as EMPTY — and "Keep mine" then wrote `''` over the field.
   *    Until the user has a draft, their version is the value on screen.
   */
  private readonly draftStarted = signal<boolean>(false);

  /** Set when a `required` commit was refused; cleared on the next keystroke. */
  private readonly localMessage = signal<string>('');

  /**
   * Whether the user has dismissed the current `error`.
   *
   * ★ `linkedSignal` on `error` rather than a plain signal: a NEW failure must
   * re-open the editor even if the previous one was dismissed, and resetting on
   * the source is exactly what makes that automatic instead of a forgotten
   * `set(false)` in three call sites.
   */
  private readonly errorDismissed = linkedSignal<SvDataError | string | null, boolean>({
    source: () => this.error(),
    computation: () => false,
  });

  /**
   * Set by `close()` when the editor still held focus, consumed by the effect
   * below once the trigger is back in the DOM. A plain field, not a signal: it
   * is written from inside an effect that also reads `open()`, and a signal
   * there would be a write-after-read loop.
   */
  private wantsFocus = false;

  constructor() {
    /**
     * ★★ Move focus INTO the conflict choice when it replaces what had it.
     *
     * The usual path to a conflict is: Enter commits → focus returns to the
     * trigger → the 409 arrives → the trigger is replaced by the choice. That
     * removal drops focus to `<body>`, and a keyboard user is left at the top
     * of the document while an alert asks them a question they cannot reach.
     * Only when focus was ours (or already lost): a user who has moved on to
     * another field is not pulled back.
     */
    let wasInConflict = false;
    effect(() => {
      const now = this.inConflict();
      const entered = now && !wasInConflict;
      wasInConflict = now;
      if (!entered || typeof document === 'undefined') return;
      const root = this.host.nativeElement as HTMLElement;
      const hadFocus = root.contains(document.activeElement);
      queueMicrotask(() => {
        const active = document.activeElement;
        if (!hadFocus && active && active !== document.body && !root.contains(active)) return;
        root.querySelector<HTMLElement>('[data-sv-conflict-action]')?.focus();
      });
    });

    /**
     * ★ Give the trigger focus once it exists again.
     *
     * Depends on `open()`, so it re-runs the moment the editor closes. The
     * element is created in the same change-detection pass, so the lookup is
     * deferred by a microtask rather than attempted mid-render.
     */
    effect(() => {
      if (this.open() || !this.wantsFocus) return;
      this.wantsFocus = false;
      queueMicrotask(() => {
        const root = this.host.nativeElement as HTMLElement;
        root.querySelector<HTMLElement>('[data-sv-inplace-trigger]')?.focus();
      });
    });

    /**
     * ★ Focus and select the editor as it appears.
     *
     * An effect, not a `(click)` handler: the editor is behind `@if`, so it does
     * not exist yet at the moment the click opens it, and `editing` can also be
     * set by the HOST (a table row's Edit button) where there is no click of
     * ours to hang this on. Reading the `viewChild` signal makes the effect
     * re-run when the element actually arrives.
     */
    effect(() => {
      const el = this.editorRef()?.nativeElement;
      if (!el) return;
      el.focus();
      // Select the text so typing replaces it — the overwhelmingly common
      // intent when you click a value to change it. `<select>` has no such API.
      if (el instanceof HTMLSelectElement) return;
      el.select();
    });
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  /**
   * Whether the editor is showing.
   *
   * ★ A live failure counts as open, so a save that came back 500 puts the user
   * back in front of their own text instead of in front of a stale read view
   * with a red message under it.
   */
  protected readonly open = computed<boolean>(
    () =>
      !this.disabled() &&
      !this.lockReason() &&
      (this.editing() ||
        this.conflict() !== null ||
        (this.error() !== null && !this.errorDismissed())),
  );

  /** True while the two-value choice is on screen. */
  protected readonly inConflict = computed<boolean>(
    () => this.conflict() !== null && !this.lockReason() && !this.disabled(),
  );

  /**
   * What the conflict banner says.
   *
   * Names the other party when the host knows it. "Someone else changed this"
   * is a fact; "Priya changed this 2 minutes ago" is the same fact plus the two
   * things that decide the answer — whether it was a person you can ask, and
   * whether their version is newer than what you were looking at.
   */
  protected readonly conflictLabel = computed<string>(() => {
    const c = this.conflict();
    if (!c) return '';
    const who = c.by?.trim();
    const when = c.at?.trim();
    const subject = who ? `${who} changed this field` : 'This field was changed elsewhere';
    return when ? `${subject} ${when}. Choose which version to keep.`
                : `${subject}. Choose which version to keep.`;
  });

  /**
   * The user's side of a conflict: what they typed, normalised the way
   * `commit()` normalises it — or the value itself when they never opened the
   * editor (see `draftStarted`).
   */
  protected readonly mine = computed<string>(() => {
    if (!this.draftStarted()) return this.value();
    return this.mode() === 'textarea' ? this.draft() : this.draft().trim();
  });

  /** `true` when there is no value to show, so the read view falls back. */
  protected readonly isEmpty = computed<boolean>(() => this.value().trim().length === 0);

  /** What the read view prints. */
  protected readonly displayText = computed<string>(() => {
    if (!this.isEmpty()) return this.value();
    if (this.mode() !== 'select') return this.emptyText();
    // A select's value may be a key nobody should read — prefer its label.
    const match = this.options().find((o) => o.value === this.value());
    return match?.label ?? this.emptyText();
  });

  /** The label of the currently-selected option, for `select` read views. */
  protected readonly selectedLabel = computed<string>(() => {
    const match = this.options().find((o) => o.value === this.value());
    return match?.label ?? this.displayText();
  });

  /** Host error first, then our own validation. One region, one message. */
  protected readonly message = computed<string>(() => {
    const failure = this.error();
    if (failure) return toSvDataError(failure).message;
    return this.localMessage();
  });

  /** Accessible name of the trigger — the value alone never says what it is. */
  protected readonly triggerLabel = computed<string>(() => {
    const field = this.label().trim();
    return field ? `Edit ${field}` : 'Edit';
  });

  /** Actions are meaningless in `select` mode, where picking IS committing. */
  protected readonly actionsVisible = computed<boolean>(
    () => this.showActions() && this.mode() !== 'select' && !this.inConflict(),
  );

  /** Whether the read view renders a pencil, and whether it is always shown. */
  protected readonly showTriggerButton = computed<boolean>(
    () => this.trigger() === 'button' || this.trigger() === 'auto',
  );

  /**
   * `auto` hides the pencil until the pointer arrives — but only where a
   * pointer can arrive. `pointer-coarse:opacity-100` is the whole fix for
   * `FI-12-I2`: Tailwind compiles `hover:` to `@media (hover: hover)`, so on a
   * phone the hover affordance is not subtle, it is ABSENT, and the field looks
   * like plain text.
   */
  protected readonly triggerButtonClasses = computed<string>(() =>
    this.trigger() === 'button'
      ? this.actionClasses
      : this.actionClasses +
        ' opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100' +
        ' focus-visible:opacity-100 pointer-coarse:opacity-100',
  );

  // ── Commands ──────────────────────────────────────────────────────────────

  /** Open the editor, seeding the draft from the current value. */
  protected beginEdit(): void {
    if (this.disabled() || this.saving() || this.lockReason()) return;
    this.original.set(this.value());
    this.draft.set(this.value());
    this.draftStarted.set(true);
    this.localMessage.set('');
    this.editing.set(true);
  }

  /**
   * Accept the draft.
   *
   * Refuses an empty `required` value and stays open. Emits nothing when the
   * value is unchanged — see the class comment.
   */
  protected commit(): void {
    if (!this.open()) return;
    const next = this.mode() === 'textarea' ? this.draft() : this.draft().trim();

    if (this.required() && next.trim().length === 0) {
      this.localMessage.set(this.requiredMessage());
      this.editorRef()?.nativeElement.focus();
      return;
    }

    this.close();

    if (next === this.original()) return;
    const previous = this.original();
    this.value.set(next);
    this._revision.update((n) => n + 1);

    this.save.emit(next);
    this.saveRequest.emit({
      value: next,
      previous,
      requestKey: svRequestKey('inplace'),
      rollback: this._edit.begin(() => {
        this.value.set(previous);
        this.draft.set(previous);
      }),
    });
  }

  // ── Conflict resolution ───────────────────────────────────────────────────

  /**
   * Keep what the user typed, and say so.
   *
   * The value is written through immediately — the same optimistic rule the
   * rest of this component follows — and the revision bumps, which is what
   * makes any rollback handle from the losing write refuse.
   */
  protected keepMine(): void {
    const mine = this.mine();
    this.wantsFocus = this.hasFocus();
    this.value.set(mine);
    this.draft.set(mine);
    this._revision.update((n) => n + 1);
    this.editing.set(false);
    this.conflictResolved.emit({ choice: 'mine', value: mine });
  }

  /** Take the server's value, discarding the draft. */
  protected takeTheirs(): void {
    const theirs = this.conflict()?.theirs ?? this.value();
    // ★ Focus goes back to the trigger once the host clears `conflict` and the
    //   choice leaves the DOM — the same rule as `close()`.
    this.wantsFocus = this.hasFocus();
    this.value.set(theirs);
    this.draft.set(theirs);
    this._revision.update((n) => n + 1);
    this.editing.set(false);
    this.conflictResolved.emit({ choice: 'theirs', value: theirs });
  }

  /** Discard the draft and restore the value as it was. */
  protected revert(): void {
    if (!this.open()) return;
    this.draft.set(this.original());
    this.close();
    this.cancel.emit();
  }

  /** Whether focus is currently inside this component. */
  private hasFocus(): boolean {
    return (this.host.nativeElement as HTMLElement).contains(document.activeElement);
  }

  /** Leave edit mode, and put focus back on the trigger if it was still ours. */
  private close(): void {
    /**
     * ★★ ONLY TAKE FOCUS BACK IF WE STILL HAVE IT.
     *
     * Focus must land somewhere on the way out — removing the editor while it
     * is focused drops focus to `<body>`, and the keyboard user's next Tab
     * starts at the top of the document. But blindly focusing the trigger is
     * its own bug: the ordinary way to leave a field is to CLICK THE NEXT ONE,
     * and pulling focus back then would yank the user out of the input they
     * just chose. Deciding here — before the DOM changes — is what tells the
     * two apart: on Escape or an action button the editor still holds focus; on
     * an outside click it does not.
     */
    const root = this.host.nativeElement as HTMLElement;
    this.wantsFocus = root.contains(document.activeElement);

    this.localMessage.set('');
    this.errorDismissed.set(true);
    this.editing.set(false);
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  protected onInput(event: Event): void {
    this.draft.set((event.target as HTMLInputElement | HTMLTextAreaElement).value);
    if (this.localMessage()) this.localMessage.set('');
  }

  /** `select` mode commits the moment a choice is made. */
  protected onSelect(event: Event): void {
    this.draft.set((event.target as HTMLSelectElement).value);
    this.commit();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      // Stop it here: an inplace edit inside a dialog or a dropdown must cancel
      // the EDIT, not close whatever is around it.
      event.stopPropagation();
      this.revert();
      return;
    }

    if (event.key !== 'Enter') return;

    if (this.mode() === 'textarea') {
      // ★ Plain Enter has to insert a newline, or a multi-line field cannot be
      // multi-line. Only the modifier commits.
      if (!event.ctrlKey && !event.metaKey) return;
    }

    event.preventDefault();
    this.commit();
  }

  /**
   * Commit or discard when focus leaves.
   *
   * ★ The action buttons never get here: they prevent `mousedown`, so pressing
   * one does not blur the editor at all. That is what stops Cancel from saving.
   */
  protected onBlur(): void {
    if (!this.open() || this.saving()) return;
    if (this.commitOnBlur()) this.commit();
    else this.revert();
  }

  // ── Classes ───────────────────────────────────────────────────────────────

  protected readonly rootClasses = computed<string>(() =>
    ['group inline-flex w-full min-w-0 items-start gap-1.5', this.customClass()].filter(Boolean).join(' '),
  );

  private readonly textScale = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'text-xs';
      case 'lg': return 'text-base';
      default: return 'text-sm';
    }
  });

  private readonly padScale = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'px-1.5 py-0.5';
      case 'lg': return 'px-3 py-2';
      default: return 'px-2 py-1';
    }
  });

  /** The read view. Dashed underline on hover so it reads as editable. */
  protected readonly triggerClasses = computed<string>(() =>
    [
      'min-w-0 max-w-full truncate rounded-md text-left text-gray-900 dark:text-gray-100',
      this.textScale(),
      this.padScale(),
      'hover:bg-gray-100 hover:underline hover:decoration-dashed hover:underline-offset-4',
      'dark:hover:bg-gray-800',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
      this.isEmpty() ? 'italic text-gray-500 dark:text-gray-400' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );

  /** Static read view — same metrics as the trigger, none of the affordance. */
  protected readonly staticClasses = computed<string>(() =>
    [
      'min-w-0 truncate text-gray-900 dark:text-gray-100',
      this.textScale(),
      this.padScale(),
      this.isEmpty() ? 'italic text-gray-500 dark:text-gray-400' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );

  protected readonly editorClasses = computed<string>(() =>
    [
      'w-full min-w-0 rounded-md border bg-white text-gray-900',
      'dark:bg-gray-900 dark:text-gray-100',
      this.textScale(),
      this.padScale(),
      'focus:outline-none focus:ring-2 focus:ring-primary-500',
      this.message()
        ? 'border-danger-400 dark:border-danger-500'
        : 'border-gray-300 dark:border-gray-700',
      this.saving() ? 'opacity-60' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );

  protected readonly actionClasses =
    'rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ' +
    'dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 ' +
    'disabled:cursor-not-allowed disabled:opacity-50';
}
