import { ToastService } from './toast.service';

/**
 * FL-J3-OF-07 · OF-19-M5 — `ToastService.promise()`: one toast that goes
 * pending → success / error, in place, and hands the work's own promise back.
 */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('ToastService.promise()', () => {
  it('★ shows one pending toast that persists and cannot be closed while the work runs', () => {
    const s = new ToastService();
    const work = deferred<number>();
    void s.promise(work.promise, { loading: 'Saving…', success: 'Saved', error: 'Failed' }).catch(() => undefined);
    const [t] = s.toasts();
    expect(s.toasts()).toHaveLength(1);
    expect(t.message).toBe('Saving…');
    expect(t.pending).toBe(true);
    expect(t.duration).toBe(0);
    expect(t.dismissible).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(s.toasts()).toHaveLength(1);
  });

  it('★ turns the SAME toast into the success toast, with no repeat count, then times out', async () => {
    const s = new ToastService();
    const work = deferred<number>();
    const result = s.promise(work.promise, { loading: 'Saving…', success: (n) => `Saved ${n} rows`, error: 'Failed' });
    const id = s.toasts()[0].id;
    work.resolve(3);
    await expect(result).resolves.toBe(3);
    const [t] = s.toasts();
    expect(t.id).toBe(id);
    expect(t.variant).toBe('success');
    expect(t.message).toBe('Saved 3 rows');
    expect(t.pending).toBe(false);
    expect(t.count).toBe(1);
    expect(t.dismissible).toBe(true);
    vi.advanceTimersByTime(4000);
    expect(s.toasts()).toHaveLength(0);
  });

  it('turns it into the error toast, holds it 6 s, and rejects with the work\'s own error', async () => {
    const s = new ToastService();
    const work = deferred<number>();
    const boom = new Error('quota');
    const result = s.promise(work.promise, { loading: 'Uploading…', success: 'Done', error: (e) => `Upload failed: ${(e as Error).message}` });
    work.reject(boom);
    await expect(result).rejects.toBe(boom);
    const [t] = s.toasts();
    expect(t.variant).toBe('error');
    expect(t.message).toBe('Upload failed: quota');
    vi.advanceTimersByTime(5999);
    expect(s.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(s.toasts()).toHaveLength(0);
  });

  it('accepts a function that starts the work, and a synchronous throw becomes the error toast', async () => {
    const s = new ToastService();
    await expect(s.promise(() => Promise.resolve('ok'), { loading: 'L', success: 'S', error: 'E' })).resolves.toBe('ok');
    const result = s.promise(() => { throw new Error('sync'); }, { loading: 'L', success: 'S', error: 'E' });
    await expect(result).rejects.toThrow('sync');
    expect(s.toasts().at(-1)?.message).toBe('E');
  });

  it('two concurrent promises are two toasts, even with identical text', () => {
    const s = new ToastService();
    void s.promise(deferred<void>().promise, { loading: 'Saving…', success: 'Saved', error: 'Failed' });
    void s.promise(deferred<void>().promise, { loading: 'Saving…', success: 'Saved', error: 'Failed' });
    expect(s.toasts()).toHaveLength(2);
  });

  it('raises the outcome as a new toast when the pending one was dismissed', async () => {
    const s = new ToastService();
    const work = deferred<void>();
    const result = s.promise(work.promise, { loading: 'Saving…', success: 'Saved', error: 'Failed' }, { dismissible: true });
    s.dismiss(s.toasts()[0].id);
    work.resolve();
    await result;
    expect(s.toasts().map((t) => t.message)).toEqual(['Saved']);
  });

  it('honours the caller\'s duration and position for the outcome', async () => {
    const s = new ToastService();
    const work = deferred<void>();
    const result = s.promise(work.promise, { loading: 'L', success: 'S', error: 'E' }, { duration: 1000, position: 'bottom-left' });
    expect(s.toasts()[0].position).toBe('bottom-left');
    work.resolve();
    await result;
    expect(s.toasts()[0].duration).toBe(1000);
  });
});
