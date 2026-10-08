import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  SV_NAV_LOCATION,
  provideSvNavLocation,
  svHashNavLocation,
  svNavParam,
  svNoopNavLocation,
  svQueryParamNavLocation,
  type SvNavLocation,
} from './nav-location';

/**
 * ============================================================================
 *  The navigation location seam — `X-8`
 * ============================================================================
 *
 * The cases that matter are the ones that break in a real app rather than in a
 * happy path: the server, where there is no `window`; the back button, which
 * does not fire for programmatic writes; and two components sharing one
 * location, which is how a page desyncs.
 *
 * `jsdom` gives a real History API, so the query and hash implementations are
 * exercised against actual `pushState` / `replaceState` rather than a double.
 */

/** Put the test page at a known URL, and leave the history stack alone after. */
function at(url: string): void {
  window.history.replaceState(null, '', url);
}

beforeEach(() => at('/page'));

describe('svNoopNavLocation — the default', () => {
  it('reads nothing and writes nothing', () => {
    const loc = svNoopNavLocation();
    loc.write('tab', 'billing');
    expect(loc.read('tab')).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('is what the token resolves to when nobody provided one', () => {
    TestBed.resetTestingModule();
    expect(TestBed.inject(SV_NAV_LOCATION).kind).toBe('noop');
  });

  /**
   * ★ The test that keeps the seam honest. A component that only behaves
   * correctly once a real location is wired up has made routing mandatory
   * through the back door, so the no-op must be a working configuration and
   * `addressable` is how a component can tell without asking for a `kind`.
   */
  it('reports itself as not addressable', () => {
    TestBed.resetTestingModule();
    TestBed.runInInjectionContext(() => {
      expect(svNavParam('tab').addressable()).toBe(false);
    });
  });

  it('unsubscribing is safe and idempotent', () => {
    const loc = svNoopNavLocation();
    const off = loc.subscribe(() => undefined);
    expect(() => {
      off();
      off();
    }).not.toThrow();
  });
});

describe('svQueryParamNavLocation', () => {
  it('reads a key that is already in the URL', () => {
    at('/page?tab=billing&page=3');
    const loc = svQueryParamNavLocation();
    expect(loc.read('tab')).toBe('billing');
    expect(loc.read('page')).toBe('3');
    expect(loc.read('absent')).toBeNull();
  });

  it('writes without disturbing the other keys', () => {
    at('/page?tab=billing&page=3');
    svQueryParamNavLocation().write('page', '4');
    expect(new URLSearchParams(window.location.search).get('tab')).toBe('billing');
    expect(new URLSearchParams(window.location.search).get('page')).toBe('4');
  });

  /**
   * `?tab=` and no `tab` at all are different URLs, and only the second one
   * means "no selection". A component clearing its state must produce the second.
   */
  it('removes the key on null rather than storing an empty value', () => {
    at('/page?tab=billing&page=3');
    svQueryParamNavLocation().write('tab', null);
    expect(window.location.search).toBe('?page=3');
    expect(window.location.search).not.toContain('tab');
  });

  it('leaves the path and the hash alone', () => {
    at('/deep/path?a=1#section');
    svQueryParamNavLocation().write('a', '2');
    expect(window.location.pathname).toBe('/deep/path');
    expect(window.location.hash).toBe('#section');
  });

  it('drops the question mark entirely when the last key goes', () => {
    at('/page?only=1');
    svQueryParamNavLocation().write('only', null);
    expect(window.location.search).toBe('');
  });

  describe('history', () => {
    /** `replace` is the default precisely so a component cannot flood the stack. */
    it('replaces by default, so the back stack does not grow', () => {
      at('/page');
      const before = window.history.length;
      const loc = svQueryParamNavLocation();
      loc.write('tab', 'a');
      loc.write('tab', 'b');
      loc.write('tab', 'c');
      expect(window.history.length).toBe(before);
      expect(new URLSearchParams(window.location.search).get('tab')).toBe('c');
    });

    it('pushes when asked, so back undoes the change', () => {
      at('/page');
      const before = window.history.length;
      svQueryParamNavLocation().write('tab', 'a', 'push');
      expect(window.history.length).toBe(before + 1);
    });

    /**
     * Writing the value it already holds is not a navigation. Without this, a
     * component re-emitting its own state on every change detection would add a
     * back entry per keystroke.
     */
    it('does nothing when the value is unchanged', () => {
      at('/page?tab=a');
      const before = window.history.length;
      const seen: string[] = [];
      const loc = svQueryParamNavLocation();
      loc.subscribe(() => seen.push(loc.read('tab') ?? ''));
      loc.write('tab', 'a', 'push');
      expect(window.history.length).toBe(before);
      expect(seen).toEqual([]);
    });
  });

  describe('notification', () => {
    /**
     * ★ `popstate` does NOT fire for `pushState` or `replaceState`. A location
     * that only forwarded `popstate` would let two components on one page drift
     * apart the moment either wrote — so writes notify too.
     */
    it('notifies on a write, not only on back and forward', () => {
      const loc = svQueryParamNavLocation();
      let calls = 0;
      loc.subscribe(() => calls++);
      loc.write('tab', 'billing');
      expect(calls).toBe(1);
    });

    it('notifies on popstate', () => {
      const loc = svQueryParamNavLocation();
      let calls = 0;
      loc.subscribe(() => calls++);
      window.dispatchEvent(new PopStateEvent('popstate'));
      expect(calls).toBe(1);
    });

    it('stops notifying after unsubscribe', () => {
      const loc = svQueryParamNavLocation();
      let calls = 0;
      const off = loc.subscribe(() => calls++);
      off();
      loc.write('tab', 'billing');
      window.dispatchEvent(new PopStateEvent('popstate'));
      expect(calls).toBe(0);
    });

    /** Two components, one location: both hear about either one's write. */
    it('keeps two subscribers in step', () => {
      const loc = svQueryParamNavLocation();
      const heard: string[] = [];
      loc.subscribe(() => heard.push(`a:${loc.read('tab')}`));
      loc.subscribe(() => heard.push(`b:${loc.read('tab')}`));
      loc.write('tab', 'billing');
      expect(heard).toEqual(['a:billing', 'b:billing']);
    });

    /**
     * A listener that unsubscribes while being notified must not shorten the set
     * mid-iteration and skip whoever came next.
     */
    it('survives a listener unsubscribing during notification', () => {
      const loc = svQueryParamNavLocation();
      const heard: string[] = [];
      const off = loc.subscribe(() => {
        heard.push('first');
        off();
      });
      loc.subscribe(() => heard.push('second'));
      loc.write('tab', 'x');
      expect(heard).toEqual(['first', 'second']);
    });
  });
});

describe('svHashNavLocation', () => {
  it('reads and writes the hash', () => {
    at('/page#installation');
    const loc = svHashNavLocation('section');
    expect(loc.read('section')).toBe('installation');

    loc.write('section', 'usage');
    expect(window.location.hash).toBe('#usage');
  });

  it('treats an empty hash as absent', () => {
    at('/page');
    expect(svHashNavLocation('section').read('section')).toBeNull();
  });

  it('removes the hash on null', () => {
    at('/page#usage');
    svHashNavLocation('section').write('section', null);
    expect(window.location.hash).toBe('');
  });

  it('encodes a value that is not URL-safe, and decodes it back', () => {
    at('/page');
    const loc = svHashNavLocation('section');
    loc.write('section', 'a b/c?d');
    expect(window.location.hash).not.toContain(' ');
    expect(loc.read('section')).toBe('a b/c?d');
  });

  /**
   * ★ A pasted or hand-typed hash can hold a truncated escape. `decodeURIComponent`
   * throws `URIError` on it, and `read` runs inside every bound `svNavParam`'s
   * `computed` — so a bad link would have thrown from change detection.
   */
  it('returns a malformed escape raw instead of throwing', () => {
    at('/page#%E0%A4');
    const loc = svHashNavLocation('section');
    expect(() => loc.read('section')).not.toThrow();
    expect(loc.read('section')).toBe('%E0%A4');
  });

  it('leaves the path and query alone', () => {
    at('/deep/path?a=1#one');
    svHashNavLocation('section').write('section', 'two');
    expect(window.location.pathname).toBe('/deep/path');
    expect(window.location.search).toBe('?a=1');
  });

  /**
   * ★ The hash is one slot, so this location owns exactly one key. A second
   * component wired to the same hash must fail VISIBLY rather than silently
   * stealing the first one's state — `#a` and `#b` cannot both be true, and that
   * is a fact about URLs rather than a limitation here.
   */
  describe('the single-slot rule', () => {
    it('refuses a foreign key on read and on write', () => {
      at('/page#installation');
      const loc = svHashNavLocation('section');
      expect(loc.read('tab')).toBeNull();

      loc.write('tab', 'billing');
      expect(window.location.hash).toBe('#installation');
    });

    it('names both keys in the dev warning, so the collision is obvious', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      svHashNavLocation('section').write('tab', 'billing');

      expect(warn).toHaveBeenCalledTimes(1);
      const message = String(warn.mock.calls[0]?.[0]);
      expect(message).toContain('section');
      expect(message).toContain('tab');
      expect(message).toContain('svQueryParamNavLocation');
      warn.mockRestore();
    });
  });

  it('notifies on hashchange as well as popstate', () => {
    const loc = svHashNavLocation('section');
    let calls = 0;
    loc.subscribe(() => calls++);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(calls).toBe(2);
  });
});

describe('svNavParam', () => {
  @Component({ standalone: true, template: '' })
  class Host {
    readonly tab = svNavParam('tab');
    readonly page = svNavParam('page', { mode: 'push' });
    readonly location = inject(SV_NAV_LOCATION);
  }

  function mount(location: SvNavLocation) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideSvNavLocation(location)] });
    return TestBed.createComponent(Host);
  }

  /** The deep-link case, arriving for free: the signal starts at what the URL held. */
  it('starts at the value already in the location', () => {
    at('/page?tab=billing');
    expect(mount(svQueryParamNavLocation()).componentInstance.tab.value()).toBe('billing');
  });

  it('writes through to the location when set', () => {
    at('/page');
    mount(svQueryParamNavLocation()).componentInstance.tab.set('billing');
    expect(new URLSearchParams(window.location.search).get('tab')).toBe('billing');
  });

  it('honours a per-parameter write mode', () => {
    at('/page');
    const f = mount(svQueryParamNavLocation());
    const before = window.history.length;
    f.componentInstance.page.set('2');
    expect(window.history.length).toBe(before + 1);
  });

  /**
   * ★ One key, two honest write modes, decided per call.
   *
   * `sv-anchor` is the case that named it: reflecting the scrolled position must
   * `replace` — pushing per section is `NV-02-I3`, the defect that fills the back
   * stack until back stops being a way out of the page — while a *click* on the
   * same nav is a navigation the reader expects back to undo. Nothing about the
   * parameter can tell a gesture from a drift; only the call site knows.
   */
  describe('a per-write mode override', () => {
    it('pushes from a parameter that replaces by default', () => {
      at('/page');
      const f = mount(svQueryParamNavLocation());
      const before = window.history.length;

      f.componentInstance.tab.set('billing');
      expect(window.history.length).toBe(before);

      f.componentInstance.tab.set('invoices', 'push');
      expect(window.history.length).toBe(before + 1);
    });

    it('replaces from a parameter that pushes by default', () => {
      at('/page');
      const f = mount(svQueryParamNavLocation());
      const before = window.history.length;

      f.componentInstance.page.set('2', 'replace');
      expect(window.history.length).toBe(before);
      expect(new URLSearchParams(window.location.search).get('page')).toBe('2');
    });

    /** Omitting it keeps the parameter's own mode — the override is opt-in. */
    it('falls back to the configured mode when omitted', () => {
      at('/page');
      const f = mount(svQueryParamNavLocation());
      const before = window.history.length;

      f.componentInstance.page.set('2');
      expect(window.history.length).toBe(before + 1);
    });
  });

  it('picks up an external change, so back and forward work', () => {
    at('/page?tab=billing');
    const f = mount(svQueryParamNavLocation());
    expect(f.componentInstance.tab.value()).toBe('billing');

    at('/page?tab=invoices');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(f.componentInstance.tab.value()).toBe('invoices');
  });

  /**
   * A change to somebody else's key must not mark this signal dirty — otherwise
   * every parameter on the page wakes every consumer's effect on any navigation.
   */
  it('ignores a change to another key', () => {
    at('/page?tab=billing');
    const f = mount(svQueryParamNavLocation());
    const first = f.componentInstance.tab.value();

    f.componentInstance.page.set('7');
    expect(f.componentInstance.tab.value()).toBe(first);
  });

  /**
   * ★ The claim is that the LISTENER goes, not that the value freezes.
   *
   * `value` is a projection — it reads the location — so a read after destruction
   * would still see the current URL, and asserting a frozen value would have been
   * asserting an artifact of lazy evaluation rather than the cleanup. Counting the
   * unsubscribe is the actual contract: nothing keeps notifying a dead component.
   */
  it('unsubscribes from the location when the component is destroyed', () => {
    let subscribes = 0;
    let unsubscribes = 0;
    const counted: SvNavLocation = {
      ...svNoopNavLocation(),
      kind: 'counted',
      subscribe: () => {
        subscribes++;
        return () => unsubscribes++;
      },
    };

    const f = mount(counted);
    expect(subscribes).toBeGreaterThan(0);
    expect(unsubscribes).toBe(0);

    f.destroy();
    expect(unsubscribes).toBe(subscribes);
  });

  /**
   * ★ A parameter is a projection, not storage — and this is where that matters.
   *
   * Under the no-op location a write goes nowhere and `value` stays `null`. That
   * is deliberate: the component keeps its own state and the parameter mirrors it
   * into the URL. Were it the other way round, a component would read its own
   * state back out of a location that may not exist, and the default
   * configuration would break it — which is exactly how "optional" would quietly
   * stop being true.
   */
  it('stays empty under the no-op location, and touches no URL', () => {
    at('/page');
    const f = mount(svNoopNavLocation());
    f.componentInstance.tab.set('billing');

    expect(f.componentInstance.tab.value()).toBeNull();
    expect(f.componentInstance.tab.addressable()).toBe(false);
    expect(window.location.search).toBe('');
  });

  /** The input-driven key: `null` means this instance does not synchronise. */
  describe('a key from an input', () => {
    @Component({ standalone: true, template: '' })
    class KeyedHost {
      readonly key = signal<string | null>(null);
      readonly param = svNavParam(() => this.key());
    }

    function mountKeyed() {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideSvNavLocation(svQueryParamNavLocation())],
      });
      return TestBed.createComponent(KeyedHost);
    }

    it('does nothing at all while the key is null', () => {
      at('/page?page=3');
      const f = mountKeyed();

      expect(f.componentInstance.param.value()).toBeNull();
      expect(f.componentInstance.param.addressable()).toBe(false);

      f.componentInstance.param.set('9');
      expect(window.location.search).toBe('?page=3');
    });

    /**
     * ★ The reason the key is resolved lazily rather than captured. A field
     * initializer runs before inputs are set, so a captured key would bind to the
     * default forever — silently, and to the wrong parameter.
     */
    it('picks up the key once it is set, and reads what is already there', () => {
      at('/page?page=3');
      const f = mountKeyed();
      expect(f.componentInstance.param.value()).toBeNull();

      f.componentInstance.key.set('page');

      expect(f.componentInstance.param.addressable()).toBe(true);
      expect(f.componentInstance.param.value()).toBe('3');
    });

    /** Two instances, two keys — which is why the key cannot be hard-coded. */
    it('lets two instances own different keys', () => {
      at('/page');
      const first = mountKeyed();
      first.componentInstance.key.set('page');
      first.componentInstance.param.set('2');

      const second = mountKeyed();
      second.componentInstance.key.set('archivePage');
      second.componentInstance.param.set('5');

      const params = new URLSearchParams(window.location.search);
      expect(params.get('page')).toBe('2');
      expect(params.get('archivePage')).toBe('5');
    });
  });
});
