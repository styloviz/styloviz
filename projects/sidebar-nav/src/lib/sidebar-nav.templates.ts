import { Directive, TemplateRef, inject } from '@angular/core';
import type { MenuItem } from './sidebar-nav.model';

/** What a row-end template gets: the item, and whether it is the current page. */
export interface SvSidebarNavItemEndContext {
  readonly $implicit: MenuItem;
  readonly current: boolean;
}

/**
 * Something at the end of every expanded row (`SR-30c`) — a pin, a count, a
 * menu. Rendered after the row's link (never inside it, so it can be its own
 * control), and not in the icon rail, where there is no room.
 *
 * ```html
 * <sv-sidebar-nav [menuGroups]="groups">
 *   <ng-template svSidebarNavItemEnd let-item>
 *     <button type="button" (click)="pin(item)">☆</button>
 *   </ng-template>
 * </sv-sidebar-nav>
 * ```
 */
@Directive({ selector: 'ng-template[svSidebarNavItemEnd]', standalone: true })
export class SvSidebarNavItemEndDirective {
  readonly template = inject<TemplateRef<SvSidebarNavItemEndContext>>(TemplateRef);
  static ngTemplateContextGuard(_dir: SvSidebarNavItemEndDirective, _ctx: unknown): _ctx is SvSidebarNavItemEndContext {
    return true;
  }
}
