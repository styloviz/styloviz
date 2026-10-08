import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvSegmentedControlComponent } from './segmented-control.component';
import type { SegmentOption } from './segmented-control.component';

/**
 * Paths the component's own spec does not reach — each one a state a user can
 * produce: a disabled control pressed anyway, a keyboard shortcut used before
 * the panel is open, a section that starts collapsed.
 */

// ── sv-segmented-control ─────────────────────────────────────────────────────

describe('SvSegmentedControlComponent — the swatch and underline variants', () => {
  const OPTIONS: SegmentOption[] = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ];

  async function setup(inputs: Partial<ComponentInput<SvSegmentedControlComponent>> = {}) {
    TestBed.resetTestingModule();
    return render(SvSegmentedControlComponent, {
      inputs: { options: OPTIONS, ...inputs } as ComponentInput<SvSegmentedControlComponent>,
    });
  }

  it('drops the shared pill chrome for the swatch variant', async () => {
    // Swatches are free-standing colour chips, so the wrapper must not carry
    // the grey track every other variant sits in.
    const { fixture } = await setup({ value: 'a', variant: 'swatch' });
    const w = fixture.componentInstance.wrapperClass();
    expect(w).toBe('flex flex-wrap items-center gap-2');
    expect(w).not.toContain('bg-gray-100');
  });

  it('gives the underline variant a bottom border on the wrapper and the buttons', async () => {
    const { fixture } = await setup({ value: 'a', variant: 'underline' });
    const c = fixture.componentInstance;
    expect(c.wrapperClass()).toContain('border-b');
    expect(c.buttonClass(OPTIONS[0])).toContain('border-primary-600'); // selected
    expect(c.buttonClass(OPTIONS[1])).toContain('border-transparent'); // not selected
  });

  it('falls back to the shared chrome for a variant it does not know', async () => {
    // Variants often arrive from configuration rather than from a literal in a
    // template, so an unknown string is reachable. It must render as a plain
    // row, not as nothing.
    const { fixture } = await setup({ value: 'a', variant: 'wat' as never });
    const c = fixture.componentInstance;
    expect(c.wrapperClass()).toBe('inline-flex items-center transition-all duration-150');
    expect(c.buttonClass(OPTIONS[0])).toContain('inline-flex');
  });

  it('gives every variant its own wrapper', async () => {
    const seen = new Set<string>();
    for (const variant of ['default', 'pills', 'underline', 'bordered', 'swatch'] as const) {
      const { fixture } = await setup({ value: 'a', variant });
      seen.add(fixture.componentInstance.wrapperClass());
    }
    expect(seen.size).toBe(5);
  });
});
