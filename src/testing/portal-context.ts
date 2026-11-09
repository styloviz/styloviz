import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { Type } from '@angular/core';
import { render } from '@testing-library/angular';

/**
 * Does a body-portalled panel keep the context it was opened in?
 *
 * ★★★ `X-7` / `FL-J3-FI-01`. A panel moved to `<body>` stops inheriting from
 *     the subtree it was opened from — so a picker opened under `dir="rtl"`
 *     lays out left-to-right, one opened in a `lang="ar"` section is read by
 *     a screen reader in the page's language, and one opened inside a locally
 *     dark preview pane renders light. `createPortalHost` copies all three
 *     from the origin; this harness proves a component actually uses it, by
 *     opening the real panel inside each context and reading the host it
 *     landed in.
 *
 * One call per component. `open` is whatever a user does to show the panel;
 * `label` is the `data-sv-portal` label the component gives its host.
 */
export interface PortalContextCase<T> {
  readonly name: string;
  readonly component: Type<T>;
  /** The component's element selector, e.g. `sv-time-picker`. */
  readonly selector: string;
  /** Extra attributes/bindings for the component element in the host template. */
  readonly bindings?: string;
  /** Values the bindings read. */
  readonly props?: Record<string, unknown>;
  /** The `data-sv-portal` label of the component's host element. */
  readonly label: string;
  /** Show the panel, as a user would. */
  readonly open: (instance: T, element: HTMLElement, fixture: ComponentFixture<unknown>) => void | Promise<void>;
  /** Run before each case — stubs a component needs (e.g. `innerText`). */
  readonly prepare?: (element: HTMLElement) => void;
}

const portalOf = (label: string) =>
  document.querySelector<HTMLElement>(`[data-sv-portal="${label}"]`);

async function mount<T>(c: PortalContextCase<T>, wrapperAttrs: string) {
  TestBed.resetTestingModule();
  const { fixture } = await render(
    `<div data-ctx ${wrapperAttrs}><${c.selector} ${c.bindings ?? ''}></${c.selector}></div>`,
    { imports: [c.component], componentProperties: c.props ?? {} },
  );
  const debug = fixture.debugElement.query(By.directive(c.component));
  const element = debug.nativeElement as HTMLElement;
  c.prepare?.(element);
  await c.open(debug.componentInstance as T, element, fixture);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, portal: portalOf(c.label) };
}

export function describePortalContext<T>(c: PortalContextCase<T>): void {
  describe(`${c.name} — the portalled panel keeps its context (X-7)`, () => {
    afterEach(() => document.querySelectorAll('[data-sv-portal]').forEach((n) => n.remove()));

    it('carries dir and lang from an RTL, Arabic section into the panel', async () => {
      const { portal } = await mount(c, 'dir="rtl" lang="ar"');
      expect(portal).not.toBeNull();
      expect(portal!.parentElement).toBe(document.body);
      expect(portal!.getAttribute('dir')).toBe('rtl');
      expect(portal!.getAttribute('lang')).toBe('ar');
    });

    it('carries a locally scoped dark theme (class and data-theme) into the panel', async () => {
      const { portal } = await mount(c, 'class="dark" data-theme="midnight"');
      expect(portal).not.toBeNull();
      expect(portal!.classList.contains('dark')).toBe(true);
      expect(portal!.getAttribute('data-theme')).toBe('midnight');
    });

    it('copies nothing when the context is the document’s own — the common case stays a no-op', async () => {
      const { portal } = await mount(c, '');
      expect(portal).not.toBeNull();
      expect(portal!.hasAttribute('dir')).toBe(false);
      expect(portal!.hasAttribute('lang')).toBe(false);
      expect(portal!.classList.contains('dark')).toBe(false);
    });

    it('takes the portal host with it when the component is destroyed', async () => {
      const { fixture, portal } = await mount(c, 'dir="rtl"');
      expect(portal?.isConnected).toBe(true);
      fixture.destroy();
      expect(portalOf(c.label)).toBeNull();
    });
  });
}
