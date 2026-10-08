import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvStepperComponent, type StepperItem } from './stepper.component';

const STEPS: StepperItem[] = [
  { id: 'account', label: 'Account' },
  { id: 'profile', label: 'Profile' },
  { id: 'review', label: 'Review', status: 'disabled' },
];

describe('SvStepperComponent', () => {
  it('renders one button per step with a list semantics wrapper', async () => {
    await render(SvStepperComponent, { inputs: { items: STEPS } });
    expect(screen.getByRole('button', { name: /Account/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Profile/ })).toBeTruthy();
    expect(screen.getByRole('list')).toBeTruthy();
  });

  it('marks the active step with aria-current="step"', async () => {
    await render(SvStepperComponent, { inputs: { items: STEPS, activeIndex: 0 } });
    expect(screen.getByRole('button', { name: /Account/ }).getAttribute('aria-current')).toBe('step');
    expect(screen.getByRole('button', { name: /Profile/ }).getAttribute('aria-current')).toBeNull();
  });

  it('navigates and emits (stepChange) when a step is clicked', async () => {
    const spy = vi.fn();
    const { fixture } = await render(SvStepperComponent, {
      inputs: { items: STEPS, activeIndex: 0 },
    });
    fixture.componentInstance.stepChange.subscribe(spy);

    await userEvent.click(screen.getByRole('button', { name: /Profile/ }));

    expect(fixture.componentInstance.activeIndex()).toBe(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ previousIndex: 0, currentIndex: 1 }),
    );
  });

  it('blocks navigation to a disabled step and emits (stepBlocked)', async () => {
    const blocked = vi.fn();
    const changed = vi.fn();
    const { fixture } = await render(SvStepperComponent, {
      inputs: { items: STEPS, activeIndex: 0 },
    });
    fixture.componentInstance.stepBlocked.subscribe(blocked);
    fixture.componentInstance.stepChange.subscribe(changed);

    await userEvent.click(screen.getByRole('button', { name: /Review/ }));

    expect(fixture.componentInstance.activeIndex()).toBe(0);
    expect(blocked).toHaveBeenCalledWith(
      expect.objectContaining({ index: 2, reason: 'disabled' }),
    );
    expect(changed).not.toHaveBeenCalled();
  });

  it('marks steps as non-interactive (aria-disabled) when interactive is false', async () => {
    await render(SvStepperComponent, {
      inputs: { items: STEPS, activeIndex: 0, interactive: false },
    });
    expect(
      screen.getByRole('button', { name: /Profile/ }).getAttribute('aria-disabled'),
    ).toBe('true');
  });
});
