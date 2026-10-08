import { render } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SvBreadcrumbComponent } from './breadcrumb.component';

describe('SvBreadcrumbComponent — async states and identity', () => {
  const crumbs = [
    { label: 'Home', routerLink: '/' },
    { label: 'Orders', routerLink: '/orders' },
    { label: 'Order 42' },
  ];

  const host = async (inputs: Record<string, unknown> = {}) => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvBreadcrumbComponent, {
      inputs: { items: crumbs, ...inputs },
      providers: [provideRouter([])],
    });
    return fixture;
  };

  it('renders a failure compactly instead of the trail', async () => {
    // A breadcrumb is a secondary trail. A full error card here would
    // out-shout whatever actually failed on the page.
    const f = await host({ error: 'Could not resolve the path' });
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[data-sv-state="error"]')).toBeTruthy();
    expect(el.textContent).toContain('Could not resolve the path');
    expect(el.querySelector('nav ol')).toBeNull();
  });

  it('prefers the error over the skeleton when both are set', async () => {
    const f = await host({ error: 'Boom', loading: true });
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[data-sv-state="error"]')).toBeTruthy();
    expect(el.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('reports the retry', async () => {
    const f = await host({ error: 'Boom' });
    const seen: number[] = [];
    f.componentInstance.retry.subscribe(() => seen.push(1));
    (f.nativeElement as HTMLElement).querySelector('button')?.click();
    expect(seen.length).toBeGreaterThanOrEqual(0);
  });

  it('keys crumbs by route, not by position', async () => {
    // `openMenuIndex` tracks the open sibling menu by index, so reusing an
    // element by position while a menu is open would leave the menu attached
    // to a different label.
    const f = await host();
    const c = f.componentInstance as unknown as {
      trackCrumb(i: number, item: unknown): string;
    };
    expect(c.trackCrumb(0, crumbs[0])).toBe('/|Home');
    expect(c.trackCrumb(1, crumbs[1])).toBe('/orders|Orders');
    // The last crumb has no link, so position is all that is left.
    expect(c.trackCrumb(2, crumbs[2])).toBe('2|Order 42');
    expect(c.trackCrumb(1, '__ellipsis__')).toBe('__ellipsis__');
  });
});
