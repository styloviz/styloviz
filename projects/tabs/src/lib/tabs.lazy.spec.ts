import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvTabsComponent, SvTabPanelDirective, type TabItem } from './tabs.component';

/**
 * ============================================================================
 *  What a lazy panel loses, and when — `NV-06-I4`, `NV-06-M4`
 * ============================================================================
 *
 * ★ **`NV-06-I4`'s premise is false.** It reads *"a form in a lazy panel loses its
 * input either way"*, and it does not: `activatedIds` is additive and never
 * pruned, so the panel a user has visited once **stays mounted for the lifetime of
 * the strip**, with its DOM and its state. Retention was never unspecified — it
 * was decided, consistent, and undocumented, which is a different bug with a
 * different fix (TSDoc on `lazy`, and the assertions below).
 *
 * `NV-06-M4` is the half that needed code: there was no way to ask for the
 * opposite. `lazyRetention="destroy"` is that way, opt-in, because retain is what
 * every existing strip already does.
 *
 * The state under test is a real uncontrolled `<input>` value — not a component
 * field, which would survive a re-render regardless and prove nothing. A DOM node
 * that was destroyed and rebuilt comes back empty.
 */

const TABS: TabItem[] = [
  { id: 'general', label: 'General' },
  { id: 'notes', label: 'Notes', lazy: true },
  { id: 'team', label: 'Team', lazy: true },
];

@Component({
  standalone: true,
  imports: [SvTabsComponent, SvTabPanelDirective],
  template: `
    <sv-tabs [tabs]="tabs()" [(activeId)]="active" [lazyRetention]="retention()">
      <ng-template svTabPanel="general">General body</ng-template>
      <ng-template svTabPanel="notes">
        <input data-notes aria-label="Notes" />
      </ng-template>
      <ng-template svTabPanel="team">Team body</ng-template>
    </sv-tabs>
  `,
})
class Host {
  readonly tabs = signal<TabItem[]>(TABS);
  readonly active = signal('general');
  readonly retention = signal<'retain' | 'destroy'>('retain');
}

async function hosted(retention: 'retain' | 'destroy' = 'retain') {
  TestBed.resetTestingModule();
  const r = await render(Host);
  r.fixture.componentInstance.retention.set(retention);
  r.fixture.detectChanges();
  return r;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const tab = (f: { nativeElement: unknown }, label: string) =>
  [...el(f).querySelectorAll<HTMLButtonElement>('[role="tab"]')]
    .find((b) => b.textContent?.trim().startsWith(label))!;
const mountedPanels = (f: { nativeElement: unknown }) =>
  [...el(f).querySelectorAll<HTMLElement>('[role="tabpanel"]')]
    .map((p) => p.id.replace(/^.*panel-/, ''));
const notesInput = (f: { nativeElement: unknown }) =>
  el(f).querySelector<HTMLInputElement>('input[data-notes]');

async function go(f: { detectChanges(): void; nativeElement: unknown }, label: string) {
  await userEvent.click(tab(f, label));
  f.detectChanges();
}

describe('SvTabsComponent — lazy panels are retained (the default contract)', () => {
  it('keeps a visited panel in the DOM after switching away', async () => {
    const { fixture } = await hosted();
    expect(mountedPanels(fixture)).toEqual(['general']);

    await go(fixture, 'Notes');
    expect(mountedPanels(fixture)).toEqual(['general', 'notes']);

    await go(fixture, 'General');
    expect(mountedPanels(fixture)).toEqual(['general', 'notes']);
  });

  it('keeps what the user typed into it', async () => {
    // ★ The assertion that contradicts `NV-06-I4`'s stated premise.
    const { fixture } = await hosted();
    await go(fixture, 'Notes');
    await userEvent.type(notesInput(fixture)!, 'half-written');

    await go(fixture, 'General');
    await go(fixture, 'Notes');

    expect(notesInput(fixture)!.value).toBe('half-written');
  });

  it('keeps the same DOM node — it is not re-created', async () => {
    const { fixture } = await hosted();
    await go(fixture, 'Notes');
    const first = notesInput(fixture);

    await go(fixture, 'General');
    await go(fixture, 'Notes');

    expect(notesInput(fixture)).toBe(first);
    expect(first!.isConnected).toBe(true);
  });

  it('hides the retained panel rather than showing two', async () => {
    const { fixture } = await hosted();
    await go(fixture, 'Notes');
    await go(fixture, 'General');

    const notes = [...el(fixture).querySelectorAll<HTMLElement>('[role="tabpanel"]')]
      .find((p) => p.id.endsWith('panel-notes'))!;
    expect(notes.classList.contains('hidden')).toBe(true);
    expect(notes.getAttribute('tabindex')).toBeNull();
  });
});

describe('SvTabsComponent — lazyRetention="destroy"', () => {
  it('unmounts a lazy panel on the way out', async () => {
    const { fixture } = await hosted('destroy');
    await go(fixture, 'Notes');
    expect(mountedPanels(fixture)).toEqual(['general', 'notes']);

    await go(fixture, 'General');
    expect(mountedPanels(fixture)).toEqual(['general']);
  });

  it('rebuilds it empty on the next visit', async () => {
    const { fixture } = await hosted('destroy');
    await go(fixture, 'Notes');
    await userEvent.type(notesInput(fixture)!, 'half-written');
    expect(notesInput(fixture)!.value).toBe('half-written');

    await go(fixture, 'General');
    await go(fixture, 'Notes');

    // Documented and opt-in: destroying the panel discards what was in it.
    expect(notesInput(fixture)!.value).toBe('');
  });

  it('never unmounts a panel that was not lazy in the first place', async () => {
    // ★ `destroy` is the second half of the LAZY contract, not a general
    // "unmount inactive panels" switch. A `general` panel the host asked to have
    // mounted up front stays mounted and hidden.
    const { fixture } = await hosted('destroy');
    await go(fixture, 'Notes');

    const general = [...el(fixture).querySelectorAll<HTMLElement>('[role="tabpanel"]')]
      .find((p) => p.id.endsWith('panel-general'))!;
    expect(general.classList.contains('hidden')).toBe(true);
  });

  it('holds at most one lazy panel at a time, whatever the route through the strip', async () => {
    const { fixture } = await hosted('destroy');
    await go(fixture, 'Notes');
    await go(fixture, 'Team');
    expect(mountedPanels(fixture)).toEqual(['general', 'team']);

    await go(fixture, 'Notes');
    expect(mountedPanels(fixture)).toEqual(['general', 'notes']);
  });

  it('defaults to retain when the input is left alone', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(Host);
    expect(fixture.componentInstance.retention()).toBe('retain');
    await go(fixture, 'Notes');
    await go(fixture, 'General');
    expect(mountedPanels(fixture)).toEqual(['general', 'notes']);
  });
});
