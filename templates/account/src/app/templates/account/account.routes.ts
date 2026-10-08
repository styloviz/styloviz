import { Routes } from '@angular/router';

/**
 * Account / Settings / Team template routes.
 *
 * A single AccountLayoutComponent wraps every child page with the shared top
 * bar + footer shell. Mount under any base path, e.g. in your root routes:
 *
 *   {
 *     path: 'account',
 *     loadChildren: () =>
 *       import('./templates/account/account.routes').then(m => m.ACCOUNT_ROUTES),
 *   }
 */
export const ACCOUNT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./account-layout.component').then((m) => m.AccountLayoutComponent),
    children: [
      {
        path: '',
        title: 'Profile & Settings · Account',
        loadComponent: () =>
          import('./pages/profile.component').then((m) => m.AccountProfileComponent),
      },
      {
        path: 'team',
        title: 'Team · Account',
        loadComponent: () =>
          import('./pages/team.component').then((m) => m.AccountTeamComponent),
      },
      {
        path: 'billing',
        title: 'Plan & Billing · Account',
        loadComponent: () =>
          import('./pages/billing.component').then((m) => m.AccountBillingComponent),
      },
    ],
  },
];
