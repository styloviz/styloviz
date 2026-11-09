import { render } from '@testing-library/angular';
import { SvStepperComponent, type StepperItem } from './stepper.component';

/**
 * `SR-37` — the free variants: `card` (a box per step: indicator, title,
 * description) and `progress-bar` (a segmented bar under the current step's
 * label), and `size="xs"`. Both variants are wizard styles: real buttons,
 * `aria-current`, the same click and arrow-key paths as every other variant.
 */
const STEPS: StepperItem[] = [
  { id: 'account', label: 'Account', icon: 'user', description: 'Create your login.' },
  { id: 'billing', label: 'Billing', description: 'Pick a plan.' },
  { id: 'invite', label: 'Invite', description: 'Bring your team.', optional: true },
  { id: 'launch', label: 'Launch' },
];

async function setup(inputs: Record<string, unknown>) {
  const view = await render(SvStepperComponent, { inputs: { items: STEPS, activeIndex: 1, ...inputs } });
  const host = view.fixture.nativeElement as HTMLElement;
  return { ...view, host, c: view.fixture.componentInstance };
}

describe('variant="card"', () => {
  it('draws one bordered button per step with its indicator, title and description', async () => {
    const { host } = await setup({ variant: 'card' });
    const cards = host.querySelectorAll<HTMLButtonElement>('[data-sv-stepper-cards] > li > button');
    expect(cards).toHaveLength(4);
    expect(cards[0].className).toContain('rounded-xl');
    expect(cards[0].className).toContain('border');
    expect(cards[1].textContent).toContain('Billing');
    expect(cards[1].textContent).toContain('Pick a plan.');
    expect(cards[2].textContent).toContain('Optional');
  });

  it('marks the current card with aria-current, its border and a bottom bar — not colour alone', async () => {
    const { host } = await setup({ variant: 'card' });
    const current = host.querySelector<HTMLButtonElement>('button[aria-current="step"]')!;
    expect(current.textContent).toContain('Billing');
    expect(current.className).toContain('border-primary-300');
    expect(current.querySelector('span.absolute.bottom-0')).not.toBeNull();
    expect(host.querySelectorAll('span.absolute.bottom-0')).toHaveLength(1);
  });

  it('shows a step’s own icon, like `icon` does', async () => {
    const { host } = await setup({ variant: 'card', activeIndex: 0 });
    expect(host.querySelector('button[aria-current="step"] sv-icon')).not.toBeNull();
  });

  it('shows a check on every complete step', async () => {
    const { host } = await setup({ variant: 'card', activeIndex: 2 });
    expect(host.querySelectorAll('[data-sv-step-state="complete"] sv-icon')).toHaveLength(2);
  });

  it('stacks on a phone and lays out in one row from sm up; vertical stays stacked', async () => {
    const { host, fixture } = await setup({ variant: 'card' });
    const grid = () => host.querySelector('[data-sv-stepper-cards]')!.className;
    expect(grid()).toContain('grid-cols-1');
    expect(grid()).toContain('sm:grid-flow-col');
    fixture.componentRef.setInput('orientation', 'vertical');
    fixture.detectChanges();
    expect(grid()).not.toContain('sm:grid-flow-col');
  });

  it('a click moves to the step, and the arrow keys move along the cards', async () => {
    const { host, fixture, c } = await setup({ variant: 'card', enableHotkeys: true });
    host.querySelectorAll<HTMLButtonElement>('[data-sv-stepper-cards] button')[2].click();
    fixture.detectChanges();
    expect(c.activeIndex()).toBe(2);
    const current = host.querySelector<HTMLButtonElement>('button[aria-current="step"]')!;
    current.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(c.activeIndex()).toBe(3);
  });

  it('a non-interactive card stepper refuses clicks', async () => {
    const { host, fixture, c } = await setup({ variant: 'card', interactive: false });
    const card = host.querySelectorAll<HTMLButtonElement>('[data-sv-stepper-cards] button')[3];
    expect(card.getAttribute('aria-disabled')).toBe('true');
    card.click();
    fixture.detectChanges();
    expect(c.activeIndex()).toBe(1);
  });
});

describe('variant="progress-bar"', () => {
  it('names the current step and its position over one segment per step', async () => {
    const { host } = await setup({ variant: 'progress-bar' });
    const bar = host.querySelector('[data-sv-stepper-progress]')!;
    expect(bar.textContent).toContain('Billing');
    expect(bar.textContent).toContain('Pick a plan.');
    expect(host.querySelector('[data-sv-stepper-progress-text]')!.textContent?.trim()).toBe('Step 2 of 4');
    const segments = host.querySelectorAll<HTMLButtonElement>('[data-sv-stepper-progress] ol button');
    expect(segments).toHaveLength(4);
    expect([...segments].map((b) => b.dataset['svStepState'])).toEqual(['complete', 'current', 'pending', 'pending']);
  });

  it('every segment has a name, and the list is named by the heading', async () => {
    const { host } = await setup({ variant: 'progress-bar' });
    const segments = [...host.querySelectorAll<HTMLButtonElement>('[data-sv-stepper-progress] ol button')];
    expect(segments.map((b) => b.getAttribute('aria-label'))).toEqual(['Account', 'Billing', 'Invite (optional)', 'Launch']);
    expect(segments[1].getAttribute('aria-current')).toBe('step');
    const list = host.querySelector('[data-sv-stepper-progress] ol')!;
    const heading = host.querySelector(`[id="${list.getAttribute('aria-labelledby')}"]`)!;
    expect(heading.getAttribute('aria-live')).toBe('polite');
    expect(heading.textContent).toContain('Step 2 of 4');
  });

  it('translates through progressLabel, and follows the active step', async () => {
    const { host, fixture } = await setup({ variant: 'progress-bar', progressLabel: 'Schritt {current} von {total}' });
    const text = () => host.querySelector('[data-sv-stepper-progress-text]')!.textContent?.trim();
    expect(text()).toBe('Schritt 2 von 4');
    host.querySelectorAll<HTMLButtonElement>('[data-sv-stepper-progress] ol button')[3].click();
    fixture.detectChanges();
    expect(text()).toBe('Schritt 4 von 4');
    expect(host.querySelector('[data-sv-stepper-progress]')!.textContent).toContain('Launch');
  });

  it('the segment is a ≥24px target around a thin bar, and the bar grows with size', async () => {
    const { host, fixture } = await setup({ variant: 'progress-bar' });
    const seg = () => host.querySelector<HTMLButtonElement>('[data-sv-stepper-progress] ol button')!;
    expect(seg().className).toContain('py-2.5');
    expect(seg().querySelector('span')!.className).toContain('h-1.5');
    fixture.componentRef.setInput('size', 'xs');
    fixture.detectChanges();
    expect(seg().querySelector('span')!.className).toContain('h-1');
    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();
    expect(seg().querySelector('span')!.className).toContain('h-2');
  });
});

describe('size="xs"', () => {
  it('a 24px indicator with an 11px number, and xs labels', async () => {
    const { host } = await setup({ size: 'xs' });
    const indicator = host.querySelector<HTMLElement>('button[aria-current="step"] span[aria-hidden="true"]')!;
    expect(indicator.className).toContain('h-6 w-6');
    expect(indicator.className).toContain('text-[11px]');
    expect(host.querySelector('button[aria-current="step"]')!.innerHTML).toContain('text-xs');
  });

  it('vertical xs pulls the rail in to the smaller indicator', async () => {
    const { host } = await setup({ size: 'xs', orientation: 'vertical' });
    expect(host.querySelector('span.absolute.rounded-full')!.className).toContain('start-[11px]');
  });
});
