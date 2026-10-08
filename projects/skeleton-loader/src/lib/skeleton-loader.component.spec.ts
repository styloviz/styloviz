import { render, screen } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import { SvSkeletonLoaderComponent } from './skeleton-loader.component';

/** Resets TestBed so a single test can render more than once. */
async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvSkeletonLoaderComponent, { inputs });
  return fixture.componentInstance;
}

describe('SvSkeletonLoaderComponent — line repeater', () => {
  it('produces one line entry by default', async () => {
    const c = await setup();
    expect(c.lineItems()).toHaveLength(1);
  });

  it('shortens the last line to 65% when multiple lines and shortLastLine', async () => {
    const c = await setup({ lines: 3, width: '100%', shortLastLine: true });
    const widths = c.lineItems().map((l) => l.width);
    expect(widths).toEqual(['100%', '100%', '65%']);
  });

  it('keeps the full width on the last line when shortLastLine is off', async () => {
    const c = await setup({ lines: 2, width: '80%', shortLastLine: false });
    expect(c.lineItems().map((l) => l.width)).toEqual(['80%', '80%']);
  });

  it('clamps lines to a minimum of one', async () => {
    const c = await setup({ lines: 0 });
    expect(c.lineItems()).toHaveLength(1);
  });
});

describe('SvSkeletonLoaderComponent — rounded class', () => {
  it('derives the rounding from the shape', async () => {
    expect((await setup({ shape: 'circle' })).roundedClass()).toBe('rounded-full');
    expect((await setup({ shape: 'button' })).roundedClass()).toBe('rounded-lg');
  });

  it('honors an explicit rounded override', async () => {
    expect((await setup({ shape: 'line', rounded: 'xl' })).roundedClass()).toBe('rounded-xl');
  });
});

describe('SvSkeletonLoaderComponent — accessibility', () => {
  it('exposes a busy status region for screen readers', async () => {
    await setup({ ariaLabel: 'Loading content…' });
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
