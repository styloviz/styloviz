/**
 * ============================================================================
 *  One sensitive-value policy
 * ============================================================================
 *
 * ★★★ FIVE COMPONENTS SHOW VALUES THAT ARE MONEY, ACCESS OR IDENTITY, AND EACH
 *     ONE HAD INVENTED ITS OWN ANSWER. `sv-credit-card` masked a PAN, `sv-gift-card`
 *     masked a bearer code, `sv-json-viewer` redacted keys, `sv-address-card`
 *     printed everything and `sv-phone-input` captured a number. Five spellings of
 *     "last four", three of "strip the host attribute" and no shared way for a
 *     host to say "this session is being recorded".
 *
 * These are the shared pieces. The policy they serve is written down in
 * `docs/sensitive-value-policy.md`, and `scripts/check-sensitive-values.mjs`
 * proves each family either enforces each point or carries a stated exemption:
 *
 *   1. masked by default
 *   2. re-authentication before a reveal
 *   3. copy auditing — an event that says a copy happened and never carries it
 *   4. no retention of the full value in public component state
 *   5. an explicit display-only (or capture) boundary in the class JSDoc
 */
import { InjectionToken, inject, isSignal, signal, type Provider, type Signal } from '@angular/core';

/**
 * What a component reports when a sensitive value reached the clipboard.
 *
 * ★★★ THERE IS NO `text`, `value` OR `code` MEMBER, AND THERE MUST NEVER BE ONE.
 *     An audit event is written into log sinks, error reporters and analytics
 *     pipelines. A payload that carries the secret turns the audit trail into the
 *     leak it was meant to make visible. The host already holds the value — it
 *     passed it in — so the event says only who, where and whether it was masked.
 *     `check:sensitive-values` fails the build if a member with one of those
 *     names appears on this interface.
 */
export interface SvSensitiveCopyEvent {
  /** The component that copied, e.g. `'sv-json-viewer'`. */
  readonly source: string;
  /** Which field or path was copied, e.g. `'$.headers.authorization'` or `'code'`. */
  readonly field: string;
  /** The copied text was a mask (or a projection containing masks), not the value. */
  readonly redacted: boolean;
  /** When the copy happened (epoch ms). */
  readonly at: number;
}

/** Characters that are punctuation or spacing rather than part of the value. */
const SEPARATOR = /[^\p{L}\p{N}]/u;

/**
 * The last `count` significant characters of a value — letters and digits only,
 * so `4111-1111-1111-1234` and `FRESH-GIFT-2K` yield `1234` and `FT2K` rather
 * than a tail with a hyphen in it.
 */
export function svLast4(value: string | null | undefined, count = 4): string {
  if (!value) return '';
  const significant = [...value].filter((c) => !SEPARATOR.test(c));
  return significant.slice(-Math.max(0, count)).join('');
}

/**
 * Mask every significant character except the last `visible`, keeping the
 * value's own separators where they were.
 *
 * ★ Separators survive so the masked value has the same SHAPE as the real one:
 *   `•••• •••• •••• 1234` reads as a card number, a run of sixteen dots does not.
 *   Nothing about the value is learned from its punctuation that the reader could
 *   not already see on a physical card.
 */
export function svMaskTail(
  value: string | null | undefined,
  visible = 4,
  maskChar = '•',
): string {
  if (!value) return '';
  const chars = [...value];
  const total = chars.filter((c) => !SEPARATOR.test(c)).length;
  const keep = Math.max(0, Math.min(visible, total));
  let seen = 0;
  return chars
    .map((c) => {
      if (SEPARATOR.test(c)) return c;
      seen += 1;
      return seen <= total - keep ? maskChar : c;
    })
    .join('');
}

/**
 * Drop attributes carrying a sensitive value off a component's host element.
 *
 * ★★ `<sv-x code="…">` is a STATIC attribute: Angular reads it from the compiled
 *    template's attribute table, so the input still receives it, but the
 *    attribute also stays in the DOM verbatim — in `outerHTML`, in DevTools and
 *    in the serialisation a session-replay tool ships. Removing it after
 *    construction costs nothing; a property binding never wrote one.
 */
export function svStripHostAttributes(host: Element, names: readonly string[]): void {
  for (const name of names) host.removeAttribute(name);
}

/**
 * App-wide "this session is recorded, screen-shared or replayed" declaration.
 *
 * Components that display a sensitive value re-mask it while this reads `true`,
 * whatever their own per-instance opt-outs say. It is a DECLARATION, not a
 * detection: a page cannot observe a capture it did not start itself, so wire
 * it to something that knows — your own `getDisplayMedia` track, a conferencing
 * SDK's in-call flag, a session-replay tool's recording state.
 */
export const SV_SENSITIVE_PRIVACY = new InjectionToken<Signal<boolean>>('SV_SENSITIVE_PRIVACY');

/**
 * Provide {@link SV_SENSITIVE_PRIVACY}. Pass a signal to switch it at runtime,
 * or a boolean for a fixed declaration.
 *
 * ```ts
 * bootstrapApplication(App, { providers: [provideSvSensitivePrivacy(isScreenSharing)] });
 * ```
 */
export function provideSvSensitivePrivacy(source: Signal<boolean> | boolean = true): Provider {
  return {
    provide: SV_SENSITIVE_PRIVACY,
    useValue: isSignal(source) ? source : signal(source).asReadonly(),
  };
}

/**
 * Read {@link SV_SENSITIVE_PRIVACY} inside an injection context, falling back to
 * a constant `false` when nothing was provided.
 */
export function injectSvSensitivePrivacy(): Signal<boolean> {
  return inject(SV_SENSITIVE_PRIVACY, { optional: true }) ?? signal(false).asReadonly();
}
