import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { SvIconComponent } from '@styloviz/icons';
import { RouterLink } from '@angular/router';
import { ThemeService, svUniqueId } from '@styloviz/core';

/** A single external resource link rendered in the topbar / sidebar. */
export interface ResourceLink {
  readonly label: string;
  readonly href: string;
}

/**
 * TopbarComponent
 *
 * Slim, premium top navigation bar:
 * - Sidebar collapse (desktop) / hamburger (mobile)
 * - Resource links (Docs, Community, Pricing)
 * - GitHub + npm quick links
 * - Dark / light theme toggle
 * - "Get Pro" call-to-action
 */
@Component({
  selector: 'sv-topbar',
  standalone: true,
  imports: [RouterLink, SvIconComponent],
  templateUrl: './topbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'menuOpen.set(false)',
    '(document:pointerdown)': 'onDocumentPointerDown($event)',
  },
})
export class SvTopbarComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Whether the small-screen navigation (hamburger) menu is open. */
  protected readonly menuOpen = signal(false);

  /**
   * Id of the overflow panel, for the trigger to point `aria-controls` at.
   *
   * The panel used to carry `role="menu"` and its links `role="menuitem"`, which
   * is a promise of arrow-key navigation and focus management that none of this
   * code makes good on — a screen reader announces a menu of eight items and the
   * arrow keys then do nothing. They are ordinary links in a disclosure, so that
   * is what they are marked up as now.
   */
  protected readonly menuId = svUniqueId('sv-topbar-menu');

  /** Whether the sidebar is currently collapsed (controls toggle icon rotation). */
  readonly sidebarCollapsed = input<boolean>(false);

  /** Overview / landing page. Internal routes use SPA navigation. */
  readonly overviewUrl = input<string>('/');

  /** Documentation page. Internal routes ('/docs') use SPA navigation; an
   *  external URL ('https://…') opens in a new tab. */
  readonly docsUrl = input<string>('/docs');

  /** Templates gallery page. Internal route by default; external URLs open in
   *  a new tab. Hide the link entirely with {@link showTemplates}. */
  readonly templatesUrl = input<string>('/templates');

  /** Whether to render the Templates link (desktop nav + overflow menu). */
  readonly showTemplates = input<boolean>(true);

  /** Community / forum URL. */
  readonly communityUrl = input<string>('#community');

  /** Pricing page — internal route by default; also used by the "Get Pro" CTA. */
  readonly pricingUrl = input<string>('/pricing');

  /** License page URL (only rendered when {@link showLicense} is true). */
  readonly licenseUrl = input<string>('/license');

  /**
   * Toggle the resource links. Defaults preserve the standalone library look
   * (GitHub + npm shown, License hidden); a host app can flip them, e.g. hide
   * GitHub/npm and surface a License link, without forking the component.
   */
  readonly showGithub = input<boolean>(true);
  /** Show the npm link (to `npmUrl`) in the bar and the mobile menu. @default true */
  readonly showNpm = input<boolean>(true);
  /** Show the License link (to `licenseUrl`) in the bar and the mobile menu. @default false */
  readonly showLicense = input<boolean>(false);

  /** Shared styling for the inline text resource links. */
  protected readonly resourceLinkClass =
    'rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-gray-600 transition-colors ' +
    'hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white';

  /** Shared styling for the small-screen overflow-menu items. */
  protected readonly menuItemClass =
    'block rounded-lg px-2.5 py-2 text-[13px] font-medium text-gray-600 transition-colors ' +
    'hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white';

  /** True for in-app routes (start with '/') — rendered with routerLink. */
  protected isInternal(url: string): boolean {
    return url.startsWith('/');
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected onDocumentPointerDown(event: PointerEvent): void {
    if (this.menuOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.menuOpen.set(false);
    }
  }

  /**
   * Whether to render the built-in "Get Pro" CTA. Set false when the host
   * projects its own Pro control into the [topbar-actions] slot (avoids a
   * duplicate button). Defaults true for standalone library use.
   */
  readonly showGetPro = input<boolean>(true);

  /** GitHub repository URL. */
  readonly githubUrl = input<string>('#github');

  /** npm package URL. */
  readonly npmUrl = input<string>('#npm');

  // ── Outputs ────────────────────────────────────────────────────────────────

  /** Emits when the desktop sidebar toggle is clicked. */
  readonly toggleSidebar = output<void>();

  /** Emits when the mobile hamburger menu is clicked. */
  readonly toggleMobileSidebar = output<void>();

  // ── Services ───────────────────────────────────────────────────────────────

  /** @internal Theme service — used by the template's dark-mode toggle. */
  protected readonly themeService = inject(ThemeService);
}
