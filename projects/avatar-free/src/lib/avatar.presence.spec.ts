import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvAvatarComponent } from './avatar.component';

/**
 * Presence, and the moment before an image arrives.
 *
 * ★ Both defects here are the same shape: a state that was conveyed through one
 * channel only. Presence through hue alone — green, grey, amber, red at ten
 * pixels — and "there is a picture" through the absence of everything else.
 */

async function setup(inputs: Partial<ComponentInput<SvAvatarComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvAvatarComponent, {
    inputs: { name: 'Ada Lovelace', ...inputs } as ComponentInput<SvAvatarComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const dot = (f: { nativeElement: unknown }) =>
  [...el(f).querySelectorAll('[role="img"]')].find((n) =>
    n.getAttribute('aria-label')?.startsWith('Status:'),
  ) as HTMLElement;
const shell = (f: { nativeElement: unknown }) =>
  el(f).firstElementChild!.firstElementChild!.firstElementChild as HTMLElement;

describe('SvAvatarComponent — presence is not only a colour', () => {
  it('gives each state a form as well as a hue', async () => {
    const shapes = new Map<string, string>();
    for (const status of ['online', 'offline', 'away', 'busy'] as const) {
      const { fixture } = await setup({ status });
      shapes.set(status, fixture.componentInstance.statusShape());
    }
    // ★ Deuteranopia makes green and amber the same mark — and online/away is
    // exactly the pair a reader has to tell apart before sending a message.
    expect(new Set(shapes.values()).size).toBe(4);
    expect(shapes.get('online')).toBe('solid');
    expect(shapes.get('busy')).toBe('bar');
    expect(shapes.get('away')).toBe('crescent');
    expect(shapes.get('offline')).toBe('hollow');
  });

  it('draws offline as a ring rather than a grey fill', async () => {
    const { fixture } = await setup({ status: 'offline' });
    // A grey fill on a white card is nearly the card, so "offline" and "no dot
    // at all" looked the same. A ring is a mark either way.
    expect(dot(fixture).className).toContain('border-2');
    expect(fixture.componentInstance.statusBorderClass()).toContain('border-gray-400');
  });

  it('announces the state in words, not the raw enum', async () => {
    const { fixture } = await setup({ status: 'busy' });
    expect(dot(fixture).getAttribute('aria-label')).toBe('Status: Busy');
  });

  it('takes the host’s own wording', async () => {
    const { fixture } = await setup({ status: 'busy', statusLabel: 'In a meeting until 3' });
    expect(dot(fixture).getAttribute('aria-label')).toBe('Status: In a meeting until 3');
  });

  it('can put the state in visible words beside the avatar', async () => {
    const { fixture } = await setup({ status: 'away', showStatusText: true });
    expect(el(fixture).textContent).toContain('Away');
  });

  it('stays silent about presence when there is none', async () => {
    const { fixture } = await setup({ status: 'none', showStatusText: true });
    expect(dot(fixture)).toBeUndefined();
    expect(fixture.componentInstance.statusText()).toBe('');
  });
});

describe('SvAvatarComponent — the fallback is a layer, not a replacement', () => {
  it('keeps the initials visible while the image is still arriving', async () => {
    const { fixture } = await setup({ src: '/me.png', color: 'teal' });
    // ★ The shell used to drop its colour the moment `src` was set, so a slow
    // image left an empty hole and a broken one snapped from that hole to
    // initials — a flash on every failure.
    expect(shell(fixture).className).toContain('bg-teal-100');
    expect(el(fixture).textContent).toContain('AL');
    expect(el(fixture).querySelector('img')!.className).toContain('opacity-0');
  });

  it('hands over once the image has decoded', async () => {
    const { fixture } = await setup({ src: '/me.png', color: 'teal' });
    el(fixture).querySelector('img')!.dispatchEvent(new Event('load'));
    fixture.detectChanges();

    expect(shell(fixture).className).not.toContain('bg-teal-100');
    expect(el(fixture).querySelector('img')!.className).toContain('opacity-100');
    expect(fixture.componentInstance.fallbackVisible()).toBe(false);
  });

  it('does not announce the name twice while both layers are present', async () => {
    const { fixture } = await setup({ src: '/me.png' });
    // `.select-none` is the initials span itself. Matching on textContent
    // picks the outermost wrapper instead — every ancestor also reads "AL".
    const initials = el(fixture).querySelector('.select-none')!;
    // The `<img alt>` carries the name; the initials underneath are decoration
    // until the image gives up.
    expect(initials.getAttribute('aria-hidden')).toBe('true');
    expect(initials.getAttribute('role')).toBeNull();
  });

  it('names the initials once the image has failed for good', async () => {
    const { fixture } = await setup({ src: '/me.png' });
    el(fixture).querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    const initials = el(fixture).querySelector('.select-none')!;
    expect(initials.getAttribute('role')).toBe('img');
    expect(initials.getAttribute('aria-label')).toBe('Ada Lovelace');
  });

  it('shows the generic glyph under a slow image when there is no name', async () => {
    const { fixture } = await setup({ name: '', src: '/me.png' });
    // A nameless avatar with a slow photo showed an empty square, for the same
    // reason a named one showed a hole.
    expect(fixture.componentInstance.showIcon()).toBe(true);
    expect(el(fixture).querySelector('sv-icon')).not.toBeNull();
  });

  it('re-arms both flags on a new src', async () => {
    const { fixture } = await setup({ src: '/me.png' });
    el(fixture).querySelector('img')!.dispatchEvent(new Event('load'));
    fixture.detectChanges();
    expect(fixture.componentInstance.imgLoaded()).toBe(true);

    fixture.componentRef.setInput('src', '/me-2.png');
    fixture.detectChanges();
    expect(fixture.componentInstance.imgLoaded()).toBe(false);
    expect(fixture.componentInstance.imgError()).toBe(false);
  });
});

describe('SvAvatarComponent — status is announced once (showStatusText)', () => {
  it.each(['online', 'offline', 'away', 'busy'] as const)(
    '%s: hides the dot from assistive tech when the word is visible',
    async (status) => {
      const { fixture } = await setup({ status, showStatusText: true });
      const statusDot = el(fixture).querySelector('[data-sv-avatar-status]')!;
      expect(statusDot.getAttribute('aria-hidden')).toBe('true');
      expect(statusDot.hasAttribute('role')).toBe(false);
      expect(statusDot.hasAttribute('aria-label')).toBe(false);
      const word = fixture.componentInstance.statusText();
      // Exactly one accessible mention of the status: the visible word.
      const mentions = [...el(fixture).querySelectorAll('*')].filter(
        (n) => !n.closest('[aria-hidden="true"]') &&
          (n.getAttribute('aria-label')?.includes(word) ||
            [...n.childNodes].some((t) => t.nodeType === 3 && t.textContent?.trim() === word)),
      );
      expect(mentions).toHaveLength(1);
    },
  );

  it.each(['online', 'offline', 'away', 'busy'] as const)(
    '%s: keeps the labelled dot when no word is shown',
    async (status) => {
      const { fixture } = await setup({ status });
      const statusDot = el(fixture).querySelector('[data-sv-avatar-status]')!;
      expect(statusDot.getAttribute('role')).toBe('img');
      expect(statusDot.getAttribute('aria-label')).toMatch(/^Status: /);
      expect(statusDot.hasAttribute('aria-hidden')).toBe(false);
    },
  );
});
