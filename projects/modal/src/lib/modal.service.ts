import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  DestroyRef,
  EnvironmentInjector,
  Injectable,
  InjectionToken,
  Injector,
  reflectComponentType,
  Type,
  computed,
  inject,
  signal,
  type Signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import type { SvPendingDismissal } from '@styloviz/core';
import {
  SvModalComponent,
  type ModalCloseReason,
  type ModalPosition,
  type ModalSize,
  type ModalVariant,
} from './modal.component';

/**
 * Data handed to a dialog component opened through `SvModalService`.
 *
 * ★ Injected rather than bound, because the component is created imperatively
 * and there is no template to bind from. It is provided as a plain value: read
 * it in the constructor or a field initializer. It does not update — a dialog's
 * inputs are the arguments it was opened with, and a "live" data channel would
 * be a second, undocumented way for the host to change what the user is looking
 * at halfway through deciding.
 */
export const SV_MODAL_DATA = new InjectionToken<unknown>('SV_MODAL_DATA');

/** Why a dialog ended without a value. */
export type SvModalDismissReason = ModalCloseReason | 'destroyed' | 'close-all';

/**
 * What awaiting a dialog gives you.
 *
 * ★★★ A DISCRIMINATED UNION, NOT `R | undefined`, AND THIS IS THE MOST
 * IMPORTANT DECISION IN THE FILE.
 *
 * The conventional shape is `Promise<R | undefined>`, where `undefined` means
 * dismissed — and every caller then writes `if (result) { … }`. That is correct
 * exactly until the dialog returns something falsy, which is the common case:
 *
 *   • a confirm that resolves `false` ("no, don't delete") is read as a cancel,
 *     so the "user said no" branch never runs;
 *   • a quantity picker that resolves `0` is read as a cancel;
 *   • a rename dialog that resolves `''` is read as a cancel.
 *
 * None of those throw. They silently take the wrong branch, and the bug looks
 * like the dialog "sometimes not working". Making the caller check `dismissed`
 * costs one line and makes the mistake unrepresentable.
 */
export type SvModalResult<R> =
  | { readonly dismissed: false; readonly value: R }
  | { readonly dismissed: true; readonly reason: SvModalDismissReason };

/** Options for `SvModalService.open()`. Mirrors the component's inputs. */
export interface SvModalConfig<D = unknown> {
  /** Injected into the dialog component as `SV_MODAL_DATA`. */
  readonly data?: D;
  readonly title?: string;
  readonly subtitle?: string;
  readonly variant?: ModalVariant;
  readonly size?: ModalSize;
  readonly position?: ModalPosition;
  readonly closeOnBackdrop?: boolean;
  readonly closeOnEsc?: boolean;
  readonly showCloseButton?: boolean;
  readonly showHeader?: boolean;
  readonly showFooter?: boolean;
  readonly backdropBlur?: boolean;
  readonly resizable?: boolean;
  readonly maximizable?: boolean;
  readonly customClass?: string;
  readonly initialFocus?: string;
  /** Host veto — see `<sv-modal [canClose]>`. Change the dirty state with `SvModalRef.setDirty`. */
  readonly canClose?: (reason: ModalCloseReason) => boolean | void;
  /** Close on navigation — see `<sv-modal [closeOnNavigation]>`. @default true */
  readonly closeOnNavigation?: boolean;
  /** Close on the browser Back button — see `<sv-modal [backCloses]>`. @default false */
  readonly backCloses?: boolean;
  /** May the user dismiss while loading — see `<sv-modal [pendingDismissal]>`. @default 'block' */
  readonly pendingDismissal?: SvPendingDismissal;
  /** Injector the dialog component is created under. Defaults to the caller's. */
  readonly injector?: Injector;
}

/**
 * The handle on one open dialog.
 *
 * Injectable inside the dialog component, which is how it closes itself with a
 * value: `inject(SvModalRef).close(theThing)`.
 */
export class SvModalRef<R = unknown, D = unknown> {
  private settle!: (result: SvModalResult<R>) => void;
  private readonly done = signal(false);

  /** True once this dialog has produced a result. */
  readonly closed: Signal<boolean> = this.done.asReadonly();

  /**
   * Resolves exactly once, with a value or a dismissal.
   *
   * ★★★ IT ALWAYS SETTLES. Every exit — a value, Escape, the backdrop, the ×,
   * `closeAll()`, the whole application being torn down — resolves it. An
   * `await` that can hang forever is worse than one that rejects: the code
   * after it never runs, no error is reported, and the only symptom is a
   * feature that stopped happening.
   */
  readonly result: Promise<SvModalResult<R>>;

  constructor(
    /** Whatever was passed as `config.data`. */
    readonly data: D,
    private readonly teardown: () => void,
    /** Forwards `setDirty` to the dialog's `[dirty]` input. */
    private readonly markDirty: (dirty: boolean) => void = () => undefined,
  ) {
    this.result = new Promise<SvModalResult<R>>((resolve) => {
      this.settle = resolve;
    });
  }

  /** Close with a value. */
  close(value: R): void {
    this.finish({ dismissed: false, value });
  }

  /**
   * Say whether the dialog holds unsaved work — the service-opened equivalent
   * of `[dirty]` on `<sv-modal>`.
   *
   * ★★ `OF-09-I5` REACHES THE SERVICE TOO. A form opened through
   *    `SvModalService.open()` had no way to raise the unsaved-changes prompt:
   *    the config mirrors the component's inputs, and `dirty` is a value that
   *    changes while the dialog is open. The content component already holds
   *    this ref, so it reports the state here — typically from its form's
   *    value changes. A programmatic `close()` / `dismiss()` still closes.
   */
  setDirty(dirty: boolean): void {
    if (this.done()) return;
    this.markDirty(dirty);
  }

  /** Close without one. */
  dismiss(reason: SvModalDismissReason = 'programmatic'): void {
    this.finish({ dismissed: true, reason });
  }

  /**
   * First settle wins, and silently.
   *
   * A dialog can be closed twice in one tick for ordinary reasons: a Save
   * handler calls `close(value)` and the click that triggered it also lands on
   * the backdrop, or Enter activates Save while an Escape is already queued.
   *
   * ★★★ WHAT THIS GUARD DOES *NOT* DO IS PROTECT THE RESULT — and the first
   * draft of this comment claimed it did. `Promise` resolution is already
   * once-only, so a second `settle()` is a no-op whatever this code does; the
   * value cannot be overwritten by a later dismissal. Mutation testing is what
   * established that: deleting the guard broke nothing, which sent me looking
   * for what it is actually for.
   *
   * What it is actually for is TEARDOWN. Without it every extra close destroys
   * the component refs again, removes the container again and releases the
   * scroll lock again. Each of those layers happens to be idempotent today —
   * which is exactly the kind of thing that stops being true quietly — and
   * `closed()` would flip through states the promise never reflects.
   *
   * It does not throw. A double close is not a programming error worth crashing
   * an app over; it is a race the component cannot avoid.
   */
  private finish(result: SvModalResult<R>): void {
    if (this.done()) return;
    this.done.set(true);
    this.settle(result);
    this.teardown();
  }
}

/**
 * Open dialogs imperatively and await a typed result.
 *
 * ★★ THERE IS NO HOST COMPONENT TO REMEMBER.
 *
 * The usual shape for this API is a service plus a `<sv-modal-host>` you add to
 * your root layout — and the failure mode when you forget is that calling
 * `open()` does nothing at all, reports nothing, and resolves nothing. The
 * service creates its own container instead, so the only way to get a dialog is
 * to ask for one.
 *
 * @example
 * ```ts
 * const ref = modal.open<boolean>(ConfirmDeleteComponent, {
 *   data: { name: project.name },
 *   variant: 'danger',
 * });
 * const result = await ref.result;
 * if (!result.dismissed && result.value) await this.deleteProject();
 * ```
 */
@Injectable({ providedIn: 'root' })
export class SvModalService {
  private readonly appRef = inject(ApplicationRef);
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);
  private readonly defaultInjector = inject(Injector);

  /**
   * The open stack.
   *
   * ★ Typed loosely on purpose: the dialogs on it resolve with different types,
   * and no single generic argument describes a heterogeneous stack honestly.
   * `SvModalRef<unknown, unknown>` says exactly that — the service can dismiss
   * any of them, and only the caller who opened one knows what it resolves
   * with.
   */
  private readonly open$ = signal<readonly SvModalRef<unknown, unknown>[]>([]);

  /** How many dialogs are open right now. */
  readonly openCount: Signal<number> = computed(() => this.open$().length);

  constructor() {
    // ★ The application being destroyed is an exit like any other, and the one
    // most likely to leave an `await` hanging: a route change tears the host
    // down while a dialog is still up. Every outstanding promise settles.
    inject(DestroyRef).onDestroy(() => this.closeAll('destroyed'));
  }

  /**
   * Open `component` in a dialog and return its handle.
   *
   * `R` is what the dialog resolves with; `D` is the shape of `config.data`.
   */
  open<R = unknown, D = unknown>(
    component: Type<unknown>,
    config: SvModalConfig<D> = {},
  ): SvModalRef<R, D> {
    const container = this.document.createElement('div');
    container.setAttribute('data-sv-modal-service', '');
    this.document.body.appendChild(container);

    let modalRef: ComponentRef<SvModalComponent> | null = null;
    let contentRef: ComponentRef<unknown> | null = null;

    /**
     * ★ `const` is IMPOSSIBLE here, so `prefer-const` cannot be satisfied.
     *
     * The binding is captured by the teardown closure passed to `SvModalRef`
     * below (it filters `stackEntry` out of `open$`), and only assigned after
     * that ref exists — the value cannot be known at declaration. This is the
     * read-before-assign case; `prefer-const` reports it because it counts one
     * assignment, not because `const` would compile.
     */
    // eslint-disable-next-line prefer-const
    let stackEntry: SvModalRef<unknown, unknown>;

    const dialogRef = new SvModalRef<R, D>(config.data as D, () => {
      // Teardown runs on the FIRST settle only — see SvModalRef.finish.
      this.open$.update((list) => list.filter((r) => r !== stackEntry));
      /**
       * ★★ DESTROY; DO NOT SET `isOpen` FALSE FIRST.
       *
       * The obvious teardown closes the modal and then destroys it. But the
       * component's close path is an EFFECT, so flipping the signal schedules
       * an emit of `closed`/`dismissed` that lands after `destroy()` has run —
       * Angular logs `NG0953: Unexpected emit for destroyed OutputRef` for
       * every dialog the service closes. Worse, the emit is the one this
       * service subscribes to, so it would be re-entering its own teardown.
       *
       * `ngOnDestroy` already unmounts the portal and releases the scroll lock,
       * which is everything the close path did that still matters once the
       * component is going away.
       */
      contentRef?.destroy();
      modalRef?.destroy();
      container.remove();
    }, (dirty) => modalRef?.setInput('dirty', dirty));

    // The dialog component gets both the ref and the data, so it can close
    // itself with a value without the caller wiring anything up.
    const elementInjector = Injector.create({
      providers: [
        { provide: SvModalRef, useValue: dialogRef },
        { provide: SV_MODAL_DATA, useValue: config.data ?? null },
      ],
      parent: config.injector ?? this.defaultInjector,
    });

    contentRef = createComponent(component, {
      environmentInjector: this.envInjector,
      elementInjector,
    });
    this.appRef.attachView(contentRef.hostView);
    contentRef.changeDetectorRef.detectChanges();

    const contentEl = contentRef.location.nativeElement as HTMLElement;

    modalRef = createComponent(SvModalComponent, {
      environmentInjector: this.envInjector,
      hostElement: container,
      projectableNodes: bodySlotProjection(contentEl),
    });
    this.appRef.attachView(modalRef.hostView);

    const modal = modalRef.instance;
    modalRef.setInput('title', config.title ?? '');
    modalRef.setInput('subtitle', config.subtitle ?? '');
    modalRef.setInput('variant', config.variant ?? 'default');
    modalRef.setInput('size', config.size ?? 'md');
    modalRef.setInput('position', config.position ?? 'center');
    modalRef.setInput('closeOnBackdrop', config.closeOnBackdrop ?? true);
    modalRef.setInput('closeOnEsc', config.closeOnEsc ?? true);
    modalRef.setInput('showCloseButton', config.showCloseButton ?? true);
    modalRef.setInput('showHeader', config.showHeader ?? true);
    modalRef.setInput('showFooter', config.showFooter ?? false);
    modalRef.setInput('backdropBlur', config.backdropBlur ?? false);
    modalRef.setInput('resizable', config.resizable ?? false);
    modalRef.setInput('maximizable', config.maximizable ?? false);
    modalRef.setInput('customClass', config.customClass ?? '');
    modalRef.setInput('initialFocus', config.initialFocus ?? '');
    modalRef.setInput('canClose', config.canClose ?? null);
    modalRef.setInput('closeOnNavigation', config.closeOnNavigation ?? true);
    modalRef.setInput('backCloses', config.backCloses ?? false);
    modalRef.setInput('pendingDismissal', config.pendingDismissal ?? 'block');

    // Every close the COMPONENT knows about — Escape, backdrop, the × — becomes
    // a dismissal with that reason. A dialog that closed itself with a value
    // has already settled by the time this fires, and `finish` ignores it.
    modal.dismissed.subscribe((reason: ModalCloseReason) => dialogRef.dismiss(reason));

    stackEntry = dialogRef as unknown as SvModalRef<unknown, unknown>;
    this.open$.update((list) => [...list, stackEntry]);
    modal.isOpen.set(true);
    modalRef.changeDetectorRef.detectChanges();

    return dialogRef;
  }

  /**
   * Dismiss every open dialog.
   *
   * Closes from the top down, which is the order a user would: a stack unwound
   * from the bottom returns focus through dialogs that are about to disappear.
   */
  closeAll(reason: SvModalDismissReason = 'close-all'): void {
    for (const ref of [...this.open$()].reverse()) {
      ref.dismiss(reason);
    }
  }
}

/**
 * Put `contentEl` in the modal's `[slot=body]` bucket.
 *
 * ★★★ `projectableNodes` DISTRIBUTES BY INDEX, AND THE INDEX IS *NOT* TEMPLATE
 * ORDER. This cost two wrong answers in a row, both of which looked right.
 *
 * The first attempt set `slot="body"` on the created element and trusted the
 * modal's `ng-content` selectors to sort it out. Mutation testing killed that:
 * deleting the attribute changed nothing, because `createComponent` ignores the
 * selectors entirely.
 *
 * The second attempt hard-coded index 1, reasoning that the template declares
 * header, body, footer in that order. It renders the dialog IN THE HEADER —
 * beside the title, above the divider — because Angular's compiler does not
 * preserve declaration order here. The modal's actual `ngContentSelectors` are
 * `['[slot=body]', '[slot=header]', '[slot=footer]']`, so body is index 0.
 *
 * Nothing warns you about either mistake; the dialog just renders in the wrong
 * part of the panel. So the index is LOOKED UP through `reflectComponentType`
 * — public API for exactly this — instead of assumed, which also means adding
 * an `ng-content` to the modal cannot silently move everybody's dialogs.
 */
function bodySlotProjection(contentEl: HTMLElement): Node[][] {
  const selectors = reflectComponentType(SvModalComponent)?.ngContentSelectors ?? [];
  const index = Math.max(0, selectors.indexOf('[slot=body]'));
  return selectors.map((_, i) => (i === index ? [contentEl] : []));
}
