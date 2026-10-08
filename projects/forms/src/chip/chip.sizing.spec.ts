import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvChipComponent } from './chip.component';

/**
 * A chip carries an avatar and a remove icon inside a fixed height, so the
 * three size helpers have to agree with each other: a small chip with a medium
 * avatar overflows its own pill. Pinning all three per size is what makes that
 * checkable.
 */

async function setup(inputs: ComponentInput<SvChipComponent> = {}) {
  TestBed.resetTestingModule();
  return render(SvChipComponent, { inputs });
}

describe('SvChipComponent — size', () => {
  it('scales the pill, the avatar and the icon together', async () => {
    const expected = {
      sm: { pill: 'h-6 px-2 text-[10px] gap-1', avatar: 'h-3.5 w-3.5 text-[7px]', icon: 'h-2.5 w-2.5' },
      md: { pill: 'h-7 px-2.5 text-xs gap-1.5', avatar: 'h-4 w-4 text-[8px]', icon: 'h-3 w-3' },
      lg: { pill: 'h-8 px-3 text-sm gap-1.5', avatar: 'h-5 w-5 text-[9px]', icon: 'h-3.5 w-3.5' },
    } as const;

    for (const size of ['sm', 'md', 'lg'] as const) {
      const { fixture } = await setup({ size, label: 'Design' });
      const c = fixture.componentInstance;
      expect(c.sizeClasses()).toBe(expected[size].pill);
      expect(c.avatarSize()).toBe(expected[size].avatar);
      expect(c.iconSize()).toBe(expected[size].icon);
    }
  });

  it('gives no two sizes the same pill height', async () => {
    const seen = new Set<string>();
    for (const size of ['sm', 'md', 'lg'] as const) {
      const { fixture } = await setup({ size });
      seen.add(fixture.componentInstance.sizeClasses());
    }
    expect(seen.size).toBe(3);
  });

  it('renders the small pill classes onto the chip itself', async () => {
    const { fixture } = await setup({ size: 'sm', label: 'Design' });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.h-6')).not.toBeNull();
  });
});
