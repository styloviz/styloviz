import { ChangeDetectionStrategy, Component } from '@angular/core';

// ─── Empty-state illustrations (SR-34) ───────────────────────────────────────
//
// Four small spot illustrations, one per empty reason, drawn as inline SVG so
// they theme with the page: every fill is a Tailwind class with a `dark:` arm,
// so they sit on white and on gray-900 alike, and on the host's palette.
//
// ★ These are GRAPHICS, not glyphs — a 160×120 scene, never an icon-sized
//   viewBox — and they are registered by name in check:ui's illustration list
//   (`scripts/inline-svg.allow.json` → `illustrations`), which also checks that
//   each one stays decorative (aria-hidden) and illustration-sized. Use them in
//   the `[svIllustration]` slot, or let `illustration="auto"` pick by reason.

/** An empty inbox tray with a paper plane — "nothing here yet". */
@Component({
  selector: 'sv-illustration-no-data',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block' },
  template: `
    <svg viewBox="0 0 160 120" class="h-28 w-auto" aria-hidden="true" focusable="false">
      <circle cx="80" cy="62" r="50" class="fill-primary-50 dark:fill-primary-500/10" />
      <path d="M36 70h88l-10 30a6 6 0 0 1-5.7 4H51.7a6 6 0 0 1-5.7-4z" class="fill-white stroke-gray-300 dark:fill-gray-800 dark:stroke-gray-600" stroke-width="2" />
      <path d="M36 70l14-28h60l14 28H98a4 4 0 0 0-4 4 6 6 0 0 1-6 6H72a6 6 0 0 1-6-6 4 4 0 0 0-4-4z" class="fill-gray-50 stroke-gray-300 dark:fill-gray-700 dark:stroke-gray-600" stroke-width="2" stroke-linejoin="round" />
      <path d="M92 20l26-8-10 26-5-9-11-9z" class="fill-primary-500 dark:fill-primary-400" />
      <path d="M103 29l15-17" class="stroke-white dark:stroke-gray-900" stroke-width="1.5" />
      <circle cx="40" cy="30" r="3" class="fill-primary-300 dark:fill-primary-500/40" />
      <circle cx="128" cy="86" r="2.5" class="fill-primary-300 dark:fill-primary-500/40" />
    </svg>`,
})
export class SvIllustrationNoDataComponent {}

/** A magnifier over scattered cards — "no matching results". */
@Component({
  selector: 'sv-illustration-no-results',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block' },
  template: `
    <svg viewBox="0 0 160 120" class="h-28 w-auto" aria-hidden="true" focusable="false">
      <circle cx="80" cy="62" r="50" class="fill-primary-50 dark:fill-primary-500/10" />
      <rect x="30" y="34" width="56" height="16" rx="5" class="fill-white stroke-gray-300 dark:fill-gray-800 dark:stroke-gray-600" stroke-width="2" />
      <rect x="30" y="56" width="44" height="16" rx="5" class="fill-white stroke-gray-300 dark:fill-gray-800 dark:stroke-gray-600" stroke-width="2" />
      <rect x="30" y="78" width="50" height="16" rx="5" class="fill-white stroke-gray-300 dark:fill-gray-800 dark:stroke-gray-600" stroke-width="2" />
      <circle cx="104" cy="58" r="20" class="fill-white/70 stroke-primary-500 dark:fill-gray-900/60 dark:stroke-primary-400" stroke-width="5" />
      <path d="M118 72l16 16" class="stroke-primary-500 dark:stroke-primary-400" stroke-width="7" stroke-linecap="round" />
      <path d="M97 52l14 12M111 52L97 64" class="stroke-gray-400 dark:stroke-gray-500" stroke-width="3" stroke-linecap="round" />
    </svg>`,
})
export class SvIllustrationNoResultsComponent {}

/** A padlocked folder — "you do not have access". */
@Component({
  selector: 'sv-illustration-no-access',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block' },
  template: `
    <svg viewBox="0 0 160 120" class="h-28 w-auto" aria-hidden="true" focusable="false">
      <circle cx="80" cy="62" r="50" class="fill-warning-50 dark:fill-warning-500/10" />
      <path d="M34 40a6 6 0 0 1 6-6h24l8 8h48a6 6 0 0 1 6 6v46a6 6 0 0 1-6 6H40a6 6 0 0 1-6-6z" class="fill-white stroke-gray-300 dark:fill-gray-800 dark:stroke-gray-600" stroke-width="2" />
      <rect x="92" y="62" width="34" height="28" rx="6" class="fill-warning-500 dark:fill-warning-400" />
      <path d="M100 62v-8a9 9 0 0 1 18 0v8" class="fill-none stroke-warning-600 dark:stroke-warning-300" stroke-width="5" />
      <circle cx="109" cy="74" r="3.5" class="fill-white dark:fill-gray-900" />
      <path d="M109 76v6" class="stroke-white dark:stroke-gray-900" stroke-width="3" stroke-linecap="round" />
    </svg>`,
})
export class SvIllustrationNoAccessComponent {}

/** A cloud with a broken link — "could not load this". */
@Component({
  selector: 'sv-illustration-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block' },
  template: `
    <svg viewBox="0 0 160 120" class="h-28 w-auto" aria-hidden="true" focusable="false">
      <circle cx="80" cy="62" r="50" class="fill-danger-50 dark:fill-danger-500/10" />
      <path d="M50 84a18 18 0 0 1 2-36 26 26 0 0 1 50-4 20 20 0 0 1 8 40z" class="fill-white stroke-gray-300 dark:fill-gray-800 dark:stroke-gray-600" stroke-width="2" stroke-linejoin="round" />
      <path d="M68 66l-6 6a7 7 0 0 0 10 10l6-6" class="fill-none stroke-danger-500 dark:stroke-danger-400" stroke-width="4" stroke-linecap="round" />
      <path d="M92 66l6-6a7 7 0 0 0-10-10l-6 6" class="fill-none stroke-danger-500 dark:stroke-danger-400" stroke-width="4" stroke-linecap="round" />
      <path d="M76 58l-4-6M84 74l4 6M70 66h-6M90 66h6" class="stroke-gray-400 dark:stroke-gray-500" stroke-width="2.5" stroke-linecap="round" />
    </svg>`,
})
export class SvIllustrationErrorComponent {}
