import { DOCUMENT, InjectionToken, inject } from '@angular/core';

/**
 * ============================================================================
 *  The clipboard, behind an adapter — `LU-02-M3`
 * ============================================================================
 *
 * ★★★ EVERY INTERESTING CLIPBOARD FAILURE IS A BROWSER POLICY, AND A POLICY
 * CANNOT BE REPRODUCED IN A UNIT TEST WITHOUT A SEAM. Denied permission, a plain
 * HTTP origin (where `navigator.clipboard` does not exist at all), an iframe
 * without `clipboard-write`, and `execCommand` quietly returning `false` were all
 * "needs a real browser" until the browser sat behind this token. Provide your
 * own `SV_CLIPBOARD` in a test — or in an Electron/Capacitor shell with a native
 * clipboard — and the component drives it unchanged.
 */

/**
 * Why a copy failed.
 *
 * - `denied` — the browser refused: permission denied, no user gesture, or an
 *   iframe without the `clipboard-write` permission policy.
 * - `insecure-context` — the page is not a secure context (plain HTTP), so the
 *   async Clipboard API does not exist, and the legacy fallback also failed.
 * - `unavailable` — no clipboard at all (server render, a stripped-down
 *   webview), and the fallback failed.
 * - `failed` — anything else.
 */
export type SvClipboardFailureReason = 'denied' | 'insecure-context' | 'unavailable' | 'failed';

/**
 * The error `copyError` emits.
 *
 * ★ Its `message` is `cause`'s message, so a host that logged `err.message`
 *   before the adapter existed logs the same text. `reason` is the new,
 *   optional-to-read classification.
 * ⚠️ `cause` is the LAST error thrown: when the Clipboard API rejected AND the
 *   `execCommand` fallback failed, it is the FALLBACK's error, while `reason`
 *   is classified from the Clipboard API's rejection (`denied` vs `failed`).
 *   For a write abandoned by `sv-copy-to-clipboard`'s `copyTimeout` it is a
 *   timeout `Error` with reason `failed`.
 */
export class SvClipboardError extends Error {
  /** Why the copy failed. */
  readonly reason: SvClipboardFailureReason;

  constructor(reason: SvClipboardFailureReason, cause?: unknown) {
    super(cause instanceof Error ? cause.message : `Clipboard write failed (${reason})`, { cause });
    this.name = 'SvClipboardError';
    this.reason = reason;
  }
}

/** Writes text to the clipboard. Resolves on success; rejects with {@link SvClipboardError}. */
export interface SvClipboardAdapter {
  writeText(text: string): Promise<void>;
}

/**
 * Whether an error is the browser refusing, rather than something breaking.
 *
 * ★★ BY `name`, NOT `instanceof Error`. A `DOMException` from another realm —
 *    an iframe's `navigator.clipboard`, or jsdom's in the test environment — is
 *    not an instance of THIS realm's `Error`, so the `instanceof` guard reported
 *    every cross-realm refusal as a generic `failed` and the user was told the
 *    copy broke instead of being told the browser blocked it.
 */
function isDenial(err: unknown): boolean {
  const name = typeof err === 'object' && err !== null ? (err as { name?: unknown }).name : undefined;
  return name === 'NotAllowedError' || name === 'SecurityError';
}

/**
 * The legacy `execCommand('copy')` path through an off-screen textarea.
 *
 * ⚠️ `execCommand` is deprecated and returns `false` — it does not throw — when
 * it declines. Treating `false` as success is how "Copied!" gets announced over
 * an empty clipboard, so it is converted into a throw here.
 */
function legacyCopy(doc: Document, text: string): void {
  const active = doc.activeElement as HTMLElement | null;
  const el = doc.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', '');
  el.style.position = 'fixed';
  el.style.opacity = '0';
  doc.body.appendChild(el);
  try {
    el.select();
    if (!doc.execCommand('copy')) throw new Error('execCommand copy returned false');
  } finally {
    doc.body.removeChild(el);
    // Selecting the textarea moved focus; hand it back to the copy button.
    active?.focus?.();
  }
}

/**
 * The browser implementation: the async Clipboard API, then `execCommand`.
 *
 * | Situation | Result |
 * |---|---|
 * | `navigator.clipboard.writeText` resolves | success |
 * | it rejects, fallback succeeds | success |
 * | it rejects with `NotAllowedError`/`SecurityError`, fallback fails | `denied` |
 * | it rejects otherwise, fallback fails | `failed` |
 * | no async API, not a secure context, fallback fails | `insecure-context` |
 * | no async API, no window (SSR) or fallback fails | `unavailable` |
 */
export function svBrowserClipboard(doc: Document): SvClipboardAdapter {
  return {
    async writeText(text: string): Promise<void> {
      const view = doc.defaultView;
      if (!view) throw new SvClipboardError('unavailable');

      const api = view.navigator?.clipboard;
      let first: unknown = null;
      if (api && typeof api.writeText === 'function') {
        try {
          await api.writeText(text);
          return;
        } catch (err) {
          first = err;
        }
      }

      try {
        legacyCopy(doc, text);
      } catch (err) {
        if (first !== null) throw new SvClipboardError(isDenial(first) ? 'denied' : 'failed', err);
        throw new SvClipboardError(view.isSecureContext === false ? 'insecure-context' : 'unavailable', err);
      }
    },
  };
}

/**
 * The clipboard `sv-copy-to-clipboard` writes through. Defaults to
 * {@link svBrowserClipboard}; provide your own to test or to target a native shell.
 *
 * ```ts
 * providers: [{ provide: SV_CLIPBOARD, useValue: { writeText: async () => {} } }]
 * ```
 */
export const SV_CLIPBOARD = new InjectionToken<SvClipboardAdapter>('SV_CLIPBOARD', {
  providedIn: 'root',
  factory: () => svBrowserClipboard(inject(DOCUMENT)),
});
