import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SvOverlayRouteService, svResetBodyScrollLock } from '@styloviz/core';
import { provideSvOverlayRouteClose, svOverlayCanDeactivate } from '@styloviz/layout';
import { SvModalComponent } from './modal.component';
import { until } from '../../../../src/testing/async';

/**
 * ============================================================================
 *  `sv-modal` + `svOverlayCanDeactivate` — ask BEFORE the page changes
 * ============================================================================
 *
 * ★★★ `provideSvOverlayRouteClose()` closes overlays on `NavigationEnd`, so a
 *     dirty dialog used to ask "discard your changes?" over the page the user
 *     had already been taken to. With the guard on the route, a real Router
 *     cancels the navigation, the dialog's own prompt comes up on the page it
 *     belongs to, Discard re-issues the navigation, and Keep editing stays.
 */

@Component({
  selector: 'sv-test-edit-page',
  standalone: true,
  imports: [SvModalComponent],
  template: `
    <sv-modal [(isOpen)]="open" [dirty]="dirty()" title="Edit contact">
      <div slot="body"><input aria-label="Name" /></div>
    </sv-modal>
  `,
})
class EditPage {
  readonly open = signal(true);
  readonly dirty = signal(true);
}

@Component({ selector: 'sv-test-other-page', standalone: true, template: 'other' })
class OtherPage {}

async function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'edit', component: EditPage, canDeactivate: [svOverlayCanDeactivate] },
        { path: 'other', component: OtherPage },
      ]),
      provideSvOverlayRouteClose(),
    ],
  });
  const harness = await RouterTestingHarness.create('/edit');
  await until(() => document.querySelector('[role="dialog"]') !== null, { label: 'the dialog' });
  return {
    harness,
    router: TestBed.inject(Router),
    routes: TestBed.inject(SvOverlayRouteService),
  };
}

const prompt = () => document.querySelector('[data-sv-state="unsaved-prompt"]');
const discardBtn = () => document.querySelector<HTMLButtonElement>('[data-sv-discard]')!;
const keepBtn = () => document.querySelector<HTMLButtonElement>('[data-sv-keep-editing]')!;

afterEach(() => {
  document.querySelectorAll('[data-sv-modal-portal]').forEach((n) => n.remove());
  svResetBodyScrollLock(document);
});

describe('svOverlayCanDeactivate — a dirty sv-modal holds the navigation', () => {
  it('★ cancels the navigation and raises the prompt on the CURRENT page', async () => {
    const h = await setup();
    const result = await h.router.navigateByUrl('/other');
    h.harness.detectChanges();

    expect(result).toBe(false);
    expect(h.router.url).toBe('/edit');
    expect(prompt()).not.toBeNull();
  });

  it('★ Discard closes the dialog and re-issues the navigation', async () => {
    const h = await setup();
    await h.router.navigateByUrl('/other');
    h.harness.detectChanges();

    discardBtn().click();
    h.harness.detectChanges();
    await until(() => h.router.url === '/other', { label: 'the re-issued navigation' });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(h.routes.openCount).toBe(0);
  });

  it('★ Discard replays the original navigation extras (state, replaceUrl)', async () => {
    const h = await setup();
    const spy = vi.spyOn(h.router, 'navigateByUrl');
    await h.router.navigateByUrl('/other', { state: { from: 'toolbar' }, replaceUrl: true });
    h.harness.detectChanges();

    discardBtn().click();
    h.harness.detectChanges();
    await until(() => h.router.url === '/other', { label: 'the re-issued navigation' });

    const replay = spy.mock.calls[1];
    expect(replay[0]).toBe('/other');
    expect(replay[1]).toEqual(expect.objectContaining({ state: { from: 'toolbar' }, replaceUrl: true }));
  });

  it('★ Keep editing stays on the page with the dialog open, and asks again next time', async () => {
    const h = await setup();
    await h.router.navigateByUrl('/other');
    h.harness.detectChanges();

    keepBtn().click();
    h.harness.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(h.router.url).toBe('/edit');
    expect(prompt()).toBeNull();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    const again = await h.router.navigateByUrl('/other');
    h.harness.detectChanges();
    expect(again).toBe(false);
    expect(prompt()).not.toBeNull();
  });

  it('a clean dialog does not hold anything — it closes on arrival as before', async () => {
    const h = await setup();
    const page = h.harness.routeDebugElement!.componentInstance as EditPage;
    page.dirty.set(false);
    h.harness.detectChanges();

    const result = await h.router.navigateByUrl('/other');
    expect(result).toBe(true);
    expect(h.router.url).toBe('/other');
    expect(prompt()).toBeNull();
  });
});
