import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvCheckboxComponent } from './checkbox.component';

/**
 * Three sizes, three class helpers, nine arms. The failure mode is silent — a
 * `case 'sm'` returning the medium classes renders a perfectly usable checkbox
 * — so each arm is pinned to a value AND asserted distinct from its siblings.
 */

async function setup(inputs: ComponentInput<SvCheckboxComponent> = {}) {
  TestBed.resetTestingModule();
  return render(SvCheckboxComponent, { inputs });
}

describe('SvCheckboxComponent — size', () => {
  it('scales the box, the tick and the label together', async () => {
    const expected = {
      sm: { box: 'h-3.5 w-3.5', icon: 'h-2 w-2', label: 'text-xs' },
      md: { box: 'h-4 w-4', icon: 'h-2.5 w-2.5', label: 'text-sm' },
      lg: { box: 'h-5 w-5', icon: 'h-3 w-3', label: 'text-base' },
    } as const;

    for (const size of ['sm', 'md', 'lg'] as const) {
      const { fixture } = await setup({ size, label: 'Notify me' });
      const c = fixture.componentInstance;
      expect(c.boxSize()).toBe(expected[size].box);
      expect(c.iconSize()).toBe(expected[size].icon);
      expect(c.labelSize()).toBe(expected[size].label);
    }
  });

  it('gives no two sizes the same box', async () => {
    const seen = new Set<string>();
    for (const size of ['sm', 'md', 'lg'] as const) {
      const { fixture } = await setup({ size });
      seen.add(fixture.componentInstance.boxSize());
    }
    expect(seen.size).toBe(3);
  });

  it('renders the small size onto the element, not just into a computed', async () => {
    const { fixture } = await setup({ size: 'sm', label: 'Notify me' });
    const host = fixture.nativeElement as HTMLElement;
    const box = host.querySelector('.h-3\\.5');
    expect(box).not.toBeNull();
  });
});
