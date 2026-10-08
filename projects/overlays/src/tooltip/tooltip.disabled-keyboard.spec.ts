import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvTooltipComponent } from './tooltip.component';

/**
 * `OF-20-I4` / `OF-20-M4` — the keyboard half of the disabled-control preset,
 * re-checked 2026-09-29.
 *
 * ★★ The preset gave the wrapper a tab stop, but two things still kept the
 *    explanation from a keyboard user:
 *    • `aria-describedby` was written on SHOW, i.e. after focus had landed on
 *      the wrapper — and a description that arrives after focus is one a
 *      screen reader does not read. Under the preset it is present from the
 *      start.
 *    • a `trigger="click"` tooltip opens from a click, and a `<div>` wrapper
 *      synthesises no click from Enter or Space. Reaching the tab stop did not
 *      open anything.
 */

async function setup(template: string) {
  TestBed.resetTestingModule();
  const view = await render(template, { imports: [SvTooltipComponent] });
  const wrap = (view.fixture.nativeElement as HTMLElement).querySelector('.relative') as HTMLElement;
  const bubble = (view.fixture.nativeElement as HTMLElement).querySelector('[role="tooltip"]') as HTMLElement;
  return { ...view, wrap, bubble };
}

const key = (el: Element, k: 'Enter' | ' ') =>
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

describe('SvTooltipComponent [forDisabledControl] — the keyboard path', () => {
  it('★ is described by the tooltip before anything is shown', async () => {
    const { wrap, bubble } = await setup(
      `<sv-tooltip text="Only admins can delete" [forDisabledControl]="true"><button disabled>Delete</button></sv-tooltip>`,
    );
    expect(wrap.getAttribute('tabindex')).toBe('0');
    expect(wrap.getAttribute('aria-describedby')).toBe(bubble.id);
  });

  it('writes no description while hidden when the preset is off (unchanged)', async () => {
    const { wrap } = await setup(`<sv-tooltip text="Save"><button>Save</button></sv-tooltip>`);
    expect(wrap.getAttribute('aria-describedby')).toBeNull();
  });

  it('★ toggles a click tooltip on Enter and Space pressed on the wrapper', async () => {
    const { wrap, bubble, fixture } = await setup(
      `<sv-tooltip text="Only admins can delete" trigger="click" [forDisabledControl]="true"><button disabled>Delete</button></sv-tooltip>`,
    );
    expect(key(wrap, 'Enter')).toBe(false);
    fixture.detectChanges();
    expect(bubble.getAttribute('aria-hidden')).toBe('false');

    key(wrap, ' ');
    fixture.detectChanges();
    expect(bubble.getAttribute('aria-hidden')).toBe('true');
  });

  it('ignores keys that start on projected content, and keys without the preset', async () => {
    const a = await setup(
      `<sv-tooltip text="x" trigger="click" [forDisabledControl]="true"><span tabindex="-1" id="inner">i</span></sv-tooltip>`,
    );
    key(a.wrap.querySelector('#inner')!, 'Enter');
    a.fixture.detectChanges();
    expect(a.bubble.getAttribute('aria-hidden')).toBe('true');

    const b = await setup(`<sv-tooltip text="x" trigger="click"><span>i</span></sv-tooltip>`);
    expect(key(b.wrap, 'Enter')).toBe(true);
    b.fixture.detectChanges();
    expect(b.bubble.getAttribute('aria-hidden')).toBe('true');
  });
});
