import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core';
import { SvTooltipComponent } from './tooltip.component';

/**
 * `OF-20-I4` / `OF-20-M4` — the tooltip over a control the browser has
 * disabled.
 *
 * ★★★ IT IS THE ONE TOOLTIP THAT COULD NEVER APPEAR, AND THE ONE USERS MOST
 *     NEED. A disabled form control fires no pointer events — the browser does
 *     not dispatch mouse events whose target is one, so nothing reaches the
 *     wrapper either — and it is out of the tab order, so there is no keyboard
 *     path to the explanation of why it cannot be pressed.
 *
 * ★★ WHAT JSDOM CAN AND CANNOT SHOW. It has no layout and no hit-testing, so
 *    `mouseenter` here is whatever the test dispatches and would "work"
 *    without the fix; what the fix actually consists of — `pointer-events:
 *    none` on the projected content, and a tab stop on the wrapper — IS
 *    assertable, and that is what these tests assert. The pointer-events
 *    class is not decoration: it is the line that takes the dead control out
 *    of hit-testing so the wrapper receives the hover.
 *
 * ★ The preferable fix is `aria-disabled="true"` instead of `disabled`, which
 *   needs none of this; the preset is for markup you do not control. The dev
 *   warning below is what keeps it from being used as a default.
 */

const POINTER_OFF = '[&>*]:pointer-events-none';

async function setup(template: string) {
  TestBed.resetTestingModule();
  svResetWarnOnce();
  const view = await render(template, { imports: [SvTooltipComponent] });
  const wrap = (view.fixture.nativeElement as HTMLElement)
    .querySelector('.relative') as HTMLElement;
  return { ...view, wrap };
}

function enter(wrap: HTMLElement) {
  wrap.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
}

describe('SvTooltipComponent — over a disabled control', () => {
  it('changes nothing when the preset is off', async () => {
    const { wrap } = await setup(
      `<sv-tooltip text="Requires admin"><button disabled>Delete</button></sv-tooltip>`,
    );
    expect(wrap.getAttribute('tabindex')).toBeNull();
    expect(wrap.className).not.toContain(POINTER_OFF);
  });

  it('★ takes the dead control out of hit-testing so the wrapper gets the hover', async () => {
    const { wrap } = await setup(
      `<sv-tooltip text="Requires admin" [forDisabledControl]="true">
         <button disabled>Delete</button>
       </sv-tooltip>`,
    );
    expect(wrap.className).toContain(POINTER_OFF);
  });

  it('★ gives the explanation a tab stop, since the control has none', async () => {
    const { wrap, fixture } = await setup(
      `<sv-tooltip text="Requires admin" [forDisabledControl]="true">
         <button disabled>Delete</button>
       </sv-tooltip>`,
    );
    expect(wrap.getAttribute('tabindex')).toBe('0');

    wrap.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();
    expect(wrap.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(wrap.getAttribute('aria-describedby')!)?.textContent?.trim())
      .toBe('Requires admin');
  });

  it('keeps the wrapper out of the tab order when the preset is off', async () => {
    const { wrap } = await setup(
      `<sv-tooltip text="Saved"><button>Save</button></sv-tooltip>`,
    );
    expect(wrap.getAttribute('tabindex')).toBeNull();
  });
});

describe('SvTooltipComponent — the dev warning behind the preset', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  const messages = () =>
    warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.startsWith('[styloviz]'));

  it('says nothing about a natively disabled control', async () => {
    const { wrap } = await setup(
      `<sv-tooltip text="Requires admin" [forDisabledControl]="true">
         <button disabled>Delete</button>
       </sv-tooltip>`,
    );
    enter(wrap);
    expect(messages()).toEqual([]);
  });

  it('says nothing about an aria-disabled control', async () => {
    const { wrap } = await setup(
      `<sv-tooltip text="Requires admin" [forDisabledControl]="true">
         <button aria-disabled="true">Delete</button>
       </sv-tooltip>`,
    );
    enter(wrap);
    expect(messages()).toEqual([]);
  });

  it('says nothing when the disabled control is nested inside the projected content', async () => {
    const { wrap } = await setup(
      `<sv-tooltip text="Requires admin" [forDisabledControl]="true">
         <span class="inline-flex"><button disabled>Delete</button></span>
       </sv-tooltip>`,
    );
    enter(wrap);
    expect(messages()).toEqual([]);
  });

  it('★ warns when the preset is wrapping a live control, whose clicks it just ate', async () => {
    const { wrap } = await setup(
      `<sv-tooltip text="Delete this" [forDisabledControl]="true">
         <button>Delete</button>
       </sv-tooltip>`,
    );
    enter(wrap);
    expect(messages().join('\n')).toContain('is wrapping content that is not disabled');
  });

  it('warns for content that is not a control at all', async () => {
    // A span cannot be disabled, so it never needed the preset — and the
    // preset has still taken pointer events away from it.
    const { wrap } = await setup(
      `<sv-tooltip text="Some help" [forDisabledControl]="true">
         <span>Hover me</span>
       </sv-tooltip>`,
    );
    enter(wrap);
    expect(messages().join('\n')).toContain('not disabled');
  });

  it('says nothing when the preset is off, whatever is projected', async () => {
    const { wrap } = await setup(
      `<sv-tooltip text="Delete this"><button>Delete</button></sv-tooltip>`,
    );
    enter(wrap);
    expect(messages()).toEqual([]);
  });

  it('says nothing when there is nothing projected at all', async () => {
    // An empty trigger is its own mistake, not this preset's, and "content is
    // not disabled" would be a misleading thing to say about no content.
    const { wrap } = await setup(
      `<sv-tooltip text="Some help" [forDisabledControl]="true"></sv-tooltip>`,
    );
    enter(wrap);
    expect(messages()).toEqual([]);
  });

  it('warns once, not on every hover', async () => {
    const { wrap } = await setup(
      `<sv-tooltip text="Delete this" [forDisabledControl]="true">
         <button>Delete</button>
       </sv-tooltip>`,
    );
    enter(wrap);
    enter(wrap);
    enter(wrap);
    expect(messages().length).toBe(1);
  });
});
