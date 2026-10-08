import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';
import { ERRORS_BRAND, ERRORS_BASE } from './errors.config';
import { ERROR_CATALOGUE, type ErrorDefinition } from './errors.data';

/**
 * ErrorsLayoutComponent
 *
 * A deliberately quiet shell: a logo, a theme toggle, and nothing else that
 * competes with "go home". 404/500/maintenance pages are reached when the
 * rest of the app's navigation has already failed the visitor.
 *
 * ★★ THE PAGE INDEX IS DEMO CHROME, and is marked as such. It exists because
 * fourteen pages nobody can find are fourteen pages nobody evaluates — but it
 * is the first thing to delete when this shell goes into a real app, and
 * `CUSTOMIZING.md` says so in one line.
 */
@Component({
  selector: 'sv-errors-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, SvIconComponent],
  templateUrl: './errors-layout.component.html',
})
export class ErrorsLayoutComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly brand = ERRORS_BRAND;

  /** Every page in the catalogue, in the order the index shows them. */
  protected readonly pages: readonly ErrorDefinition[] = [
    '400', '401', '403', '404', '408', '410', '429',
    '500', '502', '503', '504',
    'offline', 'maintenance', 'coming-soon',
  ].map((k) => ERROR_CATALOGUE[k as keyof typeof ERROR_CATALOGUE]);

  protected linkFor(page: ErrorDefinition): string {
    return `${ERRORS_BASE}/${page.key}`;
  }
}
