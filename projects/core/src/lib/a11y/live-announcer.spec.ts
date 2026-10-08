import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvLiveAnnouncer, svAnnouncePriorityFor, type SvScopedAnnouncer } from './live-announcer';

/**
 * ★★★ THE DEFECT THIS EXISTS FOR IS NOT "NOBODY ANNOUNCES" — IT IS THAT THE
 *     ANNOUNCEMENTS CANNOT BE HEARD. Toast and Alert Banner both inserted a
 *     node that already carried `aria-live` AND its own text: each toast *was*
 *     its own live region, arriving complete. Assistive technology watches an
 *     existing region for changes, so a region that arrives with its content
 *     is at the mercy of when the AT last scanned. Two regions created once
 *     and mutated forever is the pattern that works.
 *
 * ⚠️ What no test in jsdom can prove is that a screen reader then SPEAKS —
 *    there is no accessibility tree here. These assert the mechanism: the
 *    right region exists, the text reaches it, the mutation happens, and the
 *    four governance rules behave. The mechanism is shaped the way it is
 *    because of the behaviour above.
 */

function announcer(): SvLiveAnnouncer {
  TestBed.resetTestingModule();
  return TestBed.inject(SvLiveAnnouncer);
}

const textOf = (el: HTMLElement | null) => el?.textContent?.trim() ?? '';

afterEach(() => {
  document.querySelectorAll('[data-sv-live-region]').forEach((el) => el.remove());
});

describe('SvLiveAnnouncer — the regions', () => {
  it('★ creates both regions on first use, before any text goes into them', () => {
    const a = announcer();
    expect(a.regionFor('polite')).toBeNull();      // nothing touched the DOM yet

    a.announce('Saved');

    const polite = a.regionFor('polite')!;
    expect(polite.getAttribute('aria-live')).toBe('polite');
    expect(polite.getAttribute('aria-atomic')).toBe('true');
    expect(a.regionFor('assertive')!.getAttribute('aria-live')).toBe('assertive');
    expect(textOf(polite)).toBe('Saved');
    a.reset();
  });

  it('★ is hidden by clipping, not by display:none — which would silence it', () => {
    const a = announcer();
    a.announce('Saved');
    const style = a.regionFor('polite')!.style;

    expect(style.display).not.toBe('none');
    expect(style.visibility).not.toBe('hidden');
    expect(style.clipPath).toBe('inset(50%)');
    a.reset();
  });

  it('routes by priority, and the two regions do not see each other', () => {
    const a = announcer();
    a.announce('Upload failed', { priority: 'assertive' });
    a.announce('Draft saved');

    expect(textOf(a.regionFor('assertive'))).toBe('Upload failed');
    expect(textOf(a.regionFor('polite'))).toBe('Draft saved');
    a.reset();
  });

  it('★ moves a repeated message between two slots, so a repeat is still a mutation', () => {
    // Writing the same string over a region's text is not a DOM change, so an
    // AT has nothing to react to and a deliberate repeat is swallowed.
    const a = announcer();
    a.announce('No results');
    const region = a.regionFor('polite')!;
    const firstSlot = [...region.children].findIndex((c) => c.textContent);

    a.announce('No results', { force: true });
    const secondSlot = [...region.children].findIndex((c) => c.textContent);

    expect(secondSlot).not.toBe(firstSlot);
    expect(textOf(region)).toBe('No results');
    a.reset();
  });

  it('ignores an empty or whitespace-only message', () => {
    const a = announcer();
    expect(a.announce('   ')).toBe(false);
    expect(a.regionFor('polite')).toBeNull();
  });
});

describe('SvLiveAnnouncer — the four governance rules', () => {
  it('★ suppresses an identical repeat — OF-01-I4, the banner that re-announced itself', () => {
    const a = announcer();
    expect(a.announce('Changes saved')).toBe(true);
    expect(a.announce('Changes saved')).toBe(false);
    expect(a.announce('Changes saved', { force: true })).toBe(true);
    a.reset();
  });

  it('a different message is never suppressed', () => {
    const a = announcer();
    expect(a.announce('Saving…')).toBe(true);
    expect(a.announce('Saved')).toBe(true);
    a.reset();
  });

  it('★ a keyed message REPLACES the one waiting, rather than queueing behind it', async () => {
    // ★★ "Progress supersedes its own last value". 41 → 42 → 43 inside one
    //    window announces 43 once — not three values the user has passed.
    const a = announcer();
    expect(a.announce('41%', { key: 'upload', throttleMs: 40 })).toBe(true);
    expect(a.announce('42%', { key: 'upload', throttleMs: 40 })).toBe(false);
    expect(a.announce('43%', { key: 'upload', throttleMs: 40 })).toBe(false);
    expect(textOf(a.regionFor('polite'))).toBe('41%');

    await new Promise<void>((r) => setTimeout(r, 70));

    expect(textOf(a.regionFor('polite'))).toBe('43%');   // the latest, once
    a.reset();
  });

  it('unkeyed messages are independent — nothing is throttled by accident', () => {
    const a = announcer();
    expect(a.announce('Row 1 deleted')).toBe(true);
    expect(a.announce('Row 2 deleted')).toBe(true);
    expect(a.announce('Row 3 deleted')).toBe(true);
    a.reset();
  });

  it('cancel() drops a message that has not been spoken yet', async () => {
    const a = announcer();
    a.announce('10%', { key: 'job', throttleMs: 40 });
    a.announce('20%', { key: 'job', throttleMs: 40 });
    a.cancel('job');

    await new Promise<void>((r) => setTimeout(r, 70));

    expect(textOf(a.regionFor('polite'))).toBe('10%');   // 20% never arrived
    a.reset();
  });
});

@Component({ standalone: true, template: '' })
class AnnouncingHost {
  readonly live: SvScopedAnnouncer = inject(SvLiveAnnouncer).scoped();
}

describe('SvLiveAnnouncer — cancellation is the capability people forget', () => {
  it('★ a scoped announcer drops its held messages when its owner is destroyed', async () => {
    // A progress bar destroyed 200ms into a 500ms window would otherwise
    // announce a percentage for a component that no longer exists, about an
    // operation the user has navigated away from.
    TestBed.resetTestingModule();
    const { fixture } = await render(AnnouncingHost);
    const a = TestBed.inject(SvLiveAnnouncer);
    const host = fixture.componentInstance;

    host.live.announce('10%', { key: 'job', throttleMs: 40 });
    host.live.announce('20%', { key: 'job', throttleMs: 40 });

    fixture.destroy();
    await new Promise<void>((r) => setTimeout(r, 70));

    expect(textOf(a.regionFor('polite'))).toBe('10%');
    a.reset();
  });
});

describe('svAnnouncePriorityFor — one answer where the kit had two', () => {
  it('★ warning is POLITE, which is where Toast and Alert Banner disagreed', () => {
    // Toast announced `warning` assertively and Alert Banner announced it
    // politely — the same severity, the same word, interrupting the user in
    // one component and not the other. `assertive` cuts a screen reader off
    // mid-word, so it is for failures; a warning the user is not blocked by
    // does not earn that.
    expect(svAnnouncePriorityFor('warning')).toBe('polite');
    expect(svAnnouncePriorityFor('info')).toBe('polite');
    expect(svAnnouncePriorityFor('success')).toBe('polite');
  });

  it('error, danger and critical interrupt', () => {
    expect(svAnnouncePriorityFor('error')).toBe('assertive');
    expect(svAnnouncePriorityFor('danger')).toBe('assertive');
    expect(svAnnouncePriorityFor('critical')).toBe('assertive');
  });

  it('an unknown or absent variant is polite, which is the safe direction', () => {
    expect(svAnnouncePriorityFor(undefined)).toBe('polite');
    expect(svAnnouncePriorityFor('brand-new-variant')).toBe('polite');
  });
});
