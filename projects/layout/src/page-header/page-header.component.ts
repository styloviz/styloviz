import { ChangeDetectionStrategy, Component, Directive, computed, contentChild, input, output } from '@angular/core';
import { svUniqueId } from '@styloviz/core/a11y';
import { injectSvLabels } from '@styloviz/core/i18n';
import { SV_LAYOUT_LABELS } from '../layout.labels';
import { SvToolbarComponent, type ToolbarAction } from '../toolbar/toolbar.component';

/**
 * Marks the element projected into the page header's breadcrumb slot — an
 * `sv-breadcrumb` above the title (FL-J3-NV-09, `N-9`).
 */
@Directive({ selector: '[svPageHeaderBreadcrumb]', standalone: true })
export class SvPageHeaderBreadcrumbDirective {}

/** Marks the page header's back / up slot — an `sv-back-up` before the trail (FL-J3-NV-09). */
@Directive({ selector: '[svPageHeaderBack]', standalone: true })
export class SvPageHeaderBackDirective {}

/** Marks the page header's meta / status slot — badges, a status, a timestamp beside the title (FL-J3-NV-09). */
@Directive({ selector: '[svPageHeaderMeta]', standalone: true })
export class SvPageHeaderMetaDirective {}

/** Marks the page header's tabs slot — an `sv-tabs` strip along the bottom edge (FL-J3-NV-09). */
@Directive({ selector: '[svPageHeaderTabs]', standalone: true })
export class SvPageHeaderTabsDirective {}

/** One action in the page header's responsive actions row — the toolbar's own action shape. */
export type PageHeaderAction = ToolbarAction;

/**
 * PageHeaderComponent
 *
 * The page's title section, and — since FL-J3-NV-09 (`N-9`) — the place a
 * page's own navigation is COORDINATED rather than scattered:
 *
 * - `title` (the page's `<h1>`) and `subtitle`, unchanged;
 * - a **back / up** slot (`svPageHeaderBack`) and a **breadcrumb** slot
 *   (`svPageHeaderBreadcrumb`) above the title;
 * - a **meta / status** slot (`svPageHeaderMeta`) beside the title;
 * - a **tabs** slot (`svPageHeaderTabs`) along the bottom edge;
 * - a **responsive actions row**: `actions` render through `sv-toolbar` with
 *   `overflow="menu"`, so what does not fit folds into the kit's own "More
 *   actions" menu — one overflow decision, not one per button. Projected content
 *   (the default slot) still renders beside it, exactly as before.
 *
 * ★ One landmark (`docs/navigation-catalog-adr.md` Decision 2). When any of the
 *   navigation slots is used, the header becomes ONE `region` landmark named by
 *   its title, holding the trail, back/up, title, actions and tabs together —
 *   instead of four controls floating in the page. A plain title header renders
 *   exactly what it always did.
 *
 * Usage:
 *   <sv-page-header title="Order #1042" subtitle="Placed 3 March"
 *                   [actions]="actions" (actionClick)="run($event)">
 *     <sv-back-up svPageHeaderBack mode="up" [up]="'/orders'" upLabel="Orders" />
 *     <sv-breadcrumb svPageHeaderBreadcrumb [items]="trail" />
 *     <sv-badge svPageHeaderMeta variant="success">Paid</sv-badge>
 *     <button type="button">Refund</button>          <!-- default slot: actions -->
 *     <sv-tabs svPageHeaderTabs [tabs]="tabs" />
 *   </sv-page-header>
 */
@Component({
  selector: 'sv-page-header',
  standalone: true,
  imports: [SvToolbarComponent],
  templateUrl: './page-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvPageHeaderComponent {
  protected readonly labels = injectSvLabels('layout', SV_LAYOUT_LABELS);

  /** Page title */
  title = input.required<string>();

  /** Optional subtitle / description */
  subtitle = input<string>('');

  /**
   * Actions for the responsive actions row, rendered through `sv-toolbar` with
   * `overflow="menu"`: what does not fit the row folds into a "More actions"
   * menu. Projected buttons (the default slot) render beside them.
   * @default []
   */
  actions = input<readonly PageHeaderAction[]>([]);

  /** Accessible name of the actions row. @default 'Page actions' */
  actionsLabel = input<string>(this.labels.pageActions);

  /** Emits the `id` of the action chosen from the actions row or its overflow menu. */
  actionClick = output<string>();

  /** Stable id of the `<h1>`, which names the header's landmark. */
  protected readonly titleId = `${svUniqueId('sv-page-header')}-title`;

  private readonly breadcrumbSlot = contentChild(SvPageHeaderBreadcrumbDirective);
  private readonly backSlot = contentChild(SvPageHeaderBackDirective);
  private readonly tabsSlot = contentChild(SvPageHeaderTabsDirective);

  /**
   * Whether the header coordinates page navigation — a breadcrumb, back/up or
   * tabs slot is in use — and so is the page's one header landmark.
   */
  readonly composed = computed(() => !!(this.breadcrumbSlot() || this.backSlot() || this.tabsSlot()));
}
