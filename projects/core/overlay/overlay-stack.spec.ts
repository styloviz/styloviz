import { TestBed } from '@angular/core/testing';
import { SvOverlayStackService } from './overlay-stack';

/**
 * The stack answers exactly two questions — what z-index am I, and do I own
 * Escape. Everything here is about the second one, because that is the one a
 * component gets wrong on its own.
 */
const stack = () => {
  TestBed.resetTestingModule();
  return TestBed.inject(SvOverlayStackService);
};

describe('SvOverlayStackService — who owns Escape', () => {
  it('gives ownership to the only surface open', () => {
    const s = stack();
    const a = s.push('sheet');
    expect(a.isTopmost()).toBe(true);
  });

  it('★ moves ownership to the surface opened last, and back when it closes', () => {
    // ★ THE SHIPPED DEFECT. Two drawers, one `document` Escape listener each,
    //   both gated only on their own `open()` — so one keystroke closed both.
    const s = stack();
    const first = s.push('sheet');
    const second = s.push('sheet');

    expect(first.isTopmost()).toBe(false);
    expect(second.isTopmost()).toBe(true);

    second.release();
    expect(first.isTopmost()).toBe(true);
  });

  it('★★ ranks by push order, NOT by layer — a popover inside a modal owns Escape', () => {
    // ★★ The commonest nesting there is, and the case a layer-ranked rule gets
    //    backwards: a select opened inside a dialog. Escape must close the
    //    select and leave the dialog up, or a half-finished form disappears.
    const s = stack();
    const modal = s.push('modal');
    const popover = s.push('anchored'); // a LOWER layer, opened later

    expect(popover.isTopmost()).toBe(true);
    expect(modal.isTopmost()).toBe(false);

    popover.release();
    expect(modal.isTopmost()).toBe(true);
  });

  it('★★ skips non-dismissible surfaces, so a toast cannot take Escape from a dialog', () => {
    // A toast paints ABOVE the modal and must never own its keystroke.
    const s = stack();
    const modal = s.push('modal');
    const toast = s.push('toast', { dismissible: false });

    expect(modal.isTopmost()).toBe(true);
    expect(toast.isTopmost()).toBe(false);
  });

  it('leaves nobody owning Escape when only non-dismissible surfaces are open', () => {
    const s = stack();
    const tip = s.push('tooltip', { dismissible: false });
    expect(tip.isTopmost()).toBe(false);
  });

  it('releases out of order without disturbing the rest', () => {
    // Overlays do not close in the order they opened — a route change can tear
    // down the one underneath first.
    const s = stack();
    const a = s.push('anchored');
    const b = s.push('anchored');
    const c = s.push('anchored');

    b.release(); // the middle one
    expect(c.isTopmost()).toBe(true);
    expect(a.isTopmost()).toBe(false);

    c.release();
    expect(a.isTopmost()).toBe(true);
  });

  it('treats release as idempotent', () => {
    // `ngOnDestroy` after an explicit close is the normal path, not an error.
    const s = stack();
    const a = s.push('modal');
    const b = s.push('modal');
    b.release();
    b.release();
    expect(s.size).toBe(1);
    expect(a.isTopmost()).toBe(true);
  });
});

describe('SvOverlayStackService — z-index', () => {
  it('puts the ambient bands above every interactive surface', () => {
    const s = stack();
    const anchored = s.push('anchored');
    const sheet    = s.push('sheet');
    const modal    = s.push('modal');
    const toast    = s.push('toast', { dismissible: false });
    const tooltip  = s.push('tooltip', { dismissible: false });

    expect(anchored.zIndex).toBeLessThan(sheet.zIndex);
    expect(sheet.zIndex).toBeLessThan(modal.zIndex);
    expect(modal.zIndex).toBeLessThan(toast.zIndex);
    expect(toast.zIndex).toBeLessThan(tooltip.zIndex);
  });

  it('separates two surfaces in the same band', () => {
    const s = stack();
    const first = s.push('anchored');
    const second = s.push('anchored');
    expect(second.zIndex).toBeGreaterThan(first.zIndex);
  });

  it('★ leaves each surface room to paint more than one element', () => {
    // ★ A drawer is a backdrop AND a panel: the panel must sit above its own
    //   backdrop but BELOW the next drawer's backdrop. One number per surface
    //   cannot express that, so each owns a small band and paints its panel at
    //   `zIndex + 1`. Without the gap, drawer B's backdrop would land on
    //   drawer A's panel and the two would swap depending on DOM order.
    const s = stack();
    const first = s.push('sheet');
    const second = s.push('sheet');

    expect(first.zIndex + 1).toBeLessThan(second.zIndex);
  });

  it('★★★ a surface opened later paints above one from a HIGHER band', () => {
    // ★★★ THE REGRESSION THIS FILE EXISTS TO PREVENT. A popover (`anchored`,
    //     floor 1000) opened from inside a drawer (`sheet`, floor 2000) must
    //     paint ABOVE the drawer. Treating the band as the assignment rather
    //     than a floor put it at 1000 and rendered it BEHIND the drawer that
    //     opened it — which a DOM probe caught before it shipped.
    const s = stack();
    const drawer = s.push('sheet');
    const popover = s.push('anchored');
    expect(popover.zIndex).toBeGreaterThan(drawer.zIndex);
  });

  it('★★★ an ambient surface raised EARLIER still clears what opens later', () => {
    // ★★★ The other half, and the reason toast and tooltip are exempt from push
    //     order rather than merely given a high starting point. A toast shown
    //     before a dialog opens must still be readable over it — the dialog
    //     cannot bury the notification by opening second. Push order gives
    //     precisely the wrong answer here, which is why the two kinds of
    //     surface are assigned by different rules.
    const s = stack();
    const toast = s.push('toast', { dismissible: false });
    const modal = s.push('modal');
    expect(toast.zIndex).toBeGreaterThan(modal.zIndex);
  });

  it('separates two ambient surfaces of the same kind', () => {
    const s = stack();
    const a = s.push('toast', { dismissible: false });
    const b = s.push('toast', { dismissible: false });
    expect(b.zIndex).toBeGreaterThan(a.zIndex);
  });

  it('★ never reuses a z-index a live surface still holds', () => {
    // ★ The ordinal only grows. Restarting it on release would let a newly
    //   opened panel land on the value of one still on screen, and which of the
    //   two paints on top then depends on DOM order — i.e. on nothing the
    //   component controls.
    const s = stack();
    const a = s.push('anchored');
    const b = s.push('anchored');
    b.release();
    const c = s.push('anchored');

    expect(c.zIndex).not.toBe(a.zIndex);
    expect(c.zIndex).toBeGreaterThan(a.zIndex);
  });

  it('keeps a surface at one z-index for its whole life', () => {
    // Re-reading must not renumber it; a panel that changes z-index while open
    // flickers above and below its neighbours.
    const s = stack();
    const a = s.push('modal');
    const before = a.zIndex;
    s.push('modal');
    s.push('anchored');
    expect(a.zIndex).toBe(before);
  });
});

describe('SvOverlayStackService — outside-click routing', () => {
  /** A detached element stands in for a portalled panel. */
  const panel = (): HTMLElement => {
    const el = document.createElement('div');
    el.appendChild(document.createElement('button'));
    document.body.appendChild(el);
    return el;
  };

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('★★★ sees a click inside a surface opened ABOVE this one', () => {
    // ★★★ The whole point. A select opened from inside a popover is portalled
    //     to `<body>`, so it is inside neither the popover's trigger nor its
    //     panel — clicking one of its options read as an OUTSIDE click and
    //     closed the popover under the user. Local containment cannot see the
    //     nesting, because the nesting is a fact about the stack.
    const s = stack();
    const parentEl = panel();
    const childEl = panel();
    const parent = s.push('anchored', { element: () => parentEl });
    s.push('anchored', { element: () => childEl });

    expect(parent.isInsideHigherSurface(childEl.firstChild!)).toBe(true);
  });

  it('does NOT count a click inside a surface opened BELOW it', () => {
    // The parent must still close when the user clicks the page behind it —
    // including on an older, lower overlay.
    const s = stack();
    const lowerEl = panel();
    const upperEl = panel();
    s.push('anchored', { element: () => lowerEl });
    const upper = s.push('anchored', { element: () => upperEl });

    expect(upper.isInsideHigherSurface(lowerEl.firstChild!)).toBe(false);
  });

  it('does not count a click on unrelated page content', () => {
    const s = stack();
    const parentEl = panel();
    const elsewhere = panel();
    const parent = s.push('anchored', { element: () => parentEl });

    expect(parent.isInsideHigherSurface(elsewhere.firstChild!)).toBe(false);
  });

  it('★ is a getter, so a panel portalled AFTER push still counts', () => {
    // ★ The reason the option is `() => Element` rather than `Element`. At
    //   `push()` time the panel usually does not exist — it is portalled a tick
    //   later, and for some families not until an animation frame. Capturing
    //   the node at registration would capture `null` forever and this feature
    //   would silently never fire.
    const s = stack();
    const parentEl = panel();
    const parent = s.push('anchored', { element: () => parentEl });

    let lateEl: HTMLElement | null = null;
    s.push('anchored', { element: () => lateEl });

    expect(parent.isInsideHigherSurface(parentEl)).toBe(false);
    lateEl = panel(); // portalled now
    expect(parent.isInsideHigherSurface(lateEl.firstChild!)).toBe(true);
  });

  it('ignores a released surface', () => {
    const s = stack();
    const parentEl = panel();
    const childEl = panel();
    const parent = s.push('anchored', { element: () => parentEl });
    const child = s.push('anchored', { element: () => childEl });

    child.release();
    expect(parent.isInsideHigherSurface(childEl.firstChild!)).toBe(false);
  });

  it('answers false for a surface that registered no element', () => {
    // Registering an element is optional — a surface with no panel of its own
    // still stacks and still owns Escape.
    const s = stack();
    const parentEl = panel();
    const parent = s.push('anchored', { element: () => parentEl });
    s.push('modal');
    expect(parent.isInsideHigherSurface(document.body)).toBe(false);
  });
});

describe('SvOverlayStackService — what is underneath', () => {
  const el = (id: string) => {
    const d = document.createElement('div');
    d.id = id;
    d.innerHTML = '<button>x</button>';
    document.body.appendChild(d);
    return d;
  };
  afterEach(() => document.querySelectorAll('div[id^="surface"]').forEach((n) => n.remove()));

  it('reports nothing below the first surface', () => {
    const s = stack();
    const only = s.push('modal', { element: () => el('surface-a') });
    expect(only.surfaceBelow()).toBeNull();
  });

  it('★ reports the surface a nested one was opened from', () => {
    // Both are portalled to <body> as siblings, so the DOM records nothing
    // about the nesting. Push order is the only witness there is.
    const s = stack();
    const drawer = el('surface-drawer');
    s.push('sheet', { element: () => drawer });
    const popover = s.push('anchored', { element: () => el('surface-popover') });

    expect(popover.surfaceBelow()).toBe(drawer);
  });

  it('skips surfaces that never rendered a root rather than stopping at one', () => {
    const s = stack();
    const drawer = el('surface-drawer');
    s.push('sheet', { element: () => drawer });
    s.push('modal'); // no element getter — invisible to every stack query
    const top = s.push('anchored', { element: () => el('surface-top') });

    expect(top.surfaceBelow()).toBe(drawer);
  });

  it('skips a surface whose root has already left the document', () => {
    const s = stack();
    const outer = el('surface-outer');
    const torn = el('surface-torn');
    s.push('sheet', { element: () => outer });
    s.push('sheet', { element: () => torn });
    const top = s.push('anchored', { element: () => el('surface-top2') });

    torn.remove();
    expect(top.surfaceBelow()).toBe(outer);
  });
});

describe('SvOverlayStackService — inertness (X-5, the other half)', () => {
  /**
   * ★★★ `aria-modal="true"` OVER A FOCUSABLE PAGE IS A LIE, and the kit was
   *     telling it in several places: four tour variants and several dialogs
   *     asserted it while every control behind them stayed tabbable and stayed
   *     in the accessibility tree. `aria-modal` is a CLAIM about the rest of
   *     the document; `inert` is what makes the claim true.
   *
   * ★★ And it cannot be done per component. "What must be inert" is a fact
   *    about every open surface at once — the page behind the modal, yes; the
   *    drawer it was opened from, no; the select it opens itself, no — and no
   *    single component can see that set. Two of them doing it locally do not
   *    converge, they fight.
   */
  let page: HTMLElement;
  let portal: HTMLElement;

  beforeEach(() => {
    page = document.createElement('div');
    page.id = 'app-root';
    page.innerHTML = '<button>behind</button>';
    document.body.appendChild(page);
    portal = document.createElement('div');
    portal.id = 'portal';
    portal.innerHTML = '<button>in the dialog</button>';
    document.body.appendChild(portal);
  });

  afterEach(() => {
    page.remove();
    portal.remove();
    document.querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert'));
  });

  it('★ makes the page inert while a blocking surface is open, and only the page', () => {
    const s = stack();
    const dialog = s.push('modal', { blocking: true, element: () => portal });

    expect(page.hasAttribute('inert')).toBe(true);
    expect(portal.hasAttribute('inert')).toBe(false);

    dialog.release();
    expect(page.hasAttribute('inert')).toBe(false);
  });

  it('does nothing for a non-blocking surface — a popover does not switch the page off', () => {
    const s = stack();
    const popover = s.push('anchored', { element: () => portal });
    expect(page.hasAttribute('inert')).toBe(false);
    popover.release();
  });

  it('★ leaves a surface opened FROM the modal interactive', () => {
    // A select inside a dialog is portalled to <body> as a SIBLING of the
    // dialog, so it is part of neither — and marking it inert would make the
    // dialog's own controls unusable.
    const s = stack();
    const dialog = s.push('modal', { blocking: true, element: () => portal });

    const child = document.createElement('div');
    child.innerHTML = '<button>an option</button>';
    document.body.appendChild(child);
    const select = s.push('anchored', { element: () => child });

    expect(child.hasAttribute('inert')).toBe(false);
    expect(page.hasAttribute('inert')).toBe(true);

    select.release();
    dialog.release();
    child.remove();
  });

  it('★ keeps the page inert until the LAST blocking surface closes', () => {
    const s = stack();
    const outer = s.push('modal', { blocking: true, element: () => portal });
    const inner = s.push('modal', { blocking: true, element: () => portal });

    inner.release();
    expect(page.hasAttribute('inert')).toBe(true);   // the outer one is still up

    outer.release();
    expect(page.hasAttribute('inert')).toBe(false);
  });

  it('does not remove an `inert` it did not set', () => {
    // A consumer's own collapsed region. Taking their attribute off when a
    // dialog closes hands them a bug they cannot explain.
    page.setAttribute('inert', '');
    const s = stack();
    const dialog = s.push('modal', { blocking: true, element: () => portal });
    dialog.release();

    expect(page.hasAttribute('inert')).toBe(true);
  });

  it('★ an overlay portalled a tick AFTER the pass is never marked', () => {
    // This is what the deleted `syncInert()` hook was written for, and why it
    // was not needed: the pass marks a SNAPSHOT of `body.children`, so a
    // portal that arrives afterwards is outside it by construction.
    const s = stack();
    const late = document.createElement('div');
    const dialog = s.push('modal', { blocking: true, element: () => late });
    expect(page.hasAttribute('inert')).toBe(true);

    late.innerHTML = '<button>late</button>';
    document.body.appendChild(late);

    expect(late.hasAttribute('inert')).toBe(false);
    expect(page.hasAttribute('inert')).toBe(true);
    dialog.release();
    late.remove();
  });
});
