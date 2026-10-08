import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { svResetWarnOnce } from '@styloviz/core';
import { SvTabsComponent, SvTabPanelDirective, type TabItem } from './tabs.component';

/**
 * ============================================================================
 *  Arrows that move without choosing — `NV-06-M1`
 * ============================================================================
 *
 * The strip had exactly one activation mode: arrows called `selectTab` on the way
 * past, unconditionally. For cheap panels that is the APG's preferred shape and
 * fewer keystrokes. For `lazy` ones it is **one mount, and whatever that panel
 * does on mount, per keypress** — a keyboard user crossing a six-tab strip fires
 * five loads nobody asked for, and a mouse user never sees it happen.
 *
 * ★ The default stays `'automatic'` anyway, and the reasoning is in the component
 * next to the input: flipping it would re-specify the keyboard of every existing
 * strip on a package upgrade, and "the arrow keys stopped selecting" points
 * nowhere near the release note that caused it. What the lazy case gets instead is
 * a dev warning that names the fix — and that goes quiet the moment the host
 * answers it either way.
 *
 * The three things below that a screenshot cannot show: which tab holds the tab
 * order once focus and selection come apart, that `aria-selected` does NOT follow
 * focus, and that arrowing past a lazy tab leaves its panel unmounted.
 */

const TABS: TabItem[] = [
  { id: 'general', label: 'General' },
  { id: 'security', label: 'Security' },
  { id: 'billing', label: 'Billing', disabled: true },
  { id: 'team', label: 'Team' },
];

async function setup(inputs: Partial<ComponentInput<SvTabsComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvTabsComponent, {
    inputs: { tabs: TABS, ...inputs } as ComponentInput<SvTabsComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const tabButtons = (f: { nativeElement: unknown }) =>
  [...el(f).querySelectorAll<HTMLButtonElement>('[role="tab"]')];
const tab = (f: { nativeElement: unknown }, label: string) =>
  tabButtons(f).find((b) => b.textContent?.trim().startsWith(label))!;
const tabbable = (f: { nativeElement: unknown }) =>
  tabButtons(f).filter((b) => b.tabIndex === 0).map((b) => b.textContent?.trim());
const selected = (f: { nativeElement: unknown }) =>
  tabButtons(f)
    .filter((b) => b.getAttribute('aria-selected') === 'true')
    .map((b) => b.textContent?.trim());

async function press(f: { detectChanges(): void }, keys: string) {
  await userEvent.keyboard(keys);
  f.detectChanges();
}

describe('SvTabsComponent — automatic activation (the default)', () => {
  it('selects the tab the arrow keys land on', async () => {
    // The backward-compatibility pin. An unset `activation` must behave exactly
    // as the component did before the input existed.
    const { fixture } = await setup({ activeId: 'general' });
    tab(fixture, 'General').focus();

    await press(fixture, '{ArrowRight}');
    expect(fixture.componentInstance.activeId()).toBe('security');
    expect(document.activeElement).toBe(tab(fixture, 'Security'));
  });

  it('resolves an unset mode to automatic', async () => {
    const { fixture } = await setup();
    expect(fixture.componentInstance.activation()).toBeNull();
    expect(fixture.componentInstance.resolvedActivation()).toBe('automatic');
  });

  it('keeps the tab order on the selected tab, because focus never leaves it', async () => {
    const { fixture } = await setup({ activeId: 'general', activation: 'automatic' });
    tab(fixture, 'General').focus();
    await press(fixture, '{ArrowRight}');
    expect(tabbable(fixture)).toEqual(['Security']);
    expect(selected(fixture)).toEqual(['Security']);
  });
});

describe('SvTabsComponent — manual activation', () => {
  it('moves focus without selecting', async () => {
    const { fixture } = await setup({ activeId: 'general', activation: 'manual' });
    tab(fixture, 'General').focus();

    await press(fixture, '{ArrowRight}');

    expect(document.activeElement).toBe(tab(fixture, 'Security'));
    expect(fixture.componentInstance.activeId()).toBe('general');
  });

  it('leaves aria-selected on the selected tab while focus is elsewhere', async () => {
    // ★ The attribute that must NOT follow focus. A manual tablist whose
    // `aria-selected` tracks the roving tabindex announces every tab the user
    // arrows past as the current one, which is worse than having no manual mode.
    const { fixture } = await setup({ activeId: 'general', activation: 'manual' });
    tab(fixture, 'General').focus();
    await press(fixture, '{ArrowRight}');

    expect(selected(fixture)).toEqual(['General']);
    expect(tab(fixture, 'Security').getAttribute('aria-selected')).toBe('false');
  });

  it('moves the roving tabindex with focus, one stop at a time', async () => {
    const { fixture } = await setup({ activeId: 'general', activation: 'manual' });
    tab(fixture, 'General').focus();
    await press(fixture, '{ArrowRight}');

    // Still exactly one tab stop — and it is where the user actually is, so
    // Shift-Tab out and Tab back returns them there.
    expect(tabbable(fixture)).toEqual(['Security']);
  });

  it('selects the focused tab on Enter', async () => {
    const { fixture } = await setup({ activeId: 'general', activation: 'manual' });
    tab(fixture, 'General').focus();
    await press(fixture, '{ArrowRight}');
    await press(fixture, '{Enter}');

    expect(fixture.componentInstance.activeId()).toBe('security');
    expect(selected(fixture)).toEqual(['Security']);
  });

  it('selects the focused tab on Space', async () => {
    const { fixture } = await setup({ activeId: 'general', activation: 'manual' });
    tab(fixture, 'General').focus();
    await press(fixture, '{ArrowRight}{ArrowRight}');
    await press(fixture, '[Space]');

    // Two rights from General: Security, then Team — Billing is disabled and
    // skipped, not landed on, in manual mode exactly as in automatic.
    expect(fixture.componentInstance.activeId()).toBe('team');
  });

  it('wraps, jumps with Home/End, and still skips a disabled tab', async () => {
    const { fixture } = await setup({ activeId: 'general', activation: 'manual' });
    tab(fixture, 'General').focus();

    await press(fixture, '{ArrowLeft}');
    expect(document.activeElement).toBe(tab(fixture, 'Team'));

    await press(fixture, '{ArrowRight}');
    expect(document.activeElement).toBe(tab(fixture, 'General'));

    await press(fixture, '{End}');
    expect(document.activeElement).toBe(tab(fixture, 'Team'));

    await press(fixture, '{Home}');
    expect(document.activeElement).toBe(tab(fixture, 'General'));

    // Nothing above changed the selection.
    expect(fixture.componentInstance.activeId()).toBe('general');
  });

  it('returns the tab order to the selected tab when focus leaves the strip', async () => {
    // ★ Otherwise the strip's single tab stop stays parked on a tab the user
    // decided against, and Shift-Tab back lands somewhere they never chose.
    const { fixture } = await setup({ activeId: 'general', activation: 'manual' });
    tab(fixture, 'General').focus();
    await press(fixture, '{ArrowRight}');
    expect(tabbable(fixture)).toEqual(['Security']);

    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    fixture.detectChanges();

    expect(tabbable(fixture)).toEqual(['General']);
    outside.remove();
  });

  it('keeps the tab order inside the strip while focus only moves within it', async () => {
    const { fixture } = await setup({ activeId: 'general', activation: 'manual' });
    tab(fixture, 'General').focus();
    await press(fixture, '{ArrowRight}');
    tab(fixture, 'Team').focus();
    fixture.detectChanges();

    expect(tabbable(fixture)).toEqual(['Team']);
  });

  it('falls back to the selected tab when the focused one is removed', async () => {
    const { fixture } = await setup({ activeId: 'general', activation: 'manual' });
    tab(fixture, 'General').focus();
    await press(fixture, '{ArrowRight}');

    fixture.componentRef.setInput('tabs', TABS.filter((t) => t.id !== 'security'));
    fixture.detectChanges();

    expect(fixture.componentInstance.rovingId()).toBe('general');
    expect(tabbable(fixture)).toEqual(['General']);
  });

  it('still selects on click', async () => {
    const { fixture } = await setup({ activeId: 'general', activation: 'manual' });
    await userEvent.click(tab(fixture, 'Team'));
    fixture.detectChanges();
    expect(fixture.componentInstance.activeId()).toBe('team');
  });
});

describe('SvTabsComponent — manual activation and lazy panels', () => {
  @Component({
    standalone: true,
    imports: [SvTabsComponent, SvTabPanelDirective],
    template: `
      <sv-tabs [tabs]="tabs()" [(activeId)]="active" [activation]="mode()">
        <ng-template svTabPanel="general">General body</ng-template>
        <ng-template svTabPanel="security">Security body</ng-template>
        <ng-template svTabPanel="team">Team body</ng-template>
      </sv-tabs>
    `,
  })
  class Host {
    readonly tabs = signal<TabItem[]>([
      { id: 'general', label: 'General' },
      { id: 'security', label: 'Security', lazy: true },
      { id: 'team', label: 'Team', lazy: true },
    ]);
    readonly active = signal('general');
    readonly mode = signal<'automatic' | 'manual'>('manual');
  }

  const mounted = (f: { nativeElement: unknown }) =>
    [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="tabpanel"]')]
      .map((p) => p.id.replace(/^.*panel-/, ''));

  async function hosted(mode: 'automatic' | 'manual') {
    TestBed.resetTestingModule();
    const r = await render(Host);
    r.fixture.componentInstance.mode.set(mode);
    r.fixture.detectChanges();
    return r;
  }

  it('mounts nothing on the way past', async () => {
    // ★★ The reason `NV-06-M1` is the consequential one. Two arrow presses across
    // a strip of lazy tabs, and neither panel is built.
    const { fixture } = await hosted('manual');
    const strip = fixture.nativeElement as HTMLElement;
    strip.querySelectorAll<HTMLButtonElement>('[role="tab"]')[0].focus();

    await press(fixture, '{ArrowRight}{ArrowRight}');

    expect(mounted(fixture)).toEqual(['general']);
  });

  it('mounts one panel per keypress under automatic activation — the cost being avoided', async () => {
    const { fixture } = await hosted('automatic');
    const strip = fixture.nativeElement as HTMLElement;
    strip.querySelectorAll<HTMLButtonElement>('[role="tab"]')[0].focus();

    await press(fixture, '{ArrowRight}{ArrowRight}');

    expect(mounted(fixture)).toEqual(['general', 'security', 'team']);
  });
});

describe('SvTabsComponent — the lazy + automatic warning', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    svResetWarnOnce();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => warn.mockRestore());

  // ⚠️ Both callback params are annotated on purpose. `ReturnType<typeof
  //    vi.spyOn>` — the repo's idiom for a `let` spy — erases the call
  //    signature, so `mock.calls` is loose enough that an inferred `c` is an
  //    implicit `any`. Vitest does not typecheck, so this only ever appears in
  //    `typecheck:all`.
  const messages = (): string[] => warn.mock.calls.map((c: unknown[]) => String(c[0]));

  it('warns when a lazy tab meets the default mode', async () => {
    await setup({ tabs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', lazy: true }] });
    expect(messages().some((m: string) => m.includes('activation="manual"'))).toBe(true);
  });

  it('says nothing when the host chose manual', async () => {
    await setup({
      tabs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', lazy: true }],
      activation: 'manual',
    });
    expect(messages()).toEqual([]);
  });

  it('says nothing when the host chose automatic on purpose', async () => {
    // ★ An explicit `'automatic'` is an answer. A warning that survives being
    // answered is one people mute wholesale, and then the next one is invisible.
    await setup({
      tabs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', lazy: true }],
      activation: 'automatic',
    });
    expect(messages()).toEqual([]);
  });

  it('says nothing when no tab is lazy', async () => {
    await setup();
    expect(messages()).toEqual([]);
  });

  it('warns once, not once per strip', async () => {
    const lazy = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', lazy: true }];
    await setup({ tabs: lazy });
    await setup({ tabs: lazy });
    expect(messages().length).toBe(1);
  });
});
