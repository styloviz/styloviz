import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createStreamOverlay } from './stream-overlay';

interface Row { id: string; label: string; status?: string }

const row = (id: string, label = id): Row => ({ id, label });

/** The overlay uses computed(), which needs a reactive context to run in. */
function make(initial: Row[] = []) {
  const base = signal<readonly Row[]>(initial);
  const overlay = TestBed.runInInjectionContext(() =>
    createStreamOverlay<Row>(() => base(), 'id'),
  );
  return { base, overlay };
}

describe('createStreamOverlay', () => {
  it('passes the host list straight through when nothing has streamed', () => {
    const { base, overlay } = make([row('a')]);
    expect(overlay.merged()).toBe(base());
    expect(overlay.dirty()).toBe(false);
  });

  it('appends without the host rebuilding its array', () => {
    const { overlay } = make([row('a')]);
    overlay.append(row('b'));
    expect(overlay.merged().map((r) => r.id)).toEqual(['a', 'b']);
    expect(overlay.dirty()).toBe(true);
  });

  it('patches an item the host owns without mutating it', () => {
    const original = row('a');
    const { overlay } = make([original]);
    overlay.patch('a', { status: 'failed' });
    expect(overlay.merged()[0].status).toBe('failed');
    expect(original.status).toBeUndefined();
  });

  it('treats a redelivered key as a patch, not a duplicate row', () => {
    // A reconnecting EventSource replays; a doubled row is worse than a missed
    // one because totals computed from the list silently double with it.
    const { overlay } = make([row('a')]);
    overlay.append(row('b', 'first'));
    overlay.append(row('b', 'corrected'));
    expect(overlay.merged()).toHaveLength(2);
    expect(overlay.merged()[1].label).toBe('corrected');
  });

  it('patches in place when the stream re-sends an item the host already had', () => {
    const { overlay } = make([row('a', 'old')]);
    overlay.append(row('a', 'new'));
    expect(overlay.merged()).toHaveLength(1);
    expect(overlay.merged()[0].label).toBe('new');
  });

  it('evaporates when the host swaps in a new list', () => {
    const { base, overlay } = make([row('a')]);
    overlay.append(row('b'));
    base.set([row('z')]);
    expect(overlay.merged().map((r) => r.id)).toEqual(['z']);
    expect(overlay.dirty()).toBe(false);
  });

  it('keeps streaming when the host re-emits the same array reference', () => {
    const same = [row('a')];
    const { base, overlay } = make(same);
    overlay.append(row('b'));
    base.set(same);
    expect(overlay.merged()).toHaveLength(2);
  });

  it('clears on request, leaving the host list as given', () => {
    const { base, overlay } = make([row('a')]);
    overlay.append(row('b'));
    overlay.patch('a', { status: 'failed' });
    overlay.clear();
    expect(overlay.merged()).toBe(base());
    expect(overlay.dirty()).toBe(false);
  });

  it('accepts a key function for composite identities', () => {
    const base = signal<readonly Row[]>([{ id: 'a', label: 'x' }]);
    const overlay = TestBed.runInInjectionContext(() =>
      createStreamOverlay<Row>(() => base(), (r) => `${r.id}:${r.label}`),
    );
    overlay.append({ id: 'a', label: 'y' });
    expect(overlay.merged()).toHaveLength(2);
  });
});
