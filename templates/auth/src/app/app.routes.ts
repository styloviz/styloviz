import type { Routes } from '@angular/router';

/**
 * The template is mounted at `/templates/auth`, the same URL it has in the
 * Styloviz live demo. To serve it from another path, change `path` below AND
 * the `AUTH_BASE` constant in
 * `src/app/templates/auth/auth.config.ts` to match —
 * every internal link in the template is built from that one constant.
 */
export const routes: Routes = [
  {
    path: 'templates/auth',
    loadChildren: () =>
      import('./templates/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  { path: '', pathMatch: 'full', redirectTo: 'templates/auth/login' },
  { path: '**', redirectTo: '' },
];
