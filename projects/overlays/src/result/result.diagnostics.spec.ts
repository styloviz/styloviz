import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import type { SvDataError } from '@styloviz/core';
import { SvResultComponent } from './result.component';

/**
 * `OF-16-I1` / `OF-16-I3` / `OF-16-M2` / `OF-16-M3` / `OF-16-M5` — what an
 * error page owes the person who has to support it.
 *
 * ★★★ "IT SAID SOMETHING WENT WRONG" IS AN UNANSWERABLE TICKET: nobody can
 *     find the request. The same sentence with a correlation id is one log
 *     query, and the id is already on the error — it was being thrown away.
 */

const err = (over: Partial<SvDataError> = {}): SvDataError => ({
  message: 'Could not load the report.',
  retryable: true,
  ...over,
});

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const view = await render(SvResultComponent, {
    inputs: { status: 'error', title: 'Could not load the report', ...inputs },
  });
  const host = view.fixture.nativeElement as HTMLElement;
  return {
    ...view,
    component: view.fixture.componentInstance,
    host,
    reference: () => host.querySelector('[data-sv-reference]') as HTMLElement | null,
    copyBtn: () => host.querySelector('[data-sv-copy-reference]') as HTMLButtonElement | null,
    details: () => host.querySelector('[data-sv-details]') as HTMLDetailsElement | null,
    heading: () => host.querySelector('h2') as HTMLHeadingElement | null,
  };
}

afterEach(() => vi.useRealTimers());

describe('SvResultComponent — the reference (OF-16-M2)', () => {
  it('renders the correlation id the error carries', async () => {
    const view = await setup({ error: err({ reference: '7f3a9c2' }) });
    expect(view.reference()?.textContent).toContain('7f3a9c2');
  });

  it('renders nothing when the error has no reference', async () => {
    const view = await setup({ error: err() });
    expect(view.reference()).toBeNull();
  });

  it('renders nothing with no error at all', async () => {
    const view = await setup();
    expect(view.reference()).toBeNull();
  });

  it('★ makes it selectable and monospaced, for reading out and pasting', async () => {
    // It gets read over the phone and pasted into forms, so it has to be
    // unambiguous — and selectable even where the clipboard API is missing.
    const view = await setup({ error: err({ reference: 'lI10O' }) });
    const code = view.reference()?.querySelector('code') as HTMLElement;
    expect(code.className).toContain('font-mono');
    expect(code.className).toContain('select-all');
  });
});

describe('SvResultComponent — copying it', () => {
  it('copies to the clipboard and confirms', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    try {
      const view = await setup({ error: err({ reference: 'ref-1' }) });
      await view.component.copyReference();
      view.fixture.detectChanges();

      expect(writeText).toHaveBeenCalledWith('ref-1');
      // ★ The confirmation is the point, not the clipboard call: a button that
      //   looks identical before and after is pressed three times and then the
      //   id is typed by hand anyway.
      expect(view.copyBtn()?.textContent?.trim()).toBe('Copied');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('goes back to the copy label after a moment', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    try {
      const view = await setup({ error: err({ reference: 'ref-1' }) });
      await view.component.copyReference();
      expect(view.component.copied()).toBe(true);
      vi.advanceTimersByTime(2000);
      expect(view.component.copied()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('★ does not claim to have copied when the clipboard refuses', async () => {
    // `navigator.clipboard` rejects in a non-secure context and when the
    // document is not focused. Saying "Copied" then is a lie, and the
    // reference is still on screen to read out — so there is no error state.
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    try {
      const view = await setup({ error: err({ reference: 'ref-1' }) });
      await view.component.copyReference();
      expect(view.component.copied()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('survives a browser with no clipboard API at all', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    try {
      const view = await setup({ error: err({ reference: 'ref-1' }) });
      await expect(view.component.copyReference()).resolves.toBeUndefined();
      expect(view.component.copied()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('renders no copy button when copyLabel is null', async () => {
    const view = await setup({ error: err({ reference: 'ref-1' }), copyLabel: null });
    expect(view.reference()).not.toBeNull();
    expect(view.copyBtn()).toBeNull();
  });

  it('does nothing when there is no reference to copy', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    try {
      const view = await setup({ error: err() });
      await view.component.copyReference();
      expect(writeText).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('SvResultComponent — technical details (OF-16-M3)', () => {
  it('is collapsed and opt-in', async () => {
    const view = await setup({ error: err({ status: 503, code: 'UPSTREAM' }) });
    expect(view.details()).toBeNull();
  });

  it('shows status and code when asked', async () => {
    const view = await setup({
      error: err({ status: 503, code: 'UPSTREAM' }),
      showDetails: true,
    });
    const text = view.details()?.textContent ?? '';
    expect(text).toContain('503');
    expect(text).toContain('UPSTREAM');
    expect(view.details()?.open).toBe(false);
  });

  it('★ never renders `cause`, whatever is in it', async () => {
    // A raw thrown value is a stack trace or a response body, sometimes with a
    // token in a URL — and an error page is a screen people photograph.
    const view = await setup({
      error: err({ status: 500, cause: { secret: 'token=abc123', stack: 'at boom()' } }),
      showDetails: true,
    });
    expect(view.host.textContent).not.toContain('abc123');
    expect(view.host.textContent).not.toContain('at boom()');
  });

  it('renders no details block when there is nothing to put in it', async () => {
    const view = await setup({ error: err(), showDetails: true });
    expect(view.details()).toBeNull();
  });

  it('lists only the fields the error actually has', async () => {
    const view = await setup({ error: err({ status: 404 }), showDetails: true });
    expect(view.component.detailRows()).toEqual([{ label: 'Status', value: '404' }]);
  });

  it('includes a zero status, which means "no response at all"', async () => {
    const view = await setup({ error: err({ status: 0 }), showDetails: true });
    expect(view.component.detailRows()).toEqual([{ label: 'Status', value: '0' }]);
  });
});

describe('SvResultComponent — focusing the heading (OF-16-I3, OF-16-M5)', () => {
  it('★ takes focus when asked, because a routed error page leaves it behind', async () => {
    // The SPA swapped the view; focus is still on whatever the user clicked —
    // often an element that no longer exists, so it fell to <body>.
    const view = await setup({ focusHeading: true });
    expect(document.activeElement).toBe(view.heading());
  });

  it('★ is focusable only then — a heading is not focusable by default', async () => {
    // Focusing an unfocusable element is a silent no-op, which is the bug this
    // input exists to fix, arrived at from the other side.
    const on = await setup({ focusHeading: true });
    expect(on.heading()?.getAttribute('tabindex')).toBe('-1');

    const off = await setup();
    expect(off.heading()?.getAttribute('tabindex')).toBeNull();
  });

  it('does not steal focus by default, because sv-result is also used inline', async () => {
    const before = document.activeElement;
    const view = await setup();
    expect(document.activeElement).toBe(before);
    expect(view.heading()).not.toBe(document.activeElement);
  });

  it('is `-1` rather than `0`, so it is not a permanent tab stop', async () => {
    const view = await setup({ focusHeading: true });
    expect(view.heading()?.getAttribute('tabindex')).not.toBe('0');
  });
});
