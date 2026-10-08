import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { afterEach, vi } from 'vitest';
import { SvOverlayStackService } from '@styloviz/core';
import { SvProductTourComponent } from './product-tour.component';
import {
  svSerializeTourProgress,
  svRestoreTourProgress,
  type SvTourProgress,
  type SvTourProgressRestored,
  type SvTourSchemaStale,
} from './product-tour.progress';
import type { TourStep } from './product-tour.types';
import { flush, until } from '@testing/async';

/**
 * `sv-product-tour` (free) — the resume policies one by one, the record when
 * the tour is restored while shut or reopened after finishing, storage that is
 * not there, and the keyboard of a tour that cannot be skipped.
 */

const STEPS: TourStep[] = [
  { id: 'welcome', title: 'One', content: '.' },
  { id: 'filters', title: 'Two', content: '.' },
  { id: 'export', title: 'Three', content: '.' },
];

const KEY = 'sv-test-tour-resume-free';

function store(progress: Partial<SvTourProgress> = {}): void {
  localStorage.setItem(KEY, JSON.stringify(svSerializeTourProgress({
    tourId: 'onboarding', tourVersion: 1, stepId: 'export', completedIds: [], status: 'active', ...progress,
  })));
}

function stored(): SvTourProgress | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  const result = svRestoreTourProgress(JSON.parse(raw));
  return result.ok ? result.state : null;
}

async function open(inputs: Partial<ComponentInput<SvProductTourComponent>> = {}) {
  TestBed.resetTestingModule();
  const restored: SvTourProgressRestored[] = [];
  const stale: SvTourSchemaStale[] = [];
  const r = await render(SvProductTourComponent, {
    inputs: {
      steps: STEPS, active: true, tourId: 'onboarding', persistKey: KEY, ...inputs,
    } as ComponentInput<SvProductTourComponent>,
    on: {
      progressRestored: (e: SvTourProgressRestored) => restored.push(e),
      schemaStale: (e: SvTourSchemaStale) => stale.push(e),
    } as Record<string, (e: never) => void>,
  });
  await flush();
  r.fixture.detectChanges();
  return { ...r, c: r.fixture.componentInstance, restored, stale };
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const title = () => dialog()?.querySelector('h2')?.textContent?.trim();

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  vi.restoreAllMocks();
  document.querySelectorAll('body > div').forEach((n) => {
    if (n.querySelector('[role="dialog"]')) n.remove();
  });
});

describe('SvProductTourComponent (free) — the resume policy', () => {
  it('restarts and says so when the stored steps were from another version', async () => {
    store({ tourVersion: 1 });
    const h = await open({ tourVersion: 2 });
    expect(h.restored[0]).toMatchObject({ index: 0, reason: 'version-changed' });
    expect(h.c.stepIndex()).toBe(0);
  });

  it("'never' keeps the position the host gave it", async () => {
    store();
    const h = await open({ resume: 'never', stepIndex: 1 });
    expect(h.restored[0]).toMatchObject({ index: 1, reason: 'declined' });
    expect(title()).toBe('Two');
  });

  it("'restart' starts from the top whatever was stored", async () => {
    store();
    const h = await open({ resume: 'restart' });
    expect(h.restored[0]).toMatchObject({ index: 0, reason: 'policy' });
    expect(title()).toBe('One');
  });

  it('starts from the top when the record names no step', async () => {
    store({ stepId: null });
    const h = await open();
    expect(h.restored[0]).toMatchObject({ index: 0, reason: 'policy' });
  });

  it('ignores a record it cannot read, with a warning, and starts fresh', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    localStorage.setItem(KEY, JSON.stringify({ kind: 'something-else', v: 99 }));
    const h = await open();
    expect(h.restored).toEqual([]);
    expect(title()).toBe('One');
    expect(warn.mock.calls.some((c) => String(c[0]).includes('saved state ignored'))).toBe(true);
  });

  it('ignores a record that is not JSON at all, silently', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    localStorage.setItem(KEY, '{not json');
    const h = await open();
    expect(h.restored).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('waits for the steps before resuming, so the stored step can be found', async () => {
    store();
    const h = await open({ steps: [] });
    expect(h.restored).toEqual([]);
    h.fixture.componentRef.setInput('steps', STEPS);
    h.fixture.detectChanges();
    await flush();
    expect(h.restored[0]).toMatchObject({ index: 2, reason: 'resumed' });
  });
});

describe('SvProductTourComponent (free) — the record follows what is happening', () => {
  it('keeps a stored "completed" when it is restored while shut', async () => {
    store({ status: 'completed' });
    const h = await open({ active: false });
    expect(h.restored[0].progress.status).toBe('completed');
    h.fixture.detectChanges();
    await flush();
    expect(stored()?.status).toBe('completed');
  });

  it('is active again when the host reopens a finished tour', async () => {
    const h = await open({ stepIndex: 2 });
    h.c.goNext(); // Done
    h.fixture.detectChanges();
    await flush();
    expect(stored()?.status).toBe('completed');

    h.c.active.set(true); // the host's [(active)] binding
    h.fixture.detectChanges();
    await flush();
    expect(stored()?.status).toBe('active');
    await until(() => dialog() !== null, { label: 'the reopened card' });
  });

  it('records no step for a hole in the step list', async () => {
    await open({ steps: [undefined as unknown as TourStep] });
    expect(stored()?.stepId).toBeNull();
  });

  it('keeps one card and one stack entry when the steps change while open', async () => {
    const h = await open({ persistKey: '' });
    await until(() => dialog() !== null, { label: 'the card' });
    const stack = TestBed.inject(SvOverlayStackService);
    const before = stack.size;
    h.fixture.componentRef.setInput('steps', [{ id: 'new', title: 'Fresh', content: '.' }]);
    h.fixture.detectChanges();
    await flush();
    h.fixture.detectChanges();
    expect(stack.size).toBe(before);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });
});

describe('SvProductTourComponent (free) — without storage', () => {
  it('runs normally and saves nothing when localStorage is unavailable', async () => {
    vi.stubGlobal('localStorage', undefined);
    const h = await open();
    expect(h.restored).toEqual([]);
    h.c.goNext();
    h.fixture.detectChanges();
    expect(h.c.stepIndex()).toBe(1);
  });
});

describe('SvProductTourComponent (free) — schema versions', () => {
  it('says nothing when the host is on the version the steps were written for', async () => {
    const h = await open({ persistKey: '', tourVersion: 3, expectedVersion: 3 });
    expect(h.stale).toEqual([]);
  });
});

describe('SvProductTourComponent (free) — keys aimed elsewhere', () => {
  const arrow = (target: EventTarget) => {
    const ev = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
    return ev;
  };

  it('leaves the arrows to a text field, a select and a listbox', async () => {
    const h = await open({ persistKey: '' });
    const listbox = document.createElement('div');
    listbox.setAttribute('role', 'listbox');
    for (const el of [
      document.createElement('input'),
      document.createElement('textarea'),
      document.createElement('select'),
      listbox,
    ]) {
      document.body.appendChild(el);
      const ev = arrow(el);
      el.remove();
      expect(ev.defaultPrevented, el.tagName).toBe(false);
    }
    expect(h.c.stepIndex()).toBe(0);
  });

  it('leaves the arrows to an editable region', async () => {
    const h = await open({ persistKey: '' });
    const el = document.createElement('div');
    Object.defineProperty(el, 'isContentEditable', { value: true });
    document.body.appendChild(el);
    arrow(el);
    el.remove();
    expect(h.c.stepIndex()).toBe(0);
  });

  it('takes an arrow pressed with nothing focused', async () => {
    const h = await open({ persistKey: '' });
    const ev = arrow(document);
    expect(ev.defaultPrevented).toBe(true);
    expect(h.c.stepIndex()).toBe(1);
  });
});

describe('SvProductTourComponent (free) — a tour that cannot be skipped', () => {
  /**
   * ★★ `allowSkip=false` registered the card as NOT dismissible, and a
   *    non-dismissible surface is never `isTopmost()` — so the "is this key
   *    mine?" test refused every key: the arrows stopped moving the tour and
   *    Tab walked straight out of a modal card.
   */
  it('★ still moves with the arrow keys', async () => {
    const h = await open({ persistKey: '', allowSkip: false });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    expect(h.c.stepIndex()).toBe(1);
  });

  it('★ still traps Tab inside the card', async () => {
    await open({ persistKey: '', allowSkip: false, stepIndex: 1 });
    await until(() => !!dialog()?.contains(document.activeElement), { label: 'focus inside the card' });
    const controls = [...dialog()!.querySelectorAll<HTMLElement>('button:not([disabled])')];
    controls[controls.length - 1].focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(controls[0]);
  });

  it('does nothing on Escape', async () => {
    const h = await open({ persistKey: '', allowSkip: false });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(h.c.active()).toBe(true);
  });
});
