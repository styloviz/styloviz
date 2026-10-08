import { signal } from '@angular/core';
import { createCloseGuard, type SvCloseReason, type SvCloseVerdict } from './close-guard';

/**
 * ============================================================================
 *  `createCloseGuard` — the controlled-close policy (`X-11`)
 * ============================================================================
 *
 * ★★★ THE INTERESTING PART IS NOT THE PROMPT, IT IS THE ORDER OF THE
 *     QUESTIONS. Does a host veto suppress the unsaved-changes prompt or stack
 *     with it? Does a programmatic close prompt? What reason does the eventual
 *     close report? Four families answering those independently is four
 *     contracts, which is what the audit meant by "a prompt implemented four
 *     times will behave four ways".
 */

describe('createCloseGuard — with nothing configured', () => {
  it('allows every close and prompts for nothing', () => {
    const g = createCloseGuard();
    for (const reason of ['backdrop', 'escape', 'close-button', 'programmatic'] as const) {
      expect(g.request(reason)).toBe(true);
    }
    expect(g.prompting()).toBe(false);
    expect(g.pendingReason()).toBeNull();
  });
});

describe('createCloseGuard — the host veto', () => {
  it('refuses when the guard says false, and raises no prompt', () => {
    // ★★ A HOST VETO AND A DIRTY PROMPT ARE DIFFERENT REFUSALS. The host said
    //    "not now" for its own reasons and owns the messaging; showing
    //    "you have unsaved changes" here would tell the user something the
    //    host never said — and the real reason might be a request in flight.
    const g = createCloseGuard({ dirty: () => true, guard: () => () => false });

    expect(g.request('escape')).toBe(false);
    expect(g.prompting()).toBe(false);
  });

  it('treats true, undefined and no return at all as no objection', () => {
    const yes = createCloseGuard({ guard: () => () => true });
    const quiet = createCloseGuard({ guard: () => () => undefined });
    const empty = createCloseGuard({ guard: () => () => { /* no opinion */ } });

    expect(yes.request('escape')).toBe(true);
    expect(quiet.request('escape')).toBe(true);
    expect(empty.request('escape')).toBe(true);
  });

  it('★ lets a guard care about one reason and ignore the rest', () => {
    // The shape that makes `void` the useful default: no `else return true`.
    //
    // ⚠️ The return type is WRITTEN, and it has to be. `SvCloseVerdict` is
    //    `boolean | void`, but `noImplicitReturns` looks at the INFERRED type
    //    of this arrow — `false | undefined` — and reports a function that
    //    returns on one path and falls off the end on another. Annotating it
    //    says "falling off the end is one of the answers", which is the whole
    //    thing this test exists to demonstrate.
    const g = createCloseGuard({
      guard: () => (reason): SvCloseVerdict => { if (reason === 'backdrop') return false; },
    });

    expect(g.request('backdrop')).toBe(false);
    expect(g.request('escape')).toBe(true);
  });

  it('is consulted before the dirty check, every time', () => {
    const seen: SvCloseReason[] = [];
    const g = createCloseGuard({
      dirty: () => true,
      guard: () => (reason) => { seen.push(reason); },
    });

    g.request('escape');
    expect(seen).toEqual(['escape']);
    expect(g.prompting()).toBe(true);
  });

  it('reads the guard through its getter, so a late-bound input works', () => {
    const veto = signal<((r: SvCloseReason) => boolean) | null>(null);
    const g = createCloseGuard({ guard: () => veto() });

    expect(g.request('escape')).toBe(true);
    veto.set(() => false);
    expect(g.request('escape')).toBe(false);
  });
});

describe('createCloseGuard — the unsaved-changes prompt', () => {
  it('holds the close and remembers what raised it', () => {
    const g = createCloseGuard({ dirty: () => true });

    expect(g.request('escape')).toBe(false);
    expect(g.prompting()).toBe(true);
    expect(g.pendingReason()).toBe('escape');
  });

  it('★ closes with the ORIGINAL reason once the user discards', () => {
    // ★★ The user dismissed this with Escape; the prompt is an interruption in
    //    the middle of that, not a new kind of close. Reporting `programmatic`
    //    here tells the host's analytics that code closed a dialog the user
    //    closed.
    const g = createCloseGuard({ dirty: () => true });
    g.request('backdrop');

    expect(g.discard()).toBe('backdrop');
    expect(g.prompting()).toBe(false);
  });

  it('closes nothing when the user keeps editing', () => {
    const g = createCloseGuard({ dirty: () => true });
    g.request('escape');
    g.keep();

    expect(g.prompting()).toBe(false);
    expect(g.pendingReason()).toBeNull();
    // …and the next attempt asks again, rather than remembering a decision the
    // user made about a different moment.
    expect(g.request('escape')).toBe(false);
    expect(g.prompting()).toBe(true);
  });

  it('★ is idempotent while up, and does not re-label itself', () => {
    // The caller is a template event that fires repeatedly — a user clicking
    // the backdrop behind the prompt. Re-raising it on each one would be
    // indistinguishable from never having raised it.
    const g = createCloseGuard({ dirty: () => true });
    g.request('backdrop');
    expect(g.request('escape')).toBe(false);
    expect(g.request('close-button')).toBe(false);

    expect(g.pendingReason()).toBe('backdrop');
  });

  it('★ lets a programmatic close through by default', () => {
    // ★★ A DECISION, NOT AN OVERSIGHT. The prompt is for ACCIDENTAL dismissal;
    //    a programmatic close is the host's own code saying "close now", and a
    //    component that second-guesses its own API call is unusable.
    const g = createCloseGuard({ dirty: () => true });
    expect(g.request('programmatic')).toBe(true);
    expect(g.prompting()).toBe(false);
  });

  it('prompts on a programmatic close too when the host asks for it', () => {
    const g = createCloseGuard({ dirty: () => true, alwaysAllow: () => [] });
    expect(g.request('programmatic')).toBe(false);
    expect(g.pendingReason()).toBe('programmatic');
  });

  it('honours a custom allow-list', () => {
    const g = createCloseGuard({
      dirty: () => true,
      alwaysAllow: () => ['close-button', 'programmatic'],
    });

    expect(g.request('close-button')).toBe(true);
    expect(g.request('backdrop')).toBe(false);
  });

  it('asks nothing when the work is saved', () => {
    const dirty = signal(true);
    const g = createCloseGuard({ dirty: () => dirty() });

    expect(g.request('escape')).toBe(false);
    g.keep();

    dirty.set(false);
    expect(g.request('escape')).toBe(true);
    expect(g.prompting()).toBe(false);
  });

  it('reset forgets the prompt, so a reopened surface starts clean', () => {
    const g = createCloseGuard({ dirty: () => true });
    g.request('escape');
    g.reset();

    expect(g.prompting()).toBe(false);
    expect(g.discard()).toBeNull();
  });
});
