import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideSvLinkAdapter, type SvLinkTarget } from '@styloviz/core';
import { SvButtonComponent } from './button.component';

/**
 * Link mode follows in-app paths through `SV_LINK_ADAPTER` (1.0 release audit, M6).
 *
 * The templates used to get SPA navigation by nesting the button in a router
 * link — `<a routerLink><sv-button/></a>`, a `<button>` inside an `<a>`. `[href]`
 * renders one anchor; these tests pin down when the button hands the click to
 * the app and, just as important, every case where it must leave it alone.
 */

@Component({
  standalone: true,
  imports: [SvButtonComponent],
  template: `
    <sv-button
      label="Go"
      [href]="href()"
      [target]="target()"
      [download]="download()"
      [disabled]="disabled()"
      (clicked)="onClicked($event)"
    />
  `,
})
class HostComponent {
  readonly href = signal('/admin/contacts');
  readonly target = signal('_self');
  readonly download = signal<string | null>(null);
  readonly disabled = signal(false);
  preventInHandler = false;
  onClicked(event: MouseEvent): void {
    if (this.preventInHandler) event.preventDefault();
  }
}

function setup(handled = true) {
  const navigated: SvLinkTarget[] = [];
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [
      provideSvLinkAdapter({
        kind: 'test',
        href: (t) => (typeof t === 'string' ? t : t.join('/')),
        navigate: (t) => {
          navigated.push(t);
          return handled;
        },
      }),
    ],
  });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const anchor = (): HTMLAnchorElement => {
    const a = (fixture.nativeElement as HTMLElement).querySelector('a');
    if (!a) throw new Error('no anchor rendered');
    return a;
  };
  const click = (init: MouseEventInit = {}): MouseEvent => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
    anchor().dispatchEvent(event);
    return event;
  };
  return { fixture, navigated, anchor, click };
}

describe('SvButtonComponent — link mode and the link adapter', () => {
  it('renders ONE anchor with a real href and no nested button', () => {
    const { fixture, anchor } = setup();
    const root = fixture.nativeElement as HTMLElement;
    expect(anchor().getAttribute('href')).toBe('/admin/contacts');
    expect(root.querySelector('button')).toBeNull();
  });

  it('a plain click on an in-app path goes through the adapter, and the browser navigation is cancelled', () => {
    const { navigated, click } = setup();
    const event = click();
    expect(navigated).toEqual(['/admin/contacts']);
    expect(event.defaultPrevented).toBe(true);
  });

  it('an adapter that declines leaves the anchor to the browser', () => {
    const { navigated, click } = setup(false);
    const event = click();
    expect(navigated).toEqual(['/admin/contacts']);
    expect(event.defaultPrevented).toBe(false);
  });

  it.each([
    ['⌘-click', { metaKey: true }],
    ['Ctrl-click', { ctrlKey: true }],
    ['Shift-click', { shiftKey: true }],
    ['middle click', { button: 1 }],
  ])('%s keeps "open in new tab"', (_label, init) => {
    const { navigated, click } = setup();
    const event = click(init);
    expect(navigated).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  it.each([
    ['an absolute URL', 'https://example.com/x'],
    ['a protocol-relative URL', '//example.com/x'],
    ['a mailto link', 'mailto:a@b.c'],
    ['a relative fragment', '#section'],
  ])('%s is left to the browser', (_label, href) => {
    const { fixture, navigated, click } = setup();
    fixture.componentInstance.href.set(href);
    fixture.detectChanges();
    const event = click();
    expect(navigated).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  it('target="_blank" and download are left to the browser', () => {
    const { fixture, navigated, click } = setup();
    fixture.componentInstance.target.set('_blank');
    fixture.detectChanges();
    click();
    fixture.componentInstance.target.set('_self');
    fixture.componentInstance.download.set('report.csv');
    fixture.detectChanges();
    click();
    expect(navigated).toEqual([]);
  });

  it('a host (clicked) handler that calls preventDefault wins', () => {
    const { fixture, navigated, click } = setup();
    fixture.componentInstance.preventInHandler = true;
    click();
    expect(navigated).toEqual([]);
  });

  it('a disabled link navigates nowhere', () => {
    const { fixture, navigated, click } = setup();
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    const event = click();
    expect(navigated).toEqual([]);
    expect(event.defaultPrevented).toBe(true);
  });
});
