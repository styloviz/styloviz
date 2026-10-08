import { Injectable, signal, effect, inject } from '@angular/core';
import { STYLOVIZ_CONFIG } from '../tokens/styloviz.token';
import { prefersReducedMotion } from '../a11y/reduced-motion';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'styloviz-theme';

/**
 * ★★★ EVERY STORAGE ACCESS IS GUARDED, INCLUDING READING THE GLOBAL (1.0 audit, H3).
 *     With cookies/site data blocked — a browser setting, some sandboxed
 *     iframes — merely evaluating `localStorage` throws a `SecurityError`. This
 *     service reads it while it is being CONSTRUCTED, so the throw took down
 *     every component that injects it, `sv-topbar` and with it the app shell.
 *     Without storage the theme still works; it is just not remembered.
 */
function readStoredTheme(): Theme | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : null;
  } catch {
    return null;
  }
}

function storeTheme(theme: Theme): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Blocked or full storage: the switch still happens, it is just not remembered.
  }
}

/** Minimal typing for the View Transitions API (not yet in lib.dom). */
type ViewTransitionDocument = Document & {
  readonly startViewTransition?: (callback: () => void) => unknown;
};

/**
 * ThemeService — Dark/Light mode manager for Styloviz components.
 *
 * Priority order on init: localStorage → provideStyloviz colorScheme → OS preference → light.
 * Only `setTheme` / `toggleTheme` write localStorage — a theme that was merely
 * resolved (OS, config) is never stored, so it keeps following its source.
 *
 * Usage:
 *   const theme = inject(ThemeService);
 *   theme.toggleTheme();
 *   theme.isDark();   // signal
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly config = inject(STYLOVIZ_CONFIG, { optional: true });

  readonly isDark = signal<boolean>(this.resolveInitialTheme() === 'dark');

  constructor() {
    effect(() => {
      this.applyTheme(this.isDark() ? 'dark' : 'light');
    });
  }

  toggleTheme(): void {
    this.setTheme(this.isDark() ? 'light' : 'dark');
  }

  setTheme(theme: Theme): void {
    if (theme === (this.isDark() ? 'dark' : 'light')) return;

    // ★★ Only an EXPLICIT choice is remembered (1.0 audit, H3). The effect used
    //    to persist whatever theme was in force on first load — the OS
    //    preference or `provideStyloviz({ colorScheme })` — as if the user had
    //    picked it, so a later change to either was ignored for every
    //    returning visitor.
    storeTheme(theme);

    const doc =
      typeof document !== 'undefined'
        ? (document as ViewTransitionDocument)
        : undefined;
    const startViewTransition = doc?.startViewTransition;

    // Instant switch when the API is unavailable or reduced motion is
    // requested; the cross-fade itself adds no per-element transitions.
    if (!startViewTransition || this.prefersReducedMotion()) {
      this.isDark.set(theme === 'dark');
      return;
    }

    startViewTransition.call(doc, () => {
      this.isDark.set(theme === 'dark');
      this.applyTheme(theme);
    });
  }

  private prefersReducedMotion(): boolean {
    return prefersReducedMotion();
  }

  private resolveInitialTheme(): Theme {
    if (typeof window === 'undefined') return 'light';

    // 1. localStorage (user's last explicit choice)
    const stored = readStoredTheme();
    if (stored) return stored;

    // 2. provideStyloviz colorScheme config
    const scheme = this.config?.colorScheme;
    if (scheme === 'dark') return 'dark';
    if (scheme === 'light') return 'light';

    // 3. OS preference — only when the browser can actually be asked.
    if (typeof window.matchMedia !== 'function') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  private applyTheme(theme: Theme): void {
    if (typeof document === 'undefined') return;

    const html = document.documentElement;
    html.classList.toggle('dark', theme === 'dark');
    html.classList.toggle('light', theme === 'light');
  }
}
