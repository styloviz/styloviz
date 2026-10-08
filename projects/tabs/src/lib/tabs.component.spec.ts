import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvTabsComponent, SvTabPanelDirective, type TabItem } from './tabs.component';

/**
 * Three things here are not visible in a screenshot and not reachable with a
 * mouse: which tab is in the tab order, what the arrow keys do at the ends of
 * the strip, and which panels are in the DOM at all.
 *
 * The fourth is what happens with **two tab strips on one page** — which is the
 * ordinary layout for a settings screen, and which was broken because every
 * element id was a global literal built from the tab's own id.
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
const panels = (f: { nativeElement: unknown }) =>
  [...el(f).querySelectorAll<HTMLElement>('[role="tabpanel"]')];

describe('SvTabsComponent — the strip', () => {
  it('renders one tab per definition, inside a tablist', async () => {
    const { fixture } = await setup();
    expect(el(fixture).querySelector('[role="tablist"]')).not.toBeNull();
    expect(tabButtons(fixture).map((b) => b.textContent?.trim())).toEqual([
      'General', 'Security', 'Billing', 'Team',
    ]);
  });

  it('tells assistive tech which way the arrows go', async () => {
    const h = await setup();
    expect(el(h.fixture).querySelector('[role="tablist"]')!.getAttribute('aria-orientation'))
      .toBe('horizontal');

    const v = await setup({ layout: 'vertical' });
    expect(el(v.fixture).querySelector('[role="tablist"]')!.getAttribute('aria-orientation'))
      .toBe('vertical');
  });

  it('falls back to the first enabled tab when no active id is given', async () => {
    const { fixture } = await setup({ tabs: [{ id: 'a', label: 'A', disabled: true }, ...TABS] });
    expect(fixture.componentInstance.resolvedActiveId()).toBe('general');
  });

  it('puts exactly one tab in the tab order', async () => {
    // A tablist is one stop, not four: arrows move within it. Every tab being
    // tabbable is how a keyboard user ends up with two ways to do one thing and
    // no idea which is which.
    const { fixture } = await setup({ activeId: 'security' });
    expect(tabButtons(fixture).filter((b) => b.tabIndex === 0).map((b) => b.textContent?.trim()))
      .toEqual(['Security']);
  });

  it('marks the active tab selected and no other', async () => {
    const { fixture } = await setup({ activeId: 'security' });
    expect(tabButtons(fixture).filter((b) => b.getAttribute('aria-selected') === 'true').length).toBe(1);
    expect(tab(fixture, 'Security').getAttribute('aria-selected')).toBe('true');
  });

  it('marks a disabled tab without taking it out of the strip', async () => {
    // `aria-disabled` rather than `disabled`: the tab stays reachable so a
    // screen-reader user can find out it exists, and arrows skip it.
    const { fixture } = await setup();
    expect(tab(fixture, 'Billing').getAttribute('aria-disabled')).toBe('true');
    expect(tab(fixture, 'Billing').disabled).toBe(false);
  });
});

describe('SvTabsComponent — switching', () => {
  it('activates on click and reports the new id', async () => {
    const { fixture } = await setup({ activeId: 'general' });
    const seen: string[] = [];
    fixture.componentInstance.activeId.subscribe((v) => seen.push(v));

    await userEvent.click(tab(fixture, 'Security'));
    fixture.detectChanges();

    expect(fixture.componentInstance.activeId()).toBe('security');
    expect(seen).toEqual(['security']);
  });

  it('refuses a disabled tab', async () => {
    const { fixture } = await setup({ activeId: 'general' });
    await userEvent.click(tab(fixture, 'Billing'));
    fixture.detectChanges();
    expect(fixture.componentInstance.activeId()).toBe('general');
  });

  it('emits the tab on close without removing it — that is the host\'s call', async () => {
    const closable: TabItem[] = [{ id: 'a', label: 'A', closable: true }, { id: 'b', label: 'B' }];
    const { fixture } = await setup({ tabs: closable, activeId: 'a' });
    const seen: TabItem[] = [];
    fixture.componentInstance.tabClose.subscribe((t) => seen.push(t));

    await userEvent.click(el(fixture).querySelector<HTMLElement>('[data-close-tab]')!);
    fixture.detectChanges();

    expect(seen.map((t) => t.id)).toEqual(['a']);
    expect(tabButtons(fixture).length).toBe(2);
  });

  it('does not switch tabs when the close affordance is the thing clicked', async () => {
    const closable: TabItem[] = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', closable: true }];
    const { fixture } = await setup({ tabs: closable, activeId: 'a' });

    await userEvent.click(el(fixture).querySelector<HTMLElement>('[data-close-tab]')!);
    fixture.detectChanges();
    expect(fixture.componentInstance.activeId()).toBe('a');
  });

  /**
   * `tablist` may own nothing but `tab`, and `tab` flattens its own children, so
   * a focusable × is a violation wherever it is put. These lock in the shape that
   * replaced it: a glyph AT never sees, and a keyboard path on the tab itself.
   */
  it('keeps the tablist owning only tabs, so the × is hidden and unfocusable', async () => {
    const closable: TabItem[] = [{ id: 'a', label: 'A', closable: true }, { id: 'b', label: 'B' }];
    const { fixture } = await setup({ tabs: closable, activeId: 'a' });
    const root = el(fixture);

    const glyph = root.querySelector<HTMLElement>('[data-close-tab]')!;
    expect(glyph.tagName).toBe('SPAN');
    expect(glyph.getAttribute('aria-hidden')).toBe('true');
    expect(glyph.hasAttribute('tabindex')).toBe(false);

    const owned = [...root.querySelectorAll('[role="tablist"] *')].filter(
      (n) => n.hasAttribute('role') || (n as HTMLElement).tabIndex >= 0,
    );
    expect(owned.every((n) => n.getAttribute('role') === 'tab')).toBe(true);
  });

  it('closes the focused tab with Delete, and tells AT that it can', async () => {
    const closable: TabItem[] = [{ id: 'a', label: 'A', closable: true }, { id: 'b', label: 'B' }];
    const { fixture } = await setup({ tabs: closable, activeId: 'a' });
    const seen: TabItem[] = [];
    fixture.componentInstance.tabClose.subscribe((t) => seen.push(t));

    const first = tabButtons(fixture)[0];
    expect(first.getAttribute('aria-keyshortcuts')).toBe('Delete');
    expect(
      el(fixture).querySelector(`#${first.getAttribute('aria-describedby')}`)?.textContent,
    ).toContain('Delete');

    first.focus();
    await userEvent.keyboard('{Delete}');
    fixture.detectChanges();
    expect(seen.map((t) => t.id)).toEqual(['a']);

    // A tab that cannot be closed must not advertise a shortcut it lacks.
    const second = tabButtons(fixture)[1];
    expect(second.hasAttribute('aria-keyshortcuts')).toBe(false);
    expect(second.hasAttribute('aria-describedby')).toBe(false);
  });

  it('also accepts Backspace, and leaves a non-closable tab alone', async () => {
    const closable: TabItem[] = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', closable: true }];
    const { fixture } = await setup({ tabs: closable, activeId: 'a' });
    const seen: TabItem[] = [];
    fixture.componentInstance.tabClose.subscribe((t) => seen.push(t));

    tabButtons(fixture)[0].focus();
    await userEvent.keyboard('{Backspace}');
    fixture.detectChanges();
    expect(seen).toEqual([]);

    tabButtons(fixture)[1].focus();
    await userEvent.keyboard('{Backspace}');
    fixture.detectChanges();
    expect(seen.map((t) => t.id)).toEqual(['b']);
  });
});

describe('SvTabsComponent — the keyboard', () => {
  const press = async (f: { detectChanges(): void }, key: string) => {
    await userEvent.keyboard(key);
    f.detectChanges();
  };

  it('moves with Left and Right, and moves focus with it', async () => {
    const { fixture } = await setup({ activeId: 'general' });
    tab(fixture, 'General').focus();

    await press(fixture, '{ArrowRight}');
    expect(fixture.componentInstance.activeId()).toBe('security');
    expect(document.activeElement).toBe(tab(fixture, 'Security'));

    await press(fixture, '{ArrowLeft}');
    expect(fixture.componentInstance.activeId()).toBe('general');
  });

  it('steps over a disabled tab rather than landing on it', async () => {
    const { fixture } = await setup({ activeId: 'security' });
    tab(fixture, 'Security').focus();

    await press(fixture, '{ArrowRight}');
    expect(fixture.componentInstance.activeId()).toBe('team');
  });

  it('uses the vertical axis in a vertical strip', async () => {
    const { fixture } = await setup({ activeId: 'general', layout: 'vertical' });
    tab(fixture, 'General').focus();

    await press(fixture, '{ArrowDown}');
    expect(fixture.componentInstance.activeId()).toBe('security');
    await press(fixture, '{ArrowUp}');
    expect(fixture.componentInstance.activeId()).toBe('general');
  });

  it('ignores the wrong axis', async () => {
    const { fixture } = await setup({ activeId: 'general', layout: 'vertical' });
    tab(fixture, 'General').focus();
    await press(fixture, '{ArrowRight}');
    expect(fixture.componentInstance.activeId()).toBe('general');
  });

  it('jumps to the first and last enabled tab with Home and End', async () => {
    const { fixture } = await setup({ activeId: 'security' });
    tab(fixture, 'Security').focus();

    await press(fixture, '{End}');
    expect(fixture.componentInstance.activeId()).toBe('team');
    await press(fixture, '{Home}');
    expect(fixture.componentInstance.activeId()).toBe('general');
  });

  it('wraps at both ends', async () => {
    // Every other roving-tabindex control in the kit wraps — radio-group,
    // segmented-control, speed-dial. Arrow keys that stop dead at the last tab
    // are a different control with the same shape.
    const { fixture } = await setup({ activeId: 'team' });
    tab(fixture, 'Team').focus();

    await press(fixture, '{ArrowRight}');
    expect(fixture.componentInstance.activeId()).toBe('general');

    await press(fixture, '{ArrowLeft}');
    expect(fixture.componentInstance.activeId()).toBe('team');
  });

  it('ignores a key it has no meaning for', async () => {
    const { fixture } = await setup({ activeId: 'general' });
    tab(fixture, 'General').focus();
    await press(fixture, 'q');
    expect(fixture.componentInstance.activeId()).toBe('general');
  });
});

describe('SvTabsComponent — panels', () => {
  @Component({
    standalone: true,
    imports: [SvTabsComponent, SvTabPanelDirective],
    template: `
      <sv-tabs [tabs]="tabs()" [(activeId)]="active">
        <ng-template svTabPanel="general">General body</ng-template>
        <ng-template svTabPanel="security">Security body</ng-template>
        <ng-template svTabPanel="team">Team body</ng-template>
      </sv-tabs>
    `,
  })
  class Host {
    readonly tabs = signal<TabItem[]>(TABS);
    readonly active = signal('general');
  }

  async function hosted(tabs: TabItem[] = TABS) {
    TestBed.resetTestingModule();
    const r = await render(Host);
    r.fixture.componentInstance.tabs.set(tabs);
    r.fixture.detectChanges();
    return r;
  }

  it('projects the template matching the active tab', async () => {
    const { fixture } = await hosted();
    const visible = panels(fixture).filter((p) => !p.classList.contains('hidden'));
    expect(visible.length).toBe(1);
    expect(visible[0].textContent).toContain('General body');
  });

  it('points each panel back at the tab that names it', async () => {
    const { fixture } = await hosted();
    for (const panel of panels(fixture)) {
      const owner = el(fixture).querySelector(`#${panel.getAttribute('aria-labelledby')}`);
      expect(owner?.getAttribute('role')).toBe('tab');
      expect(owner?.getAttribute('aria-controls')).toBe(panel.id);
    }
  });

  it('mounts a non-lazy panel up front, and defers a lazy one', async () => {
    // ★ `lazy` is documented per tab and defaults to false, but every panel was
    // deferred regardless — the input was published, documented, and read by no
    // code. A host that wanted its content measurable on first paint had no way
    // to ask for it.
    const { fixture } = await hosted([
      { id: 'general', label: 'General' },
      { id: 'security', label: 'Security' },
      { id: 'team', label: 'Team', lazy: true },
    ]);

    const ids = panels(fixture).map((p) => p.id);
    expect(ids.some((id) => id.endsWith('panel-security'))).toBe(true);
    expect(ids.some((id) => id.endsWith('panel-team'))).toBe(false);
  });

  it('keeps a lazy panel once it has been visited', async () => {
    const { fixture } = await hosted([
      { id: 'general', label: 'General' },
      { id: 'team', label: 'Team', lazy: true },
    ]);
    expect(panels(fixture).some((p) => p.id.endsWith('panel-team'))).toBe(false);

    await userEvent.click(tab(fixture, 'Team'));
    fixture.detectChanges();
    expect(panels(fixture).some((p) => p.id.endsWith('panel-team'))).toBe(true);

    await userEvent.click(tab(fixture, 'General'));
    fixture.detectChanges();
    expect(panels(fixture).some((p) => p.id.endsWith('panel-team'))).toBe(true);
  });

  it('hides rather than unmounts an inactive panel that is already there', async () => {
    const { fixture } = await hosted();
    await userEvent.click(tab(fixture, 'Security'));
    fixture.detectChanges();

    const general = panels(fixture).find((p) => p.id.endsWith('panel-general'))!;
    expect(general.classList.contains('hidden')).toBe(true);
    expect(general.getAttribute('tabindex')).toBeNull();
  });

  it('renders a tab with no panel template without complaint', async () => {
    const { fixture } = await setup({ activeId: 'general' });
    expect(panels(fixture).length).toBeGreaterThan(0);
    expect(el(fixture).textContent).toContain('General');
  });
});

describe('SvTabsComponent — two strips on one page', () => {
  @Component({
    standalone: true,
    imports: [SvTabsComponent],
    template: `
      <sv-tabs [tabs]="tabs" activeId="general" />
      <sv-tabs [tabs]="tabs" activeId="general" />
    `,
  })
  class TwoStrips {
    readonly tabs = TABS;
  }

  async function two() {
    TestBed.resetTestingModule();
    return render(TwoStrips);
  }

  it('gives every element in both strips a unique id', async () => {
    // ★ Every id was a global literal built from the tab's own id — `tab-general`,
    // `panel-general`. Two settings screens on a page, or a tabbed panel inside a
    // tabbed page, is the ordinary layout, and both strips claimed the same ids.
    const { fixture } = await two();
    const ids = [...el(fixture).querySelectorAll('[id]')].map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not move focus into the other strip', async () => {
    // `document.getElementById('tab-security')` finds whichever strip is first
    // in the document, so arrowing in the second one threw focus into the first.
    const { fixture } = await two();
    const strips = [...el(fixture).querySelectorAll('sv-tabs')];
    const second = strips[1];
    const secondTabs = [...second.querySelectorAll<HTMLButtonElement>('[role="tab"]')];

    secondTabs[0].focus();
    await userEvent.keyboard('{ArrowRight}');
    fixture.detectChanges();

    expect(second.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(secondTabs[1]);
  });

  it('points each panel at a tab in its own strip', async () => {
    const { fixture } = await two();
    for (const strip of el(fixture).querySelectorAll('sv-tabs')) {
      for (const panel of strip.querySelectorAll('[role="tabpanel"]')) {
        const owner = el(fixture).querySelector(`#${panel.getAttribute('aria-labelledby')}`);
        expect(strip.contains(owner)).toBe(true);
      }
    }
  });
});
