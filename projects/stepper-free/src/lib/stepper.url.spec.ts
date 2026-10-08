import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import {
  provideSvNavLocation,
  svNoopNavLocation,
  svQueryParamNavLocation,
} from '@styloviz/core';
import { SvStepperComponent, type StepperItem } from './stepper.component';
import {
  SV_STEPPER_RESUME_KIND,
  SV_STEPPER_RESUME_VERSION,
  svSerializeStepperResume,
} from './stepper.resume';

/**
 * ============================================================================
 *  Addressability and resume — `NV-05-I6`, `NV-05-I7`, `NV-05-M2`, `NV-05-M3`
 * ============================================================================
 *
 * The source backlog calls a five-step wizard that loses everything on reload
 * *"the most damaging failure in this document"*, and it was the default. Two
 * mechanisms fix two different halves of it, and `X-9`'s line between them is
 * the thing to keep straight: **the step survives a refresh and the data does
 * not.** `urlKey` makes the position addressable; `persistKey` makes it
 * recoverable; neither stores what the user typed.
 *
 * Three decisions are pinned here:
 *   · the URL carries a step ID, never an index;
 *   · a URL-driven move goes through the workflow's own gate;
 *   · a restored position outranks the URL on arrival, and only on arrival.
 */

const STEPS: StepperItem[] = [
  { id: 'account', label: 'Account' },
  { id: 'payment', label: 'Payment' },
  { id: 'confirm', label: 'Confirm' },
];

function at(url: string): void {
  window.history.replaceState(null, '', url);
}

beforeEach(() => {
  at('/checkout');
  localStorage.clear();
});

afterEach(() => localStorage.clear());

async function setup(
  inputs: Partial<ComponentInput<SvStepperComponent>> = {},
  addressable = true,
) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvStepperComponent, {
    inputs: { items: STEPS, ...inputs } as ComponentInput<SvStepperComponent>,
    providers: [
      provideSvNavLocation(addressable ? svQueryParamNavLocation() : svNoopNavLocation()),
    ],
  });
  return fixture;
}

const query = () => new URLSearchParams(window.location.search);
const step = (f: { componentInstance: SvStepperComponent }) =>
  f.componentInstance.clampedActiveIndex();

describe('SvStepperComponent — opting in', () => {
  it('touches no URL without a urlKey', async () => {
    const f = await setup();
    f.componentInstance.activeIndex.set(1);
    f.detectChanges();
    expect(window.location.search).toBe('');
  });

  it('touches no URL without a provided location', async () => {
    const f = await setup({ urlKey: 'step' }, false);
    f.componentInstance.activeIndex.set(1);
    f.detectChanges();
    expect(window.location.search).toBe('');
    expect(step(f)).toBe(1);
  });

  /**
   * ★ A step ID, never an index. A saved index is wrong the moment the workflow's
   * steps change: insert one and every link written before today points somewhere
   * else, confidently.
   */
  it('writes the step id, not its position', async () => {
    const f = await setup({ urlKey: 'step' });
    f.componentInstance.activeIndex.set(1);
    f.detectChanges();
    expect(query().get('step')).toBe('payment');
  });

  /** Step one is where the wizard starts, so it is absent rather than written. */
  it('omits the first step rather than writing ?step=account', async () => {
    const f = await setup({ urlKey: 'step' });
    expect(query().has('step')).toBe(false);

    f.componentInstance.activeIndex.set(2);
    f.detectChanges();
    expect(query().get('step')).toBe('confirm');

    f.componentInstance.activeIndex.set(0);
    f.detectChanges();
    expect(query().has('step')).toBe(false);
  });

  /**
   * ★ Pushing is the point, and this is the source item: browser back does not
   * move a step back today, so the gesture users reach for exits the wizard.
   */
  it('pushes a history entry per step, so back moves one step back', async () => {
    const f = await setup({ urlKey: 'step' });
    const before = window.history.length;

    f.componentInstance.activeIndex.set(1);
    f.detectChanges();
    f.componentInstance.activeIndex.set(2);
    f.detectChanges();

    expect(window.history.length).toBe(before + 2);

    at('/checkout?step=payment');
    window.dispatchEvent(new PopStateEvent('popstate'));
    f.detectChanges();
    expect(step(f)).toBe(1);
  });

  /**
   * ★ The key DISAPPEARING is a move, not a no-op. Step one writes no key, so the
   * last back-press lands on the keyless URL — and reading that as "nothing to
   * do" would make the back button stop exactly one step short of the thing this
   * adoption exists to fix.
   */
  it('treats the key going away as a move back to step one', async () => {
    at('/checkout?step=confirm');
    const f = await setup({ urlKey: 'step' });
    expect(step(f)).toBe(2);

    at('/checkout');
    window.dispatchEvent(new PopStateEvent('popstate'));
    f.detectChanges();

    expect(step(f)).toBe(0);
  });

  /**
   * ★ The loop this file exists to protect against. `normalizedSteps()` depends
   * on the active index — each step's complete/current/pending state derives from
   * it — so MOVING re-runs the reader, which used to find the URL still naming the
   * step the writer had not updated yet and move the user straight back. Observed:
   * forward then back left both locked on the forward step.
   */
  it('lets a move settle rather than re-reading its own write', async () => {
    const f = await setup({ urlKey: 'step' });

    f.componentInstance.activeIndex.set(2);
    f.detectChanges();
    expect(query().get('step')).toBe('confirm');

    f.componentInstance.activeIndex.set(1);
    f.detectChanges();
    expect(step(f)).toBe(1);
    expect(query().get('step')).toBe('payment');

    f.componentInstance.activeIndex.set(0);
    f.detectChanges();
    expect(step(f)).toBe(0);
    expect(query().has('step')).toBe(false);
  });
});

describe('SvStepperComponent — URL to component', () => {
  it('starts on the step the URL named', async () => {
    at('/checkout?step=payment');
    const f = await setup({ urlKey: 'step' });
    expect(step(f)).toBe(1);
  });

  it('emits stepChange so the host can load that step', async () => {
    at('/checkout?step=payment');
    const seen: number[] = [];

    TestBed.resetTestingModule();
    const { fixture } = await render(SvStepperComponent, {
      inputs: { items: STEPS, urlKey: 'step' } as ComponentInput<SvStepperComponent>,
      providers: [provideSvNavLocation(svQueryParamNavLocation())],
      on: { stepChange: (e: { currentIndex: number }) => seen.push(e.currentIndex) },
    });
    fixture.detectChanges();

    expect(seen).toEqual([1]);
  });

  /**
   * ★ A link cannot jump a gate the workflow has not opened. `disabled` is the
   * free tier's only gate; the Pro twin adds `linear` and `guardRules` through
   * the same `gateReason`.
   */
  it('refuses a step the workflow has disabled', async () => {
    at('/checkout?step=confirm');
    const f = await setup({
      urlKey: 'step',
      items: STEPS.map((s) => (s.id === 'confirm' ? { ...s, status: 'disabled' as const } : s)),
    });
    expect(step(f)).toBe(0);
  });

  /**
   * ★ `interactive` is about the pointer, not the workflow — which is why the
   * gate was split out of `blockReason`. Folding it in would make `urlKey`
   * silently inert on a read-only tracker, which is a surprise rather than a rule.
   */
  it('still honours a link on a non-interactive tracker', async () => {
    at('/checkout?step=payment');
    const f = await setup({ urlKey: 'step', interactive: false });
    expect(step(f)).toBe(1);
  });

  /** A link written before the workflow was edited names a step that is gone. */
  it('ignores a step id this workflow does not have', async () => {
    at('/checkout?step=shipping');
    const f = await setup({ urlKey: 'step' });
    expect(step(f)).toBe(0);
  });

  /** Steps arriving from a request: nothing is resolvable until they land. */
  it('applies the link once the steps arrive', async () => {
    at('/checkout?step=confirm');
    const f = await setup({ urlKey: 'step', items: [] });
    expect(step(f)).toBe(0);

    f.componentRef.setInput('items', STEPS);
    f.detectChanges();
    expect(step(f)).toBe(2);
  });

  /**
   * ★ `stepChangeRequest` asks the host before moving, which is right for a click
   * and wrong for the back button: the browser has ALREADY navigated, so a
   * `deny()` arriving afterwards would leave the address bar naming a step the
   * component refused to enter — a URL that lies about the page.
   */
  it('does not ask asyncValidation for a URL-driven move', async () => {
    at('/checkout?step=payment');
    const asked: unknown[] = [];

    TestBed.resetTestingModule();
    const { fixture } = await render(SvStepperComponent, {
      inputs: {
        items: STEPS,
        urlKey: 'step',
        asyncValidation: true,
      } as ComponentInput<SvStepperComponent>,
      providers: [provideSvNavLocation(svQueryParamNavLocation())],
      on: { stepChangeRequest: (r: unknown) => asked.push(r) },
    });
    fixture.detectChanges();

    expect(asked).toEqual([]);
    expect(fixture.componentInstance.clampedActiveIndex()).toBe(1);
  });
});

describe('SvStepperComponent — resume', () => {
  const stored = (resume: { stepId: string; branch: string | null }) =>
    localStorage.setItem('checkout', JSON.stringify(svSerializeStepperResume(resume)));

  it('persists nothing without a persistKey', async () => {
    const f = await setup();
    f.componentInstance.activeIndex.set(1);
    f.detectChanges();
    expect(localStorage.length).toBe(0);
  });

  it('stores the step id after a move', async () => {
    const f = await setup({ persistKey: 'checkout' });
    f.componentInstance.activeIndex.set(1);
    f.detectChanges();

    const blob = JSON.parse(localStorage.getItem('checkout')!);
    expect(blob.kind).toBe(SV_STEPPER_RESUME_KIND);
    expect(blob.version).toBe(SV_STEPPER_RESUME_VERSION);
    expect(blob.state.stepId).toBe('payment');
  });

  it('resumes where the user left off', async () => {
    stored({ stepId: 'confirm', branch: null });
    const f = await setup({ persistKey: 'checkout' });
    expect(step(f)).toBe(2);
  });

  /**
   * The outcome, not the mechanism: mounting must not cost the user their stored
   * position.
   *
   * ⚠️ This does NOT pin the `restoreAttempted` guard in `persistOnChange` —
   * that guard is an equivalent mutant, because declaration order already makes
   * the restore run first. The component says so where the guard is. Asserting
   * an outcome that holds for two different reasons is the honest thing a test
   * can do here; claiming it protects the guard would be false.
   */
  it('does not overwrite the stored position before reading it', async () => {
    stored({ stepId: 'confirm', branch: null });
    await setup({ persistKey: 'checkout' });

    expect(JSON.parse(localStorage.getItem('checkout')!).state.stepId).toBe('confirm');
  });

  /** An id that has disappeared is detectable — which is the whole point of an id. */
  it('starts over when the stored step is gone', async () => {
    stored({ stepId: 'shipping', branch: null });
    const f = await setup({ persistKey: 'checkout' });
    expect(step(f)).toBe(0);
  });

  it('refuses another component`s blob, and says so', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    localStorage.setItem(
      'checkout',
      JSON.stringify({ kind: 'sv-product-tour/progress', version: 1, state: { stepId: 'x' } }),
    );

    const f = await setup({ persistKey: 'checkout' });
    expect(step(f)).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('foreign'));
    warn.mockRestore();
  });

  it('survives unparseable storage without warning about it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    localStorage.setItem('checkout', 'not json');

    const f = await setup({ persistKey: 'checkout' });
    expect(step(f)).toBe(0);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  /**
   * ★★ The interaction `X-9` singles out. A persisted payload saying step 1 and a
   * link saying step 3 disagree, and the persisted one is the one that knows what
   * the user actually did — a link cannot be allowed to jump a gate the workflow
   * has not opened.
   */
  it('lets the restored position outrank the URL on arrival', async () => {
    at('/checkout?step=confirm');
    stored({ stepId: 'payment', branch: null });

    const f = await setup({ urlKey: 'step', persistKey: 'checkout' });
    expect(step(f)).toBe(1);
  });

  /** …and only on arrival. After that the URL is live, so back and forward work. */
  it('follows the URL again once that first reconciliation is done', async () => {
    at('/checkout?step=confirm');
    stored({ stepId: 'payment', branch: null });

    const f = await setup({ urlKey: 'step', persistKey: 'checkout' });
    expect(step(f)).toBe(1);

    at('/checkout?step=confirm');
    window.dispatchEvent(new PopStateEvent('popstate'));
    f.detectChanges();

    expect(step(f)).toBe(2);
  });

  /**
   * ★ The split `X-9` states: the step survives a refresh and the data does not.
   * A stepper has never seen what the user typed — that lives in the host's forms
   * — and a component that quietly copied it into `localStorage` would be writing
   * personal data to disk on the host's behalf without being asked.
   */
  it('stores the position and nothing else', async () => {
    const f = await setup({ persistKey: 'checkout' });
    f.componentInstance.activeIndex.set(1);
    f.detectChanges();

    const state = JSON.parse(localStorage.getItem('checkout')!).state;
    expect(Object.keys(state).sort()).toEqual(['branch', 'stepId']);
  });
});
