import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { vi } from 'vitest';
import { SvScrollAreaComponent } from './scroll-area.component';

/**
 * `SR-28b` — the scroll-area features that were listed as Pro and ship free:
 * both axes with a corner, snap + snapChange, a sticky header the thumb and
 * fade start below, and `contentHeight` for a virtual list.
 */

async function area(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvScrollAreaComponent, { inputs });
  fixture.detectChanges();
  return { f: fixture, c: fixture.componentInstance, host: fixture.nativeElement as HTMLElement };
}

afterEach(() => {
  vi.useRealTimers();
  TestBed.resetTestingModule();
});

function sizeBoth(host: HTMLElement, v: [number, number], h: [number, number]) {
  const port = host.querySelector('[data-sv-port]') as HTMLElement;
  Object.defineProperty(port, 'clientHeight', { value: v[0], configurable: true });
  Object.defineProperty(port, 'scrollHeight', { value: v[1], configurable: true });
  Object.defineProperty(port, 'clientWidth', { value: h[0], configurable: true });
  Object.defineProperty(port, 'scrollWidth', { value: h[1], configurable: true });
  port.dispatchEvent(new Event('scroll'));
  return port;
}

describe('scroll-area (SR-28b) — both axes', () => {
  it('★ draws a thumb on each axis, short of a corner where they meet', async () => {
    const { f, host } = await area({ orientation: 'both', variant: 'always' });
    const port = sizeBoth(host, [300, 1200], [400, 1600]);
    f.detectChanges();
    expect(port.className).toContain('overflow-y-auto');
    expect(port.className).toContain('overflow-x-auto');
    const corner = host.querySelector('[data-sv-corner]') as HTMLElement;
    expect(corner.style.width).toBe('12px');                      // 8 px thumb + 4
    expect((host.querySelector('[data-sv-track]') as HTMLElement).style.height).toBe('288px');
    expect((host.querySelector('[data-sv-x-track]') as HTMLElement).style.width).toBe('388px');
    expect(host.querySelector('[data-sv-x-thumb]')).not.toBeNull();
  });

  it('no corner while only one axis overflows', async () => {
    const { f, host } = await area({ orientation: 'both', variant: 'always' });
    sizeBoth(host, [300, 1200], [400, 400]);
    f.detectChanges();
    expect(host.querySelector('[data-sv-corner]')).toBeNull();
    expect(host.querySelector('[data-sv-x-track]')).toBeNull();
    expect((host.querySelector('[data-sv-track]') as HTMLElement).style.height).toBe('300px');
  });

  it('inline fades follow the inline position', async () => {
    const { f, host } = await area({ orientation: 'both' });
    const port = sizeBoth(host, [300, 300], [400, 1600]);
    f.detectChanges();
    expect(host.querySelector('[data-sv-x-fade-start]')).toBeNull();
    expect(host.querySelector('[data-sv-x-fade-end]')).not.toBeNull();
    Object.defineProperty(port, 'scrollLeft', { value: 600, configurable: true });
    port.dispatchEvent(new Event('scroll'));
    f.detectChanges();
    expect(host.querySelector('[data-sv-x-fade-start]')).not.toBeNull();
  });

  it('★ inset reserves both gutters outside the scroller, which padding would not', async () => {
    // Padding on a scroller that overflows on both axes scrolls away with the
    // content; a margin stays put, and the thumbs sit in it.
    const { f, host } = await area({ orientation: 'both', scrollbars: 'inset', variant: 'always' });
    const port = sizeBoth(host, [300, 1200], [400, 1600]);
    f.detectChanges();
    expect(port.style.marginInlineEnd).toBe('14px');
    expect(port.style.marginBottom).toBe('14px');
    expect(port.style.paddingBottom).toBe('');
    expect((host.querySelector('[data-sv-corner]') as HTMLElement).style.width).toBe('14px');
    expect((host.querySelector('[data-sv-track]') as HTMLElement).style.height).toBe('300px');
  });

  it('a single-axis area is unchanged', async () => {
    const { f, host } = await area({ variant: 'always' });
    sizeBoth(host, [300, 1200], [400, 1600]);
    f.detectChanges();
    expect(host.querySelector('[data-sv-corner]')).toBeNull();
    expect(host.querySelector('[data-sv-x-track]')).toBeNull();
    expect((host.querySelector('[data-sv-port]') as HTMLElement).className).not.toContain('overflow-x-auto');
  });
});

describe('scroll-area (SR-28b) — snap', () => {
  it('adds the container classes for the axis', async () => {
    const v = await area({ snap: 'mandatory' });
    expect(v.host.querySelector('[data-sv-port]')!.className).toContain('snap-y snap-mandatory');
    const h = await area({ snap: 'proximity', orientation: 'horizontal' });
    expect(h.host.querySelector('[data-sv-port]')!.className).toContain('snap-x snap-proximity');
    const none = await area();
    expect(none.host.querySelector('[data-sv-port]')!.className).not.toContain('snap-');
  });

  it('★ snapChange fires once the scroll rests, with the item index', async () => {
    @Component({
      standalone: true,
      imports: [SvScrollAreaComponent],
      template: `<sv-scroll-area orientation="horizontal" snap="mandatory" (snapChange)="seen.push($event)">
        <div class="flex">@for (i of items; track i) { <div class="snap-start w-40" [attr.data-i]="i">{{ i }}</div> }</div>
      </sv-scroll-area>`,
    })
    class Host {
      readonly items = [0, 1, 2, 3];
      readonly seen: number[] = [];
    }
    vi.useFakeTimers();
    const { fixture } = await render(Host);
    const port = fixture.nativeElement.querySelector('[data-sv-port]') as HTMLElement;
    port.getBoundingClientRect = () => ({ left: 0, right: 160, top: 0, bottom: 100, width: 160, height: 100 }) as DOMRect;
    const lefts = [-320, -160, 0, 160];   // item 2 sits at the port's start
    fixture.nativeElement.querySelectorAll('[data-i]').forEach((el: HTMLElement, i: number) => {
      el.getBoundingClientRect = () => ({ left: lefts[i], right: lefts[i] + 160, top: 0, bottom: 100, width: 160, height: 100 }) as DOMRect;
    });
    for (let n = 0; n < 5; n++) port.dispatchEvent(new Event('scroll'));
    expect(fixture.componentInstance.seen).toEqual([]);
    vi.advanceTimersByTime(130);
    expect(fixture.componentInstance.seen).toEqual([2]);
    port.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(130);
    expect(fixture.componentInstance.seen).toEqual([2]);   // same item: no repeat
  });
});

describe('scroll-area (SR-28b) — sticky header', () => {
  it('★ the track and the start fade begin below the header', async () => {
    @Component({
      standalone: true,
      imports: [SvScrollAreaComponent],
      template: `<sv-scroll-area variant="always"><div svScrollAreaHeader>Header</div><p>rows</p></sv-scroll-area>`,
    })
    class Host {}
    const { fixture } = await render(Host);
    const host = fixture.nativeElement as HTMLElement;
    const header = host.querySelector('[data-sv-header]') as HTMLElement;
    expect(header.className).toContain('sticky top-0');
    expect(header.textContent).toContain('Header');
    Object.defineProperty(header, 'offsetHeight', { value: 40, configurable: true });
    const port = host.querySelector('[data-sv-port]') as HTMLElement;
    Object.defineProperty(port, 'clientHeight', { value: 300, configurable: true });
    Object.defineProperty(port, 'scrollHeight', { value: 1500, configurable: true });
    Object.defineProperty(port, 'scrollTop', { value: 200, writable: true, configurable: true });
    const c = fixture.debugElement.children[0].componentInstance as SvScrollAreaComponent;
    c.measure();
    port.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    const track = host.querySelector('[data-sv-track]') as HTMLElement;
    expect(track.style.top).toBe('40px');
    expect(track.style.height).toBe('260px');
    expect((host.querySelector('[data-sv-fade-start]') as HTMLElement).style.top).toBe('40px');
  });
});

describe('scroll-area (SR-28b) — contentHeight', () => {
  it('★ gives the content box the full virtual height', async () => {
    const { host } = await area({ contentHeight: 360_000 });
    expect((host.querySelector('[data-sv-content]') as HTMLElement).style.minHeight).toBe('360000px');
    const plain = await area();
    expect((plain.host.querySelector('[data-sv-content]') as HTMLElement).style.minHeight).toBe('');
  });
});
