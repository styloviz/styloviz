import { Routes } from '@angular/router';

/**
 * Auth template routes — the complete set of pre-session screens.
 *
 * Sign in, register, two-step verification, single sign-on, a lock screen and
 * the forgot/reset-password pair. Mount the whole thing under any base path
 * and set `AUTH_BASE` in `auth.config.ts` to match:
 *
 *   {
 *     path: 'auth',
 *     loadChildren: () =>
 *       import('./templates/auth/auth.routes').then(m => m.AUTH_ROUTES),
 *   }
 *
 * ★ The store template keeps its own `auth-login` / `auth-register` /
 *   `auth-otp` pages, skinned for that storefront. They are deliberately NOT
 *   shared: a template has to pack standalone, so cross-template imports are
 *   rejected by `check:template-escapes`. What is shared is the reasoning —
 *   both sets refuse to enumerate accounts, and both derive their password
 *   rules from one policy object.
 */
export const AUTH_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./auth-layout.component').then((m) => m.AuthLayoutComponent),
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      {
        path: 'login',
        title: 'Sign in',
        loadComponent: () =>
          import('./pages/login.component').then((m) => m.AuthLoginComponent),
      },
      {
        path: 'register',
        title: 'Create an account',
        loadComponent: () =>
          import('./pages/register.component').then((m) => m.AuthRegisterComponent),
      },
      {
        path: 'two-factor',
        title: 'Two-step verification',
        loadComponent: () =>
          import('./pages/two-factor.component').then((m) => m.AuthTwoFactorComponent),
      },
      {
        path: 'sso',
        title: 'Single sign-on',
        loadComponent: () =>
          import('./pages/sso.component').then((m) => m.AuthSsoComponent),
      },
      {
        path: 'lock',
        title: 'Locked',
        loadComponent: () =>
          import('./pages/lock-screen.component').then((m) => m.AuthLockScreenComponent),
      },
      {
        path: 'forgot-password',
        title: 'Forgot password',
        loadComponent: () =>
          import('./pages/forgot-password.component').then((m) => m.AuthForgotPasswordComponent),
      },
      {
        path: 'reset-password',
        title: 'Reset password',
        loadComponent: () =>
          import('./pages/reset-password.component').then((m) => m.AuthResetPasswordComponent),
      },
      {
        path: 'signed-in',
        title: 'Signed in',
        loadComponent: () =>
          import('./pages/signed-in.component').then((m) => m.AuthSignedInComponent),
      },
    ],
  },
];
