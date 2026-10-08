import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { vi } from 'vitest';
import { svResetWarnOnce } from '@styloviz/core';
import { SvToolbarComponent } from './toolbar.component';
import type { ToolbarAction } from './toolbar.component';
import { until } from '../../../../src/testing/async';

/**
 * `LU-11-I1`..`I3`, `M1`, `M2`: what the single tab stop and the browser's focus
 * do when the ACTIONS change underneath them — an action is disabled, removed,
 * or two share an id. The toolbar's data is dynamic in every real host
 * (permissions, selection-dependent actions), so this is the normal case, not an
 * edge one.
 */

const A: ToolbarAction = { id: 'a', label: 'A', icon: 'a' };
const B: ToolbarAction = { id: 'b', label: 'B', icon: 'b' };
const C: ToolbarAction = { id: 'c', label: 'C', icon: 'c' };
const D: ToolbarAction = { id: 'd', label: 'D', icon: 'd' };

@Component({
  standalone: true,
  imports: [SvToolbarComponent],
  template: `
    <button type="button" data-outside>outside</button>
    <sv-toolbar [actions]="actions()" label="Edit" />
  `,
})
class DynamicHost {
  readonly actions = signal<readonly ToolbarAction[]>([A, B, C, D]);
}

async function dynamicHost() {
  TestBed.resetTestingModule();
  const { fixture } = await render(DynamicHost);
  return fixture;
}

const root = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const btn = (f: ComponentFixture<unknown>, id: string) =>
  root(f).querySelector<HTMLButtonElement>(`sv-toolbar [data-action-id="${id}"]`);
const stopIds = (f: ComponentFixture<unknown>) =>
  [...root(f).querySelectorAll<HTMLElement>('sv-toolbar [tabindex="0"]')].map((e) => e.dataset['actionId'] ?? 'more');
const press = (key: string) => new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });

async function change(f: ComponentFixture<DynamicHost>, next: readonly ToolbarAction[]): Promise<void> {
  f.componentInstance.actions.set(next);
  f.detectChanges();
  await f.whenStable();
}

describe('SvToolbarComponent — the tab stop after the data changes (LU-11-I3 / M2)', () => {
  it('moves the tab stop to the successor when the active action is disabled', async () => {
    const f = await dynamicHost();
    btn(f, 'a')?.dispatchEvent(press('ArrowRight'));   // stop → b
    f.detectChanges();
    expect(stopIds(f)).toEqual(['b']);

    await change(f, [A, { ...B, disabled: true }, C, D]);
    expect(stopIds(f)).toEqual(['c']);
  });

  it('moves the tab stop to the action that slid into place when the active one is removed', async () => {
    const f = await dynamicHost();
    btn(f, 'a')?.dispatchEvent(press('ArrowRight'));   // stop → b
    f.detectChanges();

    await change(f, [A, C, D]);
    expect(stopIds(f)).toEqual(['c']);
  });

  it('falls back to the predecessor when the last action is the one removed', async () => {
    const f = await dynamicHost();
    btn(f, 'a')?.dispatchEvent(press('End'));          // stop → d
    f.detectChanges();

    await change(f, [A, B, C]);
    expect(stopIds(f)).toEqual(['c']);
  });

  it('keeps the tab stop where it was when the active action survives a replacement', async () => {
    const f = await dynamicHost();
    btn(f, 'a')?.dispatchEvent(press('End'));          // stop → d
    f.detectChanges();

    // New objects, same ids — the immutable update every host makes.
    await change(f, [{ ...B }, { ...D }, { ...A }]);
    expect(stopIds(f)).toEqual(['d']);
  });

  it('always leaves exactly one tab stop while anything is enabled', async () => {
    const f = await dynamicHost();
    for (const next of [[A, B], [{ ...A, disabled: true }, B], [C], [C, D, A]] as const) {
      await change(f, next);
      expect(stopIds(f)).toHaveLength(1);
    }
  });

  it('follows a click, so Tab returns to the action last used', async () => {
    const f = await dynamicHost();
    btn(f, 'c')?.focus();
    f.detectChanges();
    expect(stopIds(f)).toEqual(['c']);
  });
});

describe('SvToolbarComponent — focus after the data changes (LU-11-I2, X-10)', () => {
  it('moves focus to the successor when the focused action is disabled', async () => {
    const f = await dynamicHost();
    btn(f, 'b')?.focus();
    f.detectChanges();

    await change(f, [A, { ...B, disabled: true }, C, D]);
    await until(() => document.activeElement === btn(f, 'c'), { label: 'focus to move to c' });
    expect(btn(f, 'c')?.getAttribute('tabindex')).toBe('0');
  });

  it('moves focus to the successor when the focused action is removed', async () => {
    const f = await dynamicHost();
    btn(f, 'b')?.focus();
    f.detectChanges();

    await change(f, [A, C, D]);
    await until(() => document.activeElement === btn(f, 'c'), { label: 'focus to move to c' });
  });

  it('moves focus to the predecessor when the focused last action is removed', async () => {
    const f = await dynamicHost();
    btn(f, 'd')?.focus();
    f.detectChanges();

    await change(f, [A, B, C]);
    await until(() => document.activeElement === btn(f, 'c'), { label: 'focus to move to c' });
  });

  it('parks focus on the toolbar itself when nothing focusable is left — never <body>', async () => {
    const f = await dynamicHost();
    btn(f, 'a')?.focus();
    f.detectChanges();

    await change(f, [{ ...A, disabled: true }]);
    const strip = root(f).querySelector('[role="toolbar"]');
    await until(() => document.activeElement === strip, { label: 'focus to land on the toolbar' });
  });

  it('does not pull focus back once the user has left the toolbar', async () => {
    const f = await dynamicHost();
    btn(f, 'b')?.focus();
    f.detectChanges();
    const outside = root(f).querySelector<HTMLButtonElement>('[data-outside]') as HTMLButtonElement;
    outside.focus();

    await change(f, [A, C, D]);
    await f.whenStable();
    expect(document.activeElement).toBe(outside);
  });
});

@Component({
  standalone: true,
  imports: [SvToolbarComponent],
  template: `<sv-toolbar [actions]="actions" />`,
})
class DuplicateHost {
  readonly actions: readonly ToolbarAction[] = [
    { id: 'x', label: 'First X', icon: 'a' },
    { id: 'y', label: 'Y', icon: 'b' },
    { id: 'x', label: 'Second X', icon: 'c' },
  ];
}

describe('SvToolbarComponent — duplicate action ids (LU-11-I1 / M1)', () => {
  it('warns once in dev mode, naming the id', async () => {
    svResetWarnOnce();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    TestBed.resetTestingModule();
    await render(DuplicateHost);
    const ours = warn.mock.calls.filter(([m]) => String(m).includes('two actions share the id "x"'));
    expect(ours).toHaveLength(1);
    warn.mockRestore();
  });

  it('gives the tab stop to ONE of the two, not both', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    TestBed.resetTestingModule();
    const { fixture } = await render(DuplicateHost);
    const stops = [...(fixture.nativeElement as HTMLElement).querySelectorAll('[tabindex="0"]')];
    expect(stops).toHaveLength(1);
    expect(stops[0].getAttribute('aria-label')).toBe('First X');
    vi.restoreAllMocks();
  });

  /** An id-keyed lookup focused BOTH duplicates, and the later one in the DOM won. */
  it('arrows onto the right one of two actions sharing an id', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    TestBed.resetTestingModule();
    const { fixture } = await render(DuplicateHost);
    const el = fixture.nativeElement as HTMLElement;
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('[data-action-id]')];

    buttons[1].dispatchEvent(press('ArrowLeft'));
    expect(document.activeElement).toBe(buttons[0]);
    fixture.detectChanges();
    expect(buttons[0].getAttribute('tabindex')).toBe('0');
    expect(buttons[2].getAttribute('tabindex')).toBe('-1');

    buttons[1].dispatchEvent(press('ArrowRight'));
    expect(document.activeElement).toBe(buttons[2]);
    vi.restoreAllMocks();
  });
});

describe('SvToolbarComponent — duplicate ids do not trip Angular\'s own track warning (LU-11-I1)', () => {
  /**
   * `track action.id` made Angular log NG0955 ("duplicated keys") on every
   * update of an array with a repeated id — so the kit's warning was "once" and
   * Angular's repeated. The loop tracks by identity now.
   */
  it('logs no NG0955 when an array with a repeated id is rendered and replaced', async () => {
    svResetWarnOnce();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const f = await dynamicHost();
    const x1: ToolbarAction = { id: 'x', label: 'X one', icon: 'a' };
    const x2: ToolbarAction = { id: 'x', label: 'X two', icon: 'b' };
    await change(f, [x1, B, x2]);
    await change(f, [x1, B, x2, C]);
    const ng0955 = [...warn.mock.calls, ...error.mock.calls].filter(([m]) => String(m).includes('NG0955'));
    expect(ng0955).toHaveLength(0);
    vi.restoreAllMocks();
  });
});

@Component({
  standalone: true,
  imports: [SvToolbarComponent],
  template: `
    <button type="button" data-outside>outside</button>
    <sv-toolbar [actions]="actions()" [loading]="loading()" label="Edit" />
  `,
})
class LoadingHost {
  readonly actions = signal<readonly ToolbarAction[]>([A, B, C]);
  readonly loading = signal(false);
}

describe('SvToolbarComponent — a loading swap does not steal focus later (X-10)', () => {
  it('leaves focus where the user put it when loading ends', async () => {
    TestBed.resetTestingModule();
    const { fixture: f } = await render(LoadingHost);
    const el = f.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('[data-action-id="a"]')?.focus();
    expect(document.activeElement?.getAttribute('data-action-id')).toBe('a');

    // The strip is replaced by the skeleton; the focused button leaves the DOM.
    f.componentInstance.loading.set(true);
    f.detectChanges();
    await f.whenStable();

    // Meanwhile the user moves on to plain page content.
    (document.activeElement as HTMLElement | null)?.blur();

    f.componentInstance.loading.set(false);
    f.componentInstance.actions.set([A, B, C, D]);
    f.detectChanges();
    await f.whenStable();
    await until(() => !!el.querySelector('[data-action-id="d"]'));

    expect(el.querySelector('sv-toolbar')?.contains(document.activeElement)).toBe(false);
  });
});

describe('SvToolbarComponent — separators are vertical rules', () => {
  it('marks every group separator aria-orientation="vertical"', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvToolbarComponent, {
      inputs: { groups: [{ id: 'g1', actions: [A, { ...B, dividerAfter: true }] }, { id: 'g2', actions: [C] }] },
    });
    const seps = [...(fixture.nativeElement as HTMLElement).querySelectorAll('[role="separator"]')];
    expect(seps.length).toBeGreaterThan(0);
    for (const s of seps) expect(s.getAttribute('aria-orientation')).toBe('vertical');
  });
});
