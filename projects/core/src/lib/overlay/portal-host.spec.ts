import { Component, DestroyRef, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { createPortalHost } from './portal-host';

let scope: HTMLElement;
let origin: HTMLElement;

beforeEach(() => {
  scope = document.createElement('div');
  scope.innerHTML = '<div id="origin"></div>';
  document.body.appendChild(scope);
  origin = scope.querySelector<HTMLElement>('#origin')!;
});

afterEach(() => {
  scope.remove();
  document.querySelectorAll('[data-sv-portal]').forEach((el) => el.remove());
  document.documentElement.classList.remove('dark');
  document.documentElement.removeAttribute('dir');
  document.documentElement.removeAttribute('data-theme');
});

describe('createPortalHost — the context that is carried', () => {
  it('★ carries a scoped dir, which is the whole RTL case', () => {
    // A body portal is a sibling of the page, so `<div dir="rtl">` two levels
    // above the trigger reaches the trigger and not the panel it opens. The
    // menu then lays out left-to-right over a right-to-left page.
    scope.setAttribute('dir', 'rtl');
    const host = createPortalHost({ origin, label: 'test' });
    expect(host.element.getAttribute('dir')).toBe('rtl');
    host.destroy();
  });

  it('★ carries a LOCALLY dark section, and ignores a document-level one', () => {
    // The usual claim is that the theme survives because `.dark` sits on
    // <html>, which a body portal inherits. True — and not the case that
    // breaks. A locally dark preview pane is.
    document.documentElement.classList.add('dark');
    const docLevel = createPortalHost({ origin, label: 'test' });
    expect(docLevel.element.classList.contains('dark')).toBe(false);
    docLevel.destroy();

    scope.classList.add('dark');
    const scoped = createPortalHost({ origin, label: 'test' });
    expect(scoped.element.classList.contains('dark')).toBe(true);
    scoped.destroy();
  });

  it('carries a scoped data-theme and lang the same way', () => {
    scope.setAttribute('data-theme', 'midnight');
    scope.setAttribute('lang', 'ar');
    const host = createPortalHost({ origin, label: 'test' });
    expect(host.element.getAttribute('data-theme')).toBe('midnight');
    expect(host.element.getAttribute('lang')).toBe('ar');
    host.destroy();
  });

  it('copies only the custom properties it was told about', () => {
    origin.style.setProperty('--sv-density', 'compact');
    origin.style.setProperty('--sv-not-asked-for', 'x');
    const host = createPortalHost({ origin, customProperties: ['--sv-density'], label: 'test' });

    expect(host.element.style.getPropertyValue('--sv-density')).toBe('compact');
    expect(host.element.style.getPropertyValue('--sv-not-asked-for')).toBe('');
    host.destroy();
  });

  it('★ sync() re-reads the context, because a theme can toggle mid-overlay', () => {
    const host = createPortalHost({ origin, label: 'test' });
    expect(host.element.classList.contains('dark')).toBe(false);

    scope.classList.add('dark');       // the user hit the theme switch
    host.sync();

    expect(host.element.classList.contains('dark')).toBe(true);
    host.destroy();
  });

  it('drops a marker again when it is removed from the origin', () => {
    scope.setAttribute('dir', 'rtl');
    const host = createPortalHost({ origin, label: 'test' });
    scope.removeAttribute('dir');
    host.sync();
    expect(host.element.hasAttribute('dir')).toBe(false);
    host.destroy();
  });
});

describe('createPortalHost — placement and teardown', () => {
  it('reports itself available when there is a document', () => {
    const host = createPortalHost({ origin });
    expect(host.available).toBe(true);
    expect(host.element).toBeInstanceOf(HTMLElement);
  });

  it('★ does not enter the document until attach() — render first, insert once', () => {
    // `scripts/fix-portal-insertion-order.mjs` documents the bug this shape
    // prevents: a host inserted EMPTY and filled afterwards spends a frame as
    // a static block at the end of <body>, growing the page and queueing a
    // scroll event that closes the panel it just opened.
    const host = createPortalHost({ origin, label: 'test' });
    expect(host.element.isConnected).toBe(false);
    host.attach();
    expect(host.element.isConnected).toBe(true);
    host.destroy();
  });

  it('appends to <body> by default and to the given root when asked', () => {
    const a = createPortalHost({ origin, label: 'test' });
    a.attach();
    expect(a.element.parentElement).toBe(document.body);
    a.destroy();

    // ★ The sixth thing X-8 lists is the test fixture's DOM root, which is not
    //   a context at all — it is why every spec for a portalled surface
    //   queries `document.body`. Configurable rather than implicit.
    const b = createPortalHost({ origin, root: scope, label: 'test' });
    b.attach();
    expect(b.element.parentElement).toBe(scope);
    b.destroy();
  });

  it('destroy() is idempotent', () => {
    const host = createPortalHost({ origin, label: 'test' });
    host.attach();
    host.destroy();
    host.destroy();
    expect(host.element.isConnected).toBe(false);
  });

  it('sync() after destroy does nothing rather than resurrecting anything', () => {
    const host = createPortalHost({ origin, label: 'test' });
    host.attach();
    host.destroy();
    scope.classList.add('dark');
    host.sync();
    expect(host.element.classList.contains('dark')).toBe(false);
  });

  it('works with no origin at all — nothing to copy is not an error', () => {
    const host = createPortalHost({ label: 'test' });
    host.attach();
    expect(host.element.isConnected).toBe(true);
    host.destroy();
  });
});

describe('createPortalHost — attach after destroy', () => {
  it('a destroyed host cannot be put back into the document', () => {
    const host = createPortalHost({ origin, label: 'test' });
    host.attach();
    host.destroy();
    host.attach();
    expect(host.element.isConnected).toBe(false);
  });
});

describe('createPortalHost — ownership cleanup (N-4)', () => {
  it('★ is destroyed with its owner when given the owner\'s DestroyRef', () => {
    TestBed.resetTestingModule();
    @Component({ standalone: true, template: '' })
    class Owner {
      readonly host = createPortalHost({ origin, label: 'owned', destroyRef: inject(DestroyRef) });
    }
    const fixture = TestBed.createComponent(Owner);
    const host = fixture.componentInstance.host;
    host.attach();
    expect(host.element.isConnected).toBe(true);

    // The owner never calls destroy() itself — the portal still leaves.
    fixture.destroy();
    expect(host.element.isConnected).toBe(false);
    expect(document.querySelector('[data-sv-portal="owned"]')).toBeNull();
  });
});

describe('createPortalHost — no retained owner callbacks (A1)', () => {
  /** A DestroyRef stand-in that exposes how many callbacks it is holding. */
  function countingDestroyRef(): { ref: DestroyRef; readonly size: () => number; fire: () => void } {
    const callbacks = new Set<() => void>();
    const ref = {
      onDestroy(cb: () => void): () => void {
        callbacks.add(cb);
        return () => { callbacks.delete(cb); };
      },
      destroyed: false,
    } as unknown as DestroyRef;
    return { ref, size: () => callbacks.size, fire: () => callbacks.forEach((cb) => cb()) };
  }

  it('★ opening and closing many times leaves no callback on the owner', () => {
    const owner = countingDestroyRef();
    for (let i = 0; i < 50; i++) {
      const host = createPortalHost({ origin, label: 'cycled', destroyRef: owner.ref });
      host.attach();
      expect(owner.size()).toBe(1);
      host.destroy();
    }
    expect(owner.size()).toBe(0);
    expect(document.querySelector('[data-sv-portal="cycled"]')).toBeNull();
  });

  it('a live host is still removed by its owner, and unregisters exactly once', () => {
    const owner = countingDestroyRef();
    const host = createPortalHost({ origin, label: 'live', destroyRef: owner.ref });
    host.attach();
    owner.fire();
    expect(host.element.isConnected).toBe(false);
    expect(owner.size()).toBe(0);
    host.destroy();
    expect(owner.size()).toBe(0);
  });

  it('★ with a real DestroyRef, every registration is unregistered on close', () => {
    TestBed.resetTestingModule();
    @Component({ standalone: true, template: '' })
    class Owner {
      readonly destroyRef = inject(DestroyRef);
    }
    const fixture = TestBed.createComponent(Owner);
    const ref = fixture.componentInstance.destroyRef;
    const original = ref.onDestroy.bind(ref);
    let registered = 0;
    let unregistered = 0;
    vi.spyOn(ref, 'onDestroy').mockImplementation((cb: () => void) => {
      registered++;
      const off = original(cb);
      return () => { unregistered++; off(); };
    });
    for (let i = 0; i < 20; i++) {
      const host = createPortalHost({ origin, label: 'real', destroyRef: ref });
      host.attach();
      host.destroy();
    }
    expect(registered).toBe(20);
    expect(unregistered).toBe(20);
    fixture.destroy();
  });
});
