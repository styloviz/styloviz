import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvButtonComponent } from './button.component';

/**
 * The parts of the button nothing was exercising: the six visual styles, the
 * disabled *anchor* (which, unlike a disabled `<button>`, still receives the
 * click and has to swallow it itself), and the four accessible-name shapes.
 */

async function setup(inputs: Partial<ComponentInput<SvButtonComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvButtonComponent, {
    inputs: inputs as ComponentInput<SvButtonComponent>,
  });
}

const host = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const control = (f: { nativeElement: unknown }) =>
  host(f).querySelector('button, a') as HTMLElement;

describe('SvButtonComponent — visual styles', () => {
  /**
   * One assertion per `btnStyle` arm. Each names a token only that arm can
   * produce, so swapping two arms in `_variantStyleClasses` fails here rather
   * than shipping a ghost button painted as a solid one.
   */
  it('paints solid with a filled background', async () => {
    const { fixture } = await setup({ label: 'A', btnStyle: 'solid', variant: 'primary' });
    expect(control(fixture).className).toContain('bg-primary-600');
  });

  it('paints outline with a border and no fill', async () => {
    const { fixture } = await setup({ label: 'A', btnStyle: 'outline', variant: 'primary' });
    const cls = control(fixture).className;
    expect(cls).toContain('border');
    expect(cls).toContain('bg-transparent');
  });

  it('paints soft with a tinted background', async () => {
    const { fixture } = await setup({ label: 'A', btnStyle: 'soft', variant: 'primary' });
    expect(control(fixture).className).toMatch(/bg-primary-(50|100)/);
  });

  it('paints ghost with no background until hover', async () => {
    const { fixture } = await setup({ label: 'A', btnStyle: 'ghost', variant: 'primary' });
    const cls = control(fixture).className;
    expect(cls).toContain('bg-transparent');
    expect(cls).toContain('hover:bg-');
  });

  it('paints link with an underline affordance', async () => {
    const { fixture } = await setup({ label: 'A', btnStyle: 'link', variant: 'primary' });
    expect(control(fixture).className).toContain('underline');
  });

  it('paints gradient with a gradient utility', async () => {
    const { fixture } = await setup({ label: 'A', btnStyle: 'gradient', variant: 'primary' });
    expect(control(fixture).className).toContain('gradient');
  });
});

describe('SvButtonComponent — elevation', () => {
  it('adds a shadow when elevated', async () => {
    const { fixture } = await setup({ label: 'A', elevated: true, btnStyle: 'solid' });
    expect(control(fixture).className).toContain('shadow-md');
  });

  /**
   * A link or a ghost has no surface to lift, so `elevated` is deliberately
   * ignored for those two styles rather than producing a floating text link.
   */
  it('ignores elevated for the two styles that have no surface', async () => {
    for (const btnStyle of ['link', 'ghost'] as const) {
      const { fixture } = await setup({ label: 'A', elevated: true, btnStyle });
      expect(control(fixture).className).not.toContain('shadow-md');
    }
  });

  it('has no shadow when not elevated', async () => {
    const { fixture } = await setup({ label: 'A', btnStyle: 'solid' });
    expect(control(fixture).className).not.toContain('shadow-md');
  });
});

describe('SvButtonComponent — block layout', () => {
  it('spans the full width in block mode instead of shrinking to content', async () => {
    // Angular normalises and sorts a `[class]` binding, so assert on tokens
    // rather than on the substring the component composed.
    const { fixture } = await setup({ label: 'A', block: true });
    const list = control(fixture).classList;
    expect(list.contains('w-full')).toBe(true);
    expect(list.contains('flex')).toBe(true);
    expect(list.contains('inline-flex')).toBe(false);
  });

  it('is inline by default', async () => {
    const { fixture } = await setup({ label: 'A' });
    const list = control(fixture).classList;
    expect(list.contains('inline-flex')).toBe(true);
    expect(list.contains('w-full')).toBe(false);
  });
});

describe('SvButtonComponent — loading label', () => {
  it('replaces the label while loading when a loadingLabel is given', async () => {
    const { fixture } = await setup({ label: 'Save', loading: true, loadingLabel: 'Saving…' });
    expect(fixture.componentInstance.displayLabel()).toBe('Saving…');
    expect(host(fixture).textContent).toContain('Saving…');
  });

  it('keeps the original label while loading when no loadingLabel is given', async () => {
    const { fixture } = await setup({ label: 'Save', loading: true });
    expect(fixture.componentInstance.displayLabel()).toBe('Save');
  });
});

describe('SvButtonComponent — accessible name', () => {
  it('is null when the button has no name and no counter', async () => {
    const { fixture } = await setup({ iconPosition: 'only', icon: 'close' });
    expect(fixture.componentInstance.accessibleLabel()).toBeNull();
  });

  it('is the counter alone when there is a counter but no name', async () => {
    const { fixture } = await setup({ counter: 5, counterLabel: 'unread' });
    expect(fixture.componentInstance.accessibleLabel()).toBe('5 unread');
  });

  it('omits the noun when no counterLabel is set', async () => {
    const { fixture } = await setup({ label: 'Inbox', counter: 5 });
    expect(fixture.componentInstance.accessibleLabel()).toBe('Inbox, 5');
  });

  /**
   * `counter: 0` is a counter — a badge reading "0" is meaningful — whereas
   * `null` is the absence of one. The two must not collapse.
   */
  it('treats a counter of zero as present and null as absent', async () => {
    const zero = await setup({ label: 'Inbox', counter: 0 });
    expect(zero.fixture.componentInstance.hasCounter()).toBe(true);
    expect(zero.fixture.componentInstance.counterText()).toBe('0');

    const none = await setup({ label: 'Inbox', counter: null });
    expect(none.fixture.componentInstance.hasCounter()).toBe(false);
    expect(none.fixture.componentInstance.counterText()).toBe('');
    expect(none.fixture.componentInstance.accessibleLabel()).toBe('Inbox');
  });
});

describe('SvButtonComponent — anchor mode', () => {
  it('has no rel at all for a same-tab link with none set', async () => {
    const { fixture } = await setup({ label: 'Docs', href: '/docs' });
    expect(fixture.componentInstance.computedRel()).toBeNull();
    expect(control(fixture).getAttribute('rel')).toBeNull();
  });

  it('keeps an author-supplied rel and does not duplicate the safety tokens', async () => {
    const { fixture } = await setup({
      label: 'Docs',
      href: '/docs',
      target: '_blank',
      rel: 'noopener author',
    });
    const rel = fixture.componentInstance.computedRel() ?? '';
    expect(rel.split(' ').filter((t) => t === 'noopener')).toHaveLength(1);
    expect(rel).toContain('author');
    expect(rel).toContain('noreferrer');
  });

  /**
   * A disabled `<button>` never dispatches a click, so the guard in
   * `handleClick` is unreachable through it. A disabled *anchor* is only
   * disabled by ARIA — the click still arrives — so this is the case that
   * proves the guard does anything at all.
   */
  it('swallows the click on a disabled anchor instead of emitting', async () => {
    const spy = vi.fn();
    const { fixture } = await setup({ label: 'Docs', href: '/docs', disabled: true });
    fixture.componentInstance.clicked.subscribe(spy);

    const a = control(fixture);
    expect(a.getAttribute('aria-disabled')).toBe('true');
    expect(a.getAttribute('tabindex')).toBe('-1');

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    a.dispatchEvent(event);

    expect(spy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('emits from an enabled anchor', async () => {
    const spy = vi.fn();
    // A hash href: jsdom refuses real navigation and logs "Not implemented"
    // from a timer, where no test can catch it.
    const { fixture } = await setup({ label: 'Docs', href: '#docs' });
    fixture.componentInstance.clicked.subscribe(spy);
    await userEvent.click(control(fixture));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('SvButtonComponent — focus and blur', () => {
  it('emits (focused) and (blurred)', async () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const { fixture } = await setup({ label: 'A' });
    fixture.componentInstance.focused.subscribe(onFocus);
    fixture.componentInstance.blurred.subscribe(onBlur);

    control(fixture).dispatchEvent(new FocusEvent('focus'));
    control(fixture).dispatchEvent(new FocusEvent('blur'));

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

// ─── Icons come from the library ──────────────────────────────────────────────

/**
 * ★★★ This is the highest-risk rename in the whole sweep, for one reason:
 * **157 of the 167 in-repo call sites wrote the old input as a STATIC
 * attribute** (`iconPath="M12 4.5v15…"`), and Angular silently ignores an
 * unknown static attribute on a component. AOT errors on an unknown
 * `[property]` binding; it says nothing about `iconPath="…"`. So a missed call
 * site does not fail the build — it renders a button with no icon.
 *
 * Neither the compiler nor `check:icons` (which reads templates, not call
 * sites) can cover that. These tests are what is left.
 */
describe('SvButtonComponent — icons come from the library', () => {
  it('renders the named glyph from the FREE registry, never a hand-drawn path', async () => {
    const { fixture } = await setup({ icon: 'plus', label: 'New' });
    const host = fixture.nativeElement as HTMLElement;
    const svgs = [...host.querySelectorAll('svg')];
    expect(svgs.length).toBeGreaterThan(0);
    expect(svgs.every((n) => n.closest('sv-icon'))).toBe(true);
    expect(host.querySelector('sv-icon')!.querySelector('path, polyline, line, circle')).toBeTruthy();
  });

  it('renders both a leading and a trailing glyph', async () => {
    const { fixture } = await setup({ icon: 'plus', trailingIcon: 'chevron-down', label: 'Split' });
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('sv-icon').length).toBe(2);
  });

  /**
   * ★ A raw `d` string is no longer a valid value. It resolves to nothing, and
   * that is the exact symptom a missed call site would show — so pin it, or a
   * regression looks identical to "no icon was asked for".
   */
  it('renders NOTHING recognisable when handed a leftover SVG path', async () => {
    const { fixture } = await setup({ icon: 'M12 4.5v15m7.5-7.5h-15', label: 'Stale' });
    const icon = (fixture.nativeElement as HTMLElement).querySelector('sv-icon');
    expect(icon).toBeTruthy();
    expect(icon!.querySelector('path, polyline, line, circle')).toBeNull();
  });

  it('draws no icon at all when none is named', async () => {
    const { fixture } = await setup({ label: 'Plain' });
    expect((fixture.nativeElement as HTMLElement).querySelector('sv-icon')).toBeNull();
  });
});
