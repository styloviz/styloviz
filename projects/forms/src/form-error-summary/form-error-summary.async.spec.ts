import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { until, quietFor } from '@testing/async';
import { SvLiveAnnouncer } from '@styloviz/core';
import { SvFormErrorSummaryComponent, type SvFormError } from './form-error-summary.component';

/**
 * ============================================================================
 *  `sv-form-error-summary` — server errors, async rechecks, live updates
 *  (`N-3`)
 * ============================================================================
 *
 * Two defects, both about the errors a USER did not just cause.
 *
 * ★★★ A SUBMISSION-LEVEL REJECTION HAD NOWHERE TO GO. `fieldId` was required,
 *     so "your session expired" and "that card was declined" left a host with
 *     two bad options: omit the error, and the form refuses to submit with
 *     nothing on screen saying why; or invent an id, and the entry becomes a
 *     link that reports "(could not jump to this field)" — telling the user
 *     the page is broken on top of the problem they already have.
 *
 * ★★ AND A LIST THAT CHANGED WHILE THE READER WAS ELSEWHERE WAS SILENT. The
 *    component is deliberately not a live region (an alert would re-announce
 *    the whole list over the top of the field the reader had just reached), and
 *    focus only moves when it APPEARS — so a server response adding a problem
 *    to a list already on screen was known only to someone looking at it.
 */

const FIELD_ERROR: SvFormError = {
  fieldId: 'email', label: 'Email address', message: 'Enter a valid email',
};
const FORM_ERROR: SvFormError = {
  label: 'Payment', message: 'Your card was declined',
};

@Component({
  selector: 'sv-async-summary-host',
  imports: [SvFormErrorSummaryComponent],
  template: `
    <sv-form-error-summary
      [errors]="errors()"
      [autoFocus]="autoFocus()"
      [busy]="busy()"
      [busyMessage]="busyMessage()"
      (errorActivated)="activated.push($event)"
      (reachFailed)="failures.push($event)" />
    <input id="email" type="text" />
  `,
})
class HostComponent {
  readonly errors = signal<readonly SvFormError[]>([]);
  readonly autoFocus = signal(false);
  readonly busy = signal(false);
  readonly busyMessage = signal('Rechecking…');
  readonly activated: SvFormError[] = [];
  readonly failures: unknown[] = [];
}

async function setup() {
  TestBed.resetTestingModule();
  const { fixture } = await render(HostComponent);
  const announcer = TestBed.inject(SvLiveAnnouncer);
  announcer.reset();
  return { fixture, host: fixture.componentInstance, announcer };
}

/** What the polite region is currently saying. */
function spoken(announcer: SvLiveAnnouncer): string {
  return announcer.regionFor('polite')?.textContent?.trim() ?? '';
}

const heading = () => screen.queryByRole('heading')?.textContent?.trim() ?? null;
const region = () => document.querySelector('[data-sv-state="error"]') as HTMLElement | null;
const formLevel = () =>
  Array.from(document.querySelectorAll('[data-sv-state="form-level"]'))
    .map(n => n.textContent?.trim());
const busyNote = () =>
  (document.querySelector('[data-sv-state="busy"]') as HTMLElement | null)?.textContent?.trim() ?? null;

afterEach(() => TestBed.inject(SvLiveAnnouncer).reset());

describe('a problem that is not a field’s', () => {
  it('lists it as text, not as a link', async () => {
    const { fixture, host } = await setup();
    host.errors.set([FORM_ERROR]);
    fixture.detectChanges();

    expect(formLevel()).toEqual(['Payment']);
    expect(screen.queryByRole('button', { name: 'Payment' })).toBeNull();
  });

  it('counts it, because the form is refusing to submit over it', async () => {
    const { fixture, host } = await setup();
    host.errors.set([FIELD_ERROR, FORM_ERROR]);
    fixture.detectChanges();
    expect(heading()).toBe('There are 2 problems');
  });

  it('never claims it could not jump to a field that does not exist', async () => {
    // ★ The failure mode this replaces: a host inventing a fieldId got an
    //   entry that reported the app broken on top of the real error.
    const { fixture, host } = await setup();
    host.errors.set([FORM_ERROR]);
    fixture.detectChanges();

    expect(document.querySelector('[data-sv-state="unreachable"]')).toBeNull();
    expect(host.failures).toHaveLength(0);
  });

  it('still links the field errors beside it', async () => {
    const { fixture, host } = await setup();
    host.errors.set([FORM_ERROR, FIELD_ERROR]);
    fixture.detectChanges();

    await userEvent.click(screen.getByRole('button', { name: 'Email address' }));
    await until(() => document.activeElement?.id === 'email');
    expect(host.activated).toEqual([FIELD_ERROR]);
  });

  it('keeps two entries distinct when neither has a field', async () => {
    // Angular reports a duplicate track key as NG0955 rather than as a failure,
    // so the assertion has to be on the warning: nothing about the rendered
    // list distinguishes one row with a duplicated key from two with distinct
    // ones, which is how a broken key ships.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // The track key was `fieldId + '|' + message`; with no fieldId both would
    // have collapsed onto one row.
    const { fixture, host } = await setup();
    // ★ Same MESSAGE on purpose. The track key was `fieldId + '|' + message`,
    //   which for two field-less entries is `undefined|Declined` twice — a
    //   duplicate key, which is the one thing `@for` cannot survive. The
    //   subject is what distinguishes them, so the key falls back to it.
    host.errors.set([
      { label: 'Card', message: 'Declined' },
      { label: 'Backup card', message: 'Declined' },
    ]);
    fixture.detectChanges();

    // A second submit hands the same two problems back as a new array, and
    // that re-diff is where a duplicate key is detected — the first render
    // never compares anything.
    host.errors.update(list => [...list]);
    fixture.detectChanges();

    expect(formLevel()).toEqual(['Card', 'Backup card']);
    expect(heading()).toBe('There are 2 problems');
    expect(warn.mock.calls.map(a => String(a[0])).filter(m => m.includes('NG0955'))).toEqual([]);
    warn.mockRestore();
  });
});

describe('a list that changes while the reader is elsewhere', () => {
  it('announces the count when a server error joins a list already on screen', async () => {
    const { fixture, host, announcer } = await setup();
    host.errors.set([FIELD_ERROR]);
    fixture.detectChanges();

    host.errors.set([FIELD_ERROR, FORM_ERROR]);
    fixture.detectChanges();

    // ★ The second sentence lands one throttle window later, and that IS the
    //   feature: a burst of async validators supersedes itself under one key
    //   rather than queueing three counts the user has already passed. Polled
    //   rather than timed — see `@testing/async`.
    await until(() => spoken(announcer) === 'There are 2 problems', {
      label: 'the updated count is announced',
    });
  });

  it('supersedes a burst rather than reading every intermediate count', async () => {
    const { fixture, host, announcer } = await setup();
    host.errors.set([FIELD_ERROR]);
    fixture.detectChanges();

    for (const extra of [FORM_ERROR, { label: 'Session', message: 'Sign in again' }]) {
      host.errors.update(list => [...list, extra]);
      fixture.detectChanges();
    }

    await until(() => spoken(announcer) === 'There are 3 problems', {
      label: 'only the final count is announced',
    });
    await quietFor();
    expect(spoken(announcer)).toBe('There are 3 problems');
  });

  it('announces its appearance when the host does not move focus', async () => {
    const { fixture, host, announcer } = await setup();
    host.errors.set([FIELD_ERROR]);
    fixture.detectChanges();
    expect(spoken(announcer)).toBe('There is a problem');
  });

  it('does NOT announce when it moved focus instead', async () => {
    // ★★ Focusing the region reads its accessible name, which IS the heading
    //    and the count. Announcing as well says the same sentence twice.
    const { fixture, host, announcer } = await setup();
    host.autoFocus.set(true);
    host.errors.set([FIELD_ERROR]);
    fixture.detectChanges();

    await until(() => document.activeElement === region());
    expect(spoken(announcer)).toBe('');
  });

  it('says nothing when the list changes without changing the count', async () => {
    // One problem replaced by another, in the same place: "There is a problem"
    // is what the reader was already told.
    const { fixture, host, announcer } = await setup();
    host.errors.set([FIELD_ERROR]);
    fixture.detectChanges();
    announcer.reset();

    host.errors.set([{ ...FIELD_ERROR, message: 'Enter your work email' }]);
    fixture.detectChanges();
    expect(spoken(announcer)).toBe('');
  });

  it('says nothing when the list empties', async () => {
    // The form submitted. Whatever happens next is the host's news to tell,
    // and "there are 0 problems" is not a sentence.
    const { fixture, host, announcer } = await setup();
    host.errors.set([FIELD_ERROR]);
    fixture.detectChanges();
    announcer.reset();

    host.errors.set([]);
    fixture.detectChanges();
    expect(spoken(announcer)).toBe('');
  });
});

describe('a recheck in flight', () => {
  it('marks the list as stale rather than asserting it', async () => {
    const { fixture, host } = await setup();
    host.errors.set([FIELD_ERROR]);
    fixture.detectChanges();

    host.busy.set(true);
    fixture.detectChanges();

    expect(region()?.getAttribute('aria-busy')).toBe('true');
    expect(busyNote()).toBe('Rechecking…');
  });

  it('carries no aria-busy and no note when it is not rechecking', async () => {
    const { fixture, host } = await setup();
    host.errors.set([FIELD_ERROR]);
    fixture.detectChanges();

    expect(region()?.hasAttribute('aria-busy')).toBe(false);
    expect(busyNote()).toBeNull();
  });

  it('HOLDS the announcement, and speaks the outcome once the recheck lands', async () => {
    // ★★★ Held, not skipped. The transition is consumed against the list as it
    //     stood BEFORE the recheck, so the user hears the answer rather than a
    //     count that was already obsolete when it was spoken.
    const { fixture, host, announcer } = await setup();
    host.errors.set([FIELD_ERROR]);
    fixture.detectChanges();
    announcer.reset();

    host.busy.set(true);
    host.errors.set([FIELD_ERROR, FORM_ERROR]);
    fixture.detectChanges();
    expect(spoken(announcer)).toBe('');

    host.busy.set(false);
    fixture.detectChanges();
    expect(spoken(announcer)).toBe('There are 2 problems');
  });

  it('does not move focus to a list it is about to replace', async () => {
    const { fixture, host } = await setup();
    host.autoFocus.set(true);
    host.busy.set(true);
    host.errors.set([FIELD_ERROR]);
    fixture.detectChanges();

    // ★ `focusSummary` defers a frame, so asserting immediately would pass
    //   with the hold removed. Wait past the window first, then assert the
    //   absence — the negative half of the `@testing/async` rule.
    await quietFor();
    expect(document.activeElement).not.toBe(region());

    host.busy.set(false);
    fixture.detectChanges();
    await until(() => document.activeElement === region());
  });

  it('announces nothing at all for a recheck that changed nothing', async () => {
    const { fixture, host, announcer } = await setup();
    host.errors.set([FIELD_ERROR]);
    fixture.detectChanges();
    announcer.reset();

    host.busy.set(true);
    fixture.detectChanges();
    host.busy.set(false);
    fixture.detectChanges();

    expect(spoken(announcer)).toBe('');
  });
});
