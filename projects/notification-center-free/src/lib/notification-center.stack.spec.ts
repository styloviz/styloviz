import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvOverlayStackService } from '@styloviz/core';
import { SvNotificationCenterComponent } from './notification-center.component';
import type { NotificationItem } from './notification-center.types';

/**
 * FREE twin. `X-4` re-check (2026-09-29) — the notification panel is a floating overlay
 * and now answers the stack's questions in BOTH twins: its z-index comes from
 * the stack, Escape belongs to the topmost surface only, and a click inside a
 * surface opened from it is not "outside".
 *
 * ★★★ It had a page-level `z-[9999]` of its own and an unconditioned
 *     `document:keydown.escape`, so a dialog opened from a notification
 *     painted under the panel and one Escape closed both.
 */

const items: NotificationItem[] = [
  { id: 'a', type: 'comment', title: 'Hello', timestamp: '2026-07-20T10:00:00Z', read: false },
];

/** What these tests touch — the part both twins share. */
interface NcLike {
  _open(): boolean;
  closePanel(): void;
}

type Mount = () => Promise<{ fixture: ComponentFixture<NcLike> }>;

async function openPanel(mount: Mount) {
  TestBed.resetTestingModule();
  const { fixture } = await mount();
  const stack = TestBed.inject(SvOverlayStackService);
  const bell = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-haspopup]')!;
  bell.click();
  await new Promise((r) => setTimeout(r, 0));
  fixture.detectChanges();
  const portal = () => document.querySelector<HTMLElement>('[data-nc-portal]');
  return { fixture, stack, portal, c: fixture.componentInstance };
}

const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

afterEach(() => document.querySelectorAll('[data-nc-portal]').forEach((n) => n.remove()));

// ★ The Pro spec also mounts this twin, through the package import. This file
//   exists so the FREE package's own suite proves its copy of the stack code —
//   a free build tested only from the Pro side is verified by accident.
const twins: readonly (readonly [string, Mount])[] = [
  ['free', () => render(SvNotificationCenterComponent, { inputs: { variant: 'dropdown', notifications: items } })],
];

for (const [name, cmp] of twins) {
  describe(`X-4 — sv-notification-center (${name}) is on the overlay stack`, () => {
    it('★★ takes its z-index from the stack and releases it on close', async () => {
      const { stack, portal, c, fixture } = await openPanel(cmp);
      const before = stack.size;
      expect(portal()).not.toBeNull();
      expect(Number(portal()!.style.zIndex)).toBeGreaterThanOrEqual(1000);

      const dialog = stack.push('modal');
      // Opened later, so it paints above the panel it came from.
      expect(dialog.zIndex).toBeGreaterThan(Number(portal()!.style.zIndex));
      dialog.release();

      c.closePanel();
      fixture.detectChanges();
      expect(stack.size).toBe(before - 1);
    });

    it('★★★ Escape closes only the topmost surface — a dialog over the panel keeps it open', async () => {
      const { stack, portal, c, fixture } = await openPanel(cmp);
      const dialog = stack.push('modal');

      escape();
      fixture.detectChanges();
      expect(c._open()).toBe(true);
      expect(portal()).not.toBeNull();

      dialog.release();
      escape();
      fixture.detectChanges();
      expect(c._open()).toBe(false);
    });

    it('★ a click inside a surface opened FROM the panel does not close it', async () => {
      const { stack, c, fixture } = await openPanel(cmp);
      const child = document.createElement('div');
      child.innerHTML = '<button>Confirm</button>';
      document.body.appendChild(child);
      const menu = stack.push('anchored', { element: () => child });

      child.querySelector('button')!.click();
      fixture.detectChanges();
      expect(c._open()).toBe(true);

      menu.release();
      child.remove();
      document.body.click();
      fixture.detectChanges();
      expect(c._open()).toBe(false);
    });
  });
}

describe('X-4 — sv-notification-center (free) never blocks the page', () => {
  it('★ its only floating variant is an anchored dropdown, so nothing goes inert', async () => {
    // The modal presentation (`drawer`) is Pro-only; the free union has
    // `dropdown` and `inline`, and neither may take the page.
    const page = document.createElement('div');
    page.innerHTML = '<button>On the page</button>';
    document.body.appendChild(page);
    try {
      const { portal } = await openPanel(twins[0][1]);
      expect(portal()).not.toBeNull();
      expect(page.hasAttribute('inert')).toBe(false);
    } finally {
      page.remove();
    }
  });
});
