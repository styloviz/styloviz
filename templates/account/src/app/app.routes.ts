import type { Routes } from '@angular/router';

/**
 * The template is mounted at `/templates/account`, the same URL it has in the
 * Styloviz live demo. To serve it from another path, change `path` below AND
 * the `ACCOUNT_BASE` constant in
 * `src/app/templates/account/account.config.ts` to match —
 * every internal link in the template is built from that one constant.
 */
export const routes: Routes = [
  {
    path: 'templates/account',
    loadChildren: () =>
      import('./templates/account/account.routes').then((m) => m.ACCOUNT_ROUTES),
  },
  { path: '', pathMatch: 'full', redirectTo: 'templates/account' },
  { path: '**', redirectTo: '' },
];
