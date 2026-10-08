import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ThemeService } from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';
import { AUTH_BRAND, AUTH_PANEL, AUTH_SUPPORT } from './auth.config';

/**
 * AuthLayoutComponent
 *
 * A split shell: the brand panel on the left, the form on the right.
 *
 * ★★ WHY A SPLIT AND NOT A CENTRED CARD
 *
 * Forgot/reset-password is reached from an email, before there is a session —
 * so it is often the first page of yours that somebody looks at properly, and
 * the only one with nothing else on it competing for attention. A lone card on
 * a grey field spends that moment on nothing. The panel is content (what
 * happens to their account, what protects it), which is also the answer to the
 * question people actually have on this screen.
 *
 * ★ It collapses, rather than stacking. Below `lg` the panel is replaced by a
 * compact header — not moved above the form, which would push the one field on
 * the page below the fold on a phone.
 */
@Component({
  selector: 'sv-auth-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterOutlet, SvIconComponent],
  templateUrl: './auth-layout.component.html',
})
export class AuthLayoutComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly brand = AUTH_BRAND;
  protected readonly panel = AUTH_PANEL;
  protected readonly support = AUTH_SUPPORT;

  /** Emptying `AUTH_PANEL.points` turns the split back into a centred card. */
  protected readonly showPanel = computed<boolean>(() => this.panel.points.length > 0);

  protected readonly year = new Date().getFullYear();
}
