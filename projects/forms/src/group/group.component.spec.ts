import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvGroupComponent } from './group.component';

/**
 * A grouping container earns its keep entirely through wiring: the `role` and
 * the name that make a set of controls announce as one thing, and — when it
 * collapses — a toggle whose `aria-expanded` and `aria-controls` actually point
 * at the region that moved. Everything else it does is class strings.
 */

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

const region = (host: HTMLElement) => host.querySelector('[role="group"]')!;

describe('SvGroupComponent — the group itself', () => {
  it('is a named group when it has a label', async () => {
    const { host, group } = await setup('label="Notifications"');
    const labelled = region(host).getAttribute('aria-labelledby');
    expect(labelled).toBe(group._uid);
    expect(host.querySelector(`#${labelled}`)?.textContent?.trim()).toBe('Notifications');
  });

  it('does not point at a label it never rendered', async () => {
    const { host } = await setup();
    expect(region(host).getAttribute('role')).toBe('group');
    expect(region(host).getAttribute('aria-labelledby')).toBeNull();
  });

  it('renders a description under the label', async () => {
    await setup('label="Notifications" description="How we reach you."');
    expect(screen.getByText('How we reach you.')).toBeTruthy();
  });

  it('projects its content', async () => {
    await setup('label="Notifications"');
    expect(screen.getByRole('button', { name: 'One' })).toBeTruthy();
  });

  it('gives every instance a distinct id', async () => {
    // Both instances must share an application: ids are per application (svUniqueId).
    const { group: a } = await setup('label="A"');
    const first = a._uid;
    const second = TestBed.createComponent(SvGroupComponent);
    second.componentRef.setInput('label', 'B');
    second.detectChanges();
    await second.whenStable();
    expect(second.componentInstance._uid).not.toBe(first);
  });
});

describe('SvGroupComponent — collapsing', () => {
  it('has no toggle, and no region id, unless it collapses', async () => {
    const { host } = await setup('label="Notifications"');
    expect(screen.queryByRole('button', { name: '' })).toBeNull();
    expect(host.querySelectorAll('button').length).toBe(1); // the projected one
    // By absence rather than by position: the container's last child is the
    // group-level error slot now, and `div:last-child` quietly matched nothing.
    expect(host.querySelector('[id^="group-content-"]')).toBeNull();
  });

  it('points the toggle at the region it controls', async () => {
    const { host, group } = await setup('label="Notifications" [collapsible]="true"');
    const toggle = host.querySelectorAll('button')[0]!;
    const controls = toggle.getAttribute('aria-controls');
    expect(controls).toBe(`group-content-${group._uid}`);
    expect(host.querySelector(`#${controls}`)).not.toBeNull();
  });

  it('starts expanded and says so', async () => {
    const { host, group } = await setup('label="Notifications" [collapsible]="true"');
    expect(group.isCollapsed()).toBe(false);
    expect(host.querySelectorAll('button')[0]!.getAttribute('aria-expanded')).toBe('true');
  });

  it('reports each collapse and expand once', async () => {
    const seen: boolean[] = [];
    const { host, group, fixture } = await setup('label="Notifications" [collapsible]="true"');
    group.collapsedChange.subscribe((v) => seen.push(v));
    const toggle = host.querySelectorAll('button')[0]!;

    await userEvent.click(toggle);
    fixture.detectChanges();
    expect(group.isCollapsed()).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(toggle);
    fixture.detectChanges();
    expect(seen).toEqual([true, false]);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('honours a collapsed start and hides the region without animating into it', async () => {
    const { host, group } = await setup('label="Notifications" [collapsible]="true" [collapsed]="true"');
    expect(group.isCollapsed()).toBe(true);
    expect(host.querySelectorAll('button')[0]!.getAttribute('aria-expanded')).toBe('false');

    const content = host.querySelector<HTMLElement>(`#group-content-${group._uid}`)!;
    expect(content.style.display).toBe('none');
  });

  it('ignores `collapsed` when it cannot collapse', async () => {
    const { host, group } = await setup('label="Notifications" [collapsed]="true"');
    // No toggle exists, so a collapsed region would be unreachable. The initial
    // state is still recorded, but nothing is hidden.
    expect(group.isCollapsed()).toBe(true);
    const content = host.querySelector<HTMLElement>('[role="group"] > div:last-of-type')!;
    expect(content.style.display).toBe('');
  });

  it('keeps the content mounted so projection is not torn down and rebuilt', async () => {
    // Single ng-content location on purpose — re-projecting through an @if
    // destroys and recreates whatever the host put inside.
    const { host, group, fixture } = await setup('label="N" [collapsible]="true"');
    const before = screen.getByRole('button', { name: 'One' });
    await userEvent.click(host.querySelectorAll('button')[0]!);
    fixture.detectChanges();
    expect(group.isCollapsed()).toBe(true);
    expect(screen.getByRole('button', { name: 'One' })).toBe(before);
  });
});

describe('SvGroupComponent — layout', () => {
  it('stacks vertically by default', async () => {
    const { group } = await setup();
    expect(group.innerClass()).toContain('flex flex-col');
    expect(group.innerClass()).toContain('gap-4');
  });

  it('lays out horizontally on request', async () => {
    const { group } = await setup('orientation="horizontal"');
    expect(group.innerClass()).toContain('flex flex-wrap');
  });

  it('drops the gap and rounds only the outer edges when fused', async () => {
    const { group } = await setup('[fused]="true" gap="lg"');
    expect(group.innerClass()).not.toContain('gap-');
    expect(group.innerClass()).toContain('rounded-l-md');
    expect(group.innerClass()).toContain('rounded-r-md');
  });

  it('forces a row when fused, whatever the orientation says', async () => {
    // Fused children share a border; stacked vertically that is a different
    // component. Orientation cannot be allowed to break the shape.
    const { group } = await setup('[fused]="true" orientation="vertical"');
    expect(group.innerClass()).toContain('flex flex-wrap');
  });

  it('divides along the axis it is laid out on', async () => {
    const { group: vertical } = await setup('[divide]="true"');
    expect(vertical.innerClass()).toContain('divide-y');

    const { group: horizontal } = await setup('[divide]="true" orientation="horizontal"');
    expect(horizontal.innerClass()).toContain('divide-x');
  });

  it('carries the chrome of its variant', async () => {
    const { group: plain } = await setup();
    expect(plain.outerClass()).not.toContain('border');

    const { group: card } = await setup('variant="card"');
    expect(card.outerClass()).toContain('border');
    expect(card.outerClass()).toContain('shadow-sm');
  });
});
