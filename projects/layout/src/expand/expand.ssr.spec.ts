import { Component, destroyPlatform, getPlatform, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { bootstrapApplication } from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import { provideServerRendering } from '@angular/ssr';
import { render } from '@testing-library/angular';
import { SvExpandComponent } from './expand.component';

/**
 * FL-J3-LU-08 — Expand's initial state on the server (`LU-04-I4`).
 *
 * ★★ A REAL SERVER RENDER, not a jsdom render with a platform flag. The panel's
 *    collapsed state used to be written in `ngAfterViewInit` — imperatively, to
 *    the live element — and whether that reaches the serialised HTML is exactly
 *    the question. So this boots the component through `renderApplication`
 *    (`@angular/platform-server`, the engine the site's prerender uses) and
 *    reads the HTML string it produces.
 *
 *    The browser testing platform the suite runs on is destroyed first —
 *    Angular allows one platform per process — and re-created afterwards for
 *    the jsdom half below.
 */

@Component({
  selector: 'sv-ssr-expand-host',
  imports: [SvExpandComponent],
  template: `
    <button type="button" id="trigger" aria-controls="panel">Details</button>
    <sv-expand panelId="collapsed-eager" [expanded]="false" [lazy]="false" ariaLabelledby="trigger">
      <p>Eager content</p>
    </sv-expand>
    <sv-expand panelId="collapsed-lazy" [expanded]="false">
      <p>Lazy content</p>
    </sv-expand>
    <sv-expand panelId="open" [expanded]="true">
      <p>Open content</p>
    </sv-expand>`,
})
class SsrHost {}

let html = '';

beforeAll(async () => {
  // One platform per process: hand the browser testing platform back first.
  TestBed.resetTestingModule();
  getPlatform()?.destroy();
  html = await renderApplication(
    (context) =>
      bootstrapApplication(SsrHost, { providers: [provideZonelessChangeDetection(), provideServerRendering()] }, context),
    { document: '<html><head></head><body><sv-ssr-expand-host></sv-ssr-expand-host></body></html>', url: '/' },
  );
  destroyPlatform();
});

// No afterAll hand-back: `src/test-setup.ts` destroys whatever platform a file
// leaves and creates its own, so the next file in this worker starts clean.

/** The opening tag of the panel wrapper with this id, as the server wrote it. */
function wrapper(id: string): string {
  const match = html.match(new RegExp(`<div[^>]*id="${id}"[^>]*>`));
  if (!match) throw new Error(`no panel ${id} in:\n${html}`);
  return match[0];
}

describe('SvExpandComponent — server-rendered initial state (LU-04-I4)', () => {
  it('★ a collapsed non-lazy panel is serialised HIDDEN — display: none is in the HTML', () => {
    expect(wrapper('collapsed-eager')).toMatch(/style="display:\s*none;?"/);
  });

  it('its content is in the server HTML (eager), hidden from AT and out of the tab order', () => {
    const tag = wrapper('collapsed-eager');
    expect(tag).toContain('aria-hidden="true"');
    expect(tag).toContain('inert');
    expect(html).toContain('Eager content');
  });

  it('a collapsed lazy panel is hidden and ships no content until it is first opened', () => {
    expect(wrapper('collapsed-lazy')).toMatch(/style="display:\s*none;?"/);
    expect(html).not.toContain('Lazy content');
  });

  it('an open panel carries no display override and ships its content', () => {
    expect(wrapper('open')).not.toContain('display');
    expect(wrapper('open')).toContain('aria-hidden="false"');
    expect(html).toContain('Open content');
  });
});

describe('SvExpandComponent — the client agrees with the server (no flash on hydration)', () => {
  @Component({
    imports: [SvExpandComponent],
    template: `<sv-expand panelId="p" [expanded]="open()" [lazy]="false" (expandedChange)="changes.push($event)"><p>Body</p></sv-expand>`,
  })
  class ClientHost {
    readonly open = signal(false);
    readonly changes: boolean[] = [];
  }

  it('★ the client\'s FIRST render binds the same display: none — before any lifecycle hook could write it', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(ClientHost, { detectChangesOnRender: false });
    // One change-detection pass is the template render; hydration compares
    // against exactly this.
    fixture.detectChanges();
    const panel = (fixture.nativeElement as HTMLElement).querySelector('#p') as HTMLElement;
    expect(panel.style.display).toBe('none');
  });

  it('emits nothing for the initial state — expandedChange reports transitions only', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(ClientHost);
    await fixture.whenStable();
    expect(fixture.componentInstance.changes).toEqual([]);
  });

  it('the binding never fights the transitions: opening and closing still work after it', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(ClientHost);
    const panel = (fixture.nativeElement as HTMLElement).querySelector('#p') as HTMLElement;
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    expect(panel.style.display).toBe('block');
    await new Promise((r) => setTimeout(r, 400));
    fixture.detectChanges();
    expect(fixture.componentInstance.changes).toEqual([true]);
    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 400));
    fixture.detectChanges();
    expect(panel.style.display).toBe('none');
    expect(fixture.componentInstance.changes).toEqual([true, false]);
  });
});
