import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { afterEach, vi } from 'vitest';
import { provideSvSensitivePrivacy, type SvSensitiveCopyEvent } from '@styloviz/core';
import { SV_COPY_TIMEOUT_MS, SvCopyToClipboardComponent } from './copy-to-clipboard.component';
import {
  SV_CLIPBOARD,
  SvClipboardError,
  svBrowserClipboard,
  type SvClipboardAdapter,
} from './clipboard.adapter';

/**
 * `LU-02` — the clipboard behind an adapter, a busy state, destruction during
 * feedback, and the sensitive-value policy.
 *
 * Every test here drives `SV_CLIPBOARD` rather than patching `navigator`, which
 * is the point of `LU-02-M3`: denied permission and insecure origins become
 * ordinary unit tests instead of "needs a real browser".
 */

/** An adapter whose writes the test settles by hand. */
function deferredClipboard() {
  const calls: string[] = [];
  let settle: { resolve: () => void; reject: (e: unknown) => void } | null = null;
  const adapter: SvClipboardAdapter = {
    writeText: (text) => {
      calls.push(text);
      return new Promise<void>((resolve, reject) => (settle = { resolve, reject }));
    },
  };
  return {
    adapter,
    calls,
    resolve: () => settle?.resolve(),
    reject: (e: unknown) => settle?.reject(e),
  };
}

async function setup(
  inputs: Partial<ComponentInput<SvCopyToClipboardComponent>> = {},
  adapter: SvClipboardAdapter = { writeText: () => Promise.resolve() },
  privacy = false,
) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvCopyToClipboardComponent, {
    inputs: { text: 'demo_secret_4eC39HqLyjWDarjtT1zdp7dc', ...inputs } as ComponentInput<SvCopyToClipboardComponent>,
    providers: [
      { provide: SV_CLIPBOARD, useValue: adapter },
      ...(privacy ? [provideSvSensitivePrivacy(true)] : []),
    ],
  });
  return fixture;
}

const host = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const copyButton = (f: { nativeElement: unknown }) =>
  host(f).querySelector('[data-sv-copy-button]') as HTMLButtonElement;
const live = (f: { nativeElement: unknown }) => host(f).querySelector('[role="status"]')?.textContent?.trim() ?? '';
const flush = () => new Promise<void>((r) => setTimeout(r));

afterEach(() => {
  vi.useRealTimers();
  TestBed.resetTestingModule();
});

// ── M2 / I2 / I4 — busy state and destruction ───────────────────────────────

describe('SvCopyToClipboardComponent — busy state (LU-02-M2)', () => {
  it.each(['inline', 'block', 'icon-only'] as const)(
    'ignores a click while a copy is in flight, with aria-busy set (%s)',
    async (variant) => {
      const clip = deferredClipboard();
      let copies = 0;
      const f = await setup({ variant }, clip.adapter);
      f.componentInstance.copied.subscribe(() => (copies += 1));

      copyButton(f).click();
      copyButton(f).click();
      copyButton(f).click();
      f.detectChanges();
      expect(clip.calls.length).toBe(1);
      expect(copyButton(f).getAttribute('aria-busy')).toBe('true');

      clip.resolve();
      await flush();
      f.detectChanges();
      expect(copies).toBe(1);
      expect(copyButton(f).hasAttribute('aria-busy')).toBe(false);
    },
  );

  it('accepts a new copy once the previous one settled, even if it failed', async () => {
    const clip = deferredClipboard();
    const f = await setup({}, clip.adapter);
    copyButton(f).click();
    clip.reject(new SvClipboardError('denied'));
    await flush();
    copyButton(f).click();
    expect(clip.calls.length).toBe(2);
  });
});

describe('SvCopyToClipboardComponent — destroyed during feedback (LU-02-I2)', () => {
  it('clears the success timer on destroy', async () => {
    vi.useFakeTimers();
    const f = await setup({ successDuration: 1_000 });
    await f.componentInstance.copy();
    const c = f.componentInstance;
    const pending = vi.getTimerCount();
    f.destroy();
    // The revert timer is gone from the queue, not merely left to fire harmlessly.
    expect(vi.getTimerCount()).toBeLessThan(pending);
    vi.advanceTimersByTime(5_000);
    expect(c.isCopied()).toBe(true);
  });

  it('does nothing when the clipboard settles after the component is gone', async () => {
    const clip = deferredClipboard();
    let copies = 0;
    let errors = 0;
    const f = await setup({}, clip.adapter);
    const c = f.componentInstance;
    c.copied.subscribe(() => (copies += 1));
    c.copyError.subscribe(() => (errors += 1));

    const pending = c.copy();
    f.destroy();
    vi.useFakeTimers();
    clip.resolve();
    const timers = vi.getTimerCount();
    await pending;
    expect(copies).toBe(0);
    expect(c.isCopied()).toBe(false);
    // No revert timer was scheduled against the destroyed instance.
    expect(vi.getTimerCount()).toBe(timers);

    // …and a late rejection is swallowed too, rather than emitting on a dead output.
    vi.useRealTimers();
    const clip2 = deferredClipboard();
    const f2 = await setup({}, clip2.adapter);
    f2.componentInstance.copyError.subscribe(() => (errors += 1));
    const pending2 = f2.componentInstance.copy();
    f2.destroy();
    clip2.reject(new SvClipboardError('failed'));
    await pending2;
    expect(errors).toBe(0);
  });
});

// ── M3 / I3 — the adapter, denied permission, insecure origins ──────────────

describe('SvCopyToClipboardComponent — failure reasons (LU-02-I3/M3)', () => {
  it.each([
    ['denied', 'Copy blocked by the browser'],
    ['insecure-context', 'secure (HTTPS) page'],
    ['unavailable', 'Clipboard unavailable'],
    ['failed', 'Copy failed'],
  ] as const)('emits reason %s on the existing error output and announces it', async (reason, words) => {
    const errors: unknown[] = [];
    const f = await setup({}, { writeText: () => Promise.reject(new SvClipboardError(reason)) });
    f.componentInstance.copyError.subscribe((e) => errors.push(e));
    await f.componentInstance.copy();
    f.detectChanges();

    expect(errors[0]).toBeInstanceOf(SvClipboardError);
    expect((errors[0] as SvClipboardError).reason).toBe(reason);
    expect(f.componentInstance.failureReason()).toBe(reason);
    expect(live(f)).toContain(words);
    expect(f.componentInstance.isCopied()).toBe(false);
  });

  it('wraps an adapter that rejects with something else as `failed`, keeping its message', async () => {
    const errors: unknown[] = [];
    const f = await setup({}, { writeText: () => Promise.reject(new Error('boom')) });
    f.componentInstance.copyError.subscribe((e) => errors.push(e));
    await f.componentInstance.copy();
    expect((errors[0] as SvClipboardError).reason).toBe('failed');
    expect((errors[0] as Error).message).toBe('boom');
  });
});

describe('svBrowserClipboard — the default adapter (LU-02-I3/M3)', () => {
  function fakeDoc(opts: { clipboard?: { writeText: (t: string) => Promise<void> }; secure?: boolean; exec?: boolean }) {
    const view = { navigator: { clipboard: opts.clipboard }, isSecureContext: opts.secure ?? true };
    const doc = document.implementation.createHTMLDocument('x');
    Object.defineProperty(doc, 'defaultView', { value: view, configurable: true });
    Object.defineProperty(doc, 'execCommand', { value: () => opts.exec ?? false, configurable: true });
    return doc;
  }
  const reasonOf = async (p: Promise<void>) => {
    try {
      await p;
      return 'ok';
    } catch (e) {
      return (e as SvClipboardError).reason;
    }
  };
  const denied = () => Promise.reject(new DOMException('no', 'NotAllowedError'));

  it('succeeds through the async API', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    expect(await reasonOf(svBrowserClipboard(fakeDoc({ clipboard: { writeText } })).writeText('a'))).toBe('ok');
    expect(writeText).toHaveBeenCalledWith('a');
  });

  it('falls back to execCommand when permission is denied, and reports `denied` when that fails too', async () => {
    expect(await reasonOf(svBrowserClipboard(fakeDoc({ clipboard: { writeText: denied }, exec: true })).writeText('a'))).toBe('ok');
    expect(await reasonOf(svBrowserClipboard(fakeDoc({ clipboard: { writeText: denied }, exec: false })).writeText('a'))).toBe('denied');
  });

  it('reports `insecure-context` over plain HTTP, where there is no async API', async () => {
    expect(await reasonOf(svBrowserClipboard(fakeDoc({ secure: false, exec: false })).writeText('a'))).toBe('insecure-context');
    // …but the legacy command still works there when the browser allows it.
    expect(await reasonOf(svBrowserClipboard(fakeDoc({ secure: false, exec: true })).writeText('a'))).toBe('ok');
  });

  it('reports `unavailable` with no window (server render)', async () => {
    const doc = document.implementation.createHTMLDocument('x');
    Object.defineProperty(doc, 'defaultView', { value: null, configurable: true });
    expect(await reasonOf(svBrowserClipboard(doc).writeText('a'))).toBe('unavailable');
  });

  it('removes the scratch textarea whether the fallback succeeded or not', async () => {
    const doc = fakeDoc({ secure: false, exec: false });
    await reasonOf(svBrowserClipboard(doc).writeText('a'));
    expect(doc.querySelectorAll('textarea').length).toBe(0);
  });
});

// ── M1 / I1 — the sensitive-value policy ────────────────────────────────────

describe('SvCopyToClipboardComponent — sensitive values (LU-02-I1/M1)', () => {
  const KEY = 'demo_secret_4eC39HqLyjWDarjtT1zdp7dc';

  it('changes nothing when `sensitive` is off', async () => {
    const audits: SvSensitiveCopyEvent[] = [];
    const f = await setup({ variant: 'block', label: KEY });
    f.componentInstance.copyAudited.subscribe((e) => audits.push(e));
    expect(host(f).textContent).toContain(KEY);
    await f.componentInstance.copy();
    f.detectChanges();
    expect(audits.length).toBe(0);
    expect(live(f)).toBe('Copied!');
    expect(host(f).querySelector('[data-sv-copy-warning]')).toBeNull();
  });

  it.each(['inline', 'block'] as const)('masks the shown label but copies the real value (%s)', async (variant) => {
    const calls: string[] = [];
    const f = await setup({ variant, label: KEY, sensitive: true }, { writeText: async (t) => void calls.push(t) });
    expect(host(f).textContent).not.toContain(KEY);
    expect(host(f).textContent).toContain('p7dc');
    expect(host(f).querySelector('[data-sv-masked="true"]')).not.toBeNull();
    await f.componentInstance.copy();
    expect(calls).toEqual([KEY]);
  });

  it('audits a sensitive copy with the shared event shape, never the value, and warns', async () => {
    const audits: SvSensitiveCopyEvent[] = [];
    const f = await setup({ variant: 'block', label: KEY, sensitive: true, sensitiveField: 'apiKey' });
    f.componentInstance.copyAudited.subscribe((e) => audits.push(e));
    await f.componentInstance.copy();
    f.detectChanges();

    expect(audits).toHaveLength(1);
    expect(audits[0]).toEqual({ source: 'sv-copy-to-clipboard', field: 'apiKey', redacted: false, at: expect.any(Number) });
    expect(JSON.stringify(audits[0])).not.toContain(KEY);
    expect(live(f)).toContain('secret');
    expect(host(f).querySelector('[data-sv-copy-warning]')?.textContent).toContain('secret');
  });

  it('does not audit a copy that failed', async () => {
    const audits: SvSensitiveCopyEvent[] = [];
    const f = await setup({ sensitive: true }, { writeText: () => Promise.reject(new SvClipboardError('denied')) });
    f.componentInstance.copyAudited.subscribe((e) => audits.push(e));
    await f.componentInstance.copy();
    expect(audits).toHaveLength(0);
  });

  it('asks the host before revealing, then reveals once authorized', async () => {
    let requests = 0;
    const f = await setup({ variant: 'inline', label: KEY, sensitive: true, sensitiveReveal: 'revealable' });
    f.componentInstance.revealRequest.subscribe(() => (requests += 1));
    const toggle = () => host(f).querySelector('[data-sv-copy-reveal]') as HTMLButtonElement;

    toggle().click();
    f.detectChanges();
    expect(requests).toBe(1);
    expect(host(f).textContent).not.toContain(KEY);

    f.componentRef.setInput('revealAuthorized', true);
    f.detectChanges();
    toggle().click();
    f.detectChanges();
    expect(host(f).textContent).toContain(KEY);
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
  });

  it('reveals without asking when authorization is not required', async () => {
    const f = await setup({ variant: 'block', label: KEY, sensitive: true, sensitiveReveal: 'revealable', requireAuthorization: false });
    (host(f).querySelector('[data-sv-copy-reveal]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(host(f).textContent).toContain(KEY);
  });

  it('re-masks and hides the reveal while the session is declared private', async () => {
    const f = await setup(
      { variant: 'block', label: KEY, sensitive: true, sensitiveReveal: 'visible' },
      undefined,
      true,
    );
    expect(host(f).textContent).not.toContain(KEY);
    expect(host(f).querySelector('[data-sv-copy-reveal]')).toBeNull();
  });

  it('shows a `visible` sensitive value in full, still auditing the copy', async () => {
    const audits: SvSensitiveCopyEvent[] = [];
    const f = await setup({ variant: 'block', label: KEY, sensitive: true, sensitiveReveal: 'visible' });
    f.componentInstance.copyAudited.subscribe((e) => audits.push(e));
    expect(host(f).textContent).toContain(KEY);
    await f.componentInstance.copy();
    expect(audits).toHaveLength(1);
  });
});

// ── Wave 2 — a write that never settles, and what `cause` is ────────────────

/**
 * Angular's zoneless scheduler arms its own timer / frame whenever a signal the
 * view reads changes, so a raw timer count mixes those in. Letting one frame's
 * worth of fake time pass drains them, leaving only the component's own timers.
 */
const SCHEDULER_MS = 20;
const settleScheduler = () => vi.advanceTimersByTimeAsync(SCHEDULER_MS);

describe('SvCopyToClipboardComponent — a clipboard that never answers', () => {
  const never: SvClipboardAdapter = { writeText: () => new Promise<void>(() => undefined) };

  it.each(['inline', 'block', 'icon-only'] as const)(
    'fails as `failed` and clears busy after the default 10 s (%s)',
    async (variant) => {
      vi.useFakeTimers();
      const errors: unknown[] = [];
      const f = await setup({ variant }, never);
      f.componentInstance.copyError.subscribe((e) => errors.push(e));

      const pending = f.componentInstance.copy();
      f.detectChanges();
      expect(f.componentInstance.busy()).toBe(true);
      expect(copyButton(f).getAttribute('aria-busy')).toBe('true');

      await vi.advanceTimersByTimeAsync(SV_COPY_TIMEOUT_MS - 1);
      expect(f.componentInstance.busy()).toBe(true);
      expect(errors).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(1);
      await pending;
      f.detectChanges();
      expect(f.componentInstance.busy()).toBe(false);
      expect(copyButton(f).getAttribute('aria-busy')).not.toBe('true');
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(SvClipboardError);
      expect((errors[0] as SvClipboardError).reason).toBe('failed');
      expect(f.componentInstance.failureReason()).toBe('failed');
      expect(live(f)).toContain('Copy failed');
      expect(f.componentInstance.isCopied()).toBe(false);
    },
  );

  it('honours an overridden copyTimeout and leaves no timer behind', async () => {
    vi.useFakeTimers();
    const f = await setup({ copyTimeout: 500 }, never);
    await settleScheduler();
    const baseline = vi.getTimerCount();
    const pending = f.componentInstance.copy();
    await settleScheduler();
    expect(vi.getTimerCount()).toBe(baseline + 1);
    await vi.advanceTimersByTimeAsync(499 - SCHEDULER_MS);
    expect(f.componentInstance.busy()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(f.componentInstance.busy()).toBe(false);
    await settleScheduler();
    expect(vi.getTimerCount()).toBe(baseline);
  });

  it('ignores a late answer after the timeout, and a later click can copy again', async () => {
    vi.useFakeTimers();
    const clip = deferredClipboard();
    let copies = 0;
    const f = await setup({ copyTimeout: 500 }, clip.adapter);
    f.componentInstance.copied.subscribe(() => (copies += 1));
    const first = f.componentInstance.copy();
    await vi.advanceTimersByTimeAsync(500);
    await first;
    clip.resolve(); // the abandoned write answers late
    await vi.advanceTimersByTimeAsync(0);
    expect(copies).toBe(0);
    expect(f.componentInstance.isCopied()).toBe(false);

    const second = f.componentInstance.copy();
    clip.resolve();
    await second;
    expect(copies).toBe(1);
    expect(clip.calls).toHaveLength(2);
  });

  it('clears the pending timeout when the write settles in time', async () => {
    vi.useFakeTimers();
    const f = await setup({ successDuration: 1_000 });
    await settleScheduler();
    const baseline = vi.getTimerCount();
    await f.componentInstance.copy();
    await settleScheduler();
    // Only the success-revert timer was added; the 10 s timeout is gone.
    expect(vi.getTimerCount()).toBe(baseline + 1);
    await vi.advanceTimersByTimeAsync(1_000);
    await settleScheduler();
    expect(f.componentInstance.isCopied()).toBe(false);
    expect(vi.getTimerCount()).toBe(baseline);
  });

  it('clears the pending timeout when destroyed mid-write', async () => {
    vi.useFakeTimers();
    const f = await setup({}, never);
    await settleScheduler();
    const baseline = vi.getTimerCount();
    void f.componentInstance.copy();
    await settleScheduler();
    expect(vi.getTimerCount()).toBe(baseline + 1);
    f.destroy();
    await settleScheduler();
    expect(vi.getTimerCount()).toBe(baseline);
  });
});

describe('svBrowserClipboard — `cause` when both paths fail', () => {
  it('is the fallback error, while the reason comes from the Clipboard API rejection', async () => {
    const view = {
      navigator: { clipboard: { writeText: () => Promise.reject(new DOMException('no', 'NotAllowedError')) } },
      isSecureContext: true,
    };
    const doc = document.implementation.createHTMLDocument('x');
    Object.defineProperty(doc, 'defaultView', { value: view, configurable: true });
    Object.defineProperty(doc, 'execCommand', { value: () => false, configurable: true });
    let caught: unknown = null;
    try {
      await svBrowserClipboard(doc).writeText('a');
    } catch (e) {
      caught = e;
    }
    const err = caught as SvClipboardError;
    expect(err.reason).toBe('denied');
    expect(err.cause).toBeInstanceOf(Error);
    expect((err.cause as Error).message).toBe('execCommand copy returned false');
    expect(err.message).toBe('execCommand copy returned false');
  });
});

// ── Re-verification — defects found after the first pass ───────────────────

describe('SvCopyToClipboardComponent — re-verification (LU-02)', () => {
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'still abandons a never-settling write when copyTimeout is invalid (%s)',
    async (copyTimeout) => {
      vi.useFakeTimers();
      const never: SvClipboardAdapter = { writeText: () => new Promise<void>(() => undefined) };
      const f = await setup({ copyTimeout }, never);
      const pending = f.componentInstance.copy();
      await vi.advanceTimersByTimeAsync(SV_COPY_TIMEOUT_MS);
      await pending;
      expect(f.componentInstance.busy()).toBe(false);
      expect(f.componentInstance.failureReason()).toBe('failed');
    },
  );

  it('a failure right after a success shows the failure, and the old timer does not wipe it', async () => {
    vi.useFakeTimers();
    let fail = false;
    const adapter: SvClipboardAdapter = {
      writeText: () => (fail ? Promise.reject(new SvClipboardError('denied')) : Promise.resolve()),
    };
    const f = await setup({ successDuration: 2000 }, adapter);
    await f.componentInstance.copy();
    expect(f.componentInstance.isCopied()).toBe(true);

    fail = true;
    await vi.advanceTimersByTimeAsync(500);
    await f.componentInstance.copy();
    expect(f.componentInstance.isCopied()).toBe(false);
    const failure = f.componentInstance.srStatus();
    expect(failure).not.toBe('');

    await vi.advanceTimersByTimeAsync(2000);
    expect(f.componentInstance.srStatus()).toBe(failure);
  });

  it.each([
    ['a 6-digit code is fully masked', '123-456', '•••-•••'],
    ['a 12-character key keeps a quarter (three)', 'abcd-efgh-ijkl', '••••-••••-•jkl'],
    ['a 4-character PIN is fully masked', '1234', '••••'],
    ['a long key still keeps four', 'demo_secret_4eC39HqLyjWDarjtT1zdp7dc', 'p7dc'],
  ])('masks short values proportionally: %s', async (_label, value, expected) => {
    const f = await setup({ variant: 'block', label: value, text: value, sensitive: true });
    f.detectChanges();
    const shown = f.componentInstance.displayLabel();
    if (expected.length === value.length) expect(shown).toBe(expected);
    else expect(shown.endsWith(expected)).toBe(true);
  });
});

describe('SvCopyToClipboardComponent — accessible name', () => {
  it.each(['inline', 'block', 'icon-only'] as const)('names the button from ariaLabel (%s)', async (variant) => {
    const f = await setup({ variant, ariaLabel: 'Copy API key' });
    f.detectChanges();
    expect(copyButton(f).getAttribute('aria-label')).toBe('Copy API key');
  });
});
