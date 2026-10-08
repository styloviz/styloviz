import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { provideSvLinkAdapter, svResetWarnOnce, type SvLinkTarget } from '@styloviz/core';
import {
  SvJumpMenuComponent,
  type JumpMenuChangeEvent,
  type JumpMenuItem,
} from './jump-menu.component';

/**
 * ============================================================================
 *  Jump Menu — `N-7`, and `X-11`'s swap target
 * ============================================================================
 *
 * ★★ It is a native `<select>`, deliberately. This component exists to be the
 * SMALL form of other navigation — what `sv-tabs` and `sv-anchor` become on a
 * phone — so the question is not "what is the nicest dropdown?" but "what works
 * best one-handed on a phone?", and the answer is the platform's own picker: a
 * wheel on iOS, a dialog on Android, the OS's font scaling and accessibility
 * settings, with none of the kit's JavaScript in between.
 *
 * A custom listbox would trade all of that for visual control over the one
 * surface where visual control matters least — and would need a body portal, a
 * focus trap, viewport clamping and an answer for the software keyboard covering
 * the panel, none of which the kit can do better on a device it cannot see.
 */

const ITEMS: JumpMenuItem[] = [
  { id: 'intro', label: 'Introduction' },
  { id: 'install', label: 'Installation', group: 'Getting started' },
  { id: 'usage', label: 'Usage', group: 'Getting started' },
  { id: 'api', label: 'API', group: 'Reference' },
  { id: 'soon', label: 'Coming soon', group: 'Reference', disabled: true },
];

async function setup(inputs: Partial<ComponentInput<SvJumpMenuComponent>> = {}, providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const seen: JumpMenuChangeEvent[] = [];
  const view = await render(SvJumpMenuComponent, {
    inputs: { items: ITEMS, ...inputs } as ComponentInput<SvJumpMenuComponent>,
    providers: providers as never[],
    on: { jump: (e: JumpMenuChangeEvent) => seen.push(e) },
  });
  return { ...view, seen, select: view.container.querySelector('select')! };
}

beforeEach(() => svResetWarnOnce());

describe('SvJumpMenuComponent — the control itself', () => {
  /** ★ The decision the whole component rests on. */
  it('is a native select, not a custom listbox', async () => {
    const { select, container } = await setup();
    expect(select.tagName).toBe('SELECT');
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  it('renders one option per destination', async () => {
    const { select } = await setup({ placeholder: '' });
    expect([...select.querySelectorAll('option')].map((o) => o.textContent?.trim())).toEqual([
      'Introduction',
      'Installation',
      'Usage',
      'API',
      'Coming soon',
    ]);
  });

  /** Groups become `<optgroup>`, which the OS picker renders natively. */
  it('groups destinations into optgroups', async () => {
    const { select } = await setup();
    expect([...select.querySelectorAll('optgroup')].map((g) => g.label)).toEqual([
      'Getting started',
      'Reference',
    ]);
  });

  /**
   * ★ Encounter order, not alphabetical and not "all ungrouped last". A jump
   * menu's order is the DOCUMENT's order — sections down a page, steps through a
   * wizard — and re-sorting would put the control's idea of "next" out of step
   * with the page's.
   */
  it('keeps an ungrouped destination in its place in the sequence', async () => {
    const { select } = await setup({ placeholder: '' });
    const first = select.children[0] as HTMLElement;
    expect(first.tagName).toBe('OPTION');
    expect(first.textContent?.trim()).toBe('Introduction');
  });

  it('marks a disabled destination as disabled', async () => {
    const { select } = await setup();
    const soon = [...select.querySelectorAll('option')].find((o) => o.value === 'soon')!;
    expect(soon.disabled).toBe(true);
  });

  /**
   * ★ A bare `<select>` in a navigation bar reads as "combo box, Overview" and
   * nothing tells a screen-reader user it moves them.
   */
  it('labels the control, and points the label at it', async () => {
    const { container, select } = await setup({ label: 'Jump to section' });
    const label = container.querySelector('label')!;
    expect(label.textContent?.trim()).toBe('Jump to section');
    expect(label.getAttribute('for')).toBe(select.id);
  });

  it('keeps the label for assistive technology when hidden', async () => {
    const { container } = await setup({ labelHidden: true });
    expect(container.querySelector('label')?.className).toContain('sr-only');
  });
});

describe('SvJumpMenuComponent — choosing a destination', () => {
  const choose = (select: HTMLSelectElement, id: string) => {
    select.value = id;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };

  it('emits the destination and the group it came from', async () => {
    const { select, seen, fixture } = await setup();
    choose(select, 'usage');
    fixture.detectChanges();

    expect(seen).toHaveLength(1);
    expect(seen[0].item.id).toBe('usage');
    expect(seen[0].group).toBe('Getting started');
  });

  it('reports a null group for an ungrouped destination', async () => {
    const { select, seen, fixture } = await setup();
    choose(select, 'intro');
    fixture.detectChanges();
    expect(seen[0].group).toBeNull();
  });

  it('updates the two-way value', async () => {
    const { select, fixture } = await setup();
    choose(select, 'api');
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('api');
  });

  it('refuses a disabled destination', async () => {
    const { select, seen, fixture } = await setup();
    choose(select, 'soon');
    fixture.detectChanges();

    expect(seen).toEqual([]);
    expect(fixture.componentInstance.value()).toBe('');
  });

  it('ignores a value naming no destination', async () => {
    const { select, seen, fixture } = await setup();
    choose(select, 'ghost');
    fixture.detectChanges();
    expect(seen).toEqual([]);
  });
});

describe('SvJumpMenuComponent — who navigates', () => {
  function recording() {
    const navigated: SvLinkTarget[] = [];
    return {
      navigated,
      provider: provideSvLinkAdapter({
        kind: 'fake-router',
        href: (t) => String(t),
        navigate: (t) => {
          navigated.push(t);
          return true;
        },
      }),
    };
  }

  const withHref: JumpMenuItem[] = [
    { id: 'a', label: 'A', href: '/a' },
    { id: 'b', label: 'B' },
  ];

  /** A destination with an `href` goes through the adapter. */
  it('navigates through the link adapter', async () => {
    const { navigated, provider } = recording();
    const { select, fixture } = await setup({ items: withHref }, [provider]);

    select.value = 'a';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    expect(navigated).toEqual(['/a']);
  });

  /**
   * ★ It emits as well, unlike `sv-mega-menu`. That component's rule is "the
   * output fires exactly when this component stopped the browser from
   * navigating" — but a `<select>` is not a link and never navigates on its own,
   * so there is nothing to stop and the output always fires. Same principle, on a
   * control where the browser was never a participant.
   */
  it('emits as well as navigating, because nothing was stopped', async () => {
    const { provider } = recording();
    const { select, seen, fixture } = await setup({ items: withHref }, [provider]);

    select.value = 'a';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    expect(seen.map((e) => e.item.id)).toEqual(['a']);
  });

  /** No `href` is the in-page case: the host handles it from `jump`. */
  it('asks the adapter nothing for a destination with no href', async () => {
    const { navigated, provider } = recording();
    const { select, seen, fixture } = await setup({ items: withHref }, [provider]);

    select.value = 'b';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    expect(navigated).toEqual([]);
    expect(seen.map((e) => e.item.id)).toEqual(['b']);
  });
});

describe('SvJumpMenuComponent — with no adapter wired up', () => {
  /**
   * ★ The default `svHrefLinkAdapter` renders hrefs and navigates nothing. An
   *   anchor falls back to the browser following it; a `<select>` has nothing
   *   to fall back on, so a destination with an `href` used to do nothing at all.
   *   A same-document hash target is used because jsdom performs those for real.
   */
  it('loads the href itself when the adapter declines', async () => {
    const target = `${window.location.pathname}#jump-fallback`;
    const { select, fixture, seen } = await setup({
      items: [{ id: 'a', label: 'A', href: target }],
    });

    select.value = 'a';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    expect(window.location.hash).toBe('#jump-fallback');
    expect(seen.map((e) => e.item.id)).toEqual(['a']);
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('does not load anything when the adapter took the navigation', async () => {
    window.history.replaceState(null, '', window.location.pathname);
    const { select, fixture } = await setup({ items: [{ id: 'a', label: 'A', href: '#taken' }] }, [
      provideSvLinkAdapter({ kind: 'router', href: (t) => String(t), navigate: () => true }),
    ]);

    select.value = 'a';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    expect(window.location.hash).toBe('');
  });
});

describe('SvJumpMenuComponent — a preset value', () => {
  /**
   * ★ The select's `[value]` binding runs before the @for has created any
   *   options, so on the first render it named nothing and the browser showed
   *   the placeholder or the first option. Asserted on the DOM, not the model.
   */
  it('is showing on the first render', async () => {
    const { select } = await setup({ value: 'api' });
    expect(select.value).toBe('api');
    expect(select.selectedOptions[0]?.textContent?.trim()).toBe('API');
  });

  it('follows a later change of value', async () => {
    const { select, fixture } = await setup({ value: 'api' });
    fixture.componentRef.setInput('value', 'usage');
    fixture.detectChanges();
    expect(select.value).toBe('usage');
  });
});

describe('SvJumpMenuComponent — the placeholder', () => {
  it('shows while the value names nothing', async () => {
    const { select } = await setup();
    expect(select.querySelector('option[value=""]')?.textContent?.trim()).toBe('Select…');
  });

  it('goes away once a destination is current', async () => {
    const { select } = await setup({ value: 'api' });
    expect(select.querySelector('option[value=""]')).toBeNull();
  });

  it('can be removed entirely', async () => {
    const { select } = await setup({ placeholder: '' });
    expect(select.querySelector('option[value=""]')).toBeNull();
  });
});
