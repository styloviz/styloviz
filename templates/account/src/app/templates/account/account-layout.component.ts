import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from '@styloviz/core';
import { SvAvatarComponent } from '@styloviz/avatar';
import { SvIconComponent } from '@styloviz/icons';
import { ACCOUNT_BRAND, ACCOUNT_USER, ACCOUNT_BASE } from './account.config';

/**
 * AccountLayoutComponent
 *
 * Self-contained shell for the account template: a slim top bar (wordmark +
 * section tabs + signed-in member + dark-mode toggle) and a footer. No
 * sidebar — this template is a handful of pages meant to sit inside a larger
 * app (or be reached from one), not a whole admin console.
 *
 * Uses `ThemeService` from `@styloviz/core` directly rather than a bespoke
 * per-template service (compare `admin`/`store`, which each roll their own):
 * a settings page is exactly the surface a real app already has its own
 * dark-mode wiring for, so leaning on the shared, published service is the
 * better default here — see CUSTOMIZING.md.
 */
@Component({
  selector: 'sv-account-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, SvAvatarComponent, SvIconComponent],
  templateUrl: './account-layout.component.html',
})
export class AccountLayoutComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly brand = ACCOUNT_BRAND;
  protected readonly user = ACCOUNT_USER;

  protected readonly tabs = [
    { link: ACCOUNT_BASE, exact: true, label: 'Profile & Settings', icon: 'user' },
    { link: `${ACCOUNT_BASE}/team`, exact: false, label: 'Team', icon: 'users' },
    { link: `${ACCOUNT_BASE}/billing`, exact: false, label: 'Plan & Billing', icon: 'credit-card' },
  ];
}
