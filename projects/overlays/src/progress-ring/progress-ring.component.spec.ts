import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import { SvProgressRingComponent } from './progress-ring.component';

/**
 * The ring is an SVG circle whose `stroke-dashoffset` is the progress. Two ways
 * that goes wrong without anything saying so: a `max` of zero makes the offset
 * NaN and the browser throws the attribute away, and `aria-valuenow` bound to
 * the raw input reports a figure outside the `aria-valuemax` the same component
 * declared.
 */

async function setup(inputs: Partial<ComponentInput<SvProgressRingComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvProgressRingComponent, {
    inputs: inputs as ComponentInput<SvProgressRingComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const ring = () => screen.getByRole('progressbar');

describe('SvProgressRingComponent — the arc', () => {
  it('turns a value into a fraction of the circumference', async () => {
    const { fixture } = await setup({ value: 25 });
    const c = fixture.componentInstance;
    expect(c.pct()).toBe(25);
    expect(c.dashOffset()).toBeCloseTo(c.circumference() * 0.75, 6);
  });

  it('is empty at zero and closed at the top', async () => {
    const { fixture: empty } = await setup({ value: 0 });
    expect(empty.componentInstance.dashOffset()).toBeCloseTo(empty.componentInstance.circumference(), 6);

    const { fixture: full } = await setup({ value: 100 });
    expect(full.componentInstance.dashOffset()).toBeCloseTo(0, 6);
  });

  it('honours a scale that is not out of a hundred', async () => {
    const { fixture } = await setup({ value: 3, max: 12 });
    expect(fixture.componentInstance.pct()).toBe(25);
  });

  it('clamps a value outside its own scale', async () => {
    const { fixture: over } = await setup({ value: 250 });
    expect(over.componentInstance.pct()).toBe(100);

    const { fixture: under } = await setup({ value: -5 });
    expect(under.componentInstance.pct()).toBe(0);
  });

  it('draws nothing rather than NaN when there is no scale yet', async () => {
    const { fixture } = await setup({ value: 5, max: 0 });
    expect(fixture.componentInstance.pct()).toBe(0);
    expect(Number.isFinite(fixture.componentInstance.dashOffset())).toBe(true);
    expect(el(fixture).innerHTML).not.toContain('NaN');
  });

  it('keeps the stroke inside the box it was given', async () => {
    const { fixture } = await setup({ size: 'md' });
    const c = fixture.componentInstance;
    const { size, stroke } = c.cfg();
    expect(c.radius()).toBe((size - stroke) / 2);
    expect(c.radius() * 2 + stroke).toBe(size);
  });

  it.each(['xs', 'sm', 'md', 'lg', 'xl'] as const)('sizes %s coherently', async (size) => {
    const { fixture } = await setup({ size });
    const c = fixture.componentInstance;
    expect(c.cfg().size).toBeGreaterThan(0);
    expect(c.circumference()).toBeGreaterThan(0);
  });
});

describe('SvProgressRingComponent — what it announces', () => {
  it('is a progressbar with a range it stays inside', async () => {
    await setup({ value: 30, max: 60 });
    expect(ring().getAttribute('aria-valuenow')).toBe('30');
    expect(ring().getAttribute('aria-valuemin')).toBe('0');
    expect(ring().getAttribute('aria-valuemax')).toBe('60');
  });

  it('does not report a figure past its own maximum', async () => {
    // The arc clamps and shows a full ring; `aria-valuenow` used to be bound to
    // the raw input, so it reported 250 out of a declared maximum of 100.
    await setup({ value: 250, max: 100 });
    expect(ring().getAttribute('aria-valuenow')).toBe('100');

    await setup({ value: -20, max: 100 });
    expect(ring().getAttribute('aria-valuenow')).toBe('0');
  });

  it('names itself from the label, and defers to an explicit name', async () => {
    const { fixture: generated } = await setup({ value: 42 });
    expect(generated.componentInstance.resolvedAriaLabel()).toBe('Progress: 42%');

    const { fixture: labelled } = await setup({ value: 42, label: 'Storage used' });
    expect(labelled.componentInstance.resolvedAriaLabel()).toBe('Storage used');

    const { fixture: named } = await setup({ value: 42, label: 'Storage used', ariaLabel: 'Storage: 42 of 100 GB' });
    expect(named.componentInstance.resolvedAriaLabel()).toBe('Storage: 42 of 100 GB');
  });

  it('shows the value in the middle, with its unit', async () => {
    const { fixture } = await setup({ value: 42, suffix: ' GB' });
    expect(el(fixture).textContent).toContain('GB');

    const { fixture: hidden } = await setup({ value: 42, showValue: false });
    expect(hidden.componentInstance.showValue()).toBe(false);
  });
});

describe('SvProgressRingComponent — the gradient id', () => {
  it('gives every instance its own', async () => {
    // Both instances must share an application: ids are per application (svUniqueId).
    const { fixture: a } = await setup();
    const b = TestBed.createComponent(SvProgressRingComponent);
    b.detectChanges();
    expect(a.componentInstance.gradId).toMatch(/^pr-grad-\w+-\d+$/);
    expect(b.componentInstance.gradId).toMatch(/^pr-grad-\w+-\d+$/);
    expect(a.componentInstance.gradId).not.toBe(b.componentInstance.gradId);
  });

  it('points the stroke at the gradient it defined', async () => {
    // A `Math.random()` id in a field initializer differs between the server
    // render and the client one, so a rehydrated ring pointed `stroke` at a
    // gradient that was not there.
    const { fixture } = await setup({ variant: 'gradient' });
    const id = fixture.componentInstance.gradId;
    expect(el(fixture).querySelector(`#${id}`)).not.toBeNull();
    expect(el(fixture).innerHTML).toContain(`url(#${id})`);
  });

  it('uses a plain colour for every other variant', async () => {
    const { fixture } = await setup({ variant: 'default', color: '#ff0000' });
    expect(el(fixture).innerHTML).not.toContain('url(#');
    expect(el(fixture).innerHTML).toContain('#ff0000');
  });
});

describe('SvProgressRingComponent — reaching the end', () => {
  it('says so, once', async () => {
    let completions = 0;
    const { fixture } = await setup({ value: 0 });
    fixture.componentInstance.completed.subscribe(() => { completions += 1; });

    fixture.componentRef.setInput('value', 100);
    fixture.detectChanges();
    fixture.componentRef.setInput('value', 100);
    fixture.detectChanges();
    expect(completions).toBe(1);
  });

  it('arms itself again after falling back', async () => {
    let completions = 0;
    const { fixture } = await setup({ value: 100 });
    fixture.componentInstance.completed.subscribe(() => { completions += 1; });

    fixture.componentRef.setInput('value', 20);
    fixture.detectChanges();
    fixture.componentRef.setInput('value', 100);
    fixture.detectChanges();
    expect(completions).toBe(1);
  });
});

describe('SvProgressRingComponent — looks', () => {
  it('takes a track colour, and has a default', async () => {
    const { fixture: fallback } = await setup();
    expect(fallback.componentInstance.trackFill()).toBe('var(--color-gray-200)');

    const { fixture: custom } = await setup({ trackColor: '#123456' });
    expect(custom.componentInstance.trackFill()).toBe('#123456');
  });

  it('leaves animation on unless the host turns it off', async () => {
    const { fixture: on } = await setup();
    expect(on.componentInstance.animationOn()).toBe(true);

    const { fixture: off } = await setup({ animated: false });
    expect(off.componentInstance.animationOn()).toBe(false);
  });

  it('shows a second line under the value when given one', async () => {
    const { fixture } = await setup({ value: 42, sublabel: 'of 100 GB' });
    expect(el(fixture).textContent).toContain('of 100 GB');
  });
});
