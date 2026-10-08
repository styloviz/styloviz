import { Routes } from '@angular/router';
import type { ErrorKey } from './errors.data';

/**
 * Error / system page template routes.
 *
 * ★★ FOURTEEN PAGES, ONE PRESENTER. Everything specific to a status code
 * lives in `ERROR_CATALOGUE` (`errors.data.ts`); most routes below just name
 * the key. The five with their own component are the ones an app wires
 * directly — a `**` wildcard reads better as `ErrorsNotFoundComponent` than as
 * a route with a data bag.
 *
 *   {
 *     path: 'errors',
 *     loadChildren: () =>
 *       import('./templates/errors/errors.routes').then(m => m.ERRORS_ROUTES),
 *   }
 *
 * These are demo routes for browsing the pages, not how you'd wire them into
 * a real app — see `CUSTOMIZING.md` for using `not-found.component.ts` as
 * your app's own wildcard (`**`) route instead.
 */

/** A route that renders one catalogue entry through the shared presenter. */
function codeRoute(path: string, errorKey: ErrorKey, title: string) {
  return {
    path,
    title,
    data: { errorKey },
    loadComponent: () =>
      import('./pages/code-page.component').then((m) => m.ErrorsCodePageComponent),
  };
}

export const ERRORS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./errors-layout.component').then((m) => m.ErrorsLayoutComponent),
    children: [
      { path: '', redirectTo: '404', pathMatch: 'full' },

      // ── The five with a named component ─────────────────────────────────
      {
        path: '404',
        title: '404 · Page not found',
        loadComponent: () =>
          import('./pages/not-found.component').then((m) => m.ErrorsNotFoundComponent),
      },
      {
        path: '500',
        title: '500 · Server error',
        loadComponent: () =>
          import('./pages/server-error.component').then((m) => m.ErrorsServerErrorComponent),
      },
      {
        path: '503',
        title: '503 · Service unavailable',
        loadComponent: () =>
          import('./pages/unavailable.component').then((m) => m.ErrorsUnavailableComponent),
      },
      {
        path: 'maintenance',
        title: 'Down for maintenance',
        loadComponent: () =>
          import('./pages/maintenance.component').then((m) => m.ErrorsMaintenanceComponent),
      },
      {
        path: 'coming-soon',
        title: 'Coming soon',
        loadComponent: () =>
          import('./pages/coming-soon.component').then((m) => m.ErrorsComingSoonComponent),
      },

      // ── The rest, straight from the catalogue ───────────────────────────
      codeRoute('400', '400', '400 · Bad request'),
      codeRoute('401', '401', '401 · Not signed in'),
      codeRoute('403', '403', '403 · Forbidden'),
      codeRoute('408', '408', '408 · Request timed out'),
      codeRoute('410', '410', '410 · Gone'),
      codeRoute('429', '429', '429 · Too many requests'),
      codeRoute('502', '502', '502 · Bad gateway'),
      codeRoute('504', '504', '504 · Gateway timeout'),
      codeRoute('offline', 'offline', "You're offline"),
    ],
  },
];
