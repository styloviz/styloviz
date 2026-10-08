import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { until, quietFor } from '@testing/async';
import {
  SvFormErrorSummaryComponent,
  type SvFormError,
  type SvFormErrorReachFailure,
} from './form-error-summary.component';

/**
 * `N-8` / `FI-11-I1` — the list of what is wrong, with a way into each one.
 *
 * The interesting cases are all the same case: the field the summary points at
 * is not in the DOM when the user clicks the entry. A collapsed group renders
 * nothing; so does a wizard step that is not current. Every assertion here is
 * about that seam, or about the focus story that makes the summary reachable in
 * the first place.
 */

const ERRORS: SvFormError[] = [
  { fieldId: 'email', label: 'Email address', message: 'Enter a valid email', groupId: 'contact' },
  { fieldId: 'postcode', label: 'Postcode', message: 'This field cannot be empty' },
];

/**
 * A host with a REAL collapsed group, because that is the defect: the field
 * exists in the model and not in the document until something opens it.
 */
@Component({
  selector: 'sv-summary-host',
  imports: [SvFormErrorSummaryComponent],
  template: `
    <sv-form-error-summary
      [errors]="errors()"
      [autoFocus]="autoFocus()"
      (errorActivated)="activated.push($event); open.set(true)"
      (reachFailed)="failures.push($event)" />

    @if (open()) {
      <input id="email" type="text" />
    }
    <fieldset id="postcode">
      <input id="postcode-inner" type="text" />
    </fieldset>
  `,
})
class HostComponent {
  readonly errors = signal<readonly SvFormError[]>([]);
  readonly autoFocus = signal(true);
  readonly open = signal(false);
  readonly activated: SvFormError[] = [];
  readonly failures: { error: SvFormError; reason: SvFormErrorReachFailure }[] = [];
}

async function setup(errors: readonly SvFormError[] = ERRORS) {
  TestBed.resetTestingModule();
  const { fixture } = await render(HostComponent);
  fixture.componentInstance.errors.set(errors);
  fixture.detectChanges();
  return fixture;
}

const region = (): HTMLElement | null => document.querySelector('[data-sv-state="error"]');

describe('SvFormErrorSummaryComponent — what it renders', () => {
  it('renders nothing at all before the user has attempted anything', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(HostComponent);
    // A summary that appears on a pristine form tells the user they have made
    // mistakes they have not yet had the chance to make.
    expect(region()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('problem');
  });

  it('lists every error with its label and its message', async () => {
    await setup();
    expect(screen.getByRole('button', { name: 'Email address' })).toBeTruthy();
    expect(region()!.textContent).toContain('Enter a valid email');
    expect(region()!.textContent).toContain('This field cannot be empty');
  });

  it('counts the problems, and gets the singular right', async () => {
    const f = await setup([ERRORS[0]]);
    expect(screen.getByRole('heading').textContent).toBe('There is a problem');

    f.componentInstance.errors.set(ERRORS);
    f.detectChanges();
    expect(screen.getByRole('heading').textContent).toBe('There are 2 problems');
  });

  it('lets the host word it, with {n} for the count', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvFormErrorSummaryComponent, {
      inputs: { errors: ERRORS, heading: 'Fix {n} things before continuing' },
    });
    fixture.detectChanges();
    expect(screen.getByRole('heading').textContent).toBe('Fix 2 things before continuing');
  });

  /**
   * A real heading, not a styled div. The reader most likely to be looking for
   * this is the one navigating by heading, and a `<div>` with big text is
   * invisible to that.
   */
  it('renders a real heading at the level the page needs', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvFormErrorSummaryComponent, {
      inputs: { errors: ERRORS, headingLevel: 3 },
    });
    fixture.detectChanges();
    expect(screen.getByRole('heading', { level: 3 })).toBeTruthy();
  });

  it('names the region by its heading, so the two cannot drift apart', async () => {
    await setup();
    const labelledBy = region()!.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)!.textContent).toBe('There are 2 problems');
  });

  /**
   * Not `role="alert"`, on purpose: this list changes on every submit, and an
   * alert would re-announce all of it over the top of the field the reader had
   * just reached.
   */
  it('is a focusable region rather than an alert', async () => {
    await setup();
    expect(region()!.getAttribute('tabindex')).toBe('-1');
    expect(region()!.getAttribute('role')).toBeNull();
  });
});

describe('SvFormErrorSummaryComponent — getting to the field', () => {
  it('emits before it looks, so the host can reveal a collapsed field', async () => {
    const f = await setup();
    // The field genuinely is not in the document yet — that is the defect.
    expect(document.getElementById('email')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Email address' }));
    f.detectChanges();

    expect(f.componentInstance.activated.map((e) => e.fieldId)).toEqual(['email']);
    expect(f.componentInstance.activated[0].groupId).toBe('contact');
  });

  it('focuses the field once the host has opened it', async () => {
    const f = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Email address' }));
    f.detectChanges();

    await until(() => document.activeElement?.id === 'email', { label: 'focus to land on the field' });
    expect(f.componentInstance.failures).toEqual([]);
  });

  /**
   * A required group's error belongs to the `<fieldset>` — that is where
   * `aria-describedby` points — and a fieldset is not a tab stop. Sending the
   * user there and leaving focus on `<body>` is the same silent nothing this
   * component exists to prevent.
   */
  it('falls through a non-focusable target to the first control inside it', async () => {
    const f = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Postcode' }));
    f.detectChanges();

    await until(() => document.activeElement?.id === 'postcode-inner', {
      label: 'focus to fall through to the input',
    });
    expect(f.componentInstance.failures).toEqual([]);
  });

  it('says so when the field cannot be reached at all', async () => {
    const f = await setup([{ fieldId: 'nowhere', label: 'Nickname', message: 'Required' }]);
    await userEvent.click(screen.getByRole('button', { name: 'Nickname' }));
    f.detectChanges();

    await until(() => f.componentInstance.failures.length === 1, { label: 'the failure report' });
    f.detectChanges();

    expect(f.componentInstance.failures[0].reason).toBe('not-found');
    // Silence would be worse than no summary: the user has been told where the
    // problem is AND that they cannot go to it, with no way to tell a broken
    // link from a field that is merely off-screen.
    expect(region()!.querySelector('[data-sv-state="unreachable"]')).not.toBeNull();
  });

  it('clears an old could-not-reach mark when the errors change', async () => {
    const f = await setup([{ fieldId: 'nowhere', label: 'Nickname', message: 'Required' }]);
    await userEvent.click(screen.getByRole('button', { name: 'Nickname' }));
    await until(() => f.componentInstance.failures.length === 1, { label: 'the failure report' });
    f.detectChanges();
    expect(region()!.querySelector('[data-sv-state="unreachable"]')).not.toBeNull();

    f.componentInstance.errors.set(ERRORS);
    f.detectChanges();

    // A field fixed in one submit and broken in the next deserves a fresh
    // verdict, not a mark from an attempt nobody made against it.
    expect(region()!.querySelector('[data-sv-state="unreachable"]')).toBeNull();
  });
});

describe('SvFormErrorSummaryComponent — focus on submit', () => {
  it('takes focus when the summary appears', async () => {
    await setup();
    await until(() => document.activeElement === region(), { label: 'focus to reach the summary' });
    expect(document.activeElement).toBe(region());
  });

  it('leaves focus alone when the host says not to', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(HostComponent);
    fixture.componentInstance.autoFocus.set(false);
    fixture.componentInstance.errors.set(ERRORS);
    fixture.detectChanges();
    await quietFor(30);

    expect(document.activeElement).not.toBe(region());
  });

  /**
   * The gap `autoFocus` cannot close, and the reason `focusSummary()` is public:
   * a second failed submit with the same errors is not an empty → non-empty
   * transition, so nothing moves and the user is left wondering what happened.
   */
  it('moves focus again on a repeat submit, when the host asks', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvFormErrorSummaryComponent, { inputs: { errors: ERRORS } });
    fixture.detectChanges();
    await until(() => document.activeElement === region(), { label: 'the first focus' });

    (document.querySelector('button') as HTMLElement).focus();
    expect(document.activeElement).not.toBe(region());

    fixture.componentInstance.focusSummary();
    await until(() => document.activeElement === region(), { label: 'the second focus' });
  });

  it('does nothing when there is nothing to show, so it is safe to call blind', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvFormErrorSummaryComponent, { inputs: { errors: [] } });
    const before = document.activeElement;
    fixture.componentInstance.focusSummary();
    await quietFor(30);
    expect(document.activeElement).toBe(before);
  });
});
