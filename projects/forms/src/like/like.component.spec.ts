import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvLikeComponent, type LikeToggleEvent } from './like.component';

/**
 * A like button is an optimistic toggle over a count the host owns, so the
 * interesting part is what it shows between the click and the server agreeing:
 * the count has to move immediately, come back if the write is rejected, and
 * yield to the host's number once it arrives. Its accessible name carries the
 * state too, which is the half a screenshot cannot check.
 */

async function setup(inputs: ComponentInput<SvLikeComponent> = {}) {
  TestBed.resetTestingModule();
  return render(SvLikeComponent, { inputs });
}

const btn = () => screen.getByRole('button');

/** Collect toggle events so a test can act on the handle the host would get. */
function watch(c: SvLikeComponent): LikeToggleEvent[] {
  const seen: LikeToggleEvent[] = [];
  c.likeChange.subscribe((e) => seen.push(e));
  return seen;
}

describe('SvLikeComponent', () => {
  it('reflects the host state without touching the count', async () => {
    const { fixture } = await setup({ count: 12, liked: true });
    expect(fixture.componentInstance.count()).toBe(12);
    expect(btn().getAttribute('aria-pressed')).toBe('true');
  });

  it('moves the count immediately on click, before anyone confirms', async () => {
    const { fixture } = await setup({ count: 12, liked: false });
    await userEvent.click(btn());
    expect(fixture.componentInstance.count()).toBe(13);
    expect(btn().getAttribute('aria-pressed')).toBe('true');
  });

  it('takes the count back down when un-liking', async () => {
    const { fixture } = await setup({ count: 12, liked: true });
    await userEvent.click(btn());
    expect(fixture.componentInstance.count()).toBe(11);
    expect(btn().getAttribute('aria-pressed')).toBe('false');
  });

  it('never shows a negative count, however the host seeded it', async () => {
    // `liked: true` with `count: 0` is a legitimate seed — the host knows the
    // viewer reacted and has not loaded totals yet.
    const { fixture } = await setup({ count: 0, liked: true });
    await userEvent.click(btn());
    expect(fixture.componentInstance.count()).toBe(0);
  });

  it('lets the host number win once it lands', async () => {
    // The optimistic +1 is a guess. The server's total is the truth, and it can
    // differ by more than one because other people are reacting too.
    const { fixture } = await setup({ count: 12, liked: false });
    await userEvent.click(btn());
    expect(fixture.componentInstance.count()).toBe(13);

    fixture.componentRef.setInput('count', 20);
    fixture.detectChanges();

    expect(fixture.componentInstance.count()).toBe(20);
  });

  // ── Rolling back a rejected write ──────────────────────────────────────────

  it('hands the host a way back with the event that caused the write', async () => {
    // The undo used to be a public `rollback()` method, reachable only through a
    // ViewChild. The host that needs it is the one handling the event, so the
    // handle travels in the payload.
    const { fixture } = await setup({ count: 12, liked: false });
    const seen = watch(fixture.componentInstance);

    await userEvent.click(btn());
    expect(fixture.componentInstance.count()).toBe(13);

    seen[0]!.rollback();
    fixture.detectChanges();

    expect(fixture.componentInstance.count()).toBe(12);
    expect(fixture.componentInstance.liked()).toBe(false);
    expect(btn().getAttribute('aria-pressed')).toBe('false');
  });

  it('rolls the icon and the count back together', async () => {
    // Undoing one and not the other leaves a filled heart over a count that
    // does not include it, which is worse than not undoing at all.
    const { fixture } = await setup({ count: 4, liked: true });
    const seen = watch(fixture.componentInstance);

    await userEvent.click(btn()); // un-like → 3
    seen[0]!.rollback();
    fixture.detectChanges();

    expect(fixture.componentInstance.liked()).toBe(true);
    expect(fixture.componentInstance.count()).toBe(4);
  });

  it('refuses a stale rollback and says which input prevents it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { fixture } = await setup({ count: 12, liked: false });
    const seen = watch(fixture.componentInstance);

    await userEvent.click(btn()); // liked, 13
    await userEvent.click(btn()); // un-liked, 12

    seen[0]!.rollback(); // holds the pre-first-click state
    fixture.detectChanges();

    // Applying it would have set liked=false/12 — which happens to be where we
    // are, so assert on the warning, and on the newest handle still working.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[pending]'));
    seen[1]!.rollback();
    fixture.detectChanges();
    expect(fixture.componentInstance.liked()).toBe(true);
    expect(fixture.componentInstance.count()).toBe(13);
    warn.mockRestore();
  });

  it('reports each toggle once, with the state and the count it produced', async () => {
    const { fixture } = await setup({ count: 0, liked: false });
    const seen = watch(fixture.componentInstance);

    await userEvent.click(btn());
    await userEvent.click(btn());

    expect(seen.map((e) => [e.liked, e.count])).toEqual([
      [true, 1],
      [false, 0],
    ]);
  });

  it('gives every toggle its own idempotency key', async () => {
    // The key is what stops a retried request counting twice. Two toggles that
    // shared one would be indistinguishable from a retry of the first.
    const { fixture } = await setup({ count: 0, liked: false });
    const seen = watch(fixture.componentInstance);

    await userEvent.click(btn());
    await userEvent.click(btn());

    expect(seen[0]!.requestKey).toBeTruthy();
    expect(seen[1]!.requestKey).not.toBe(seen[0]!.requestKey);
  });

  it('does nothing when disabled', async () => {
    const { fixture } = await setup({ count: 5, liked: false, disabled: true });
    const seen = watch(fixture.componentInstance);

    await userEvent.click(btn());
    expect(fixture.componentInstance.count()).toBe(5);
    expect(seen).toEqual([]);
    expect(btn().getAttribute('aria-disabled')).toBe('true');
  });

  // ── In flight ──────────────────────────────────────────────────────────────

  it('does not toggle again while the write is in flight', async () => {
    // A double-tap otherwise sends like and un-like to a server free to apply
    // them in either order, and leaves two live rollback handles.
    const { fixture } = await setup({ count: 5, liked: false, pending: true });
    const seen = watch(fixture.componentInstance);

    await userEvent.click(btn());

    expect(seen).toEqual([]);
    expect(fixture.componentInstance.count()).toBe(5);
    expect(btn().getAttribute('aria-busy')).toBe('true');
  });

  // ── A failed write ─────────────────────────────────────────────────────────

  it('names the failure so it is not carried by the ring alone', async () => {
    const { fixture } = await setup({ count: 5, liked: false, error: 'Network unreachable' });
    expect(fixture.componentInstance.ariaLabel()).toBe('Like, 5, not saved');
    expect(btn().className).toContain('ring-danger-500');
  });

  it('shows the failure as visible text and ties it to the button', async () => {
    // DD-22-I1/M1: the message used to live only in the accessible name, so a
    // sighted reader saw a red ring and no reason.
    const { fixture } = await setup({ count: 5, liked: false, error: 'Network unreachable' });
    const host = fixture.nativeElement as HTMLElement;
    const text = host.querySelector<HTMLElement>('[data-sv-like-error]');
    expect(text?.textContent?.trim()).toBe('Not saved: Network unreachable');
    expect(btn().getAttribute('aria-describedby')).toBe(text?.id);
    expect(text?.closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('describes nothing and renders no failure text when there is none', async () => {
    const { fixture } = await setup({ count: 5, liked: false });
    expect(btn().hasAttribute('aria-describedby')).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-sv-like-error]')).toBeNull();
  });

  it('normalises an SvDataError into the visible text', async () => {
    const { fixture } = await setup({
      count: 5, liked: true, error: { message: 'Offline', retryable: true },
    } as ComponentInput<SvLikeComponent>);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-sv-like-error]')?.textContent)
      .toContain('Offline');
  });

  it('says nothing about failure when there is none', async () => {
    const { fixture } = await setup({ count: 5, liked: false });
    expect(fixture.componentInstance.ariaLabel()).toBe('Like, 5');
    expect(btn().className).not.toContain('ring-danger-500');
  });

  // ── A signed-out viewer ────────────────────────────────────────────────────

  it('asks the host to sign the viewer in instead of faking a reaction', async () => {
    // The old behaviour toggled, looked saved, and reported a write that could
    // not possibly succeed.
    const { fixture } = await setup({ count: 5, liked: false, signedIn: false });
    const seen = watch(fixture.componentInstance);
    let asked = 0;
    fixture.componentInstance.authRequired.subscribe(() => asked++);

    await userEvent.click(btn());

    expect(asked).toBe(1);
    expect(seen).toEqual([]);
    expect(fixture.componentInstance.count()).toBe(5);
    expect(fixture.componentInstance.liked()).toBe(false);
  });

  it('reacts normally when the viewer is signed in', async () => {
    const { fixture } = await setup({ count: 5, liked: false });
    let asked = 0;
    fixture.componentInstance.authRequired.subscribe(() => asked++);

    await userEvent.click(btn());

    expect(asked).toBe(0);
    expect(fixture.componentInstance.count()).toBe(6);
  });

  // ── The accessible name ────────────────────────────────────────────────────

  it('names the ACTION, and leaves the state to aria-pressed', async () => {
    // A label that flips to "Unlike" while `aria-pressed` also flips says the
    // opposite thing twice — screen readers announce "Unlike, pressed".
    const { fixture } = await setup({ count: 3, liked: true, showCount: true });
    expect(fixture.componentInstance.ariaLabel()).toBe('Like, 3');
    expect(btn().getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps the count in the name current as it changes', async () => {
    const { fixture } = await setup({ count: 3, liked: false, showCount: true });
    await userEvent.click(btn());
    expect(fixture.componentInstance.ariaLabel()).toBe('Like, 4');
  });

  it('drops the count from the name when it is not shown', async () => {
    const { fixture } = await setup({ count: 3, liked: false, showCount: false });
    expect(fixture.componentInstance.ariaLabel()).toBe('Like');
  });

  it('uses the verb that matches the variant', async () => {
    for (const [variant, verb] of [
      ['heart', 'Like'],
      ['thumbs-up', 'Like'],
      ['star', 'Star'],
      ['clap', 'Applaud'],
    ] as const) {
      const { fixture } = await setup({ variant, showCount: false });
      expect(fixture.componentInstance.ariaLabel()).toBe(verb);
    }
  });

  // ── The reaction hue ───────────────────────────────────────────────────────

  it('reacts in the hue each variant is conventionally drawn in', async () => {
    // One shared rose made a STARRED item render a red star, which reads as a
    // warning rather than a favourite. Asserted per variant because the natural
    // way to regress this is a sweep collapsing four arms back into one.
    for (const [variant, hue] of [
      ['heart', 'rose'],
      ['thumbs-up', 'sky'],
      ['star', 'amber'],
      ['clap', 'violet'],
    ] as const) {
      await setup({ variant, liked: true });
      expect(btn().className).toContain(`text-${hue}-700`);
      expect(btn().className).toContain(`bg-${hue}-50`);
    }
  });

  it('paints the resting state from the neutral token, whatever the variant', async () => {
    // Only the reaction hue opts out of the theme; the chrome must still follow
    // a buyer's `gray`.
    const { fixture } = await setup({ variant: 'star', liked: false });
    expect(fixture.componentInstance.liked()).toBe(false);
    expect(btn().className).toContain('text-gray-500');
    expect(btn().className).not.toContain('amber');
  });

  // ── Reduced motion ─────────────────────────────────────────────────────────

  it('paints a visible burst when motion is allowed', async () => {
    // DD-22-I3: the particles also carried `opacity-0`, and ping's keyframes
    // only define the END state, so the burst animated 0 → 0 and never showed.
    const { fixture } = await setup({ count: 0, liked: false });
    await userEvent.click(btn());
    fixture.detectChanges();

    const burst = (fixture.nativeElement as HTMLElement).querySelector('[data-sv-like-burst]');
    expect(burst?.className).toContain('motion-reduce:hidden');
    const particles = burst!.querySelectorAll('span');
    expect(particles.length).toBe(4);
    for (const p of particles) {
      expect(p.classList.contains('motion-safe:animate-ping')).toBe(true);
      expect(p.classList.contains('animate-ping')).toBe(false);
      expect(p.classList.contains('opacity-0')).toBe(false);
      // Ping's `transform: scale()` would replace a translate, so centring uses calc().
      expect(p.getAttribute('style') ?? '').not.toContain('translate');
    }
  });

  it('renders no burst at all under prefers-reduced-motion', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    try {
      const { fixture } = await setup({ count: 0, liked: false });
      await userEvent.click(btn());
      fixture.detectChanges();
      expect(fixture.componentInstance.liked()).toBe(true);
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-sv-like-burst]')).toBeNull();
    } finally {
      window.matchMedia = original;
    }
  });
});
