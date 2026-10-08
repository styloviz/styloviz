/**
 * The scoped context a body portal drops, and what to do about it.
 *
 * ★★★ THE SIX THINGS X-8 NAMES ARE NOT SIX PROBLEMS. Portalling to `<body>`
 *     is how an overlay escapes an `overflow: hidden` ancestor, and it costs
 *     the surface everything it was inheriting from where it used to live:
 *     theme, directionality, density, custom properties, the transformed
 *     coordinate space, and the test fixture's DOM root. Sorted by what can
 *     actually be done about each, they are three different kinds of thing:
 *
 *     • **CARRIED** — `dir`, `lang`, and the theme marker. Each has exactly
 *       one correct value, findable with one `closest()` from the origin, and
 *       copying it is unambiguous. Done automatically, here.
 *     • **DECLARED** — custom properties. The set is unbounded and, worse, not
 *       enumerable: `getComputedStyle` will not list inherited custom
 *       properties in every engine, so "copy them all" cannot be written at
 *       all, let alone written portably. The caller names the ones that matter
 *       and they are copied by value.
 *     • **ABANDONED ON PURPOSE** — the transformed coordinate space. Escaping
 *       it IS the reason to portal. Positioning code must therefore measure
 *       against the viewport rather than the origin's parent, which is the
 *       positioning engine's job (`X-7`), not this one's.
 *
 *     The sixth, the test fixture's root, is not a context at all — it is why
 *     every spec for a portalled surface queries `document.body`. `root` makes
 *     it configurable rather than implicit.
 *
 * ★★ WHY THE THEME MARKER IS NOT ALREADY FINE. The usual claim is that the
 *    theme survives, because `.dark` is toggled on `documentElement` and a
 *    body portal inherits from there. That is true and it is not the case that
 *    breaks: a LOCALLY dark section — a preview pane, a code sample, an editor
 *    surface — carries its own `.dark`, and a menu opened from inside it
 *    renders light on a dark page. The marker is copied only when the nearest
 *    one is NOT the document element, so the common case stays a no-op.
 */

import type { DestroyRef } from '@angular/core';

/** Attributes that carry unambiguously and are copied without being asked. */
const CARRIED_ATTRIBUTES = ['dir', 'lang'] as const;

export interface SvPortalHostOptions {
  /**
   * The element the surface would have rendered inside — its component host.
   * The context is read from here; with no origin nothing is copied.
   */
  readonly origin?: Element | null;
  /** Where the host is appended. @default document.body */
  readonly root?: Element | null;
  /** Classes for the host element itself. */
  readonly className?: string;
  /**
   * Custom properties to copy by value from the origin's computed style.
   *
   * ★ Named, not enumerated, and the reason is not laziness: inherited custom
   *   properties cannot be listed from `getComputedStyle` portably, so a
   *   "copy everything" implementation would silently copy a different subset
   *   in every browser. Naming them makes the set a decision instead of an
   *   accident.
   */
  readonly customProperties?: readonly string[];
  /** Marks the host in the DOM as `data-sv-portal="<label>"`, for debugging. */
  readonly label?: string;
  /** Injectable for SSR and tests. */
  readonly document?: Document;
  /**
   * The OWNER whose destruction also destroys this host (`N-4` ownership
   * cleanup).
   *
   * ★ Optional, and additive: every existing caller destroys in its own
   *   `ngOnDestroy` and keeps working. Passing the owner's `DestroyRef` makes
   *   the orphaned `<div>` in `<body>` impossible rather than merely unlikely —
   *   a component that forgets its teardown path, or throws before reaching it,
   *   still takes its portal with it.
   */
  readonly destroyRef?: DestroyRef;
}

export interface SvPortalHost {
  /**
   * The host element. Append the surface's nodes to this, THEN `attach()`.
   *
   * ⚠️ **With no document (SSR) this is `null` at runtime**, despite the type.
   *    Typed non-null because every caller creates its host on open — a user
   *    gesture, which never happens on the server — and widening it now would
   *    break each of them at compile time for a branch they cannot reach.
   *    Code that may run without a document checks {@link available} first.
   */
  readonly element: HTMLElement;
  /**
   * `false` for the server stub returned when there is no document: its
   * {@link element} is `null` and every method is a no-op. `true` otherwise.
   */
  readonly available: boolean;
  /**
   * Put the host into the document. Idempotent.
   *
   * ★★★ SEPARATE FROM CREATION ON PURPOSE, and the repo has a script about
   *     why (`scripts/fix-portal-insertion-order.mjs`, proven against
   *     `sv-mention`): a host that enters `<body>` EMPTY and is filled
   *     afterwards spends a frame as a static-positioned block at the end of
   *     the document. If the panel is tall enough the page grows, the browser
   *     queues a `scroll` event, and any component that closes on scroll
   *     closes the panel it has just opened. Render first, insert once — so
   *     this API makes the order explicit instead of hoping each caller
   *     remembers it.
   */
  attach(): void;
  /**
   * Re-read the origin's context and re-apply it.
   *
   * ★ Not decoration: a theme toggle while a menu is open changes the marker
   *   under it, and nothing about a copied attribute updates itself.
   */
  sync(): void;
  /** Remove the host from the document. Idempotent. */
  destroy(): void;
}

/**
 * The nearest theme marker above `el`, or `null` when the only one is the
 * document element — which a body portal already inherits.
 */
function scopedThemeMarker(
  el: Element,
  doc: Document,
): { className: string | null; theme: string | null } {
  const darkHost = el.closest('.dark');
  const themeHost = el.closest('[data-theme]');
  return {
    className: darkHost && darkHost !== doc.documentElement ? 'dark' : null,
    theme:
      themeHost && themeHost !== doc.documentElement
        ? themeHost.getAttribute('data-theme')
        : null,
  };
}

/** Create a context-carrying portal host. */
export function createPortalHost(options: SvPortalHostOptions = {}): SvPortalHost {
  const doc = options.document ?? (typeof document !== 'undefined' ? document : null);
  if (!doc) {
    // SSR: a stub that does nothing and cannot be appended to anything. The
    // one cast in this file, and it is the documented one on `element`: there
    // is no document to create an element from, so `null` is the honest value
    // and `available: false` is how a caller finds out.
    return {
      element: null as unknown as HTMLElement,
      available: false,
      attach: () => undefined,
      sync: () => undefined,
      destroy: () => undefined,
    };
  }

  const element = doc.createElement('div');
  if (options.className) element.className = options.className;
  if (options.label) element.setAttribute('data-sv-portal', options.label);

  const apply = (): void => {
    const origin = options.origin;
    if (!origin) return;

    for (const attr of CARRIED_ATTRIBUTES) {
      const marked = origin.closest(`[${attr}]`);
      const value = marked?.getAttribute(attr);
      // ★ Only a SCOPED value is copied. Taking the document element's `dir`
      //   would pin the host to the value it already inherits, so a later
      //   change to it would stop reaching this surface and only this one.
      if (value && marked !== doc.documentElement) element.setAttribute(attr, value);
      else element.removeAttribute(attr);
    }

    const { className, theme } = scopedThemeMarker(origin, doc);
    element.classList.toggle('dark', className === 'dark');
    if (theme) element.setAttribute('data-theme', theme);
    else element.removeAttribute('data-theme');

    const names = options.customProperties;
    if (names?.length && typeof window !== 'undefined') {
      const computed = window.getComputedStyle(origin);
      for (const name of names) {
        const value = computed.getPropertyValue(name).trim();
        if (value) element.style.setProperty(name, value);
        else element.style.removeProperty(name);
      }
    }
  };

  apply();

  let destroyed = false;
  // ★ Keep the unregister function. A surface that makes a fresh host on every
  //   open (Speed Dial) and destroys it on close would otherwise leave one dead
  //   callback on its owner's DestroyRef per open, all retained until the owner
  //   itself is destroyed.
  let unregister: (() => void) | null = null;
  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    unregister?.();
    unregister = null;
    element.remove();
  };
  unregister = options.destroyRef?.onDestroy(destroy) ?? null;
  return {
    element,
    available: true,
    attach: () => {
      if (destroyed || element.isConnected) return;
      (options.root ?? doc.body).appendChild(element);
    },
    sync: () => { if (!destroyed) apply(); },
    destroy,
  };
}
