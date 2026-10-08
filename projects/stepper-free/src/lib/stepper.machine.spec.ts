import {
  SV_STEPPER_LIFECYCLES,
  SV_STEPPER_TRANSITIONS,
  svStepperCanTransition,
  svStepperIsSettled,
  svStepperLifecycleOf,
  svStepperPresentation,
  svStepperTransition,
  svStepperTransitionFor,
  type StepperStepLifecycle,
  type StepperTransition,
} from './stepper.machine';
import type { StepperStepStatus } from './stepper.component';

/**
 * ============================================================================
 *  The step lifecycle, as a machine — `NV-05-M1`
 * ============================================================================
 *
 * No TestBed here on purpose: the machine is data and four pure functions, and a
 * rendered component is the wrong instrument for asking "is this transition
 * legal?". The component's USE of it is asserted in `stepper.lifecycle.spec.ts`.
 */

const ALL_TRANSITIONS = Object.keys(SV_STEPPER_TRANSITIONS) as StepperTransition[];

describe('stepper machine — the transition table', () => {
  it('names exactly six transitions', () => {
    expect(ALL_TRANSITIONS.sort()).toEqual(
      ['complete', 'enter', 'fail', 'reopen', 'reset', 'skip'],
    );
  });

  it('covers every lifecycle state as a destination of something', () => {
    const destinations = new Set(ALL_TRANSITIONS.map(t => SV_STEPPER_TRANSITIONS[t].to));
    expect([...destinations].sort()).toEqual(
      ['active', 'complete', 'error', 'pending', 'skipped'],
    );
    expect(destinations.size).toBe(SV_STEPPER_LIFECYCLES.length);
  });

  /**
   * ★★ THE PROPERTY `svStepperTransitionFor` DEPENDS ON, asserted rather than
   *    trusted. If two rules ever shared a destination AND an origin, "which
   *    transition was that?" would have two answers and the lookup would return
   *    whichever came first in the object — a silent, order-dependent bug in a
   *    table somebody will extend.
   */
  it('has no two rules sharing a destination and an origin', () => {
    const seen = new Set<string>();
    for (const name of ALL_TRANSITIONS) {
      const rule = SV_STEPPER_TRANSITIONS[name];
      for (const from of rule.from) {
        const key = `${from}→${rule.to}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });

  it('never lets a transition originate in its own destination', () => {
    for (const name of ALL_TRANSITIONS) {
      const rule = SV_STEPPER_TRANSITIONS[name];
      expect(rule.from).not.toContain(rule.to);
    }
  });
});

describe('stepper machine — taking a transition', () => {
  it.each([
    ['pending', 'enter', 'active'],
    ['active', 'complete', 'complete'],
    ['active', 'skip', 'skipped'],
    ['pending', 'skip', 'skipped'],
    ['active', 'fail', 'error'],
    ['complete', 'reopen', 'active'],
    ['skipped', 'reopen', 'active'],
    ['error', 'reopen', 'active'],
    ['complete', 'reset', 'pending'],
  ] as const)('%s --%s--> %s', (from, transition, to) => {
    expect(svStepperCanTransition(from, transition)).toBe(true);
    expect(svStepperTransition(from, transition)).toBe(to);
  });

  /** The illegal ones are the point of naming transitions at all. */
  it.each([
    ['complete', 'enter'],
    ['complete', 'complete'],
    ['complete', 'fail'],
    ['skipped', 'complete'],
    ['error', 'complete'],
    ['pending', 'complete'],
    ['pending', 'fail'],
    ['pending', 'reopen'],
    ['pending', 'reset'],
    ['skipped', 'skip'],
  ] as const)('refuses %s --%s-->', (from, transition) => {
    expect(svStepperCanTransition(from, transition)).toBe(false);
    expect(svStepperTransition(from, transition)).toBeNull();
  });
});

describe('stepper machine — naming a move', () => {
  /**
   * ★ The distinction `stepChange` could never make: both land in `active`, and
   *   a host that invalidates later work on a revisit needs to know which.
   */
  it('calls a first arrival `enter` and a return `reopen`', () => {
    expect(svStepperTransitionFor('pending', 'active')).toBe('enter');
    expect(svStepperTransitionFor('complete', 'active')).toBe('reopen');
    expect(svStepperTransitionFor('skipped', 'active')).toBe('reopen');
    expect(svStepperTransitionFor('error', 'active')).toBe('reopen');
  });

  /** Staying put is not a transition; reporting one would re-run host effects. */
  it('returns null for a state to itself', () => {
    for (const state of SV_STEPPER_LIFECYCLES) {
      expect(svStepperTransitionFor(state, state)).toBeNull();
    }
  });

  it('returns null for a move no transition names', () => {
    expect(svStepperTransitionFor('complete', 'error')).toBeNull();
    expect(svStepperTransitionFor('skipped', 'complete')).toBeNull();
  });

  it('agrees with the table for every pair it names', () => {
    for (const from of SV_STEPPER_LIFECYCLES) {
      for (const to of SV_STEPPER_LIFECYCLES) {
        const name = svStepperTransitionFor(from, to);
        if (!name) continue;
        expect(svStepperTransition(from, name)).toBe(to);
      }
    }
  });
});

describe('lifecycle → presentation', () => {
  it.each([
    ['pending', 'pending'],
    ['active', 'current'],
    ['complete', 'complete'],
    ['skipped', 'skipped'],
    ['error', 'error'],
  ] as const)('%s looks like %s', (lifecycle, status) => {
    expect(svStepperPresentation(lifecycle)).toBe(status);
  });

  /**
   * ★★ `NV-05-I11` IN ONE ASSERTION. Complete and valid are separate facts, so
   *    a complete step with invalid data has to be sayable — and it must not
   *    read as `error`, which claims the step itself failed.
   */
  it('shows a complete step with invalid data as a warning, not an error', () => {
    expect(svStepperPresentation('complete', false)).toBe('warning');
    expect(svStepperPresentation('complete', true)).toBe('complete');
    expect(svStepperPresentation('complete', undefined)).toBe('complete');
  });

  /** ★ Nobody is shouted at while they are still typing. */
  it('leaves an active step looking current even when it is invalid', () => {
    expect(svStepperPresentation('active', false)).toBe('current');
  });

  it('ignores validity for pending, skipped and errored steps', () => {
    expect(svStepperPresentation('pending', false)).toBe('pending');
    expect(svStepperPresentation('skipped', false)).toBe('skipped');
    expect(svStepperPresentation('error', true)).toBe('error');
  });
});

describe('presentation → lifecycle', () => {
  /**
   * ★★★ THE MAP THAT KEEPS THE LINEAR GATE HONEST. Gating used to ask
   *     `state !== 'complete'` of the PRESENTATION status and now asks the
   *     lifecycle, so every pre-existing status value has to map to a lifecycle
   *     that gives the identical gate answer. This table IS that promise:
   *     `complete` opens the gate and the other five do not.
   */
  const cases: readonly [StepperStepStatus, StepperStepLifecycle, boolean][] = [
    ['pending', 'pending', false],
    ['current', 'active', false],
    ['complete', 'complete', true],
    ['skipped', 'skipped', true],
    ['error', 'error', false],
    ['warning', 'error', false],
    ['disabled', 'pending', false],
  ];

  it.each(cases)('%s implies lifecycle %s (settled: %s)', (status, lifecycle, settled) => {
    expect(svStepperLifecycleOf(status)).toBe(lifecycle);
    expect(svStepperIsSettled(svStepperLifecycleOf(status))).toBe(settled);
  });

  /**
   * ★ `warning` maps to `error`, not to `complete`, and this is the assertion
   *   that stops somebody "tidying" it: a host marking a step `warning` gets it
   *   gated today, and mapping it to `complete` would silently open every
   *   linear gate behind a warned step.
   */
  it('does not let a warning open a gate', () => {
    expect(svStepperIsSettled(svStepperLifecycleOf('warning'))).toBe(false);
  });

  it('treats only complete and skipped as settled', () => {
    expect(SV_STEPPER_LIFECYCLES.filter(svStepperIsSettled)).toEqual(['complete', 'skipped']);
  });
});
