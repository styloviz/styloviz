import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * SvFooterComponent — the thin bar at the foot of the app shell.
 *
 * The default slot is the start side (stacked on top on small screens), and
 * `[svFooterEnd]` the end side: a copyright and a version, a status line,
 * legal links. For a full multi-column marketing footer use
 * `sv-site-footer`.
 *
 * 2.0: the hard-coded Styloviz copyright moved out (FL-A6a) — project your own.
 */
@Component({
  selector: 'sv-footer',
  standalone: true,
  templateUrl: './footer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvFooterComponent {}
