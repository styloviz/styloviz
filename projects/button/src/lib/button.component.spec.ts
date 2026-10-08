import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvButtonComponent } from './button.component';

describe('SvButtonComponent', () => {
  it('renders a native button with the projected label', async () => {
    await render(SvButtonComponent, { inputs: { label: 'Save' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('emits (clicked) on activation', async () => {
    const spy = vi.fn();
    const { fixture } = await render(SvButtonComponent, { inputs: { label: 'Go' } });
    fixture.componentInstance.clicked.subscribe(spy);

    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not emit (clicked) while disabled', async () => {
    const spy = vi.fn();
    const { fixture } = await render(SvButtonComponent, {
      inputs: { label: 'Go', disabled: true },
    });
    fixture.componentInstance.clicked.subscribe(spy);

    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(spy).not.toHaveBeenCalled();
  });

  it('treats loading as disabled and blocks activation', async () => {
    const spy = vi.fn();
    const { fixture } = await render(SvButtonComponent, {
      inputs: { label: 'Save', loading: true },
    });
    fixture.componentInstance.clicked.subscribe(spy);

    expect(fixture.componentInstance.isDisabled()).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('renders an <a> anchor in link mode with a safe rel for _blank', async () => {
    const { fixture } = await render(SvButtonComponent, {
      inputs: { label: 'Docs', href: 'https://example.com', target: '_blank' },
    });
    const link = screen.getByRole('link', { name: 'Docs' });
    expect(link.tagName).toBe('A');
    expect(fixture.componentInstance.computedRel()).toContain('noopener');
    expect(fixture.componentInstance.computedRel()).toContain('noreferrer');
  });

  it('exposes an accessible name for icon-only buttons via ariaLabel', async () => {
    await render(SvButtonComponent, {
      inputs: { iconPosition: 'only', ariaLabel: 'Delete', icon: 'close' },
    });
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('caps the counter text at counterMax', async () => {
    const { fixture } = await render(SvButtonComponent, {
      inputs: { label: 'Inbox', counter: 250, counterMax: 99 },
    });
    expect(fixture.componentInstance.counterText()).toBe('99+');
    expect(fixture.componentInstance.hasCounter()).toBe(true);
  });

  it('folds the counter into the accessible name', async () => {
    const { fixture } = await render(SvButtonComponent, {
      inputs: { label: 'Inbox', counter: 5, counterLabel: 'unread' },
    });
    expect(fixture.componentInstance.accessibleLabel()).toBe('Inbox, 5 unread');
  });

  it('publishes aria-pressed only when it is actually a toggle', async () => {
    /**
     * ★★ A BUTTON THAT STAYS ON IS A TOGGLE AND HAS TO SAY SO. Filter chips,
     *    "pin", "mute", "bold" — the variant changes to show the state, and to
     *    a screen reader that change is invisible: the name is identical in
     *    both states, so the control reads as an ordinary button that does
     *    nothing.
     *
     * ★ And `aria-pressed="false"` on an ORDINARY button is its own bug — it
     *   tells the reader there is a state to toggle when there is not. Which is
     *   why the default omits the attribute rather than defaulting to false.
     */
    const { fixture, rerender } = await render(SvButtonComponent, {
      inputs: { label: 'Save' },
    });
    const button = () => (fixture.nativeElement as HTMLElement).querySelector('button');
    expect(button()?.hasAttribute('aria-pressed')).toBe(false);

    await rerender({ inputs: { label: 'Filter', pressed: true } });
    expect(button()?.getAttribute('aria-pressed')).toBe('true');

    await rerender({ inputs: { label: 'Filter', pressed: false } });
    expect(button()?.getAttribute('aria-pressed')).toBe('false');
  });
});
