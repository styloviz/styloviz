import { computed, linkedSignal, untracked, type Signal } from '@angular/core';

/** What a host may pass as a server-reported error: a message, or an object carrying one. */
export type SvServerError = string | { readonly message: string } | null | undefined;

export interface SvFieldError {
  /** The message the error slot should render — server first, then client. */
  readonly resolvedError: Signal<string>;
  /** Whether there is anything to render. */
  readonly showError: Signal<boolean>;
}

/**
 * The validation-error contract shared by every form control in the kit.
 *
 * Two inputs, deliberately separate, because they expire differently:
 *
 * - `errorMessage` is the host's own client-side validation. It has no expiry;
 *   the host clears it when it decides the field is valid.
 * - `serverError` came back from a request about a SPECIFIC value ("that email
 *   is already taken"). The moment the user edits the field, that statement is
 *   about a value which no longer exists, and continuing to show it is telling
 *   the user something false about what they are currently looking at. So it is
 *   anchored to the value it was reported against and self-expires on the next
 *   edit — which is also why the host cannot be asked to manage it by hand.
 *
 * While live, `serverError` outranks `errorMessage`: it is the more specific
 * fact about this value.
 *
 * This logic was independently written out in 8 components before it lived
 * anywhere; each copy is a chance for one of them to keep showing a stale
 * rejection. Pair with `<sv-field-error>` for the rendering half.
 *
 * **One caveat worth knowing.** Signals are pull-based, so the anchor is captured
 * the first time the error is READ after `serverError` changes, not at the moment
 * it is written. In a rendered control those are the same change-detection pass,
 * which is why it has never mattered — but a host that writes `serverError` and
 * `value` together, with nothing reading in between, anchors to the second write
 * and the rejection stays visible against a value it was not about. Pinned in
 * `field-error.spec.ts` under "anchors when the error is first READ".
 *
 * @example
 * protected readonly fieldError = createFieldError(this.value, this.serverError, this.errorMessage);
 * // template: <sv-field-error [id]="describedById()" [message]="fieldError.resolvedError()" />
 */
export function createFieldError(
  value: Signal<unknown>,
  serverError: Signal<SvServerError>,
  errorMessage: Signal<string>,
): SvFieldError {
  // The value the current serverError was reported against. Recomputed only
  // when serverError itself changes — reading `value` untracked is what stops
  // the anchor from chasing every keystroke.
  const anchor = linkedSignal<SvServerError, unknown>({
    source: serverError,
    computation: () => untracked(() => value()),
  });

  const live = computed(() => {
    const e = serverError();
    if (!e) return '';
    if (value() !== anchor()) return '';
    return typeof e === 'string' ? e : e.message;
  });

  const resolvedError = computed(() => live() || errorMessage());
  return { resolvedError, showError: computed(() => !!resolvedError()) };
}
