import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvStepperComponent, type StepperItem } from './stepper.component';

/**
 * ============================================================================
 *  Left / Right follow the reading direction — FL-J3-NV-01 (`X-16`)
 * ============================================================================
 *
 * A horizontal stepper mirrors under `dir="rtl"`: step 1 sits on the right, so
 * the arrow that points at the next step is ArrowLeft. The direction is read
 * from the host, so a `dir="rtl"` ancestor flips it.
 */

const STEPS: StepperItem[] = [
  { id: 'a', label: 'Account' },
  { id: 'b', label: 'Billing' },
  { id: 'c', label: 'Shipping' },
];

@Component({
  imports: [SvStepperComponent],
  template: `<div [attr.dir]="dir()">
    <sv-stepper [items]="steps" [enableHotkeys]="true" [orientation]="orientation()" [(activeIndex)]="active" />
  </div>`,
})
class HostComponent {
  readonly steps = STEPS;
  readonly dir = signal<'rtl' | 'ltr'>('rtl');
  readonly orientation = signal<'horizontal' | 'vertical'>('horizontal');
  active = 1;
}

async function setup(dir: 'rtl' | 'ltr', orientation: 'horizontal' | 'vertical' = 'horizontal') {
  TestBed.resetTestingModule();
  const { fixture } = await render(HostComponent);
  fixture.componentInstance.dir.set(dir);
  fixture.componentInstance.orientation.set(orientation);
  fixture.detectChanges();
  const stepper = fixture.debugElement.children[0].children[0].componentInstance as SvStepperComponent;
  return { fixture, stepper };
}

function press(stepper: SvStepperComponent, key: string): boolean {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  stepper.onStepKeydown(event, stepper.normalizedSteps()[stepper.activeIndex()]);
  return event.defaultPrevented;
}

describe('SvStepperComponent — RTL arrow keys (FL-J3-NV-01)', () => {
  it('ArrowLeft advances and ArrowRight goes back under a dir="rtl" ancestor', async () => {
    const { stepper } = await setup('rtl');
    expect(press(stepper, 'ArrowLeft')).toBe(true);
    expect(stepper.activeIndex()).toBe(2);
    expect(press(stepper, 'ArrowRight')).toBe(true);
    expect(stepper.activeIndex()).toBe(1);
  });

  it('keeps ArrowRight = next in LTR', async () => {
    const { stepper } = await setup('ltr');
    press(stepper, 'ArrowRight');
    expect(stepper.activeIndex()).toBe(2);
  });

  it('a vertical stepper keeps Up/Down in RTL and leaves Left/Right to the page', async () => {
    const { stepper } = await setup('rtl', 'vertical');
    expect(press(stepper, 'ArrowLeft')).toBe(false);
    expect(stepper.activeIndex()).toBe(1);
    press(stepper, 'ArrowDown');
    expect(stepper.activeIndex()).toBe(2);
  });
});
