import { TestBed } from '@angular/core/testing';
import { SvLiveAnnouncer } from '../a11y/live-announcer';
import { svRecoverFocus, svRestoreFocusedItem, svSnapshotFocusedItem, svSuccessorIndex } from './focus-recovery';

/**
 * ============================================================================
 *  Where focus goes when the thing holding it disappears — `X-14`
 * ============================================================================
 *
 * ★ Focus on `<body>` is not "focus nowhere". It is focus at the TOP OF THE
 * DOCUMENT, so the next Tab goes to the first link on the page — and a keyboard
 * user who deleted one tab out of six is returned to the start of the site with
 * no announcement. A sighted mouse user sees none of it, which is why five
 * families shipped it and each described it as its own bug.
 */

function mount(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('svRecoverFocus — the priority list', () => {
  it('takes the first candidate that can hold focus', () => {
    const host = mount('<button id="a">A</button><button id="b">B</button>');
    const a = host.querySelector<HTMLElement>('#a')!;
    const b = host.querySelector<HTMLElement>('#b')!;

    expect(svRecoverFocus({ to: [a, b] })).toBe(a);
    expect(document.activeElement).toBe(a);
  });

  /** Nulls are allowed, so a caller can write `[next, previous, list]` plainly. */
  it('skips nulls and undefineds', () => {
    const host = mount('<button id="b">B</button>');
    const b = host.querySelector<HTMLElement>('#b')!;

    expect(svRecoverFocus({ to: [null, undefined, b] })).toBe(b);
  });

  /** The case this exists for: the preferred element has just been removed. */
  it('skips a candidate that is no longer in the document', () => {
    const host = mount('<button id="a">A</button><button id="b">B</button>');
    const a = host.querySelector<HTMLElement>('#a')!;
    const b = host.querySelector<HTMLElement>('#b')!;
    a.remove();

    expect(svRecoverFocus({ to: [a, b] })).toBe(b);
  });

  it('skips a candidate the browser would refuse', () => {
    const host = mount('<button id="a" disabled>A</button><button id="b">B</button>');
    const a = host.querySelector<HTMLElement>('#a')!;
    const b = host.querySelector<HTMLElement>('#b')!;

    expect(svRecoverFocus({ to: [a, b] })).toBe(b);
  });
});

describe('svRecoverFocus — never dropping to body', () => {
  /**
   * ★ What "never drop to `<body>`" actually means: a container that exists but
   * is not focusable is made focusable rather than being given up on.
   */
  it('borrows a tabindex for a container that has none', () => {
    const host = mount('<div id="list"></div>');
    const list = host.querySelector<HTMLElement>('#list')!;

    expect(svRecoverFocus({ to: [], fallback: list })).toBe(list);
    expect(document.activeElement).toBe(list);
    expect(list.getAttribute('tabindex')).toBe('-1');
  });

  /**
   * …and gives it back. A container that silently accumulates attributes over a
   * session is how a later reader concludes it was always meant to be focusable.
   */
  it('removes the borrowed tabindex once focus leaves', () => {
    const host = mount('<div id="list"></div><button id="away">Away</button>');
    const list = host.querySelector<HTMLElement>('#list')!;
    const away = host.querySelector<HTMLElement>('#away')!;

    svRecoverFocus({ to: [], fallback: list });
    away.focus();

    expect(list.hasAttribute('tabindex')).toBe(false);
  });

  /** A tabindex the component owns is left exactly as it was. */
  it('leaves an existing tabindex alone', () => {
    const host = mount('<div id="list" tabindex="0"></div>');
    const list = host.querySelector<HTMLElement>('#list')!;

    svRecoverFocus({ to: [], fallback: list });
    expect(list.getAttribute('tabindex')).toBe('0');
  });

  it('reports failure rather than pretending, when even the fallback has gone', () => {
    const host = mount('<div id="list"></div>');
    const list = host.querySelector<HTMLElement>('#list')!;
    list.remove();

    expect(svRecoverFocus({ to: [], fallback: list })).toBeNull();
  });
});

describe('svRecoverFocus — what it says', () => {
  function announcer(): { instance: SvLiveAnnouncer; said: string[] } {
    TestBed.resetTestingModule();
    const instance = TestBed.inject(SvLiveAnnouncer);
    const said: string[] = [];
    vi.spyOn(instance, 'announce').mockImplementation((m: string) => {
      said.push(m);
      return true;
    });
    return { instance, said };
  }

  it('announces the event when asked', () => {
    const host = mount('<button id="b">B</button>');
    const b = host.querySelector<HTMLElement>('#b')!;
    const { instance, said } = announcer();

    svRecoverFocus({ to: [b], announce: 'Tab closed.', announcer: instance });
    expect(said).toEqual(['Tab closed.']);
  });

  it('announces for the fallback path too', () => {
    const host = mount('<div id="list"></div>');
    const list = host.querySelector<HTMLElement>('#list')!;
    const { instance, said } = announcer();

    svRecoverFocus({ to: [], fallback: list, announce: 'Tab closed.', announcer: instance });
    expect(said).toEqual(['Tab closed.']);
  });

  /** Nothing moved, so there is nothing to narrate. */
  it('stays quiet when focus could not be placed', () => {
    const { instance, said } = announcer();
    svRecoverFocus({ to: [], announce: 'Tab closed.', announcer: instance });
    expect(said).toEqual([]);
  });

  it('stays quiet with no announcer, rather than throwing', () => {
    const host = mount('<button id="b">B</button>');
    const b = host.querySelector<HTMLElement>('#b')!;
    expect(() => svRecoverFocus({ to: [b], announce: 'Tab closed.' })).not.toThrow();
  });
});

describe('svSuccessorIndex — the X-12 mutation rule', () => {
  it('prefers the successor that slid into the same index', () => {
    // [a, b, c] → remove b (index 1) → [a, c]; c is now at 1.
    expect(svSuccessorIndex(1, 2)).toBe(1);
  });

  it('falls back to the predecessor when the last item was removed', () => {
    expect(svSuccessorIndex(2, 2)).toBe(1);
  });

  it('returns -1 when the list is now empty — focus belongs to the container', () => {
    expect(svSuccessorIndex(0, 0)).toBe(-1);
  });

  it('treats an unknown removed index as the start', () => {
    expect(svSuccessorIndex(-1, 3)).toBe(0);
  });
});

describe('svSnapshotFocusedItem / svRestoreFocusedItem — a keyed collection', () => {
  const rows = (host: HTMLElement) => [...host.querySelectorAll('[data-k]')];
  const list = (keys: string[]) =>
    keys.map((k) => `<div data-k="${k}"><button>edit ${k}</button><button>del ${k}</button></div>`).join('');

  it('records the item and which of its controls held focus', () => {
    const host = mount(list(['a', 'b', 'c']));
    host.querySelectorAll('button')[3].focus(); // "del b"
    expect(svSnapshotFocusedItem(rows(host), 'data-k')).toEqual({ key: 'b', index: 1, control: 1 });
  });

  it('is null when focus is outside the collection', () => {
    const host = mount(list(['a']));
    expect(svSnapshotFocusedItem(rows(host), 'data-k')).toBeNull();
  });

  it('focuses the same control in the successor once the item is gone', () => {
    const host = mount(list(['a', 'b', 'c']));
    host.querySelectorAll('button')[3].focus();
    const snap = svSnapshotFocusedItem(rows(host), 'data-k')!;
    host.innerHTML = list(['a', 'c']);
    expect(svRestoreFocusedItem(rows(host), 'data-k', snap)).toBe(host.querySelectorAll('button')[3]);
    expect(document.activeElement?.textContent).toBe('del c');
  });

  it('does nothing while the item is still there', () => {
    const host = mount(list(['a', 'b']));
    host.querySelector('button')!.focus();
    const snap = svSnapshotFocusedItem(rows(host), 'data-k')!;
    expect(svRestoreFocusedItem(rows(host), 'data-k', snap)).toBeNull();
  });

  it('falls back to the container — never <body> — when the collection empties', () => {
    const host = mount(list(['a']));
    host.querySelector('button')!.focus();
    const snap = svSnapshotFocusedItem(rows(host), 'data-k')!;
    host.innerHTML = '';
    expect(svRestoreFocusedItem(rows(host), 'data-k', snap, { fallback: host })).toBe(host);
  });

  it('hands a roving item the tab stop when the item itself held focus', () => {
    const host = mount('<div data-k="a" tabindex="0">A</div><div data-k="b" tabindex="-1">B</div>');
    (host.firstElementChild as HTMLElement).focus();
    const snap = svSnapshotFocusedItem(rows(host), 'data-k')!;
    expect(snap.control).toBe(-1);
    host.firstElementChild!.remove();
    const b = host.querySelector<HTMLElement>('[data-k="b"]')!;
    expect(svRestoreFocusedItem(rows(host), 'data-k', snap)).toBe(b);
    expect(b.tabIndex).toBe(0);
  });
});
