import type { Routes } from '@angular/router';

/**
 * The template is mounted at `/templates/errors`, the same URL it has in the
 * Styloviz live demo. To serve it from another path, change `path` below AND
 * the `ERRORS_BASE` constant in
 * `src/app/templates/errors/errors.config.ts` to match —
 * every internal link in the template is built from that one constant.
 */
export const routes: Routes = [
  {
    path: 'templates/errors',
    loadChildren: () =>
      import('./templates/errors/errors.routes').then((m) => m.ERRORS_ROUTES),
  },
  { path: '', pathMatch: 'full', redirectTo: 'templates/errors' },
  { path: '**', redirectTo: '' },
];
