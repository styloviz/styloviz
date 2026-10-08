import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * PageHeaderComponent
 *
 * Reusable page title section with:
 * - Title and subtitle
 * - Optional description
 * - Content projection slot for action buttons
 *
 * Usage:
 *   <sv-page-header
 *     title="Analytics Dashboard"
 *     subtitle="Monitor your key metrics and performance.">
 *     <button class="...">Export</button>  <!-- projected into actions slot -->
 *   </sv-page-header>
 */
@Component({
  selector: 'sv-page-header',
  standalone: true,
  imports: [],
  templateUrl: './page-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvPageHeaderComponent {
  /** Page title */
  title = input.required<string>();

  /** Optional subtitle / description */
  subtitle = input<string>('');
}