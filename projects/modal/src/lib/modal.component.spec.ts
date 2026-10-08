import { render } from '@testing-library/angular';
import { SvModalComponent } from './modal.component';

async function setup(extra: Record<string, unknown> = {}) {
  const { fixture } = await render(SvModalComponent, { inputs: { ...extra } });
  return { c: fixture.componentInstance, fixture };
}

/** A backdrop click event whose target IS the backdrop element. */
function backdropEvent(): MouseEvent {
  const el = document.createElement('div');
  return { target: el, currentTarget: el } as unknown as MouseEvent;
}

describe('SvModalComponent — open/close state', () => {
  it('open() and close() flip the isOpen model', async () => {
    const { c } = await setup();
    c.open();
    expect(c.isOpen()).toBe(true);
    c.close();
    expect(c.isOpen()).toBe(false);
  });

  it('close() is blocked while loading', async () => {
    const { c } = await setup({ isOpen: true, loading: true });
    c.close();
    expect(c.isOpen()).toBe(true);
  });
});

describe('SvModalComponent — backdrop', () => {
  it('closes on a backdrop click when closeOnBackdrop is true', async () => {
    const { c } = await setup({ isOpen: true });
    c.onBackdropClick(backdropEvent());
    expect(c.isOpen()).toBe(false);
  });

  it('ignores backdrop clicks when closeOnBackdrop is false', async () => {
    const { c } = await setup({ isOpen: true, closeOnBackdrop: false });
    c.onBackdropClick(backdropEvent());
    expect(c.isOpen()).toBe(true);
  });
});

describe('SvModalComponent — keyboard', () => {
  it('closes on Escape when closeOnEsc is true', async () => {
    const { c } = await setup({ isOpen: true });
    c.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(c.isOpen()).toBe(false);
  });

  it('ignores Escape when closeOnEsc is false', async () => {
    const { c } = await setup({ isOpen: true, closeOnEsc: false });
    c.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(c.isOpen()).toBe(true);
  });
});

describe('SvModalComponent — dismiss reason', () => {
  it('emits dismissed with the correct reason on close', async () => {
    const spy = vi.fn();
    const { c, fixture } = await setup({ isOpen: true });
    fixture.detectChanges(); // flush the open transition (sets wasOpen = true)
    c.dismissed.subscribe(spy);

    c.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges(); // flush the close effect

    expect(spy).toHaveBeenCalledWith('escape');
  });
});
