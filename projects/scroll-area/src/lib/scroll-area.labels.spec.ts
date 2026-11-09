import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvScrollAreaComponent } from './scroll-area.component';
import { SV_SCROLL_AREA_LABELS } from './scroll-area.labels';

/** Give the viewport a size and scroll it past `showAfter`, so the back-to-top button shows. */
function scrollPast(host: HTMLElement) {
  const port = host.querySelector('[data-sv-port]') as HTMLElement;
  Object.defineProperty(port, 'clientHeight', { value: 400, configurable: true });
  Object.defineProperty(port, 'scrollHeight', { value: 4000, configurable: true });
  Object.defineProperty(port, 'scrollTop', { value: 900, writable: true, configurable: true });
  port.dispatchEvent(new Event('scroll'));
}

async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvScrollAreaComponent, {
    inputs: { backToTop: true, showAfter: 300 },
    providers: providers as never[],
  });
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  scrollPast(host);
  fixture.detectChanges();
  return host.querySelector<HTMLButtonElement>('[data-sv-back-to-top]')!;
}

/** FL-B1d: the back-to-top button's default name is a label an app can translate. */
describe('SvScrollAreaComponent — labels', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('names the back-to-top button in English by default', async () => {
    const button = await setup();
    expect(button.getAttribute('aria-label')).toBe(SV_SCROLL_AREA_LABELS.backToTop);
  });

  it('renders the name an app provides', async () => {
    const button = await setup([provideSvLabels({ scrollArea: { backToTop: 'Nach oben' } })]);
    expect(button.getAttribute('aria-label')).toBe('Nach oben');
    expect(button.title).toBe('Nach oben');
  });

  it('builds the scroll read-out from the labels an app provides (FL-B1e)', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvScrollAreaComponent, {
      providers: [provideSvLabels({ scrollArea: { scrollPosition: '{progress} % gescrollt; {shown} % des Inhalts sichtbar.' } })],
    });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const port = host.querySelector('[data-sv-port]') as HTMLElement;
    Object.defineProperty(port, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(port, 'scrollHeight', { value: 800, configurable: true });
    Object.defineProperty(port, 'scrollTop', { value: 200, writable: true, configurable: true });
    port.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(host.querySelector('[data-sv-readout]')?.textContent?.trim()).toBe('50 % gescrollt; 50 % des Inhalts sichtbar.');
  });
});
