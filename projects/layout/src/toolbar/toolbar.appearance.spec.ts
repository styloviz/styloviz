import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvToolbarComponent } from './toolbar.component';
import type { ToolbarAction, ToolbarSize, ToolbarVariant } from './toolbar.component';
import { ICON_REGISTRY } from '@styloviz/icons';

/**
 * These are long `if` ladders returning class strings. The failure they guard
 * against is a copy-paste one: two arms returning the same thing, so a variant
 * silently renders as another. So the assertions are about the arms being
 * *distinct* and about the shared parts surviving, not about literal strings —
 * a class-name change should not break the suite, a collapsed arm should.
 */

const actions: ToolbarAction[] = [{ id: 'save', label: 'Save', icon: 's' }];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvToolbarComponent, { inputs: { actions, ...inputs } });
  return fixture.componentInstance;
}

const VARIANTS: ToolbarVariant[] = ['default', 'glass', 'bordered', 'elevated', 'ghost'];

describe('SvToolbarComponent — wrapper variants', () => {
  it('gives every variant its own surface', async () => {
    const seen = new Map<string, ToolbarVariant>();
    for (const variant of VARIANTS) {
      const c = await setup({ variant });
      const cls = c.wrapperClass();
      expect(cls).toContain('inline-flex');
      const clash = seen.get(cls);
      expect(clash, `${variant} renders the same as ${clash}`).toBeUndefined();
      seen.set(cls, variant);
    }
  });

  /**
   * The template binds `[class]="wrapperClass()"`, so an unknown variant must
   * still yield the base — otherwise the toolbar loses its layout entirely.
   */
  it('falls back to the bare base for a variant it does not know', async () => {
    const c = await setup({ variant: 'nonesuch' as ToolbarVariant });
    expect(c.wrapperClass()).toContain('inline-flex');
    expect(c.wrapperClass()).not.toContain('bg-white');
  });

  it('adds the sticky offsets only when asked, on every variant', async () => {
    for (const variant of [...VARIANTS, 'nonesuch' as ToolbarVariant]) {
      expect((await setup({ variant })).wrapperClass()).not.toContain('sticky');
      expect((await setup({ variant, sticky: true })).wrapperClass()).toContain('sticky top-2');
    }
  });
});

describe('SvToolbarComponent — button appearance', () => {
  const kinds = ['default', 'primary', 'danger', 'success'] as const;

  it('renders each button variant differently, active and inactive alike', async () => {
    const c = await setup();
    const seen = new Map<string, string>();
    for (const variant of kinds) {
      for (const active of [false, true]) {
        const cls = c.variantBtnClass({ id: 'x', label: 'X', icon: 'x', variant }, active);
        const key = `${variant}/${active}`;
        const clash = seen.get(cls);
        expect(clash, `${key} renders the same as ${clash}`).toBeUndefined();
        seen.set(cls, key);
      }
    }
    expect(seen.size).toBe(8);
  });

  /** An action with no `variant` must land on the same arm as an explicit 'default'. */
  it('treats a missing variant as default', async () => {
    const c = await setup();
    const implicit = c.variantBtnClass({ id: 'x', label: 'X', icon: 'x' }, false);
    const explicit = c.variantBtnClass({ id: 'x', label: 'X', icon: 'x', variant: 'default' }, false);
    expect(implicit).toBe(explicit);
  });

  it('carries the size class into the button', async () => {
    const sizes: Record<ToolbarSize, string> = { sm: 'h-7 w-7', md: 'h-8 w-8', lg: 'h-10 w-10' };
    for (const [size, expected] of Object.entries(sizes) as [ToolbarSize, string][]) {
      const c = await setup({ size });
      expect(c.btnSize()).toBe(expected);
      expect(c.variantBtnClass(actions[0], false)).toContain(expected);
      expect(c.iconSize()).not.toBe('');
    }
  });

  it('sizes the icon separately from the button', async () => {
    const seen = new Set<string>();
    for (const size of ['sm', 'md', 'lg'] as ToolbarSize[]) seen.add((await setup({ size })).iconSize());
    expect(seen.size).toBe(3);
  });
});

describe('SvToolbarComponent — loading the definition', () => {
  it('shows a placeholder instead of an empty action strip', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvToolbarComponent, { inputs: { actions, loading: true } });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-sv-state="loading"]')).toBeTruthy();
    // The buttons must be gone, not merely hidden — a toolbar you can tab into
    // while its permissions are still loading is a toolbar you can misuse.
    expect(host.querySelector('[data-action-id]')).toBeNull();
    expect(host.querySelector('[role="toolbar"]')).toBeNull();
  });

  /**
   * A failed DEFINITION fetch has nothing left to click, so it gets the real
   * retry — unlike a failed action, which is re-run by clicking it again.
   */
  it('offers a working retry when the definition itself failed', async () => {
    TestBed.resetTestingModule();
    let retries = 0;
    const { fixture } = await render(SvToolbarComponent, {
      inputs: { actions: [], loadError: 'Permissions unavailable' },
      on: { retryLoad: () => retries++ },
    });
    const host = fixture.nativeElement as HTMLElement;
    const strip = host.querySelector<HTMLElement>('[data-sv-state="load-error"]');
    expect(strip?.textContent).toContain('Permissions unavailable');

    const retry = strip?.querySelector('button');
    expect(retry).toBeTruthy();
    (retry as HTMLButtonElement).click();
    expect(retries).toBe(1);
  });

  /** The two failure kinds are different inputs and must render as different strips. */
  it('keeps a load failure and an action failure apart', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvToolbarComponent, {
      inputs: { actions, loadError: 'Could not load', error: 'Save failed' },
    });
    const host = fixture.nativeElement as HTMLElement;
    // `:scope >` matters: sv-error-shell stamps its own data-sv-state="error"
    // INSIDE the load-error strip, so an unscoped query finds that one first.
    const loadStrip = host.querySelector<HTMLElement>(':scope > [data-sv-state="load-error"]');
    const actionStrip = host.querySelector<HTMLElement>(':scope > [data-sv-state="error"]');
    expect(loadStrip?.textContent).toContain('Could not load');
    expect(actionStrip?.textContent).toContain('Save failed');
    expect(actionStrip?.querySelector('button')).toBeNull();
    expect(loadStrip?.querySelector('button')).toBeTruthy();
  });
});

describe('SvToolbarComponent — glyphs come from the library', () => {
  /**
   * `ToolbarAction.icon` was a raw `<path d="…">` piped through `[attr.d]`, and
   * the field is still typed `string` — so a consumer passing a NAME compiled
   * fine and rendered `d="bold"`, which draws nothing. The playground's toolbar
   * had been doing exactly that, silently, with six blank buttons.
   *
   * `icon` is a name now. These pin both halves: the name reaches `<sv-icon>`,
   * and it resolves in the FREE registry — `<sv-icon>` reads only that one, so
   * a Pro-only name is the same blank button wearing a different disguise.
   */
  const renderWith = async (icon: string) => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvToolbarComponent, {
      inputs: { actions: [{ id: 'b', label: 'Bold', icon }] as ToolbarAction[] },
    });
    return fixture.nativeElement as HTMLElement;
  };

  it('renders each action icon from the library', async () => {
    const host = await renderWith('bold');
    expect(host.querySelector('sv-icon')).toBeTruthy();
    expect([...host.querySelectorAll('svg')].every((n) => n.closest('sv-icon'))).toBe(true);

    const node = ICON_REGISTRY.bold[0] as { d?: string; points?: string };
    const geometry = node.d ?? node.points;
    const drawn = [...host.querySelectorAll('sv-icon path, sv-icon polyline, sv-icon line')].map(
      (n) => n.getAttribute('d') ?? n.getAttribute('points'),
    );
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn).toContain(geometry);
  });

  it('draws nothing for a raw SVG path, where a name belongs', async () => {
    const host = await renderWith('M6 4h8a4 4 0 010 8H6V4z');
    expect(host.querySelectorAll('sv-icon path, sv-icon polyline, sv-icon line')).toHaveLength(0);
  });
});
