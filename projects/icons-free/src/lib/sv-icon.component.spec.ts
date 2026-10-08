import { render } from '@testing-library/angular';
import { SvIconComponent } from './sv-icon.component';
import { provideSvIcons } from './provide-icons';
import { SvArrowRightIcon } from '../generated/icons/arrow-right.icon';
import { SvCalendarIcon } from '../generated/icons/calendar.icon';
import { ICON_NAMES, ICON_REGISTRY, ICON_METADATA, ICON_SOLID_REGISTRY } from '../generated/registry';
import type { IconNode } from './icon.types';

/** Every primitive the renderer drew, in order — walks descendants, not `svg.children` (always `[g]`). */
const drawn = (root: Element) => [...root.querySelectorAll('svg path, svg line, svg circle, svg polyline, svg polygon, svg rect')];
/** A brand mark is already a filled shape — every primitive `fill: true` — so it needs no silhouette. */
const isBrandMark = (nodes: readonly IconNode[]) => nodes.every((n) => n.fill);

describe('SvIconComponent', () => {
  it('renders an <svg> on a 24 grid for a known name', async () => {
    const { container } = await render(SvIconComponent, { inputs: { name: 'arrow-right' } });
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('renders nothing for an unknown name', async () => {
    const { container } = await render(SvIconComponent, { inputs: { name: 'not-a-real-icon' } });
    expect(container.querySelector('svg')).toBeNull();
  });

  it('is decorative (aria-hidden) by default', async () => {
    const { container } = await render(SvIconComponent, { inputs: { name: 'check' } });
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('role')).toBeNull();
  });

  it('exposes role="img" with an accessible label when titled', async () => {
    const { container } = await render(SvIconComponent, {
      inputs: { name: 'check', title: 'Done' },
    });
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe('Done');
    expect(container.querySelector('title')?.textContent).toBe('Done');
  });

  it('maps size tokens to pixels', async () => {
    const { container } = await render(SvIconComponent, { inputs: { name: 'check', size: 'lg' } });
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('24');
    expect(svg?.getAttribute('height')).toBe('24');
  });

  it('resolves custom icons registered via provideSvIcons', async () => {
    const { container } = await render(SvIconComponent, {
      inputs: { name: 'brand-mark' },
      providers: [provideSvIcons({ 'brand-mark': [{ tag: 'circle', cx: 12, cy: 12, r: 6 }] })],
    });
    expect(container.querySelector('svg circle')).toBeTruthy();
  });
});

describe('per-icon components', () => {
  it('SvArrowRightIcon renders a standalone svg', async () => {
    const { container } = await render(SvArrowRightIcon);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('svg line')).toBeTruthy();
  });
});

describe('icon registry', () => {
  it('exposes every icon with matching names and metadata', () => {
    expect(ICON_NAMES.length).toBe(Object.keys(ICON_REGISTRY).length);
    expect(ICON_METADATA.length).toBe(ICON_NAMES.length);
    for (const name of ICON_NAMES) {
      expect(ICON_REGISTRY[name].length).toBeGreaterThan(0);
    }
  });
});

describe('solid weight', () => {
  it('ships a silhouette for every glyph that is not already a filled brand mark', () => {
    // ★ Mirrors `check:icons-solid`. Without a silhouette `solid` fills the line
    // geometry, and an outline glyph becomes a blob — silently.
    const missing = ICON_NAMES.filter((n) => !isBrandMark(ICON_REGISTRY[n]) && !ICON_SOLID_REGISTRY[n]);
    expect(missing).toEqual([]);
  });

  it('every silhouette is filled geometry, never a stroke-only primitive', () => {
    for (const [name, nodes] of Object.entries(ICON_SOLID_REGISTRY)) {
      const strokeOnly = nodes.filter((n) => n.tag === 'line' || (n.tag === 'polyline' && !n.fill));
      expect(strokeOnly, name).toEqual([]);
    }
  });

  it('<sv-icon weight="solid"> draws the silhouette, not the filled outline', async () => {
    const { container } = await render(SvIconComponent, { inputs: { name: 'calendar', weight: 'solid' } });
    expect(drawn(container).map((n) => n.getAttribute('d'))).toEqual(ICON_SOLID_REGISTRY['calendar'].map((n) => n.d));
  });

  it('<sv-icon> line weight still draws the line glyph', async () => {
    const { container } = await render(SvIconComponent, { inputs: { name: 'calendar' } });
    expect(drawn(container).length).toBe(ICON_REGISTRY.calendar.length);
  });

  it('a per-icon component draws its silhouette too', async () => {
    const { container } = await render(SvCalendarIcon, { inputs: { weight: 'solid' } });
    expect(drawn(container).map((n) => n.getAttribute('d'))).toEqual(ICON_SOLID_REGISTRY['calendar'].map((n) => n.d));
  });

  it('a custom glyph that shadows a built-in name does not borrow its silhouette', async () => {
    const custom: IconNode[] = [{ tag: 'circle', cx: 12, cy: 12, r: 6 }];
    const { container } = await render(SvIconComponent, {
      inputs: { name: 'calendar', weight: 'solid' },
      providers: [provideSvIcons({ calendar: custom })],
    });
    expect(drawn(container).map((n) => n.tagName.toLowerCase())).toEqual(['circle']);
  });
});
