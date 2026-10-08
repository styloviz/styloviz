import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SvGroupComponent } from './group.component';

/**
 * `FI-06-M1`, `FI-11-M1`, `FI-11-M2`.
 *
 * Three backlog items that turn out to be one component's problem. "Select at
 * least one" is true of a fieldset and of no checkbox in it; a count of what is
 * wrong behind a chevron is only useful while the chevron is shut; and neither
 * matters if the application can collapse the section the error is in.
 */

@Component({
  standalone: true,
  imports: [SvGroupComponent],
  template: `
    <sv-group
      [label]="label()"
      [description]="description()"
      [collapsible]="collapsible()"
      [collapsed]="collapsed()"
      [errorMessage]="errorMessage()"
      [errorCount]="errorCount()"
      [expandOnError]="expandOnError()"
      (collapsedChange)="emitted.push($event)"
    >
      <input type="checkbox" />
    </sv-group>
  `,
})
class HostComponent {
  readonly label = signal('Contact');
  readonly description = signal('');
  readonly collapsible = signal(false);
  readonly collapsed = signal(false);
  readonly errorMessage = signal('');
  readonly errorCount = signal(0);
  readonly expandOnError = signal(true);
  readonly emitted: boolean[] = [];
}

function setup() {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const debug = fixture.debugElement.query(By.directive(SvGroupComponent));
  return {
    fixture,
    host: fixture.componentInstance,
    group: debug.componentInstance as SvGroupComponent,
    el: fixture.nativeElement as HTMLElement,
    /** Apply pending signal writes and re-render. */
    tick: () => fixture.detectChanges(),
  };
}

const container = (el: HTMLElement) => el.querySelector<HTMLElement>('[role="group"]')!;
const alert = (el: HTMLElement) => el.querySelector<HTMLElement>('[role="alert"]');
const badge = (el: HTMLElement) => el.querySelector<HTMLElement>('[id$="-error-count"]');

// ─── FI-06-M1 ────────────────────────────────────────────────────────────────

describe('SvGroupComponent — the error belongs to the fieldset (FI-06-M1)', () => {
  it('renders a group-level message and marks the container invalid', () => {
    const { host, el, tick } = setup();
    host.errorMessage.set('Select at least one option');
    tick();

    expect(alert(el)?.textContent?.trim()).toBe('Select at least one option');
    expect(container(el).getAttribute('aria-invalid')).toBe('true');
  });

  it('points the container at the message rather than leaving it floating', () => {
    // A `role="alert"` announces once, when it appears. Someone arriving at the
    // group afterwards — tabbing back, or sent here by an error summary — hears
    // nothing at all unless the container names it.
    const { host, el, tick } = setup();
    host.errorMessage.set('Select at least one option');
    tick();

    const errorId = alert(el)!.getAttribute('id');
    expect(errorId).toBeTruthy();
    expect(container(el).getAttribute('aria-describedby')).toContain(errorId!);
  });

  it('says nothing at all when the group is valid', () => {
    const { el } = setup();

    expect(alert(el)).toBeNull();
    expect(container(el).getAttribute('aria-invalid')).toBeNull();
    // Not `aria-describedby=""` — a present attribute naming nothing reads
    // differently from an absent one on some assistive tech.
    expect(container(el).getAttribute('aria-describedby')).toBeNull();
  });

  it('composes the description and the error instead of choosing between them', () => {
    // The description was rendered and associated with nothing before this: a
    // line of standing instruction under the legend that nobody reaching the
    // group by keyboard ever heard.
    const { host, el, tick } = setup();
    host.description.set('How we reach you');
    host.errorMessage.set('Select at least one option');
    tick();

    const descId = el.querySelector('p[id$="-desc"]')!.getAttribute('id')!;
    const errId = alert(el)!.getAttribute('id')!;
    expect(container(el).getAttribute('aria-describedby')!.split(' ')).toEqual([descId, errId]);
  });

  /**
   * `sv-form-error-summary` promises that activating an entry takes you to the
   * thing that is wrong. A container with no `tabindex` cannot be focused, so
   * the summary reports `reachFailed` and moves nobody — which makes the two
   * features useless in the one combination they were both built for.
   */
  it('becomes programmatically focusable while invalid, and not before', () => {
    const { host, el, tick } = setup();
    expect(container(el).getAttribute('tabindex')).toBeNull();

    host.errorMessage.set('Select at least one option');
    tick();
    expect(container(el).getAttribute('tabindex')).toBe('-1');

    container(el).focus();
    expect(document.activeElement).toBe(container(el));

    // -1, never 0: a keyboard user still tabs straight into the first field.
    expect(container(el).getAttribute('tabindex')).not.toBe('0');
  });

  it('drops the focus target again once the group is valid', () => {
    const { host, el, tick } = setup();
    host.errorMessage.set('Nope');
    tick();
    expect(container(el).getAttribute('tabindex')).toBe('-1');

    host.errorMessage.set('');
    tick();
    expect(container(el).getAttribute('tabindex')).toBeNull();
  });
});

// ─── FI-11-M1 ────────────────────────────────────────────────────────────────

describe('SvGroupComponent — the count on the collapsed header (FI-11-M1)', () => {
  it('shows the tally only once the group is shut', () => {
    const { host, group, el, tick } = setup();
    host.collapsible.set(true);
    host.errorCount.set(3);
    tick();

    // Expanded: each of those three errors is on screen beside its own field,
    // and a second tally next to the legend is noise.
    expect(badge(el)).toBeNull();

    host.expandOnError.set(false);
    tick();
    group.toggleCollapse();
    tick();

    expect(badge(el)?.textContent).toContain('3');
  });

  it('completes the bare number into a sentence for a screen reader', () => {
    // A reader that announced "3" here would be telling nobody anything.
    const { host, group, el, tick } = setup();
    host.collapsible.set(true);
    host.errorCount.set(3);
    host.expandOnError.set(false);
    tick();
    group.toggleCollapse();
    tick();

    expect(badge(el)!.querySelector('.sr-only')!.textContent).toBe('3 fields need attention');
    // The digit itself is hidden, or the reader says "3, 3 fields need attention".
    expect(badge(el)!.querySelector('[aria-hidden="true"]')!.textContent).toBe('3');
  });

  it('says "1 field", not "1 fields"', () => {
    const { host, group, el, tick } = setup();
    host.collapsible.set(true);
    host.errorCount.set(1);
    host.expandOnError.set(false);
    tick();
    group.toggleCollapse();
    tick();

    expect(badge(el)!.querySelector('.sr-only')!.textContent).toBe('1 field needs attention');
  });

  it('names the tally in the container description, so arriving at the group reports it', () => {
    const { host, group, el, tick } = setup();
    host.collapsible.set(true);
    host.errorCount.set(2);
    host.expandOnError.set(false);
    tick();
    group.toggleCollapse();
    tick();

    expect(container(el).getAttribute('aria-describedby')).toContain(badge(el)!.id);
    expect(container(el).getAttribute('aria-invalid')).toBe('true');
  });

  it('tells the user who clicked the chevron what they just hid', () => {
    // Focus stays on the button after the click, and the container's
    // description is not re-read to someone already inside the group — so the
    // button itself has to carry the tally.
    const { host, el, tick } = setup();
    host.collapsible.set(true);
    host.errorCount.set(2);
    tick();

    const chevron = el.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
    expect(chevron.hasAttribute('aria-describedby')).toBe(false);

    chevron.click();
    tick();

    expect(chevron.getAttribute('aria-expanded')).toBe('false');
    expect(chevron.getAttribute('aria-describedby')).toBe(badge(el)!.id);
    expect(badge(el)!.querySelector('.sr-only')!.textContent).toBe('2 fields need attention');

    chevron.click();
    tick();
    expect(chevron.hasAttribute('aria-describedby')).toBe(false);
  });

  it('shows nothing when nothing is wrong', () => {
    const { host, group, el, tick } = setup();
    host.collapsible.set(true);
    tick();
    group.toggleCollapse();
    tick();

    expect(badge(el)).toBeNull();
  });
});

// ─── FI-11-M2 ────────────────────────────────────────────────────────────────

describe('SvGroupComponent — never auto-collapse over an error (FI-11-M2)', () => {
  it('refuses a programmatic collapse while the group is invalid', () => {
    const { host, group, tick } = setup();
    host.collapsible.set(true);
    host.errorCount.set(1);
    tick();

    host.collapsed.set(true);
    tick();

    expect(group.isCollapsed()).toBe(false);
  });

  it('reports the real state back, so a host mirroring `collapsed` learns it was refused', () => {
    // Silently ignoring the request is how the application ends up believing
    // the section is shut while the user is looking at it open.
    const { host, tick } = setup();
    host.collapsible.set(true);
    host.errorCount.set(1);
    tick();

    host.collapsed.set(true);
    tick();

    expect(host.emitted).toEqual([false]);
  });

  it('starts expanded when it was asked to start collapsed over an error', () => {
    // The guard applies to the initial value exactly as it does to a later one:
    // a form that re-renders with server errors must not open with them hidden.
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.collapsible.set(true);
    fixture.componentInstance.collapsed.set(true);
    fixture.componentInstance.errorCount.set(2);
    fixture.detectChanges();

    const group = fixture.debugElement.query(By.directive(SvGroupComponent))
      .componentInstance as SvGroupComponent;
    expect(group.isCollapsed()).toBe(false);
    expect(fixture.componentInstance.emitted).toEqual([false]);
  });

  it('opens a collapsed group the moment an error appears inside it', () => {
    const { host, group, tick } = setup();
    host.collapsible.set(true);
    host.collapsed.set(true);
    tick();
    expect(group.isCollapsed()).toBe(true);

    host.errorMessage.set('These dates overlap');
    tick();

    expect(group.isCollapsed()).toBe(false);
    expect(host.emitted).toContain(false);
  });

  /**
   * The two halves of `FI-11` compose. `M2` stops the *application* hiding an
   * error; `M1` makes sure the user who hides one on purpose knows it is there.
   * Refusing the chevron instead would give the user a control that visibly
   * does nothing when clicked.
   */
  it('still honours a collapse the user asked for', () => {
    const { host, group, el, tick } = setup();
    host.collapsible.set(true);
    host.errorCount.set(2);
    tick();

    group.toggleCollapse();
    tick();

    expect(group.isCollapsed()).toBe(true);
    expect(badge(el)?.textContent).toContain('2');
  });

  it('does not re-open the group the user collapsed when the same error is still there', () => {
    // The expand effect keys off the arrival of an error, not its presence —
    // otherwise a deliberate collapse would spring open on the next render.
    const { host, group, tick } = setup();
    host.collapsible.set(true);
    host.errorCount.set(2);
    tick();
    group.toggleCollapse();
    tick();

    host.errorCount.set(2);
    tick();
    host.label.set('Billing');
    tick();

    expect(group.isCollapsed()).toBe(true);
  });

  it('does not queue a refused collapse for later', () => {
    // A refusal is a refusal. Applying it retroactively when the error clears
    // would collapse a section under a user who has moved on.
    const { host, group, tick } = setup();
    host.collapsible.set(true);
    host.errorCount.set(1);
    tick();
    host.collapsed.set(true);
    tick();
    expect(group.isCollapsed()).toBe(false);

    host.errorCount.set(0);
    tick();

    expect(group.isCollapsed()).toBe(false);
  });

  it('lets a host that opts out collapse over an error', () => {
    const { host, group, tick } = setup();
    host.collapsible.set(true);
    host.expandOnError.set(false);
    host.errorCount.set(1);
    tick();

    host.collapsed.set(true);
    tick();

    expect(group.isCollapsed()).toBe(true);
  });
});
