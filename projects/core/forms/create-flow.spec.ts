import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SvLiveAnnouncer } from '@styloviz/core/a11y';
import { createCreateFlow, type SvCreateFlow } from './create-flow';

/**
 * `X-13` / `FL-J3-FI-03` — the shared create-new state machine behind
 * sv-autocomplete, sv-select-dropdown-pro and sv-tag-input-pro.
 */
describe('createCreateFlow', () => {
  let values: string[];
  let labels: Map<string, string>;
  let flow: SvCreateFlow;
  let live: SvLiveAnnouncer;

  beforeEach(() => {
    TestBed.resetTestingModule();
    values = [];
    labels = new Map();
    const injector = TestBed.inject(Injector);
    live = TestBed.inject(SvLiveAnnouncer);
    live.clearHistory();
    flow = runInInjectionContext(injector, () => createCreateFlow({
      commit: ({ value, label }) => { values.push(value); labels.set(value, label); },
      replace: (from, to) => { values = values.map(v => (v === from ? to.value : v)); labels.delete(from); labels.set(to.value, to.label); },
      remove: (value) => { values = values.filter(v => v !== value); labels.delete(value); },
    }));
  });

  const said = () => live.history().map(h => h.message);

  describe('immediate (awaitCreate off — the default)', () => {
    it('commits at once and reports the request as not awaited', () => {
      const r = flow.begin('Design', 'design', false);
      expect(values).toEqual(['design']);
      expect(flow.pending()).toBeNull();
      expect(r).toEqual(expect.objectContaining({ label: 'Design', value: 'design', awaited: false }));
      expect(r.requestKey).toBeTruthy();
    });

    it('resolve() with the server id swaps the value and label', () => {
      const r = flow.begin('Design', 'design', false);
      r.resolve({ value: 'tag_42', label: 'Design team' });
      expect(values).toEqual(['tag_42']);
      expect(labels.get('tag_42')).toBe('Design team');
    });

    it('reject() takes the entry back out and announces why, assertively', () => {
      const r = flow.begin('Design', 'design', false);
      r.reject('Name already taken');
      expect(values).toEqual([]);
      expect(flow.error()).toBe('Name already taken');
      expect(live.history().at(-1)).toEqual(expect.objectContaining({ message: 'Name already taken', priority: 'assertive' }));
    });
  });

  describe('awaited (awaitCreate on)', () => {
    it('shows the entry as pending, NOT in the value, and announces it', () => {
      flow.begin('Design', 'design', true);
      expect(values).toEqual([]);
      expect(flow.pending()).toEqual(expect.objectContaining({ label: 'Design', value: 'design' }));
      expect(said()).toContain('Creating “Design”…');
    });

    it('resolve() commits the server’s entity and clears the pending one', () => {
      const r = flow.begin('Design', 'design', true);
      r.resolve({ value: 'tag_42' });
      expect(values).toEqual(['tag_42']);
      expect(labels.get('tag_42')).toBe('Design');
      expect(flow.pending()).toBeNull();
      expect(said()).toContain('“Design” created');
    });

    it('reject() drops the pending entry and falls back to a labelled message', () => {
      const r = flow.begin('Design', 'design', true);
      r.reject();
      expect(values).toEqual([]);
      expect(flow.pending()).toBeNull();
      expect(flow.error()).toBe('Could not create “Design”.');
    });
  });

  it('settles each request once — a retried callback cannot add or remove twice', () => {
    const r = flow.begin('Design', 'design', true);
    r.resolve();
    r.resolve();
    r.reject();
    expect(values).toEqual(['design']);
    expect(flow.error()).toBe('');
  });

  it('a new create clears the previous failure', () => {
    flow.begin('A', 'a', false).reject('no');
    expect(flow.error()).toBe('no');
    flow.begin('B', 'b', false);
    expect(flow.error()).toBe('');
  });

  it('ignores settlement after its owner is destroyed', () => {
    const r = flow.begin('Design', 'design', true);
    TestBed.resetTestingModule();
    r.resolve();
    expect(values).toEqual([]);
  });
});
