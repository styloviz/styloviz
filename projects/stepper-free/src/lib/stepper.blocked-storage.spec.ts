import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvStepperComponent } from './stepper.component';

/**
 * A persisted stepper with site data blocked (1.0 audit, M4). Its storage guard
 * was `typeof localStorage === 'undefined'`, which itself throws a
 * SecurityError when storage is blocked — so a `persistKey` took the page down.
 */
describe('SvStepperComponent — blocked storage', () => {
  it('renders with a persistKey when localStorage throws', async () => {
    const desc = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
    try {
      TestBed.resetTestingModule();
      const { fixture } = await render(SvStepperComponent, {
        inputs: {
          items: [
            { id: 'a', label: 'Account' },
            { id: 'b', label: 'Billing' },
          ],
          persistKey: 'blocked-storage-test',
        },
      });
      expect(fixture.nativeElement.textContent).toContain('Account');
    } finally {
      if (desc) Object.defineProperty(window, 'localStorage', desc);
    }
  });
});
