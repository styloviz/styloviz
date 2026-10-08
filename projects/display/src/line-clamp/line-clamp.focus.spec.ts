import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvLineClampComponent } from './line-clamp.component';

/**
 * What happens to things the clamp cut off but did not remove.
 *
 * ★ `-webkit-line-clamp` CLIPS. A link on line eight of a three-line clamp is
 * still in the tab order, still focusable, and drawn nowhere the user can see —
 * so tabbing through the page appears to swallow focus. jsdom has no layout, so
 * the geometry is supplied explicitly below; the decision under test is the
 * component's, not the browser's.
 */

const LINK = '<a href="#deep" id="deep">Read the full policy</a>';

async function setup(attrs = '', content = `Some text ${LINK}`) {
  TestBed.resetTestingModule();
  const view = await render(`<sv-line-clamp ${attrs}>${content}</sv-line-clamp>`, {
    imports: [SvLineClampComponent],
  });
  const debug = view.fixture.debugElement.children[0];
  return { ...view, clamp: debug.componentInstance as SvLineClampComponent };
}

type View = Awaited<ReturnType<typeof setup>>;
const el = (v: View) => v.fixture.nativeElement as HTMLElement;
const box = (v: View) => el(v).querySelector('.sv-clamp-content') as HTMLElement;
const link = (v: View) => el(v).querySelector('#deep') as HTMLAnchorElement;

/** jsdom reports every rect as zero, so the clamp line is stated outright. */
function geometry(v: View, opts: { boxBottom: number; targetBottom: number }) {
  box(v).getBoundingClientRect = () => ({ bottom: opts.boxBottom }) as DOMRect;
  link(v).getBoundingClientRect = () => ({ bottom: opts.targetBottom }) as DOMRect;
}

async function settle(v: View) {
  await new Promise((r) => setTimeout(r, 0));
  v.clamp.isClamped.set(true);
  v.fixture.detectChanges();
}

describe('SvLineClampComponent — focus reaching what the clamp cut off', () => {
  it('opens the block when focus lands below the clamp line', async () => {
    const v = await setup();
    await settle(v);
    geometry(v, { boxBottom: 60, targetBottom: 180 });

    link(v).focus();
    v.fixture.detectChanges();

    expect(v.clamp.expanded()).toBe(true);
  });

  it('leaves a visible link alone', async () => {
    const v = await setup();
    await settle(v);
    // Line one. Expanding the block under the reader because they tabbed to
    // something they can already see would be the component moving the page
    // for no reason.
    geometry(v, { boxBottom: 60, targetBottom: 20 });

    link(v).focus();
    v.fixture.detectChanges();

    expect(v.clamp.expanded()).toBe(false);
  });

  it('collapses again when focus leaves', async () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const v = await setup();
    await settle(v);
    geometry(v, { boxBottom: 60, targetBottom: 180 });

    link(v).focus();
    v.fixture.detectChanges();
    expect(v.clamp.expanded()).toBe(true);

    outside.focus();
    v.fixture.detectChanges();
    // The block was borrowed by focus, not opened by the reader.
    expect(v.clamp.expanded()).toBe(false);
    outside.remove();
  });

  it('keeps an expansion the reader asked for', async () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const v = await setup();
    await settle(v);
    geometry(v, { boxBottom: 60, targetBottom: 180 });

    link(v).focus();
    v.fixture.detectChanges();
    // ★ Pressing the toggle moves focus out of the TEXT but not out of the
    // component. A box-scoped focusout check collapsed the block a beat before
    // `toggle()` ran and then re-opened it — the reader pressed "Show less" and
    // it stayed open.
    await userEvent.click(el(v).querySelector('.sv-clamp-toggle') as HTMLElement);
    v.fixture.detectChanges();
    expect(v.clamp.expanded()).toBe(false);

    // Open it deliberately this time.
    await userEvent.click(el(v).querySelector('.sv-clamp-toggle') as HTMLElement);
    v.fixture.detectChanges();
    expect(v.clamp.expanded()).toBe(true);

    outside.focus();
    v.fixture.detectChanges();
    // An explicit press takes ownership — focus leaving must not undo it.
    expect(v.clamp.expanded()).toBe(true);
    outside.remove();
  });

  it('does nothing when the host has turned it off', async () => {
    const v = await setup('[expandOnFocus]="false"');
    await settle(v);
    geometry(v, { boxBottom: 60, targetBottom: 180 });

    link(v).focus();
    v.fixture.detectChanges();

    expect(v.clamp.expanded()).toBe(false);
  });
});

describe('SvLineClampComponent — printing', () => {
  it('unclamps on paper and hides the affordances', async () => {
    const v = await setup();
    await settle(v);
    const css = Array.from(document.styleSheets)
      .flatMap((sheet) => {
        try { return Array.from(sheet.cssRules).map((r) => r.cssText); } catch { return []; }
      })
      .join('\n');

    // ★ Paper has no "Show more". A clamped block used to print exactly as it
    // looked — three lines and a fade — and a printed clause that stops
    // mid-sentence is indistinguishable from one that ended there.
    expect(css).toContain('@media print');
    expect(css).toMatch(/-webkit-line-clamp:\s*unset\s*!important/);
    expect(css).toMatch(/sv-clamp-fade/);
    expect(css).toMatch(/sv-clamp-toggle/);
  });
});
