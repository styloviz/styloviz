import { TestBed } from '@angular/core/testing';
import { ICON_REGISTRY } from '@styloviz/icons';
import { render } from '@testing-library/angular';
import { SvStepperComponent } from './stepper.component';
import type { StepperItem, StepperSize, StepperVariant } from './stepper.component';
import { svStepperLifecycleOf } from './stepper.machine';

/**
 * ============================================================================
 *  Variant / size / state rendering
 * ============================================================================
 *
 * Mirrors the Pro presentation spec: same class helpers, same decisions. The
 * one real difference is how a status glyph reaches the DOM — Pro names an
 * icon from the Pro library (`stepIconName()`), the free tier inlines the raw
 * SVG path. The last describe asserts that, in the DOM, so a future refactor
 * cannot quietly swap one for the other.
 */

const STEPS: StepperItem[] = [
  { id: 'a', label: 'Account', description: 'Who you are' },
  { id: 'b', label: 'Billing', description: 'How you pay' },
  { id: 'c', label: 'Confirm' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvStepperComponent, {
    inputs: { items: STEPS, ...inputs },
  });
  return fixture;
}

type Fixture = Awaited<ReturnType<typeof setup>>;

/**
 * A normalized step forced into a given state, for the class helpers.
 *
 * ⚠️ `lifecycle` is REQUIRED on `NormalizedStep` since `NV-05-M1`, and it is
 *    derived here rather than passed: these cases are about the presentation
 *    axis, so pinning a lifecycle by hand would let a `state` and a `lifecycle`
 *    disagree in a fixture and say nothing about either. `svStepperLifecycleOf`
 *    is the same mapping the component uses.
 */
const asState = (state: StepperItem['status'], extra: Partial<StepperItem> = {}) => ({
  index: 0,
  item: { id: 'x', label: 'X', ...extra },
  state: state!,
  lifecycle: svStepperLifecycleOf(state!),
});

describe('SvStepperComponent — indicator colours by state', () => {
  const cases: [NonNullable<StepperItem['status']>, string][] = [
    ['complete', 'bg-accent-700'],
    ['current', 'bg-primary-600'],
    ['error', 'bg-danger-600'],
    ['warning', 'bg-warning-500'],
    ['disabled', 'bg-gray-200'],
    ['pending', 'ring-gray-300'],
  ];

  it.each(cases)('paints a %s step with %s', async (state, token) => {
    const f = await setup();
    expect(f.componentInstance.indicatorClass(asState(state))).toContain(token);
  });

  it('strips the ring in the minimal variant', async () => {
    const f = await setup({ variant: 'minimal' });
    const cls = f.componentInstance.indicatorClass(asState('current'));
    expect(cls).toContain('ring-0');
    expect(cls).toContain('bg-primary-500');
  });

  it('leaves the ring in place for every other variant', async () => {
    const f = await setup({ variant: 'default' });
    expect(f.componentInstance.indicatorClass(asState('current'))).not.toContain('ring-0');
  });

  it('rounds a pill indicator into a padded lozenge, not a circle', async () => {
    const f = await setup({ variant: 'pill' });
    expect(f.componentInstance.indicatorClass(asState('pending'))).toContain('rounded-xl px-2.5');
  });
});

describe('SvStepperComponent — indicator size by variant and size', () => {
  const sizes: StepperSize[] = ['sm', 'md', 'lg'];

  it.each(sizes)('sizes a dot indicator for %s', async (size) => {
    const f = await setup({ variant: 'dot', size });
    const expected = { sm: 'h-2.5 w-2.5', md: 'h-3 w-3', lg: 'h-4 w-4' }[size];
    expect(f.componentInstance.indicatorClass(asState('pending'))).toContain(expected);
  });

  it.each(sizes)('sizes a pill indicator for %s', async (size) => {
    const f = await setup({ variant: 'pill', size });
    const expected = { sm: 'h-7 min-w-7', md: 'h-8 min-w-8', lg: 'h-10 min-w-10' }[size];
    expect(f.componentInstance.indicatorClass(asState('pending'))).toContain(expected);
  });

  it.each(sizes)('sizes a default indicator for %s', async (size) => {
    const f = await setup({ size });
    const expected = { sm: 'h-7 w-7', md: 'h-8 w-8', lg: 'h-10 w-10' }[size];
    expect(f.componentInstance.indicatorClass(asState('pending'))).toContain(expected);
  });
});

describe('SvStepperComponent — connectors', () => {
  it('colours the connector after a complete step, and greys the rest', async () => {
    const c = (await setup()).componentInstance;
    expect(c.connectorClass(asState('complete'))).toContain('bg-accent-400');
    expect(c.connectorClass(asState('error'))).toContain('bg-danger-300');
    expect(c.connectorClass(asState('warning'))).toContain('bg-warning-300');
    expect(c.connectorClass(asState('pending'))).toContain('bg-gray-200');
    expect(c.connectorClass(asState('current'))).toContain('bg-gray-200');
  });

  it('thickens the connector only in the line variant', async () => {
    expect((await setup({ variant: 'line' })).componentInstance.connectorSizeClass()).toBe('h-1');
    expect((await setup({ variant: 'default' })).componentInstance.connectorSizeClass()).toBe('h-px');
  });

  it('drops the connectors when showConnectors is off', async () => {
    const withRail = await setup({ showConnectors: true });
    const without = await setup({ showConnectors: false });
    const count = (f: Fixture) =>
      (f.nativeElement as HTMLElement).querySelectorAll('[aria-hidden="true"]').length;

    expect(count(withRail)).toBeGreaterThan(count(without));
  });

  /** The last step has nothing to connect to. */
  it('renders no connector after the final step', async () => {
    const f = await setup({ showConnectors: true });
    expect((f.nativeElement as HTMLElement).querySelectorAll('.ml-3')).toHaveLength(
      STEPS.length - 1,
    );
  });
});

describe('SvStepperComponent — vertical layout tokens', () => {
  const sizes: StepperSize[] = ['sm', 'md', 'lg'];

  it.each(sizes)('indents the vertical row for %s', async (size) => {
    const f = await setup({ orientation: 'vertical', size });
    const expected = { sm: 'pl-11', md: 'pl-14', lg: 'pl-16' }[size];
    expect(f.componentInstance.verticalRowPaddingClass()).toBe(expected);
  });

  it.each(sizes)('positions the vertical connector for %s', async (size) => {
    const f = await setup({ orientation: 'vertical', size });
    const expectedLeft = { sm: 'left-[13px]', md: 'left-[15px]', lg: 'left-[19px]' }[size];
    const cls = f.componentInstance.verticalConnectorLayoutClass();
    expect(cls).toContain(expectedLeft);
    expect(cls).toContain('w-0.5');
  });

  it('widens the vertical connector in the line variant', async () => {
    const f = await setup({ orientation: 'vertical', variant: 'line' });
    expect(f.componentInstance.verticalConnectorLayoutClass()).toContain('w-1');
  });

  it('switches the root to a column when vertical', async () => {
    expect((await setup({ orientation: 'vertical' })).componentInstance.rootClasses())
      .toContain('flex-col');
    expect((await setup({ orientation: 'horizontal' })).componentInstance.rootClasses())
      .toContain('items-start');
  });

  it('appends a custom class without dropping the layout classes', async () => {
    const f = await setup({ customClass: 'my-8' });
    expect(f.componentInstance.rootClasses()).toBe('flex items-start my-8');
  });

  it('does not append an empty custom class', async () => {
    const f = await setup({ customClass: '' });
    expect(f.componentInstance.rootClasses()).toBe('flex items-start');
  });
});

describe('SvStepperComponent — labels and descriptions', () => {
  it('colours the label per state', async () => {
    const c = (await setup()).componentInstance;
    expect(c.labelClass(asState('current'))).toContain('text-gray-900');
    expect(c.labelClass(asState('complete'))).toContain('text-accent-700');
    expect(c.labelClass(asState('error'))).toContain('text-danger-700');
    expect(c.labelClass(asState('warning'))).toContain('text-warning-700');
    expect(c.labelClass(asState('disabled'))).toContain('text-gray-500');
    expect(c.labelClass(asState('pending'))).toContain('text-gray-600');
  });

  it.each(['sm', 'md', 'lg'] as StepperSize[])('sizes the label for %s', async (size) => {
    const f = await setup({ size });
    const expected = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' }[size];
    expect(f.componentInstance.labelClass(asState('pending'))).toContain(expected);
  });

  it('uses a tighter description size at sm', async () => {
    expect((await setup({ size: 'sm' })).componentInstance.descriptionClass(asState('pending')))
      .toContain('text-[11px]');
    expect((await setup({ size: 'lg' })).componentInstance.descriptionClass(asState('pending')))
      .toContain('text-xs');
  });

  it('renders descriptions only when asked to', async () => {
    const shown = await setup({ showDescriptions: true });
    expect((shown.nativeElement as HTMLElement).textContent).toContain('Who you are');

    const hidden = await setup({ showDescriptions: false });
    expect((hidden.nativeElement as HTMLElement).textContent).not.toContain('Who you are');
  });

  it('renders nothing for a step that has no description', async () => {
    const f = await setup({ showDescriptions: true });
    expect((f.nativeElement as HTMLElement).querySelectorAll('p')).toHaveLength(2);
  });

  it('marks an optional step in the label row', async () => {
    const f = await setup({ items: [{ id: 'a', label: 'A', optional: true }] as StepperItem[] });
    expect((f.nativeElement as HTMLElement).textContent).toContain('Optional');
  });
});

describe('SvStepperComponent — indicator content', () => {
  it('hides the number in the dot and minimal variants', async () => {
    const step = asState('pending');
    expect((await setup({ variant: 'dot' })).componentInstance.shouldShowText(step)).toBe(false);
    expect((await setup({ variant: 'minimal' })).componentInstance.shouldShowText(step)).toBe(false);
    expect((await setup({ variant: 'default' })).componentInstance.shouldShowText(step)).toBe(true);
  });

  it('shows a status icon for complete, error and warning in any variant', async () => {
    const c = (await setup()).componentInstance;
    expect(c.shouldShowIcon(asState('complete'))).toBe(true);
    expect(c.shouldShowIcon(asState('error'))).toBe(true);
    expect(c.shouldShowIcon(asState('warning'))).toBe(true);
    expect(c.shouldShowIcon(asState('pending'))).toBe(false);
    expect(c.shouldShowIcon(asState('current'))).toBe(false);
  });

  it('shows a custom icon in the icon variant only when the step has a path', async () => {
    const c = (await setup({ variant: 'icon' })).componentInstance;
    expect(c.shouldShowIcon(asState('pending', { icon: 'star' }))).toBe(true);
    expect(c.shouldShowIcon(asState('pending'))).toBe(false);
  });

  /**
   * Both claims survive the sweep; they just belong to ONE method now.
   * `stepIconName` used to return '' for a plain step and a second method
   * returned a raw `d` — a name and a path, side by side.
   */
  it('falls back to the step’s own glyph when the state has none', async () => {
    const c = (await setup()).componentInstance;
    expect(c.stepIconName(asState('pending', { icon: 'star' }))).toBe('star');
    expect(c.stepIconName(asState('pending'))).toBe('');
  });

  it('uses a distinct glyph per status state, and each one resolves', async () => {
    const c = (await setup()).componentInstance;
    const names = ['complete', 'error', 'warning'].map((s) =>
      c.stepIconName(asState(s as NonNullable<StepperItem['status']>)),
    );
    expect(names[0]).toBe('check');
    expect(new Set(names).size).toBe(2);   // error and warning share alert-triangle
    for (const n of names) expect(ICON_REGISTRY[n as keyof typeof ICON_REGISTRY], n).toBeTruthy();
  });

  it('numbers the indicators from one', async () => {
    const f = await setup();
    const steps = f.componentInstance.normalizedSteps();
    expect(steps.map((s) => f.componentInstance.indicatorText(s))).toEqual(['1', '2', '3']);
  });

  /**
   * ★ The tier difference in the DOM. The free stepper draws its status glyph
   * as an inline `<path d="…">` taken from `icon()`; the Pro twin renders
   * `<sv-icon-pro [name]="stepIconName(step)">` and only falls back to a raw
   * path for a step's own custom glyph. There is no `stepIconName` here.
   */
  /**
   * ★ WAS "inlines the tick as a raw SVG path rather than a named library
   * icon" — a DIVERGENCE FROM THE PRO TWIN that the icon sweep closed. The free
   * stepper hand-drew its completion tick and published no `stepIconName`; the
   * Pro twin already resolved a name. That is the half-migration shape, and
   * this test was pinning the wrong half of it.
   *
   * Inverted: the twins are now asserted to AGREE.
   */
  it('draws the completion tick from the library, like its Pro twin', async () => {
    const items: StepperItem[] = [{ id: 'a', label: 'A', status: 'complete' }];
    const f = await setup({ items });
    const host = f.nativeElement as HTMLElement;

    const drawn = [...host.querySelectorAll('svg')];
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.every((n) => n.closest('sv-icon'))).toBe(true);
    expect(typeof (f.componentInstance as unknown as Record<string, unknown>)['stepIconName'])
      .toBe('function');
  });
});

describe('SvStepperComponent — accessibility markers', () => {
  it('puts aria-current="step" on the active step and nowhere else', async () => {
    const f = await setup({ activeIndex: 1 });
    const marked = [...(f.nativeElement as HTMLElement).querySelectorAll('button')]
      .map((b) => b.getAttribute('aria-current'));
    expect(marked).toEqual([null, 'step', null]);
  });

  it('moves aria-current with the active step', async () => {
    const f = await setup({ activeIndex: 0 });
    f.componentInstance.activeIndex.set(2);
    f.detectChanges();

    const marked = [...(f.nativeElement as HTMLElement).querySelectorAll('button')]
      .map((b) => b.getAttribute('aria-current'));
    expect(marked).toEqual([null, null, 'step']);
  });

  /**
   * ★ REGRESSION GUARD — `X-1` / `X-2`. Do not simplify this back into a
   * count of `[role="listitem"]`.
   *
   * The Phase 5 navigation audit's one finding was this shape: each step button
   * carried `role="listitem"` ITSELF. An explicit ARIA role REPLACES an
   * element's implicit one, so a screen reader announced a clickable step as a
   * list item and never as a button — the clickable affordance was carried by
   * focusability alone.
   *
   * The audit offered two ways out and recommended the cheap one: drop the list
   * roles and make the container a `role="group"`. This kit took the other one,
   * a `role="listitem"` WRAPPER around each button, because it is the only
   * option that keeps BOTH facts — position-in-set and "this is a button".
   *
   * That makes the two assertions below inseparable, and it is why the nesting
   * is asserted rather than the count: flattening the wrapper to save a `div`
   * reintroduces the finding while a count of three list items still passes.
   */
  it('wraps each step button in a list item without overriding the button role', async () => {
    const f = await setup();
    const host = f.nativeElement as HTMLElement;

    const list = host.querySelector('[role="list"]');
    expect(list?.getAttribute('aria-label')).toBe('Progress steps');

    const items = [...host.querySelectorAll('[role="listitem"]')];
    expect(items).toHaveLength(3);

    // Each list item is a WRAPPER holding exactly one step button…
    for (const item of items) {
      expect(item.tagName).not.toBe('BUTTON');
      expect(item.querySelectorAll('button')).toHaveLength(1);
    }

    // …and no button carries a role of its own. That is the regression.
    const buttons = [...host.querySelectorAll('button')];
    expect(buttons).toHaveLength(3);
    for (const b of buttons) expect(b.getAttribute('role')).toBeNull();
  });

  /** The vertical layout is a second template, so it can regress on its own. */
  it('keeps the wrapper-and-button pairing in the vertical layout', async () => {
    const f = await setup({ orientation: 'vertical', activeIndex: 2 });
    const host = f.nativeElement as HTMLElement;

    const items = [...host.querySelectorAll('[role="listitem"]')];
    expect(items).toHaveLength(3);
    for (const item of items) expect(item.querySelectorAll('button')).toHaveLength(1);

    const buttons = [...host.querySelectorAll('button')];
    expect(buttons).toHaveLength(3);
    expect(buttons[2].getAttribute('aria-current')).toBe('step');
    for (const b of buttons) expect(b.getAttribute('role')).toBeNull();
  });
});

describe('SvStepperComponent — tracker variant', () => {
  it('renders a static ordered list rather than clickable steps', async () => {
    const f = await setup({ variant: 'tracker', activeIndex: 1 });
    const host = f.nativeElement as HTMLElement;

    expect(host.querySelector('ol')).toBeTruthy();
    expect(host.querySelectorAll('button')).toHaveLength(0);
    expect(host.querySelectorAll('li')).toHaveLength(3);
  });

  it('marks the current tracker stage with aria-current', async () => {
    const f = await setup({ variant: 'tracker', activeIndex: 1 });
    const marked = [...(f.nativeElement as HTMLElement).querySelectorAll('li')]
      .map((li) => li.getAttribute('aria-current'));
    expect(marked).toEqual([null, 'step', null]);
  });

  /**
   * ★ WAS "draws a supplied icon path in place of the stage number" and had
   * gone stale: `StepperItem.icon` is an icon-library NAME now, so reading the
   * drawn `d` straight back off `path[d]` can never match `'M1 1h2'`. The claim
   * — a named glyph REPLACES the stage number — is what mattered, and is now
   * asserted against what actually renders.
   */
  it('draws a supplied named glyph in place of the stage number', async () => {
    const items: StepperItem[] = [{ id: 'p', label: 'Packed', icon: 'star' }];
    const f = await setup({ variant: 'tracker', items });
    const host = f.nativeElement as HTMLElement;

    // Something was drawn, by the library, and the number is gone.
    const drawn = [...host.querySelectorAll('svg')];
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.every((n) => n.closest('sv-icon'))).toBe(true);
    expect(host.textContent).not.toContain('1');

    // ...and a step with NO glyph still shows its number, or the assertion
    // above would pass on a tracker that renders nothing at all.
    const plain = await setup({ variant: 'tracker', items: [{ id: 'p', label: 'Packed' }] });
    expect((plain.nativeElement as HTMLElement).textContent).toContain('1');
  });
});

describe('SvStepperComponent — load and failure states', () => {
  const stateEl = (f: Fixture, n: string) =>
    (f.nativeElement as HTMLElement).querySelector(`[data-sv-state="${n}"]`);

  it('shows a placeholder instead of the steps while loading', async () => {
    const f = await setup({ loading: true });
    expect(stateEl(f, 'loading')).toBeTruthy();
    expect((f.nativeElement as HTMLElement).querySelectorAll('button')).toHaveLength(0);
  });

  it('shows the failure and offers a retry', async () => {
    const f = await setup({ error: 'Wizard service down' });
    let retried = 0;
    f.componentInstance.retry.subscribe(() => retried++);

    expect(stateEl(f, 'error')?.textContent).toContain('Wizard service down');
    (stateEl(f, 'error')?.querySelector('button') as HTMLButtonElement).click();
    expect(retried).toBe(1);
  });

  /** Loading wins: a stale error must not sit on top of a fresh request. */
  it('prefers the loading placeholder over a previous error', async () => {
    const f = await setup({ loading: true, error: 'stale' });
    expect(stateEl(f, 'loading')).toBeTruthy();
    expect(stateEl(f, 'error')).toBeNull();
  });
});

describe('SvStepperComponent — variant smoke matrix', () => {
  it.each(['default', 'pill', 'minimal', 'icon', 'dot', 'line'] as StepperVariant[])(
    'renders three steps in the %s variant',
    async (variant) => {
      const f = await setup({ variant });
      expect((f.nativeElement as HTMLElement).querySelectorAll('button')).toHaveLength(3);
    },
  );

  it('renders no label text in the dot variant', async () => {
    const f = await setup({ variant: 'dot' });
    expect((f.nativeElement as HTMLElement).textContent).not.toContain('Account');
  });
});
