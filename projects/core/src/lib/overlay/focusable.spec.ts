import { SV_FOCUSABLE_SELECTOR, svFirstFocusableWithin, svFocusableWithin, svIsFocusable } from './focusable';

let root: HTMLElement;
function mount(html: string): HTMLElement {
  root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}
afterEach(() => root?.remove());

describe('svFocusableWithin — the divergences that made ten copies wrong', () => {
  it('★ excludes disabled controls, which is what a trap must never nominate', () => {
    // Three of the shipped copies matched bare `input, select, textarea`. A
    // trap whose "first focusable" is disabled calls `focus()` on it, gets
    // nothing, and leaks on the next Tab — with no error anywhere.
    mount(`
      <input id="off" disabled />
      <textarea id="off2" disabled></textarea>
      <button id="on">go</button>
    `);
    expect(svFocusableWithin(root).map((el) => el.id)).toEqual(['on']);
  });

  it('★ the exported selector excludes disabled controls on its own', () => {
    // `svIsFocusable` filters disabled controls out anyway, so a test that
    // only goes through the helpers passes whether or not the SELECTOR is
    // right — and the selector is the part that gets used raw, as all ten
    // copies it replaces were. Assert the constant directly or this guard is
    // decorative: removing `:not([disabled])` left every other test green.
    mount(`
      <button id="b" disabled>b</button>
      <input id="i" disabled />
      <select id="s" disabled></select>
      <textarea id="t" disabled></textarea>
    `);
    for (const id of ['b', 'i', 's', 't']) {
      expect(document.getElementById(id)!.matches(SV_FOCUSABLE_SELECTOR)).toBe(false);
    }
  });

  it('excludes hidden, inert and aria-hidden subtrees', () => {
    mount(`
      <button id="a">a</button>
      <button id="b" hidden>b</button>
      <div inert><button id="c">c</button></div>
      <div aria-hidden="true"><button id="d">d</button></div>
    `);
    expect(svFocusableWithin(root).map((el) => el.id)).toEqual(['a']);
  });

  it('counts contenteditable and positive tabindex, and skips tabindex="-1"', () => {
    mount(`
      <div id="edit" contenteditable="true"></div>
      <div id="no" contenteditable="false"></div>
      <div id="prog" tabindex="-1"></div>
      <div id="tab" tabindex="0"></div>
    `);
    expect(svFocusableWithin(root).map((el) => el.id)).toEqual(['edit', 'tab']);
  });

  it('returns them in tab order, and `first` is the first of them', () => {
    mount('<button id="one">1</button><a id="two" href="#">2</a><input id="three" />');
    expect(svFocusableWithin(root).map((el) => el.id)).toEqual(['one', 'two', 'three']);
    expect(svFirstFocusableWithin(root)?.id).toBe('one');
  });

  it('★ is not a layout test — jsdom reports every element as unrendered', () => {
    // A `getClientRects()` or `offsetParent` filter looks more correct and
    // would make every helper here return nothing under test while passing in
    // a browser. A guard that only works where it is never exercised is not a
    // guard.
    mount('<button id="a">a</button>');
    expect(root.querySelector('button')!.getClientRects().length).toBe(0);
    expect(svFocusableWithin(root)).toHaveLength(1);
  });

  it('svIsFocusable rejects a detached element', () => {
    const orphan = document.createElement('button');
    expect(orphan.matches(SV_FOCUSABLE_SELECTOR)).toBe(true);
    expect(svIsFocusable(orphan)).toBe(false);
  });

  it('tolerates a null root instead of throwing at the call site', () => {
    expect(svFocusableWithin(null)).toEqual([]);
    expect(svFirstFocusableWithin(undefined)).toBeNull();
  });
});
