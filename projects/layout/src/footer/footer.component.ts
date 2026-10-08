import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * FooterComponent
 *
 * Simple dashboard footer with copyright and version info.
 * Sticks to the bottom of the content area (not the viewport).
 */
@Component({
  selector: 'sv-footer',
  standalone: true,
  imports: [],
  templateUrl: './footer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvFooterComponent {
  readonly currentYear = new Date().getFullYear();
}