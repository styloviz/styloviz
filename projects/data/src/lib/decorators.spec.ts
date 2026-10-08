import { createQuery, type SvPage } from '@styloviz/core';
import { withFailure, withFlakiness, withLatency } from './decorators';
import type { SvDataSource } from './types';

const ok: SvDataSource<string> = async () => ({ items: ['a'], total: 1, cursor: null }) as SvPage<string>;
const live = () => new AbortController().signal;

describe('withLatency', () => {
  it('delays the answer', async () => {
    const started = Date.now();
    await withLatency(ok, 30)(createQuery(), live());
    expect(Date.now() - started).toBeGreaterThanOrEqual(25);
  });

  it('gives up as soon as the request is superseded', async () => {
    // Otherwise a demo with latency leaks a timer per keystroke.
    const ac = new AbortController();
    const promise = withLatency(ok, 1000)(createQuery(), ac.signal);
    ac.abort(new DOMException('superseded', 'AbortError'));
    await expect(promise).rejects.toBeDefined();
  });

  it('re-reads a function per request, so a slider can drive it', async () => {
    let ms = 0;
    const src = withLatency(ok, () => ms);
    await src(createQuery(), live());
    ms = 20;
    const started = Date.now();
    await src(createQuery(), live());
    expect(Date.now() - started).toBeGreaterThanOrEqual(15);
  });
});

describe('withFailure', () => {
  it('fails with a retryable status by default', async () => {
    await expect(withFailure(ok, { when: true })(createQuery(), live()))
      .rejects.toMatchObject({ status: 503, retryable: true });
  });

  it('can fail with a status that earns no retry', async () => {
    // Seeing both is the point: a 404 must not offer a button that can only
    // fail again.
    await expect(withFailure(ok, { when: true, status: 404 })(createQuery(), live()))
      .rejects.toMatchObject({ status: 404, retryable: false });
  });

  it('re-reads the toggle per request, so a demo can flip it live', async () => {
    let broken = true;
    const src = withFailure(ok, { when: () => broken });
    await expect(src(createQuery(), live())).rejects.toBeDefined();
    broken = false;
    await expect(src(createQuery(), live())).resolves.toMatchObject({ items: ['a'] });
  });

  it('passes through untouched when healthy', async () => {
    await expect(withFailure(ok, { when: false })(createQuery(), live()))
      .resolves.toMatchObject({ items: ['a'] });
  });
});

describe('withFlakiness', () => {
  it('fails when the roll is under the rate', async () => {
    await expect(withFlakiness(ok, 0.5, () => 0.1)(createQuery(), live())).rejects.toBeDefined();
  });

  it('succeeds when the roll is over the rate', async () => {
    await expect(withFlakiness(ok, 0.5, () => 0.9)(createQuery(), live())).resolves.toBeDefined();
  });

  it('clamps the rate, so 2 does not mean "sometimes"', async () => {
    await expect(withFlakiness(ok, 2, () => 0.999)(createQuery(), live())).rejects.toBeDefined();
    await expect(withFlakiness(ok, -1, () => 0)(createQuery(), live())).resolves.toBeDefined();
  });
});
