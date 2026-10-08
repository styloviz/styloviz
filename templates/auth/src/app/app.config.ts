import { type ApplicationConfig, inject, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { Router, provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideSvLinkAdapter, type SvLinkTarget } from '@styloviz/core';
import { provideSvOverlayRouteClose } from '@styloviz/layout';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),

    // Lets Styloviz navigation components (breadcrumbs, menus) route through
    // the Angular router instead of doing a full page load on click.
    provideSvLinkAdapter(() => {
      const router = inject(Router);
      const tree = (target: SvLinkTarget) =>
        typeof target === 'string' ? router.parseUrl(target) : router.createUrlTree([...target]);
      return {
        kind: 'angular-router',
        href: (target) => router.serializeUrl(tree(target)),
        navigate: (target) => {
          void router.navigateByUrl(tree(target));
          return true;
        },
      };
    }),

    // Modals, drawers and menus close when the user navigates to another page.
    provideSvOverlayRouteClose({ closeOn: 'path' }),
  ],
};
