import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { svCloseOnNavigation } from './close-on-navigation';
import {
  provideSvNavLocation,
  svHashNavLocation,
  svQueryParamNavLocation,
  type SvNavLocation,
} from './nav-location';

/**
 * ============================================================================
 *  Closing a floating panel when the page underneath changes — `NV-03-I5`, `NV-07-I7`
 * ============================================================================
 *
 * ★ The rule pinned here has two halves, and the second is the one that was
 * wrong: close on a REAL navigation, and do NOT close on the kit's own writes.
 * An anchor rail rewriting the hash as the reader scrolls notifies the location
 * exactly like a route change does, and used to shut every open menu.
 */

/** A location the test can notify by hand, and whose listeners it can count. */
function manualLocation(): SvNavLocation & { notify(): void; readonly listeners: Set<() => void> } {
  const listeners = new Set<() => void>();
  return {
    kind: 'manual',
    listeners,
    read: () => null,
    write: () => undefined,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify() {
      for (const listener of [...listeners]) listener();
    },
  };
}

let closes = 0;

@Component({ standalone: true, template: '' })
class Host {
  constructor() {
    svCloseOnNavigation(() => closes++);
  }
}

function mount(location: SvNavLocation) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideSvNavLocation(location)] });
  return TestBed.createComponent(Host);
}

const START = '/start';

beforeEach(() => {
  closes = 0;
  window.history.replaceState(null, '', START);
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('svCloseOnNavigation — browser navigation', () => {
  it('closes on popstate (back and forward)', () => {
    mount(manualLocation());
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(closes).toBe(1);
  });

  it('closes on hashchange (a followed # link)', () => {
    mount(manualLocation());
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(closes).toBe(1);
  });
});

describe('svCloseOnNavigation — SV_NAV_LOCATION notifications', () => {
  it('closes when the notification arrives with a new path', () => {
    const location = manualLocation();
    mount(location);

    window.history.pushState(null, '', '/elsewhere');
    location.notify();

    expect(closes).toBe(1);
  });

  it('closes once per path change, not once per notification', () => {
    const location = manualLocation();
    mount(location);

    window.history.pushState(null, '', '/elsewhere');
    // A router adapter notifies on several events for one navigation.
    location.notify();
    location.notify();

    expect(closes).toBe(1);
  });

  /** The regression: a component's own param write is not a navigation. */
  it('ignores a notification that left the path alone', () => {
    const location = manualLocation();
    mount(location);

    window.history.replaceState(null, '', `${START}?tab=billing#section`);
    location.notify();

    expect(closes).toBe(0);
  });

  it('ignores a real query-param write made by a kit component', () => {
    const location = svQueryParamNavLocation();
    mount(location);

    location.write('page', '3');
    location.write('tab', 'billing', 'push');

    expect(window.location.search).toContain('page=3');
    expect(closes).toBe(0);
  });

  it('ignores a real hash write, the anchor-while-scrolling case', () => {
    const location = svHashNavLocation('section');
    mount(location);

    location.write('section', 'installation');
    location.write('section', 'api');

    expect(window.location.hash).toBe('#api');
    expect(closes).toBe(0);
  });

  it('does not double-count the notification that follows a popstate', () => {
    const location = manualLocation();
    mount(location);

    window.history.pushState(null, '', '/back-target');
    window.dispatchEvent(new PopStateEvent('popstate'));
    location.notify();

    expect(closes).toBe(1);
  });
});

describe('svCloseOnNavigation — teardown', () => {
  it('releases every listener when the component is destroyed', () => {
    const location = manualLocation();
    const fixture = mount(location);
    expect(location.listeners.size).toBe(1);

    fixture.destroy();
    expect(location.listeners.size).toBe(0);

    window.history.pushState(null, '', '/after-destroy');
    location.notify();
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(closes).toBe(0);
  });
});
