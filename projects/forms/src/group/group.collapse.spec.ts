import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvGroupComponent } from './group.component';

/**
 * The collapse animation's two awkward moments: the very first paint of a group
 * that starts collapsed (which must not animate, or the content flashes on
 * screen before hiding), and a `transitionend` that came from something inside
 * the projected content rather than from the region itself.
 */

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

async function setup(attrs = '', content = '<button type="button">One</button>') {
  TestBed.resetTestingModule();
  const view = await render(`<sv-group ${attrs}>${content}</sv-group>`, {
    imports: [SvGroupComponent],
  });
  const debug = view.fixture.debugElement.query(By.directive(SvGroupComponent));
  return {
    ...view,
    group: debug.componentInstance as SvGroupComponent,
    host: debug.nativeElement as HTMLElement,
  };
}

/** The collapsible region carries a generated `group-content-*` id. */
const region = (host: HTMLElement) => host.querySelector<HTMLElement>('[id^="group-content-"]');

describe('SvGroupComponent — starting collapsed', () => {
  it('hides the content outright rather than animating it shut on first paint', async () => {
    // Animating open → closed on load is a visible flash of content the user
    // was never meant to see, so the initial state is set with `display`, not
    // with the height transition.
    const { host, group } = await setup('label="Billing" [collapsible]="true" [collapsed]="true"');
    expect(group.isCollapsed()).toBe(true);
    expect(region(host)?.style.display).toBe('none');
  });

  it('leaves the content visible when it starts expanded', async () => {
    const { host } = await setup('label="Billing" [collapsible]="true"');
    expect(region(host)).not.toBeNull();
    expect(region(host)?.style.display).not.toBe('none');
  });

  it('does not hide anything when the group is not collapsible', async () => {
    // `collapsed` without `collapsible` is a misconfiguration, and it must not
    // make the content unreachable — there would be no toggle to bring it back.
    const { host } = await setup('label="Billing" [collapsed]="true"');
    expect(region(host)).toBeNull();
    const hidden = [...host.querySelectorAll<HTMLElement>('div')].some(
      (d) => d.style.display === 'none',
    );
    expect(hidden).toBe(false);
  });
});

describe('SvGroupComponent — settling the collapse animation', () => {
  it('ignores a transitionend that came from the projected content', async () => {
    // A transition on anything inside the region bubbles up to it. Treating
    // that as "the collapse finished" ends the animation early and leaves the
    // region stuck at whatever height it had reached.
    const { host, group, fixture } = await setup(
      'label="Billing" [collapsible]="true"',
      '<button type="button">One</button>',
    );
    const content = region(host)!;
    const inner = content.querySelector('button')!;

    group.toggleCollapse(); // start closing
    await nextFrame();
    inner.dispatchEvent(new Event('transitionend', { bubbles: true }));
    fixture.detectChanges();

    // Still mid-animation: the stray event must not have hidden the region.
    expect(content.style.display).not.toBe('none');
  });

  it('finishes on a transitionend that came from the region itself', async () => {
    const { host, group, fixture } = await setup('label="Billing" [collapsible]="true"');
    const content = region(host)!;

    group.toggleCollapse();
    await nextFrame();
    content.dispatchEvent(new Event('transitionend'));
    fixture.detectChanges();

    expect(content.style.display).toBe('none');
  });

  it('is safe to destroy mid-animation', async () => {
    const { group, fixture } = await setup('label="Billing" [collapsible]="true"');
    group.toggleCollapse();
    expect(() => fixture.destroy()).not.toThrow();
  });
});
