import { createFocusScope } from './focus-scope';

/**
 * ★★ EVERY TEST HERE FAILS AGAINST THE CODE THIS REPLACES.
 *
 * The pattern all seven families shipped is two lines:
 *
 *     this.previouslyFocused = document.activeElement as HTMLElement | null;
 *     ...
 *     this.previouslyFocused?.focus?.();
 *
 * It is correct for exactly one case and silently wrong for the three X-6
 * names. "Silently" is the whole problem: `focus()` on a detached element
 * throws nothing, warns nothing, and leaves `document.activeElement` on
 * `<body>`, where the next Tab restarts from the top of the page and a screen
 * reader announces nothing at all.
 */

let root: HTMLElement;

function mount(html: string): HTMLElement {
  root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

afterEach(() => {
  root?.remove();
  document.querySelectorAll('main, [role="main"]').forEach((el) => el.remove());
});

describe('createFocusScope — the case that already worked', () => {
  it('returns focus to the trigger that opened the overlay', () => {
    mount('<button id="t">open</button>');
    const trigger = document.getElementById('t')!;
    trigger.focus();

    const scope = createFocusScope();
    scope.capture();
    (document.activeElement as HTMLElement | null)?.blur(); // focus falls to <body>

    expect(scope.restore()).toBe('opener');
    expect(document.activeElement).toBe(trigger);
  });

  it('does nothing when nothing had focus — restoring would be an unsolicited jump', () => {
    mount('<main><button>elsewhere</button></main>');
    const scope = createFocusScope();
    scope.capture(); // activeElement is <body>

    expect(scope.restore()).toBe('none');
    expect(document.activeElement).toBe(document.body);
  });
});

describe('createFocusScope — X-6 case 1: the trigger was removed', () => {
  it('★ lands in the container the trigger was removed from, not on <body>', () => {
    // The commonest dialog there is: the confirm dialog that deletes the row
    // its own trigger sits in. The better it works, the more reliably the old
    // code lost focus.
    mount(`
      <ul id="list">
        <li id="row1"><button id="del1">delete</button></li>
        <li id="row2"><button id="del2">delete</button></li>
      </ul>
    `);
    const del2 = document.getElementById('del2')!;
    del2.focus();

    const scope = createFocusScope();
    scope.capture();
    document.getElementById('row2')!.remove(); // the dialog did its job

    const outcome = scope.restore();

    expect(outcome).toBe('neighbour');
    expect(document.activeElement).toBe(document.getElementById('del1'));
    expect(document.activeElement).not.toBe(document.body);
  });

  it('focuses the surviving container itself when nothing inside it is focusable', () => {
    mount('<section id="panel"><p id="only"><button id="x">go</button></p></section>');
    document.getElementById('x')!.focus();

    const scope = createFocusScope();
    scope.capture();
    document.getElementById('only')!.remove();

    expect(scope.restore()).toBe('neighbour');
    expect(document.activeElement).toBe(document.getElementById('panel'));
    expect(document.getElementById('panel')!.getAttribute('tabindex')).toBe('-1');
  });

  it('treats a trigger that survived but went disabled as gone', () => {
    // `focus()` on a disabled control is the same silent no-op as `focus()` on
    // a detached one, so "still in the document" is not the test.
    mount('<div id="bar"><button id="a">a</button><button id="b">b</button></div>');
    const b = document.getElementById('b') as HTMLButtonElement;
    b.focus();

    const scope = createFocusScope();
    scope.capture();
    b.disabled = true;

    expect(scope.restore()).toBe('neighbour');
    expect(document.activeElement).toBe(document.getElementById('a'));
  });
});

describe('createFocusScope — X-6 case 2: the route changed', () => {
  it('★ falls back to the main landmark when the opener had no surviving ancestor', () => {
    const main = document.createElement('main');
    main.innerHTML = '<h1>New page</h1>';
    document.body.appendChild(main);

    // A route swap: the whole outlet subtree is detached in one go.
    const outlet = document.createElement('div');
    outlet.innerHTML = '<button id="old">on the old page</button>';
    document.body.appendChild(outlet);
    const old = document.getElementById('old')!;
    old.focus();

    const scope = createFocusScope();
    scope.capture();
    outlet.remove();

    expect(scope.restore()).toBe('fallback');
    expect(document.activeElement).toBe(main);
    // The landmark itself, not its first control: the user needs to hear what
    // page they are on, not be dropped three levels into a nav.
    expect(main.getAttribute('tabindex')).toBe('-1');
  });

  it('reports `none` rather than pretending, when even the landmark is gone', () => {
    const outlet = document.createElement('div');
    outlet.innerHTML = '<button id="old">gone</button>';
    document.body.appendChild(outlet);
    document.getElementById('old')!.focus();

    const scope = createFocusScope();
    scope.capture();
    outlet.remove();

    expect(scope.restore()).toBe('none');
  });
});

describe('createFocusScope — X-6 case 3: the overlay was nested', () => {
  it('★ lands in the surface underneath when the scope that held the opener is gone', () => {
    // A popover opened from a button inside a drawer, and the drawer is torn
    // down first. The popover's opener is in a portal that no longer exists,
    // so its parent chain leads nowhere — but there is still a surface on
    // screen, and the stack is the only thing that knows which one.
    const beneath = document.createElement('div');
    beneath.innerHTML = '<button id="in-drawer">still here</button>';
    document.body.appendChild(beneath);

    const portal = document.createElement('div');
    portal.innerHTML = '<button id="opener">opens the popover</button>';
    document.body.appendChild(portal);
    document.getElementById('opener')!.focus();

    const scope = createFocusScope({ below: () => beneath });
    scope.capture();
    portal.remove();

    expect(scope.restore()).toBe('below');
    expect(document.activeElement).toBe(document.getElementById('in-drawer'));
    beneath.remove();
  });

  it('prefers the opener over the surface below while the opener survives', () => {
    const beneath = document.createElement('div');
    beneath.innerHTML = '<button id="deep">deeper</button>';
    document.body.appendChild(beneath);
    mount('<button id="t">trigger</button>');
    const trigger = document.getElementById('t')!;
    trigger.focus();

    const scope = createFocusScope({ below: () => beneath });
    scope.capture();

    expect(scope.restore()).toBe('opener');
    expect(document.activeElement).toBe(trigger);
    beneath.remove();
  });
});

describe('createFocusScope — the bug the other families "fixed" by restoring anyway', () => {
  it('★ leaves focus alone when the user has already moved it somewhere else', () => {
    // An outside click that lands on another control closes the overlay AND
    // focuses that control. Restoring unconditionally yanks focus off the
    // thing the user just clicked, one frame after they clicked it.
    mount('<button id="t">trigger</button><input id="other" />');
    const trigger = document.getElementById('t')!;
    const other = document.getElementById('other')!;
    trigger.focus();

    const scope = createFocusScope();
    scope.capture();
    other.focus(); // the outside click

    expect(scope.restore()).toBe('moved');
    expect(document.activeElement).toBe(other);
  });

  it('still restores when focus is inside the overlay itself', () => {
    mount('<button id="t">trigger</button><div id="panel"><button id="ok">ok</button></div>');
    const trigger = document.getElementById('t')!;
    trigger.focus();

    const scope = createFocusScope({ within: () => document.getElementById('panel') });
    scope.capture();
    document.getElementById('ok')!.focus(); // focus is in the panel, as it should be

    expect(scope.restore()).toBe('opener');
    expect(document.activeElement).toBe(trigger);
  });

  it('is idempotent — a second restore does not move focus again', () => {
    mount('<button id="t">trigger</button><button id="other">other</button>');
    const trigger = document.getElementById('t')!;
    trigger.focus();

    const scope = createFocusScope();
    scope.capture();
    (document.activeElement as HTMLElement | null)?.blur(); // focus falls to <body>
    expect(scope.restore()).toBe('opener');

    document.getElementById('other')!.focus();
    expect(scope.restore()).toBe('moved');
    expect(document.activeElement).toBe(document.getElementById('other'));
  });
});

describe('createFocusScope — an opener the surface already knows', () => {
  it('★ prefers the declared trigger over whatever happened to have focus', () => {
    // Safari does not focus a button on click. A menu that captured
    // `activeElement` would record the trigger on two engines and `<body>` on
    // the third, and restore correctly only where the browser cooperated.
    mount('<button id="trigger">menu</button><div id="elsewhere" tabindex="0"></div>');
    const trigger = document.getElementById('trigger')!;
    document.getElementById('elsewhere')!.focus(); // not the trigger

    const scope = createFocusScope({ opener: () => trigger });
    scope.capture();
    (document.activeElement as HTMLElement).blur();

    expect(scope.restore()).toBe('opener');
    expect(document.activeElement).toBe(trigger);
  });

  it('falls back to the focused element when the declared opener is not there yet', () => {
    mount('<button id="t">t</button>');
    const t = document.getElementById('t')!;
    t.focus();

    const scope = createFocusScope({ opener: () => null });
    scope.capture();
    (document.activeElement as HTMLElement).blur();

    expect(scope.restore()).toBe('opener');
    expect(document.activeElement).toBe(t);
  });
});

describe('createFocusScope — a region that is being emptied', () => {
  it('★ walks past the wrapper that survives but has nothing left in it', () => {
    // The in-place case: a banner dismissing itself keeps its host element and
    // removes only the content inside it. Without `skip` the nearest surviving
    // ancestor IS that empty wrapper, and focusing it announces nothing.
    mount(`
      <div id="region">
        <button id="outside">Outside</button>
        <div id="banner"><button id="dismiss">×</button></div>
      </div>
    `);
    const banner = document.getElementById('banner')!;
    document.getElementById('dismiss')!.focus();

    const scope = createFocusScope({ skip: () => banner });
    scope.capture();
    banner.innerHTML = '';          // the content goes, the wrapper stays

    expect(scope.restore()).toBe('neighbour');
    expect(document.activeElement).toBe(document.getElementById('outside'));
    expect(banner.hasAttribute('tabindex')).toBe(false);
  });

  it('without skip, the empty wrapper is what the walk finds', () => {
    // Recorded rather than asserted as desirable: it is why `skip` exists.
    mount(`
      <div id="region2">
        <button id="outside2">Outside</button>
        <div id="banner2"><button id="dismiss2">×</button></div>
      </div>
    `);
    const banner = document.getElementById('banner2')!;
    document.getElementById('dismiss2')!.focus();

    const scope = createFocusScope();
    scope.capture();
    banner.innerHTML = '';

    expect(scope.restore()).toBe('neighbour');
    expect(document.activeElement).toBe(banner);
  });
});

describe('createFocusScope — the no-op that has to be a real no-op', () => {
  it('★ does not re-focus the element that already has focus', () => {
    // An auto-dismissing banner closes while the user is typing in a field
    // elsewhere. Restoring "to the opener" is correct and must be free:
    // re-focusing a focused input can interrupt an IME composition and reset
    // its scroll position.
    mount('<input id="typing" />');
    const input = document.getElementById('typing') as HTMLInputElement;
    input.focus();

    const scope = createFocusScope();
    scope.capture();

    const spy = vi.spyOn(input, 'focus');
    expect(scope.restore()).toBe('opener');
    expect(spy).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
    spy.mockRestore();
  });

  it('still focuses the opener when focus has since gone nowhere', () => {
    mount('<button id="t">t</button>');
    const t = document.getElementById('t')!;
    t.focus();

    const scope = createFocusScope();
    scope.capture();
    t.blur();

    const spy = vi.spyOn(t, 'focus');
    expect(scope.restore()).toBe('opener');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
