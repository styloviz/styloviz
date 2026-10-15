import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SvChipComponent } from '../chip/chip.component';
import { SvChipGroupComponent } from './chip-group.component';

/**
 * `FI-07-I2` / `FI-07-M2` — a set of chips that belongs to something.
 *
 * A selectable `sv-chip` is a `role="checkbox"` with its own `tabindex="0"`.
 * Valid ARIA, poor control: twenty filter chips were twenty tab stops, and a
 * reader announcing "Design, checkbox, not checked" could not say what set it
 * belonged to or how big the set was.
 */

@Component({
  standalone: true,
  imports: [SvChipGroupComponent, SvChipComponent],
  template: `
    <sv-chip-group [label]="label()" [orientation]="orientation()">
      <sv-chip label="Design" [selectable]="true" [(selected)]="a" />
      <sv-chip label="Frontend" [selectable]="true" [(selected)]="b" />
      <sv-chip label="Backend" [selectable]="true" [disabled]="bDisabled()" [(selected)]="c" />
      <sv-chip label="Status only" />
    </sv-chip-group>
  `,
})
class HostComponent {
  readonly label = signal('Filter by tag');
  readonly orientation = signal<'horizontal' | 'vertical'>('horizontal');
  readonly bDisabled = signal(false);
  readonly a = signal(false);
  readonly b = signal(false);
  readonly c = signal(false);
}

function setup() {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    host: fixture.componentInstance,
    el,
    group: fixture.debugElement.query(By.directive(SvChipGroupComponent))
      .componentInstance as SvChipGroupComponent,
    container: () => el.querySelector<HTMLElement>('[role="group"]')!,
    boxes: () => Array.from(el.querySelectorAll<HTMLElement>('[role="checkbox"]')),
    tick: () => fixture.detectChanges(),
  };
}

const press = (el: HTMLElement, key: string) => {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(ev);
  return ev;
};

describe('SvChipGroupComponent — the set has a name', () => {
  it('names the group, so a chip is a member of something', () => {
    const { container } = setup();
    expect(container().getAttribute('role')).toBe('group');
    expect(container().getAttribute('aria-label')).toBe('Filter by tag');
  });

  /**
   * DA-47 — `aria-orientation` is not allowed on `role="group"` (axe:
   * aria-allowed-attr, critical), and the arrows move on both axes in either
   * layout, so orientation is a layout fact only.
   */
  it('lays the chips out on the requested axis without claiming an ARIA orientation', () => {
    const { host, container, tick } = setup();
    expect(container().hasAttribute('aria-orientation')).toBe(false);
    expect(container().className).toContain('flex-row');

    host.orientation.set('vertical');
    tick();
    expect(container().hasAttribute('aria-orientation')).toBe(false);
    expect(container().className).toContain('flex-col');
  });

  /**
   * An unnamed group is worse than no group: a reader announces a grouping
   * boundary and cannot say what the grouping is.
   */
  it('drops the attribute rather than rendering an empty name', () => {
    const { host, container, tick } = setup();
    host.label.set('');
    tick();
    expect(container().getAttribute('aria-label')).toBeNull();
  });
});

describe('SvChipGroupComponent — one tab stop, not twenty', () => {
  it('gives the set a single tab stop', () => {
    const { boxes } = setup();
    const tabbable = boxes().filter((b) => b.getAttribute('tabindex') === '0');

    expect(boxes().length).toBe(3);
    expect(tabbable.length).toBe(1);
  });

  it('takes the others out of the tab order without taking them out of reach', () => {
    const { boxes } = setup();
    const rest = boxes().slice(1);
    for (const b of rest) expect(b.getAttribute('tabindex')).toBe('-1');
  });

  it('moves the stop to whichever chip the user actually focused', () => {
    const { boxes, tick } = setup();
    boxes()[1].dispatchEvent(new Event('focus'));
    tick();

    expect(boxes()[1].getAttribute('tabindex')).toBe('0');
    expect(boxes()[0].getAttribute('tabindex')).toBe('-1');
  });

  /**
   * A chip that is not selectable was never focusable and must not become a
   * member of the roving set — a status chip is decoration.
   */
  it('leaves a non-selectable chip out of the rotation entirely', () => {
    const { el, group } = setup();
    const plain = Array.from(el.querySelectorAll('sv-chip'))[3];

    expect(plain.querySelector('[role="checkbox"]')).toBeNull();
    expect(group.focusableChips().length).toBe(3);
  });
});

describe('SvChipGroupComponent — arrows move, they do not choose', () => {
  it('steps focus forward with the arrows', () => {
    const { boxes, tick } = setup();
    press(boxes()[0], 'ArrowRight');
    tick();

    expect(document.activeElement).toBe(boxes()[1]);
  });

  it('wraps around both ends', () => {
    const { boxes, tick } = setup();
    press(boxes()[0], 'ArrowLeft');
    tick();
    expect(document.activeElement).toBe(boxes()[2]);

    press(boxes()[2], 'ArrowRight');
    tick();
    expect(document.activeElement).toBe(boxes()[0]);
  });

  it('jumps to the ends with Home and End', () => {
    const { boxes, tick } = setup();
    press(boxes()[0], 'End');
    tick();
    expect(document.activeElement).toBe(boxes()[2]);

    press(boxes()[2], 'Home');
    tick();
    expect(document.activeElement).toBe(boxes()[0]);
  });

  /**
   * ★★ THE WHOLE REASON THIS IS NOT A RADIOGROUP. In a radiogroup selection
   *    follows focus and that is correct — there is always exactly one answer,
   *    so moving IS choosing. Here, a user scanning a filter bar with the
   *    arrows would silently switch on every filter they passed.
   */
  it('does not select anything on the way past', () => {
    const { host, boxes, tick } = setup();
    press(boxes()[0], 'ArrowRight');
    tick();
    press(boxes()[1], 'ArrowRight');
    tick();

    expect(host.a()).toBe(false);
    expect(host.b()).toBe(false);
    expect(host.c()).toBe(false);
  });

  it('still toggles on Space, which is the key that means choose', () => {
    const { host, boxes, tick } = setup();
    boxes()[0].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    tick();

    expect(host.a()).toBe(true);
  });

  /**
   * Tab and Escape must reach the page. A group that swallowed every key would
   * trap the user inside the control they were trying to leave.
   */
  it('lets a key it does not own pass through uncancelled', () => {
    const { boxes } = setup();
    for (const key of ['Tab', 'Escape', 'a']) {
      expect(press(boxes()[0], key).defaultPrevented).toBe(false);
    }
  });

  it('cancels the keys it does own, so the page does not scroll', () => {
    const { boxes } = setup();
    expect(press(boxes()[0], 'ArrowRight').defaultPrevented).toBe(true);
  });
});

describe('SvChipGroupComponent — a set that changes under the cursor', () => {
  /**
   * Arrowing onto something that cannot be acted on reads as the control being
   * broken, so a disabled chip is stepped over rather than focused.
   */
  it('skips a disabled chip', () => {
    const { host, group, boxes, tick } = setup();
    host.bDisabled.set(true);
    tick();

    // It keeps `role="checkbox"` and gains `aria-disabled` — a disabled control
    // still exists, and dropping the role would hide it from the set entirely.
    // What it loses is its place in the rotation.
    expect(boxes().length).toBe(3);
    expect(boxes()[2].getAttribute('aria-disabled')).toBe('true');
    expect(boxes()[2].getAttribute('tabindex')).toBeNull();
    expect(group.focusableChips().length).toBe(2);

    press(boxes()[1], 'ArrowRight');
    tick();
    expect(document.activeElement).toBe(boxes()[0]);
  });

  /**
   * The tab stop is held as an INDEX, so a chip disappearing cannot leave the
   * group pointing at something that is no longer there — the set would then
   * have no reachable member at all.
   */
  it('keeps exactly one tab stop when the set shrinks under it', () => {
    const { host, boxes, tick } = setup();
    press(boxes()[0], 'End');
    tick();
    expect(document.activeElement).toBe(boxes()[2]);

    host.bDisabled.set(true);
    tick();

    const tabbable = boxes().filter((b) => b.getAttribute('tabindex') === '0');
    expect(tabbable.length).toBe(1);
  });
});

describe('SvChipComponent — alone', () => {
  /**
   * A lone status chip is a perfectly good thing and must not require a
   * container to exist.
   */
  it('is still its own tab stop outside any group', () => {
    TestBed.resetTestingModule();
    @Component({
      standalone: true,
      imports: [SvChipComponent],
      template: `<sv-chip label="Solo" [selectable]="true" />`,
    })
    class Solo {}

    const f = TestBed.createComponent(Solo);
    f.detectChanges();
    const box = (f.nativeElement as HTMLElement).querySelector('[role="checkbox"]')!;
    expect(box.getAttribute('tabindex')).toBe('0');
  });
});

// ─── Re-verified 2026-09-26: tokens and the × button ───────────────────────

@Component({
  standalone: true,
  imports: [SvChipGroupComponent, SvChipComponent],
  template: `
    <sv-chip-group label="Applied filters" [selectionMode]="mode()">
      @for (t of tokens(); track t) {
        <sv-chip [label]="t" [removable]="true" [selectable]="selectable()" (removed)="removed.push(t)" />
      }
    </sv-chip-group>
  `,
})
class TokenHost {
  readonly mode = signal<'multiple' | 'none'>('none');
  readonly selectable = signal(false);
  readonly tokens = signal(['Status: open', 'Owner: me', 'Due: this week']);
  readonly removed: string[] = [];
}

function setupTokens() {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(TokenHost);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    host: fixture.componentInstance,
    el,
    xs: () => Array.from(el.querySelectorAll<HTMLButtonElement>('button[aria-label^="Remove"]')),
    tick: () => fixture.detectChanges(),
  };
}

describe('SvChipGroupComponent — a row of tokens is one tab stop too', () => {
  it('puts exactly one remove button in the tab order', () => {
    const { xs } = setupTokens();
    expect(xs().map((b) => b.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });

  it('walks the remove buttons with the arrows', () => {
    const { xs, tick } = setupTokens();
    xs()[0].focus();
    press(xs()[0], 'ArrowRight');
    tick();
    expect(document.activeElement).toBe(xs()[1]);
    expect(xs().map((b) => b.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
  });

  it('lets Enter on a remove button do its job instead of cancelling it', () => {
    const { xs } = setupTokens();
    // The chip body listens for Enter/Space; a key on the × used to bubble up
    // and be preventDefault-ed, which cancels the button's own activation.
    expect(press(xs()[0], 'Enter').defaultPrevented).toBe(false);
    expect(press(xs()[0], ' ').defaultPrevented).toBe(false);
  });

  it('does not infer a filter from `selectable` in a selectionMode="none" group', () => {
    const { host, el, tick } = setupTokens();
    host.selectable.set(true);
    tick();
    expect(el.querySelectorAll('[role="checkbox"]').length).toBe(0);

    host.mode.set('multiple');
    tick();
    expect(el.querySelectorAll('[role="checkbox"]').length).toBe(3);
  });

  it('keeps a filter chip\'s × out of the tab order and removes with Delete instead', () => {
    const { host, el, xs, tick } = setupTokens();
    host.mode.set('multiple');
    host.selectable.set(true);
    tick();

    const boxes = Array.from(el.querySelectorAll<HTMLElement>('[role="checkbox"]'));
    expect(xs().every((b) => b.getAttribute('tabindex') === '-1')).toBe(true);
    expect(boxes[0].getAttribute('aria-keyshortcuts')).toBe('Delete Backspace');

    expect(press(boxes[1], 'Delete').defaultPrevented).toBe(true);
    expect(host.removed).toEqual(['Owner: me']);
    // Enter on the × removes (via the native click) rather than toggling the filter.
    expect(press(xs()[0], 'Enter').defaultPrevented).toBe(false);
  });
});

describe('SvChipComponent — a lone removable chip keeps the native × behaviour', () => {
  it('leaves the × in its native tab order and adds no shortcut', () => {
    TestBed.resetTestingModule();
    @Component({
      standalone: true,
      imports: [SvChipComponent],
      template: `<sv-chip label="Solo" [removable]="true" [selectable]="true" />`,
    })
    class Solo {}
    const f = TestBed.createComponent(Solo);
    f.detectChanges();
    const root = f.nativeElement as HTMLElement;
    expect(root.querySelector('button')!.hasAttribute('tabindex')).toBe(false);
    expect(root.querySelector('[role="checkbox"]')!.hasAttribute('aria-keyshortcuts')).toBe(false);
  });
});
