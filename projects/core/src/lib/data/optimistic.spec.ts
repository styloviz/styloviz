import { signal } from '@angular/core';
import { createOptimisticEdit } from './optimistic';

/**
 * The rule under test is the refusal, not the undo. Any component can call a
 * closure; what three of them had hand-rolled — and every one that gains an
 * optimistic action now inherits — is knowing when NOT to.
 */
describe('createOptimisticEdit', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  const setup = () => {
    let revision = 0;
    const state = signal('original');
    const edit = createOptimisticEdit({
      revision: () => revision,
      selector: 'sv-demo',
      superseded: 'the order has changed since. Bind [saving] to prevent it.',
    });
    /** Apply an edit the way a component does: mutate, bump, hand back a handle. */
    const apply = (value: string): (() => void) => {
      const before = state();
      state.set(value);
      revision++;
      return edit.begin(() => state.set(before));
    };
    return { state, apply };
  };

  it('undoes the edit it was taken for', () => {
    const { state, apply } = setup();
    const rollback = apply('edited');

    rollback();
    expect(state()).toBe('original');
    expect(warn).not.toHaveBeenCalled();
  });

  it('refuses once a later edit has landed, and says which input to bind', () => {
    // The whole point. The first handle is holding a snapshot that predates both
    // edits, so applying it would restore the first row AND silently throw away
    // the second — a change the user made and nothing would report.
    const { state, apply } = setup();
    const stale = apply('first');
    apply('second');

    stale();
    expect(state()).toBe('second');
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sv-demo: rollback() ignored'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[saving]'));
  });

  it('lets the newest handle undo even when older ones have gone stale', () => {
    const { state, apply } = setup();
    apply('first');
    const rollback = apply('second');

    rollback();
    expect(state()).toBe('first');
    expect(warn).not.toHaveBeenCalled();
  });

  it('is idempotent — a second call does not undo the undo', () => {
    // A host wired to both an error handler and a retry can call this twice, and
    // the second call must not walk the state backwards a step further.
    const { state, apply } = setup();
    const rollback = apply('edited');

    rollback();
    rollback();
    expect(state()).toBe('original');
  });

  it('tracks a revision the component does not own', () => {
    // The Gantt chart's token is its command history: undoing means popping a
    // command, and the revision is what makes that exact.
    const revision = signal(7);
    const undone: number[] = [];
    const edit = createOptimisticEdit({
      revision: () => revision(),
      selector: 'sv-gantt-chart',
      superseded: 'the schedule has changed since.',
    });

    const first = edit.begin(() => undone.push(1));
    revision.set(8);
    const second = edit.begin(() => undone.push(2));

    first();
    second();
    expect(undone).toEqual([2]);
  });
});
