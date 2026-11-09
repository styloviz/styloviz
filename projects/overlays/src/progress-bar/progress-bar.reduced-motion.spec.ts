import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvProgressBarComponent } from './progress-bar.component';

/**
 * FL-J3-OF-01 · OF-14-I9 / OF-14-M5 — the bar's three kinds of motion each
 * have a reduced-motion path. jsdom does not evaluate media queries, so the
 * contract is the `motion-reduce:` utilities Tailwind turns into
 * `@media (prefers-reduced-motion: reduce)` rules.
 */
async function setup(inputs: Partial<ComponentInput<SvProgressBarComponent>>) {
  TestBed.resetTestingModule();
  const r = await render(SvProgressBarComponent, { inputs: inputs as ComponentInput<SvProgressBarComponent> });
  return { host: r.fixture.nativeElement as HTMLElement, c: r.fixture.componentInstance };
}

describe('SvProgressBarComponent — reduced motion (FL-J3-OF-01)', () => {
  it('jumps the determinate fill instead of gliding it', async () => {
    const { c } = await setup({ value: 40 });
    expect(c.fillClasses()).toContain('transition-[width]');
    expect(c.fillClasses()).toContain('motion-reduce:transition-none');
  });

  it('stands the animated stripes still', async () => {
    const { c } = await setup({ value: 40, striped: true, animated: true });
    expect(c.fillClasses()).toContain('[animation:progress-stripe_1s_linear_infinite]');
    expect(c.fillClasses()).toContain('motion-reduce:[animation:none]');
  });

  it('replaces the indeterminate sweep with a still, half-strength track', async () => {
    const { host } = await setup({ indeterminate: true, variant: 'success' });
    const sweeps = Array.from(host.querySelectorAll('[class*="[animation:progress-indeterminate"]')) as HTMLElement[];
    expect(sweeps).toHaveLength(2);
    for (const s of sweeps) expect(s.className).toContain('motion-reduce:hidden');

    const still = host.querySelector('[data-sv-progress-static]') as HTMLElement;
    expect(still).not.toBeNull();
    // Hidden by default, shown only under reduced motion, in the variant's colour.
    expect(still.className).toContain('hidden');
    expect(still.className).toContain('motion-reduce:block');
    expect(still.className).toContain('bg-accent-600');
    expect(still.getAttribute('class')).not.toMatch(/animation/);
  });

  it('keeps the glow static, so it needs no reduced-motion path', async () => {
    const { c } = await setup({ value: 40, glow: true });
    expect(c.fillClasses()).toMatch(/shadow-\[/);
    expect(c.fillClasses()).not.toMatch(/animate-/);
  });
});
