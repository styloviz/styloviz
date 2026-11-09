import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { render } from '@testing-library/angular';
import { provideSvIcons } from '@styloviz/icons';
import { starIcon } from '@styloviz/icons/glyph/star';
import { SvDashboardShellComponent } from './dashboard-shell/dashboard-shell.component';
import { SvDividerComponent } from './divider/divider.component';
import { SvSidebarComponent } from './sidebar/sidebar.component';
import { SvToolbarComponent, type ToolbarAction } from './toolbar/toolbar.component';

/**
 * FL-J3-LU-02 — the layout family under `dir="rtl"` (`X-14`, `LU-11-I5`,
 * `LU-11-M6`, `LU-03-I4`, `LU-03-M4`). The Splitter's half is in
 * `layout-pro/src/splitter/splitter.rtl.spec.ts`, the Watermark's in
 * `watermark/src/lib/watermark.rtl.spec.ts`.
 *
 * ★★ jsdom has no layout, so these pin the two things that DECIDE the layout:
 *    the toolbar's key handling (which reads the direction through core
 *    `svIsRtl`, whose `[dir]` walk works here), and that every edge in the
 *    shell, sidebar and divider is LOGICAL — `start`/`end`/`ms`/`border-e` —
 *    so the browser mirrors it. A physical `left-0` or `ml-64` is the defect:
 *    under RTL the sidebar sat on the left while the content made room for it
 *    on the left too, and the mirrored page had a 16rem hole on the right.
 */

/** Any Tailwind utility that names a PHYSICAL horizontal edge. */
const PHYSICAL = /(^|\s|:)-?(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|text-left|text-right)(-|\s|$)/;

function physicalClasses(root: Element): string[] {
  const out: string[] = [];
  for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
    const cls = el.getAttribute('class') ?? '';
    for (const c of cls.split(/\s+/)) if (c && PHYSICAL.test(c)) out.push(`${el.tagName.toLowerCase()} .${c}`);
  }
  return out;
}

// ── Shell + sidebar ──────────────────────────────────────────────────────────

@Component({
  imports: [SvDashboardShellComponent, SvSidebarComponent],
  template: `
    <div dir="rtl">
      <sv-dashboard-shell [(collapsed)]="collapsed" [(mobileOpen)]="open">
        <sv-sidebar svShellSidebar><a href="/orders">Orders</a></sv-sidebar>
        <p>Page</p>
      </sv-dashboard-shell>
    </div>`,
})
class RtlShellHost {
  readonly collapsed = signal(false);
  readonly open = signal(false);
}

describe('Dashboard shell + sidebar — RTL (X-14)', () => {
  async function setup() {
    TestBed.resetTestingModule();
    const r = await render(RtlShellHost);
    const root = r.fixture.nativeElement as HTMLElement;
    return {
      ...r,
      root,
      aside: root.querySelector('aside') as HTMLElement,
      content: root.querySelector('main')!.parentElement as HTMLElement,
    };
  }

  it('★ offsets the content on the inline START, the side the sidebar is pinned to', async () => {
    const { content, aside, fixture } = await setup();
    expect(aside.classList).toContain('start-0');
    expect(content.classList).toContain('lg:ms-64');
    fixture.componentInstance.collapsed.set(true);
    fixture.detectChanges();
    expect(content.classList).toContain('lg:ms-20');
    // The transition follows the logical property it animates.
    expect(content.className).toContain('transition-[margin-inline-start]');
  });

  it('the sidebar border faces the content on the inline END', async () => {
    const { aside } = await setup();
    expect(aside.classList).toContain('border-e');
  });

  it('★ a closed overlay slides off to the RIGHT in RTL, and the desktop sidebar is untouched', async () => {
    const { aside, fixture } = await setup();
    // Closed: off-screen on the start side in both directions.
    expect(aside.classList).toContain('-translate-x-full');
    expect(aside.classList).toContain('max-lg:rtl:translate-x-full');
    // Scoped below lg: Tailwind emits `rtl:` after `lg:`, so an unscoped
    // `rtl:translate-x-full` would beat `lg:translate-x-0` and hide the
    // desktop sidebar in RTL.
    expect(aside.classList).not.toContain('rtl:translate-x-full');
    expect(aside.classList).toContain('lg:translate-x-0');

    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    expect(aside.classList).toContain('translate-x-0');
    expect(aside.classList).not.toContain('max-lg:rtl:translate-x-full');
  });

  it('names no physical horizontal edge anywhere in the shell or sidebar it renders', async () => {
    const { root } = await setup();
    expect(physicalClasses(root.querySelector('sv-dashboard-shell')!)).toEqual([]);
  });
});

// ── Toolbar ──────────────────────────────────────────────────────────────────

const ACTIONS: ToolbarAction[] = [
  { id: 'a', label: 'A', icon: 'bold' },
  { id: 'b', label: 'B', icon: 'italic' },
  { id: 'c', label: 'C', icon: 'underline' },
];

@Component({
  imports: [SvToolbarComponent],
  template: `<div [attr.dir]="dir()"><sv-toolbar [actions]="actions" /></div>`,
})
class ToolbarHost {
  readonly dir = signal<'rtl' | 'ltr'>('rtl');
  readonly actions = ACTIONS;
}

describe('Toolbar — arrow keys follow the visual direction (LU-11-I5, LU-11-M6)', () => {
  async function setup(dir: 'rtl' | 'ltr') {
    TestBed.resetTestingModule();
    const r = await render(ToolbarHost);
    r.fixture.componentInstance.dir.set(dir);
    r.fixture.detectChanges();
    const root = r.fixture.nativeElement as HTMLElement;
    const btn = (id: string) => root.querySelector<HTMLButtonElement>(`[data-action-id="${id}"]`)!;
    const press = (from: string, key: string) => {
      btn(from).focus();
      btn(from).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    };
    return { ...r, btn, press };
  }

  it('★ in RTL, ArrowLeft moves to the NEXT action — it is drawn to the left', async () => {
    const { btn, press } = await setup('rtl');
    press('a', 'ArrowLeft');
    expect(document.activeElement).toBe(btn('b'));
    press('b', 'ArrowRight');
    expect(document.activeElement).toBe(btn('a'));
  });

  it('in RTL, ArrowRight from the first action wraps to the last', async () => {
    const { btn, press } = await setup('rtl');
    press('a', 'ArrowRight');
    expect(document.activeElement).toBe(btn('c'));
  });

  it('LTR is unchanged (the negative)', async () => {
    const { btn, press } = await setup('ltr');
    press('a', 'ArrowRight');
    expect(document.activeElement).toBe(btn('b'));
  });

  it('Up/Down and Home/End are direction-free: next/previous, first/last', async () => {
    const { btn, press } = await setup('rtl');
    press('a', 'ArrowDown');
    expect(document.activeElement).toBe(btn('b'));
    press('b', 'ArrowUp');
    expect(document.activeElement).toBe(btn('a'));
    press('a', 'End');
    expect(document.activeElement).toBe(btn('c'));
    press('c', 'Home');
    expect(document.activeElement).toBe(btn('a'));
  });

});

// ── Divider ──────────────────────────────────────────────────────────────────

@Component({
  imports: [SvDividerComponent],
  template: `
    <div dir="rtl">
      <sv-divider label="Start" align="start" />
      <sv-divider label="End" align="end" />
      <sv-divider orientation="vertical" variant="dashed" [thickness]="2" />
      <sv-divider icon="star" />
      <sv-divider variant="gradient" />
    </div>`,
})
class DividerHost {}

describe('Divider — RTL (LU-03-I4, LU-03-M4)', () => {
  let dividerInstances: SvDividerComponent[] = [];
  async function setup() {
    TestBed.resetTestingModule();
    const { fixture } = await render(DividerHost, { providers: [provideSvIcons([starIcon])] });
    dividerInstances = fixture.debugElement.queryAll(By.directive(SvDividerComponent)).map((d) => d.componentInstance);
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('sv-divider')) as HTMLElement[];
  }

  it('★ align="start" puts the label FIRST in the flex row, so it sits at the inline start (the right, in RTL)', async () => {
    const [start] = await setup();
    const row = start.firstElementChild as HTMLElement;
    // No leading line: the label is the first child, then the line.
    expect(row.children[0].textContent).toContain('Start');
    expect(row.children).toHaveLength(2);
    // The row is a plain flex row — no `flex-row-reverse` or `justify-*` that
    // would pin it to a physical side.
    expect(row.className).not.toMatch(/row-reverse|justify-(start|end)/);
  });

  it('align="end" puts the label LAST — the inline end', async () => {
    const [, end] = await setup();
    const row = end.firstElementChild as HTMLElement;
    expect(row.children[row.children.length - 1].textContent).toContain('End');
    expect(row.children).toHaveLength(2);
  });

  it('a vertical rule draws its border on the inline START, not the physical left', async () => {
    const [, , vertical] = await setup();
    const line = vertical.querySelector('.flex-1') as HTMLElement;
    expect(line.classList).toContain('border-s');
    const cmp = dividerInstances[2];
    expect(cmp.lineStyle()).toContain('border-inline-start-width:2px');
    expect(cmp.lineStyle()).not.toContain('border-left');
  });

  it('an icon-only divider does not pretend the icon means something: it is hidden, and nothing is announced but "separator"', async () => {
    const [, , , iconOnly] = await setup();
    const svg = iconOnly.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    const sep = iconOnly.querySelector('[role="separator"]')!;
    expect(sep.getAttribute('aria-label')).toBeNull();
  });

  it('the gradient rule is symmetric (transparent at both ends), so it reads the same mirrored', async () => {
    const dividers = await setup();
    const line = dividers[4].querySelector('.flex-1') as HTMLElement;
    expect(line.className).toContain('from-transparent');
    expect(line.className).toContain('to-transparent');
  });

  it('names no physical horizontal edge in any variant', async () => {
    for (const d of await setup()) expect(physicalClasses(d)).toEqual([]);
  });
});
