import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvEmptyStateComponent } from './empty-state.component';
import type { EmptyStateAction, EmptyStateIcon, EmptyStateSize } from './empty-state.component';

/**
 * The presentation surface: 12 icon presets plus a custom override, three
 * sizes, two layouts, the optional card surface, the decorative rings and the
 * three action-button styles.
 *
 * Queries are scoped to the fixture host rather than `screen`, so a second
 * empty state elsewhere in the document could not satisfy them.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvEmptyStateComponent, { inputs });
  return fixture;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const region = (f: { nativeElement: unknown }) => el(f).querySelector<HTMLElement>('[role="region"]')!;
const buttons = (f: { nativeElement: unknown }) =>
  [...el(f).querySelectorAll<HTMLButtonElement>('button')];

const PRESETS: Exclude<EmptyStateIcon, 'custom'>[] = [
  'inbox',
  'search',
  'folder',
  'users',
  'chart',
  'document',
  'notification',
  'cart',
  'filter',
  'star',
  'lock',
  'error',
];

/**
 * A rendered glyph's shape, as a signature over every primitive it draws.
 *
 * `[name]` is NOT reflected to the DOM, so a test cannot read back which icon
 * was asked for — it has to compare what was actually drawn. The primitives sit
 * inside the renderer's `<g transform>` wrapper, so this walks descendants
 * rather than direct children.
 */
const glyphSig = (f: { nativeElement: unknown }) => {
  const svg = el(f).querySelector('sv-icon svg');
  if (!svg) return '';
  return [...svg.querySelectorAll('path, circle, line, polyline, polygon, rect')]
    .map((n) =>
      [
        n.tagName,
        n.getAttribute('d') ?? '',
        n.getAttribute('points') ?? '',
        n.getAttribute('cx') ?? '',
        n.getAttribute('x1') ?? '',
        n.getAttribute('x') ?? '',
      ].join(','),
    )
    .join('|');
};

describe('SvEmptyStateComponent — the icon', () => {
  it('gives each of the twelve presets a distinct glyph', async () => {
    // A shared fallback would make eleven of the twelve presets a lie. Same
    // claim as before the sweep; the discriminator is now the drawn shape
    // rather than one `d` string, because a library glyph may be built from
    // circles and lines as well as paths.
    const sigs = new Set<string>();
    for (const icon of PRESETS) {
      const f = await setup({ icon });
      const sig = glyphSig(f);
      // Assert something WAS drawn before asserting the shapes differ — a set
      // of twelve empty strings would otherwise fail loudly for the wrong
      // reason, and a set of one would not say which preset went missing.
      expect(sig, `preset "${icon}" drew nothing`).not.toBe('');
      sigs.add(sig);
    }
    expect(sigs.size).toBe(PRESETS.length);
  });

  it('uses the host\'s own named glyph for the custom preset', async () => {
    const custom = await setup({ icon: 'custom', customIcon: 'star' });
    const builtin = await setup({ icon: 'inbox' });
    expect(glyphSig(custom)).not.toBe('');
    expect(glyphSig(custom)).not.toBe(glyphSig(builtin));
  });

  it('draws every preset on the library 24-box, whatever its size', async () => {
    // `iconViewBox` used to let a host override this and crop the geometry.
    // The input is gone: a library name is always 24-box, and the visual size
    // is a CSS class on the same `<svg>`.
    for (const size of ['sm', 'md', 'lg'] as EmptyStateSize[]) {
      const f = await setup({ icon: 'inbox', size });
      const svg = el(f).querySelector('sv-icon svg')!;
      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    }
  });

  it('draws nothing at all when custom is selected with no name supplied', async () => {
    // An unresolved name renders no `<svg>` rather than an empty `<path d="">`,
    // so the ring keeps its shape and no stray 0×0 node lands in the a11y tree.
    const f = await setup({ icon: 'custom' });
    expect(el(f).querySelector('sv-icon')).toBeTruthy();
    expect(el(f).querySelector('sv-icon svg')).toBeNull();
  });

  it('draws the decorative rings by default and drops them on request', async () => {
    const withRings = await setup();
    const without = await setup({ showRings: false });
    const rings = (f: { nativeElement: unknown }) =>
      el(f).querySelectorAll('[aria-hidden="true"]').length;
    expect(rings(withRings)).toBeGreaterThan(rings(without));
  });
});

describe('SvEmptyStateComponent — the card surface', () => {
  it('draws a border and background by default', async () => {
    const f = await setup();
    expect(region(f).className).toContain('border');
    expect(region(f).className).toContain('bg-white');
  });

  it('blends into the parent when bordered is off', async () => {
    const f = await setup({ bordered: false });
    expect(region(f).className).not.toContain('border');
    expect(region(f).className).not.toContain('bg-white');
    // The padding and the rounding still belong to the size, not the border.
    expect(region(f).className).toContain('rounded-xl');
  });

  it('names the region after the title', async () => {
    const f = await setup({ title: 'No invoices' });
    expect(region(f).getAttribute('aria-label')).toBe('No invoices');
  });

  it('appends the host\'s own classes', async () => {
    const f = await setup({ customClass: 'mt-8' });
    expect(region(f).className).toContain('mt-8');
  });
});

describe('SvEmptyStateComponent — sizes', () => {
  it.each([
    ['sm', 'px-6 py-8', 'h-20 w-20', 'h-10 w-10', 'h-5 w-5', 'text-sm', 'text-xs'],
    ['md', 'px-8 py-12', 'h-28 w-28', 'h-14 w-14', 'h-7 w-7', 'text-lg', 'text-sm'],
    ['lg', 'px-10 py-16', 'h-36 w-36', 'h-16 w-16', 'h-8 w-8', 'text-2xl', 'text-base'],
  ])(
    'scales padding, rings, icon and type together at %s',
    async (size, pad, ring, container, svg, title, message) => {
      const f = await setup({ size: size as EmptyStateSize, message: 'Nothing to show.' });
      const c = f.componentInstance;
      expect(region(f).className).toContain(pad);
      expect(c.ringSizeClass()).toBe(ring);
      expect(c.iconContainerClass()).toBe(container);
      expect(c.iconSvgClass()).toBe(svg);
      expect(c.titleClass()).toContain(title);
      expect(c.messageClass()).toContain(message);
    },
  );

  it('rounds the largest size more than the smaller two', async () => {
    expect(region(await setup({ size: 'lg' })).className).toContain('rounded-2xl');
    expect(region(await setup({ size: 'md' })).className).toContain('rounded-xl');
  });

  it('widens the message column at lg, and only in the vertical layout', async () => {
    // Horizontal already has a column to fill, so capping its width fights the
    // layout instead of helping readability.
    expect((await setup({ size: 'lg' })).componentInstance.messageClass()).toContain('max-w-md');
    expect((await setup({ size: 'md' })).componentInstance.messageClass()).toContain('max-w-xs');
    expect((await setup({ size: 'sm' })).componentInstance.messageClass()).toContain('max-w-xs');

    for (const size of ['sm', 'md', 'lg'] as EmptyStateSize[]) {
      const f = await setup({ size, layout: 'horizontal' });
      expect(f.componentInstance.messageClass()).not.toContain('max-w-');
    }
  });
});

describe('SvEmptyStateComponent — layout', () => {
  it('centres everything in a column by default', async () => {
    const f = await setup();
    const c = f.componentInstance;
    expect(region(f).className).toContain('flex flex-col items-center text-center');
    expect(c.textBlockClass()).toContain('items-center');
    expect(c.actionsClass()).toContain('justify-center');
  });

  it('puts the icon beside left-aligned text when horizontal', async () => {
    const f = await setup({ layout: 'horizontal' });
    const c = f.componentInstance;
    expect(region(f).className).toContain('flex items-center gap-8');
    expect(region(f).className).not.toContain('text-center');
    expect(c.textBlockClass()).toContain('text-left');
    expect(c.actionsClass()).not.toContain('justify-center');
  });
});

describe('SvEmptyStateComponent — the message', () => {
  it('renders no message paragraph when there is nothing to say', async () => {
    const f = await setup({ title: 'Empty' });
    expect(el(f).querySelector('h3')!.textContent?.trim()).toBe('Empty');
    expect(el(f).querySelector('p')).toBeNull();
  });

  it('renders the message beneath the title when there is', async () => {
    const f = await setup({ title: 'Empty', message: 'Add your first invoice.' });
    expect(el(f).querySelector('h3')!.textContent?.trim()).toBe('Empty');
    expect(el(f).querySelector('p')!.textContent?.trim()).toBe('Add your first invoice.');
  });
});

describe('SvEmptyStateComponent — actions', () => {
  const ACTIONS: EmptyStateAction[] = [
    { id: 'create', label: 'Create' },
    { id: 'import', label: 'Import', style: 'secondary' },
    { id: 'help', label: 'Help', style: 'ghost', icon: 'star' },
  ];

  it('renders no action row at all when there are no actions', async () => {
    const f = await setup();
    expect(buttons(f)).toEqual([]);
    expect(el(f).querySelector('.mt-4')).toBeNull();
  });

  it('gives each style its own look, and defaults a styleless action to primary', async () => {
    const f = await setup({ actions: ACTIONS });
    const classes = buttons(f).map((b) => b.className);
    expect(classes[0]).toContain('bg-primary-600');
    expect(classes[1]).toContain('ring-gray-300');
    expect(classes[2]).toContain('text-gray-500');
    expect(new Set(classes).size).toBe(3);

    const explicit = await setup({ actions: [{ id: 'a', label: 'A', style: 'primary' }] });
    expect(buttons(explicit)[0].className).toBe(classes[0]);
  });

  it('scales the action buttons with the component size', async () => {
    const sm = await setup({ size: 'sm', actions: [ACTIONS[0]] });
    const lg = await setup({ size: 'lg', actions: [ACTIONS[0]] });
    expect(buttons(sm)[0].className).toContain('px-3 py-1.5');
    expect(buttons(lg)[0].className).toContain('px-5 py-2.5');
  });

  it('shows a leading glyph only on the actions that asked for one', async () => {
    const f = await setup({ actions: ACTIONS, showRings: false });
    expect(buttons(f).map((b) => b.querySelector('svg') !== null)).toEqual([false, false, true]);
  });

  it('reports which action was pressed', async () => {
    const f = await setup({ actions: ACTIONS });
    const seen: string[] = [];
    f.componentInstance.actionClick.subscribe((id) => seen.push(id));

    buttons(f)[2].click();
    buttons(f)[0].click();
    expect(seen).toEqual(['help', 'create']);
  });
});
