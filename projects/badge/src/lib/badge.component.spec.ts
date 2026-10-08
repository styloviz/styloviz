import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvBadgeComponent } from './badge.component';

describe('SvBadgeComponent', () => {
  it('renders its label text', async () => {
    await render(SvBadgeComponent, { inputs: { label: 'Active' } });
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('enters count mode and caps at maxCount', async () => {
    const { fixture } = await render(SvBadgeComponent, {
      inputs: { count: 120, maxCount: 99 },
    });
    expect(fixture.componentInstance.isCountMode()).toBe(true);
    expect(fixture.componentInstance.displayCount()).toBe('99+');
    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('exposes role="status" when live', async () => {
    await render(SvBadgeComponent, { inputs: { label: 'Syncing', live: true } });
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('exposes role="img" with an aria-label override', async () => {
    const { fixture } = await render(SvBadgeComponent, {
      inputs: { label: 'A', ariaLabel: 'Premium account' },
    });
    expect(fixture.componentInstance.hostRole()).toBe('img');
    expect(screen.getByRole('img', { name: 'Premium account' })).toBeTruthy();
  });

  it('renders a dismiss button and emits (dismissed) on click', async () => {
    const spy = vi.fn();
    const { fixture } = await render(SvBadgeComponent, {
      inputs: { label: 'Filter', dismissible: true },
    });
    fixture.componentInstance.dismissed.subscribe(spy);

    await userEvent.click(screen.getByRole('button', { name: 'Remove Filter' }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('hides the dismiss control in count mode', async () => {
    await render(SvBadgeComponent, {
      inputs: { count: 3, dismissible: true },
    });
    expect(screen.queryByRole('button')).toBeNull();
  });
});

/**
 * Motion nobody asked for, on the smallest possible surface.
 *
 * ★★ A PULSING DOT IS EXACTLY WHAT `prefers-reduced-motion` EXISTS FOR: small,
 *    peripheral and endless, which is the shape most likely to trigger a
 *    vestibular response. What it is NOT is optional information — the dot is
 *    the status indicator, so the animation stops and the dot stays.
 */
describe('SvBadgeComponent — the pulse under reduced motion', () => {
  async function mount(inputs: Record<string, unknown>) {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvBadgeComponent, { inputs });
    return fixture.nativeElement as HTMLElement;
  }

  it('stops the animation without removing the dot', async () => {
    const host = await mount({ label: 'Live', dot: true, pulseDot: true });
    const pulse = host.querySelector('.animate-ping');
    expect(pulse).not.toBeNull();
    expect(pulse!.className).toContain('motion-reduce:animate-none');
  });

  it('draws no pulse layer when the dot is not pulsing', async () => {
    const host = await mount({ label: 'Idle', dot: true, pulseDot: false });
    expect(host.querySelector('.animate-ping')).toBeNull();
  });

  it('keeps the dot itself whatever the motion preference', async () => {
    // ★ Removing it would delete information to fix a comfort problem.
    for (const pulseDot of [true, false]) {
      const host = await mount({ label: 'S', dot: true, pulseDot });
      expect(host.querySelector('span[aria-hidden="true"]')).not.toBeNull();
    }
  });
});

/**
 * Every tone × style combination renders a pair the contrast gate can score.
 *
 * ★ The classes live in a TypeScript `Record` map rather than in the template,
 *   and `check:contrast` scores them where they are DECLARED — verified
 *   empirically by planting a deliberately bad pair in this package and
 *   watching the gate name the file and the line. What is pinned here is that
 *   every combination is reachable and paints both a ground and an ink, which
 *   is what makes that coverage complete rather than accidental.
 */
describe('SvBadgeComponent — the full tone x style matrix', () => {
  const TONES = [
    'primary', 'secondary', 'success', 'warning', 'danger', 'info', 'neutral', 'brand',
  ] as const;
  const STYLES = ['filled', 'soft', 'outline'] as const;

  for (const variant of TONES) {
    for (const badgeStyle of STYLES) {
      it(`${variant} / ${badgeStyle} paints both a ground and an ink`, async () => {
        TestBed.resetTestingModule();
        const { fixture } = await render(SvBadgeComponent, {
          inputs: { variant, badgeStyle, label: 'Label' },
        });
        const cls = (fixture.nativeElement as HTMLElement).querySelector('span')!.className;
        // `outline` is transparent by design, so its ground is the ring.
        expect(/\b(bg-|ring-)/.test(cls)).toBe(true);
        expect(/\btext-/.test(cls)).toBe(true);
      });
    }
  }

  it('covers all 24 combinations', () => {
    expect(TONES.length * STYLES.length).toBe(24);
  });
});

describe('SvBadgeComponent — announceTone (X-11 non-colour)', () => {
  const variants = ['primary', 'secondary', 'success', 'warning', 'danger', 'info', 'neutral', 'brand'] as const;
  const expected: Record<(typeof variants)[number], string> = {
    primary: '', secondary: '', success: 'success', warning: 'warning',
    danger: 'error', info: 'information', neutral: '', brand: '',
  };

  it.each(variants)('%s: adds nothing by default', async (variant) => {
    const { fixture } = await render(SvBadgeComponent, { inputs: { label: 'Paid', variant } });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-sv-badge-tone]')).toBeNull();
  });

  it.each(variants)('%s: appends the tone word as sr-only text when on', async (variant) => {
    const { fixture } = await render(SvBadgeComponent, {
      inputs: { label: 'Paid', variant, announceTone: true },
    });
    const host = fixture.nativeElement as HTMLElement;
    const tone = host.querySelector('[data-sv-badge-tone]');
    if (expected[variant]) {
      expect(tone?.classList).toContain('sr-only');
      expect(tone?.textContent).toBe(`, ${expected[variant]}`);
    } else {
      expect(tone).toBeNull();
    }
  });

  it('works in count mode too', async () => {
    const { fixture } = await render(SvBadgeComponent, {
      inputs: { count: 3, variant: 'danger', announceTone: true },
    });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toMatch(/3\s*, error/);
  });

  it('appends the tone to an aria-label override instead of a hidden span', async () => {
    const { fixture } = await render(SvBadgeComponent, {
      inputs: { label: 'A', ariaLabel: 'Invoice overdue', variant: 'warning', announceTone: true },
    });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Invoice overdue, warning');
    expect(host.querySelector('[data-sv-badge-tone]')).toBeNull();
  });
});
