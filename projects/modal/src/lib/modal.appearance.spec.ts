import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvModalComponent } from './modal.component';
import { until } from '../../../../src/testing/async';

/**
 * The variant / size / position maps, and the four close reasons. The overlay
 * is portaled into `<body>`, so anything that has to be read off the DOM is
 * queried there deliberately and cleaned up in `afterEach`.
 */

async function setup(inputs: Partial<ComponentInput<SvModalComponent>> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvModalComponent, {
    inputs: inputs as ComponentInput<SvModalComponent>,
  });
  return { c: fixture.componentInstance, fixture };
}

/** Render with the overlay actually mounted in `<body>`. */
async function open(inputs: Partial<ComponentInput<SvModalComponent>> = {}) {
  const r = await setup({ ...inputs, isOpen: true });
  await until(() => document.querySelector('[role="dialog"]') !== null, {
    label: 'the dialog to mount',
  });
  r.fixture.detectChanges();
  return r;
}

const panel = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
const backdrop = () => panel().parentElement!;

afterEach(() => {
  document.querySelectorAll('[data-sv-modal-portal]').forEach((n) => n.remove());
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
});

describe('SvModalComponent — size and position', () => {
  it('gives every size its own width cap', async () => {
    const caps = new Set<string>();
    for (const size of ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const) {
      const { c } = await setup({ size });
      expect(c.panelClass()).toContain('w-full');
      caps.add(c.panelClass());
    }
    expect(caps.size).toBe(6);

    const { c } = await setup({ size: 'full' });
    // `full` is the one size that is not a capped column.
    expect(c.panelClass()).toContain('w-screen');
    expect(c.panelClass()).toContain('rounded-none');
  });

  it('aligns the panel by position', async () => {
    expect((await setup({ position: 'top' })).c.alignClass()).toContain('items-start');
    expect((await setup({ position: 'bottom' })).c.alignClass()).toContain('items-end');
    expect((await setup({ position: 'center' })).c.alignClass()).toBe('items-center');
  });

  /**
   * A bottom sheet squares off its lower corners against the viewport edge —
   * but a `full`-size dialog already has square corners everywhere, so applying
   * the sheet treatment on top of it would fight the `rounded-none` above.
   */
  it('squares off a bottom sheet, except at full size', async () => {
    expect((await setup({ position: 'bottom' })).c.positionPanelClass())
      .toContain('rounded-b-none');
    expect((await setup({ position: 'bottom', size: 'full' })).c.positionPanelClass()).toBe('');
    expect((await setup({ position: 'center' })).c.positionPanelClass()).toBe('');
  });

  it('slides a bottom sheet up and everything else down', async () => {
    expect((await setup({ position: 'bottom' })).c.animationClass())
      .toContain('modal-panel--up');
    expect((await setup({ position: 'top' })).c.animationClass()).toBe('modal-panel');
    expect((await setup({ position: 'center' })).c.animationClass()).toBe('modal-panel');
  });
});

describe('SvModalComponent — variants', () => {
  it('gives every semantic variant an accent bar and an icon tint', async () => {
    const bars = new Set<string>();
    for (const variant of ['primary', 'success', 'warning', 'danger', 'info'] as const) {
      const { c } = await setup({ variant });
      expect(c.accentBarClass()).not.toBe('');
      expect(c.hasIcon()).toBe(true);
      bars.add(c.accentBarClass());
    }
    expect(bars.size).toBe(5);
  });

  /** `default` is the plain dialog: no bar, no badge, even with showIcon on. */
  it('draws neither bar nor badge for the default variant', async () => {
    const { c } = await setup({ variant: 'default', showIcon: true });
    expect(c.accentBarClass()).toBe('');
    expect(c.hasIcon()).toBe(false);
    expect(c.iconAccentClass()).toContain('bg-gray-100');
  });

  it('suppresses the badge when showIcon is off, keeping the accent bar', async () => {
    const { c } = await setup({ variant: 'danger', showIcon: false });
    expect(c.hasIcon()).toBe(false);
    expect(c.accentBarClass()).toBe('bg-danger-500');
  });

  it('renders the matching glyph for each variant', async () => {
    for (const [variant, name] of [
      ['success', 'check-circle'],
      ['warning', 'alert-triangle'],
      ['danger', 'x-circle'],
      ['info', 'info'],
      ['primary', 'sparkles'],
    ] as const) {
      await open({ variant, title: 'T' });
      expect(panel().querySelector(`sv-icon[name="${name}"]`)).not.toBeNull();
      document.querySelectorAll('[data-sv-modal-portal]').forEach((n) => n.remove());
    }
  });
});

describe('SvModalComponent — how it is announced', () => {
  it('labels itself by its title and describes itself by its subtitle', async () => {
    const { c } = await open({ title: 'Delete project', subtitle: 'This is permanent' });
    expect(c.hasDescription()).toBe(true);
    expect(panel().getAttribute('aria-labelledby')).toBe(c.titleId);
    expect(panel().getAttribute('aria-describedby')).toBe(c.subtitleId);
    expect(document.getElementById(c.titleId)?.textContent?.trim()).toBe('Delete project');
  });

  /** With no title there is no element to point at, so it names itself. */
  it('falls back to a plain label when it has no title', async () => {
    const { c } = await open({ title: '' });
    expect(c.hasDescription()).toBe(false);
    expect(panel().getAttribute('aria-labelledby')).toBeNull();
    expect(panel().getAttribute('aria-label')).toBe('Dialog');
    expect(panel().getAttribute('aria-describedby')).toBeNull();
  });

  it('announces itself as busy while loading, and offers a status region', async () => {
    await open({ title: 'Saving', loading: true, loadingText: 'Uploading…' });
    expect(panel().getAttribute('aria-busy')).toBe('true');
    const status = panel().querySelector('[role="status"]')!;
    expect(status.getAttribute('aria-label')).toBe('Uploading…');
  });

  it('is not busy when it is not loading', async () => {
    await open({ title: 'Idle' });
    expect(panel().getAttribute('aria-busy')).toBeNull();
    expect(panel().querySelector('[role="status"]')).toBeNull();
  });
});

describe('SvModalComponent — chrome toggles', () => {
  it('drops the header, the close button and the footer on request', async () => {
    await open({ title: 'T', showHeader: false, showFooter: false });
    expect(panel().querySelector('h2')).toBeNull();
    expect(panel().querySelector('[aria-label="Close dialog"]')).toBeNull();

    document.querySelectorAll('[data-sv-modal-portal]').forEach((n) => n.remove());

    await open({ title: 'T', showCloseButton: false });
    expect(panel().querySelector('h2')).not.toBeNull();
    expect(panel().querySelector('[aria-label="Close dialog"]')).toBeNull();
  });

  it('drops the header and footer dividers on request', async () => {
    await open({ title: 'T', showHeaderDivider: false, showFooterDivider: false });
    expect(panel().innerHTML).not.toContain('border-b');
    expect(panel().innerHTML).not.toContain('border-t');
  });

  it('blurs the backdrop only when asked', async () => {
    await open({ title: 'T', backdropBlur: true });
    expect(backdrop().className).toContain('backdrop-blur-sm');

    document.querySelectorAll('[data-sv-modal-portal]').forEach((n) => n.remove());

    await open({ title: 'T' });
    expect(backdrop().className).not.toContain('backdrop-blur-sm');
  });

  it('merges customClass onto the panel', async () => {
    await open({ title: 'T', customClass: 'max-w-prose' });
    expect(panel().className).toContain('max-w-prose');
  });
});

describe('SvModalComponent — why it closed', () => {
  async function reasonFrom(
    act: (c: SvModalComponent) => void,
    inputs: Partial<ComponentInput<SvModalComponent>> = {},
  ) {
    const { c, fixture } = await open(inputs);
    const seen: string[] = [];
    c.dismissed.subscribe((r) => seen.push(r));
    act(c);
    fixture.detectChanges();
    return seen;
  }

  it('reports the close button', async () => {
    expect(await reasonFrom(() => {
      (document.querySelector<HTMLElement>('[aria-label="Close dialog"]'))!.click();
    }, { title: 'T' })).toEqual(['close-button']);
  });

  it('reports the backdrop', async () => {
    expect(await reasonFrom(() => {
      const bd = backdrop();
      bd.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, { title: 'T' })).toEqual(['backdrop']);
  });

  it('reports Escape', async () => {
    expect(await reasonFrom((c) => {
      c.onKeydown(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    }, { title: 'T' })).toEqual(['escape']);
  });

  it('reports a programmatic close', async () => {
    expect(await reasonFrom((c) => c.close(), { title: 'T' })).toEqual(['programmatic']);
  });

  /** The reason must not stick: the next close is programmatic again. */
  it('resets the reason between closes', async () => {
    const { c, fixture } = await open({ title: 'T' });
    const seen: string[] = [];
    c.dismissed.subscribe((r) => seen.push(r));

    c.close('escape');
    fixture.detectChanges();
    c.open();
    fixture.detectChanges();
    await until(() => document.querySelector('[role="dialog"]') !== null, {
      label: 'the dialog to re-mount',
    });
    c.close();
    fixture.detectChanges();

    expect(seen).toEqual(['escape', 'programmatic']);
  });

  it('emits opened and closed once per transition', async () => {
    const opened = vi.fn();
    const closed = vi.fn();
    const { c, fixture } = await setup({ title: 'T' });
    c.opened.subscribe(opened);
    c.closed.subscribe(closed);

    c.open();
    fixture.detectChanges();
    c.open();            // already open — not a transition
    fixture.detectChanges();
    c.close();
    fixture.detectChanges();
    c.close();           // already closed — not a transition
    fixture.detectChanges();

    expect(opened).toHaveBeenCalledTimes(1);
    expect(closed).toHaveBeenCalledTimes(1);
  });
});

describe('SvModalComponent — loading blocks every close path', () => {
  it('ignores a click that lands on the panel rather than the backdrop', async () => {
    const { c, fixture } = await open({ title: 'T' });
    // Bubbling from inside the panel: target !== currentTarget, so it is a
    // click *in* the dialog, not outside it.
    panel().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(c.isOpen()).toBe(true);
  });

  it('ignores the backdrop while loading', async () => {
    const { c, fixture } = await open({ title: 'T', loading: true });
    backdrop().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(c.isOpen()).toBe(true);
  });

  it('ignores Escape while loading', async () => {
    const { c } = await open({ title: 'T', loading: true });
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    c.onKeydown(event);
    expect(c.isOpen()).toBe(true);
    expect(event.defaultPrevented).toBe(false);
  });

  it('disables the close button while loading', async () => {
    await open({ title: 'T', loading: true });
    const btn = panel().querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')!;
    expect(btn.disabled).toBe(true);
  });

  it('ignores a key it has no meaning for', async () => {
    const { c } = await open({ title: 'T' });
    const event = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    c.onKeydown(event);
    expect(c.isOpen()).toBe(true);
    expect(event.defaultPrevented).toBe(false);
  });
});
