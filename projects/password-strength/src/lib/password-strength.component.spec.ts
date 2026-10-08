import { render, screen } from '@testing-library/angular';
import { untilRendered } from '../../../../src/testing/async';
import { SvPasswordStrengthComponent } from './password-strength.component';
import type { PasswordBreachStatus, PasswordGuidance } from './password-strength';

/** The visible band label — plain text, deliberately not a live region. */
const bandLabel = (fixture: { nativeElement: unknown }) =>
  (fixture.nativeElement as HTMLElement).querySelector('[data-sv-band]') as HTMLElement;

/** The polite announcement region. */
const liveRegion = () => screen.getByRole('status');

describe('SvPasswordStrengthComponent', () => {
  it('shows a neutral "no password" state and zero filled segments when empty', async () => {
    const { fixture } = await render(SvPasswordStrengthComponent, { inputs: { value: '' } });
    expect(bandLabel(fixture).textContent?.trim()).toBe('No password entered');
    const segments = fixture.nativeElement.querySelectorAll('[aria-hidden="true"] > span');
    expect(segments.length).toBe(4);
    for (const seg of Array.from(segments) as HTMLElement[]) {
      expect(seg.className).toContain('bg-gray-200');
    }
  });

  it('reads a long passphrase as the top band', async () => {
    const { fixture } = await render(SvPasswordStrengthComponent, {
      inputs: { value: 'thistlewood Harbour lantern7' },
    });
    expect(bandLabel(fixture).textContent?.trim()).toBe('Strong');
  });

  it('renders at least one filled segment for a non-empty weak password', async () => {
    const { fixture } = await render(SvPasswordStrengthComponent, { inputs: { value: 'password' } });
    expect(bandLabel(fixture).textContent?.trim()).toBe('Very weak');
    const filled = fixture.nativeElement.querySelectorAll('[aria-hidden="true"] > span.bg-danger-500');
    expect(filled.length).toBeGreaterThanOrEqual(1);
  });

  it('shows suggestions by default and hides them on request', async () => {
    const { container, fixture } = await render(SvPasswordStrengthComponent, {
      inputs: { value: 'password' },
    });
    expect(container.querySelectorAll('ul li').length).toBeGreaterThan(0);

    fixture.componentRef.setInput('showSuggestions', false);
    fixture.detectChanges();
    expect(container.querySelector('ul')).toBeNull();
  });

  it('measures against the host policy, not its own opinion', async () => {
    await render(SvPasswordStrengthComponent, {
      inputs: { value: 'Ab1!Ab1!', minLength: 16 },
    });
    const list = screen.getAllByRole('listitem');
    expect(list.some((li) => li.textContent?.includes('16 characters'))).toBe(true);
  });

  describe('announcements', () => {
    // ★ DD-25-I2: the visible label used to BE the live region, so every
    //   keystroke interrupted a screen-reader user and re-read the band. The
    //   information is now in a separate polite region that waits for a pause
    //   and only speaks when the band changed.

    it('does not make the visible band label a live region', async () => {
      const { fixture } = await render(SvPasswordStrengthComponent, { inputs: { value: 'abc' } });
      const label = bandLabel(fixture);
      expect(label.getAttribute('aria-live')).toBeNull();
      expect(label.getAttribute('role')).toBeNull();
    });

    it('says nothing at all until something has been typed', async () => {
      await render(SvPasswordStrengthComponent, {
        inputs: { value: '', announceDelay: 0 },
      });
      expect(liveRegion().textContent?.trim()).toBe('');
    });

    it('announces the band once typing settles', async () => {
      const { fixture } = await render(SvPasswordStrengthComponent, {
        inputs: { value: 'thistlewood Harbour lantern7', announceDelay: 0 },
      });
      await untilRendered(fixture, () => liveRegion().textContent!.trim().length > 0);
      expect(liveRegion().textContent?.trim()).toBe('Password strength: Strong.');
    });

    it('stays silent while the band is unchanged, however much is typed', async () => {
      const { fixture } = await render(SvPasswordStrengthComponent, {
        inputs: { value: 'thistlewood Harbour lantern7', announceDelay: 0 },
      });
      await untilRendered(fixture, () => liveRegion().textContent!.trim().length > 0);

      // Still the top band; a different password, same advice. Nothing to say.
      fixture.componentRef.setInput('value', 'thistlewood Harbour lantern78');
      await untilRendered(fixture, () => true);
      expect(liveRegion().textContent?.trim()).toBe('Password strength: Strong.');
    });

    it('cancels a pending announcement when the next keystroke arrives', async () => {
      // A long quiet period that the test never waits out: the announcement for
      // the intermediate value must never land.
      const { fixture } = await render(SvPasswordStrengthComponent, {
        inputs: { value: 'a', announceDelay: 5000 },
      });
      fixture.componentRef.setInput('value', 'ab');
      fixture.componentRef.setInput('value', 'abc');
      await untilRendered(fixture, () => true);
      expect(liveRegion().textContent?.trim()).toBe('');
    });

    it('opens the announcement with the group label so it has a subject', async () => {
      const { fixture } = await render(SvPasswordStrengthComponent, {
        inputs: { value: 'password', label: 'New password strength', announceDelay: 0 },
      });
      await untilRendered(fixture, () => liveRegion().textContent!.trim().length > 0);
      expect(liveRegion().textContent?.trim()).toBe('New password strength: Very weak.');
    });

    it('clears itself when the field is emptied, so the next band is news again', async () => {
      const { fixture } = await render(SvPasswordStrengthComponent, {
        inputs: { value: 'password', announceDelay: 0 },
      });
      await untilRendered(fixture, () => liveRegion().textContent!.trim().length > 0);

      fixture.componentRef.setInput('value', '');
      await untilRendered(fixture, () => liveRegion().textContent!.trim() === '');

      fixture.componentRef.setInput('value', 'password');
      await untilRendered(fixture, () => liveRegion().textContent!.trim().length > 0);
      expect(liveRegion().textContent?.trim()).toBe('Password strength: Very weak.');
    });

    // DD-25-M3: the breach notice is on screen, so it has to be spoken too — and
    // a finding for an unchanged password is news even though the band did not move.
    it('speaks the breach notice with the band', async () => {
      const { fixture } = await render(SvPasswordStrengthComponent, {
        inputs: { value: 'password', breach: 'breached' as PasswordBreachStatus, announceDelay: 0 },
      });
      await untilRendered(fixture, () => liveRegion().textContent!.trim().length > 0);
      expect(liveRegion().textContent?.trim()).toBe(
        'Password strength: Very weak. This password has appeared in a data breach. Choose a different one.',
      );
    });

    it('re-announces when a breach finding arrives while the band stays at 0', async () => {
      const { fixture } = await render(SvPasswordStrengthComponent, {
        inputs: { value: 'password', announceDelay: 0 },
      });
      await untilRendered(fixture, () => liveRegion().textContent!.trim().length > 0);
      expect(liveRegion().textContent?.trim()).toBe('Password strength: Very weak.');

      fixture.componentRef.setInput('breach', 'breached');
      await untilRendered(fixture, () => liveRegion().textContent!.includes('data breach'));
      expect(liveRegion().textContent?.trim()).toContain('Very weak. This password has appeared in a data breach');

      fixture.componentRef.setInput('breach', 'unavailable');
      await untilRendered(fixture, () => liveRegion().textContent!.includes('could not check'));
      expect(liveRegion().textContent?.trim()).toBe(
        'Password strength: Very weak. We could not check this against known breaches right now.',
      );
    });
  });

  describe('breach status', () => {
    // ★ DD-25-M3: the host owns the network call. The component takes the answer,
    //   reports an outage as an outage, and blocks nothing in any state.

    it('shows no breach notice when the host is not running a check', async () => {
      const { fixture } = await render(SvPasswordStrengthComponent, {
        inputs: { value: 'thistlewood Harbour lantern7' },
      });
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-sv-breach]')).toBeNull();
    });

    it('lets a breach finding override a passphrase the heuristic liked', async () => {
      const { fixture } = await render(SvPasswordStrengthComponent, {
        inputs: { value: 'thistlewood Harbour lantern7', breach: 'breached' as PasswordBreachStatus },
      });
      expect(bandLabel(fixture).textContent?.trim()).toBe('Very weak');
      const notice = (fixture.nativeElement as HTMLElement).querySelector('[data-sv-breach]')!;
      expect(notice.textContent).toContain('appeared in a data breach');
      expect(notice.className).toContain('bg-danger-50');
    });

    it('marks an in-flight check busy rather than pretending to have an answer', async () => {
      const { fixture } = await render(SvPasswordStrengthComponent, {
        inputs: { value: 'thistlewood Harbour lantern7', breach: 'checking' as PasswordBreachStatus },
      });
      const notice = (fixture.nativeElement as HTMLElement).querySelector('[data-sv-breach]')!;
      expect(notice.getAttribute('aria-busy')).toBe('true');
      expect(bandLabel(fixture).textContent?.trim()).toBe('Strong');
    });

    it('tells an outage apart from a finding, in words and in colour', async () => {
      const outage = await render(SvPasswordStrengthComponent, {
        inputs: { value: 'thistlewood Harbour lantern7', breach: 'unavailable' as PasswordBreachStatus },
      });
      const notice = (outage.fixture.nativeElement as HTMLElement).querySelector('[data-sv-breach]')!;
      expect(notice.textContent).toContain('could not check');
      // A warning, not a danger: nobody's password was rejected here.
      expect(notice.className).toContain('bg-warning-50');
      expect(bandLabel(outage.fixture).textContent?.trim()).toBe('Strong');
    });

    it('never marks the notice as an alert in any state', async () => {
      const { fixture } = await render(SvPasswordStrengthComponent, {
        inputs: { value: 'thistlewood Harbour lantern7', breach: 'checking' as PasswordBreachStatus },
      });
      for (const breach of ['checking', 'safe', 'breached', 'unavailable'] as const) {
        fixture.componentRef.setInput('breach', breach);
        fixture.detectChanges();
        const notice = (fixture.nativeElement as HTMLElement).querySelector('[data-sv-breach]')!;
        expect(notice.getAttribute('role')).toBeNull();
        expect(notice.getAttribute('aria-live')).toBeNull();
      }
    });
  });

  describe('guidanceChange', () => {
    it('emits on a band change and stays quiet when the band holds', async () => {
      const emitted: PasswordGuidance[] = [];
      const { fixture } = await render(SvPasswordStrengthComponent, {
        inputs: { value: 'a' },
        on: { guidanceChange: (g: PasswordGuidance) => emitted.push(g) },
      });
      await untilRendered(fixture, () => emitted.length > 0);
      expect(emitted[0].band).toBe(0);

      fixture.componentRef.setInput('value', 'thistlewood Harbour lantern7');
      await untilRendered(fixture, () => emitted.length > 1);
      expect(emitted.at(-1)!.band).toBe(4);

      // A different password in the same band is not a change worth reporting.
      fixture.componentRef.setInput('value', 'thistlewood Harbour lantern78');
      fixture.detectChanges();
      await Promise.resolve();
      expect(emitted.length).toBe(2);
    });

    it('re-emits when a breach finding arrives for an unchanged password', async () => {
      const emitted: PasswordGuidance[] = [];
      const { fixture } = await render(SvPasswordStrengthComponent, {
        inputs: { value: 'password' },
        on: { guidanceChange: (g: PasswordGuidance) => emitted.push(g) },
      });
      await untilRendered(fixture, () => emitted.length > 0);
      expect(emitted[0].fromBreachCheck).toBe(false);

      // Same band (0), but now it rests on evidence rather than a heuristic —
      // which is exactly the difference a host wants to record.
      fixture.componentRef.setInput('breach', 'breached');
      await untilRendered(fixture, () => emitted.length > 1);
      expect(emitted.at(-1)!.fromBreachCheck).toBe(true);
    });
  });
});
