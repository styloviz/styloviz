import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import {
  SV_NAV_TELEMETRY,
  svResetWarnOnce,
  type SvNavEvent,
  type SvNavTelemetry,
} from '@styloviz/core';
import { SvStepperComponent, type StepperItem } from './stepper.component';

/**
 * ============================================================================
 *  `X-15` — the FREE stepper on the shared navigation stream
 * ============================================================================
 *
 * Adapted from `projects/stepper/src/lib/stepper.analytics.spec.ts`. The
 * divergences are read out of the two components rather than assumed, and each
 * is marked ▲:
 *
 *   ▲ free has no `linear` and no `guardRules`, so the only refusal it can
 *     produce from a click is `disabled`.
 *   ▲ free has no `(telemetry)` output, so the "one row per move" tests have
 *     nothing to contrast against — the assertion is just the count.
 *
 * ⚠️ **The shared stream is NOT the Pro telemetry output leaking into free.**
 *    It is a seam in `@styloviz/core`, and a navigation-analytics contract that
 *    only worked for paying consumers would be a contract nobody could build
 *    on. What stays Pro is the per-step fact stream with its branch keys and
 *    its six event types.
 */

const ITEMS: StepperItem[] = [
  { id: 'account', label: 'Account' },
  { id: 'billing', label: 'Billing' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'confirm', label: 'Confirm' },
];

function sink(retention: string, granted = true) {
  const seen: SvNavEvent[] = [];
  const state = { granted };
  const provided: SvNavTelemetry = {
    kind: 'spec',
    retention,
    consent: () => state.granted,
    record: (e) => seen.push(e),
  };
  return { seen, provided, state };
}

async function setup(
  inputs: Partial<ComponentInput<SvStepperComponent>> = {},
  retention = '30d',
  granted = true,
) {
  TestBed.resetTestingModule();
  svResetWarnOnce();
  const { seen, provided } = sink(retention, granted);
  const { fixture } = await render(SvStepperComponent, {
    inputs: { items: ITEMS, ...inputs } as ComponentInput<SvStepperComponent>,
    providers: [{ provide: SV_NAV_TELEMETRY, useValue: provided }],
  });
  return { fixture, c: fixture.componentInstance, seen };
}

const stepAt = (f: { componentInstance: SvStepperComponent }, i: number) =>
  f.componentInstance.normalizedSteps()[i];

describe('SvStepperComponent — X-15 intents', () => {
  it('calls a move of one forward `advance`', async () => {
    const { c, seen, fixture } = await setup({ activeIndex: 0 });
    c.onSelect(stepAt(fixture, 1));
    expect(seen.map((e) => e.intent)).toEqual(['advance']);
  });

  it('calls a move of one backward `retreat`', async () => {
    const { c, seen, fixture } = await setup({ activeIndex: 2 });
    c.onSelect(stepAt(fixture, 1));
    expect(seen.map((e) => e.intent)).toEqual(['retreat']);
  });

  it('calls a move of more than one `jump`, in either direction', async () => {
    const forward = await setup({ activeIndex: 0 });
    forward.c.onSelect(stepAt(forward.fixture, 3));

    const back = await setup({ activeIndex: 3 });
    back.c.onSelect(stepAt(back.fixture, 0));

    expect(forward.seen.map((e) => e.intent)).toEqual(['jump']);
    expect(back.seen.map((e) => e.intent)).toEqual(['jump']);
  });

  it('carries the surface, step id, label and index', async () => {
    const { c, seen, fixture } = await setup({ activeIndex: 0, surfaceId: 'signup' });
    c.onSelect(stepAt(fixture, 2));
    expect(seen[0]).toMatchObject({
      surface: 'stepper',
      surfaceId: 'signup',
      key: 'shipping',
      label: 'Shipping',
      index: 2,
    });
  });

  it('records nothing for a click on the step already active', async () => {
    const { c, seen, fixture } = await setup({ activeIndex: 1 });
    c.onSelect(stepAt(fixture, 1));
    expect(seen).toEqual([]);
  });
});

describe('SvStepperComponent — X-15 refusals', () => {
  /** ▲ `disabled` is the only gate the free stepper has. */
  it('records a disabled step as blocked', async () => {
    const items = ITEMS.map((s, i) => (i === 2 ? { ...s, status: 'disabled' as const } : s));
    const { c, seen, fixture } = await setup({ items, activeIndex: 0 });
    c.onSelect(stepAt(fixture, 2));
    expect(seen).toEqual([
      expect.objectContaining({ intent: 'blocked', reason: 'disabled', key: 'shipping' }),
    ]);
  });

  it('records the unsaved prompt as blocked, then the move that Discard completes', async () => {
    const { c, seen, fixture } = await setup({ activeIndex: 0, dirty: true });

    c.onSelect(stepAt(fixture, 1));
    expect(seen.map((e) => `${e.intent}:${e.reason ?? ''}`)).toEqual(['blocked:unsaved']);

    c.discardChanges();
    expect(seen.map((e) => e.intent)).toEqual(['blocked', 'advance']);
  });

  it('records nothing more when the user keeps editing', async () => {
    const { c, seen, fixture } = await setup({ activeIndex: 0, dirty: true });
    c.onSelect(stepAt(fixture, 1));
    c.keepEditing();
    expect(seen).toHaveLength(1);
  });
});

describe('SvStepperComponent — X-15 consent and retention', () => {
  it('records nothing at all while consent is withheld', async () => {
    const { c, seen, fixture } = await setup({ activeIndex: 0 }, '30d', false);
    c.onSelect(stepAt(fixture, 1));
    c.onSelect(stepAt(fixture, 2));
    expect(seen).toEqual([]);
  });

  it('still reports the move, without the id, for a sink that declares no retention', async () => {
    const { c, seen, fixture } = await setup({ activeIndex: 0 }, 'none');
    c.onSelect(stepAt(fixture, 1));
    expect(seen[0]).toMatchObject({ surface: 'stepper', intent: 'advance', index: 1 });
    expect(seen[0].key).toBeNull();
    expect(seen[0].label).toBeNull();
  });
});
