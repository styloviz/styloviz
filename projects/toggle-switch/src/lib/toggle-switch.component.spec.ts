import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvToggleSwitchComponent } from './toggle-switch.component';

describe('SvToggleSwitchComponent', () => {
  it('renders with role="switch" and reflects aria-checked', async () => {
    await render(SvToggleSwitchComponent, {
      inputs: { label: 'Notifications', checked: false },
    });
    const sw = screen.getByRole('switch', { name: /Notifications/i });
    expect(sw.getAttribute('aria-checked')).toBe('false');
  });

  it('toggles state and emits (toggled) on click', async () => {
    const spy = vi.fn();
    const { fixture } = await render(SvToggleSwitchComponent, {
      inputs: { label: 'Wi-Fi' },
    });
    fixture.componentInstance.toggled.subscribe(spy);

    await userEvent.click(screen.getByRole('switch'));
    expect(fixture.componentInstance.checked()).toBe(true);
    expect(spy).toHaveBeenCalledWith(true);
  });

  it('is keyboard operable with Space and Enter', async () => {
    const spy = vi.fn();
    const { fixture } = await render(SvToggleSwitchComponent, {
      inputs: { label: 'Sync' },
    });
    fixture.componentInstance.toggled.subscribe(spy);

    screen.getByRole('switch').focus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{Enter}');
    expect(spy).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.checked()).toBe(false); // two flips back to start
  });

  it('does not toggle while disabled', async () => {
    const spy = vi.fn();
    const { fixture } = await render(SvToggleSwitchComponent, {
      inputs: { label: 'Locked', disabled: true },
    });
    fixture.componentInstance.toggled.subscribe(spy);

    await userEvent.click(screen.getByRole('switch'));
    expect(fixture.componentInstance.checked()).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('supports ControlValueAccessor.writeValue for reactive forms', async () => {
    const { fixture } = await render(SvToggleSwitchComponent, {
      inputs: { label: 'CVA' },
    });
    fixture.componentInstance.writeValue(true);
    expect(fixture.componentInstance.checked()).toBe(true);
  });
});
