import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvToggleSwitchComponent } from './toggle-switch.component';

/**
 * The switch's behaviour is covered in `toggle-switch.component.spec.ts`. What
 * was not covered at all: the four size ramps, the label placements, the track
 * labels and thumb icons, and the validation-error wiring — the last of which is
 * `protected`, so it can only be read where a user reads it, off the rendered
 * `aria-describedby` / `aria-invalid`.
 */

async function setup(inputs: Partial<ComponentInput<SvToggleSwitchComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvToggleSwitchComponent, {
    inputs: inputs as ComponentInput<SvToggleSwitchComponent>,
  });
}

const host = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const group = (f: { nativeElement: unknown }) =>
  host(f).querySelector('[role="group"]') as HTMLElement;
const track = (f: { nativeElement: unknown }) =>
  host(f).querySelector('[role="switch"]') as HTMLElement;

const SIZES = ['xs', 'sm', 'md', 'lg'] as const;

describe('SvToggleSwitchComponent — size ramps', () => {
  it('gives every size its own track', async () => {
    const tracks = ['h-4 w-7', 'h-5 w-9', 'h-6 w-11', 'h-7 w-14'];
    for (const [i, size] of SIZES.entries()) {
      const { fixture } = await setup({ size });
      expect(fixture.componentInstance.trackClasses()).toContain(tracks[i]);
    }
  });

  it('gives every size its own thumb, and moves it further on a wider track', async () => {
    const off = ['translate-x-0.5', 'translate-x-0.5', 'translate-x-0.5', 'translate-x-1'];
    const on = ['translate-x-3.5', 'translate-x-4.5', 'translate-x-5.5', 'translate-x-7.5'];
    for (const [i, size] of SIZES.entries()) {
      const cold = await setup({ size, checked: false });
      expect(cold.fixture.componentInstance.thumbClasses()).toContain(off[i]);

      const hot = await setup({ size, checked: true });
      expect(hot.fixture.componentInstance.thumbClasses()).toContain(on[i]);
    }
  });

  it('gives every size its own thumb-icon box', async () => {
    const boxes = ['h-1.5 w-1.5', 'h-2.5 w-2.5', 'h-3 w-3', 'h-3.5 w-3.5'];
    for (const [i, size] of SIZES.entries()) {
      const { fixture } = await setup({ size });
      expect(fixture.componentInstance.thumbIconClass()).toBe(boxes[i]);
    }
  });

  it('gives every size its own track-label type size', async () => {
    const ramp = ['text-[7px]', 'text-[8px]', 'text-[9px]', 'text-[10px]'];
    for (const [i, size] of SIZES.entries()) {
      const { fixture } = await setup({ size });
      expect(fixture.componentInstance.trackLabelClass()).toBe(ramp[i]);
    }
  });

  it('gives every size its own main-label type size', async () => {
    const ramp = ['text-xs', 'text-sm', 'text-sm', 'text-base'];
    for (const [i, size] of SIZES.entries()) {
      const { fixture } = await setup({ size, label: 'L' });
      expect(fixture.componentInstance.labelClass().endsWith(ramp[i])).toBe(true);
    }
  });

  /** The description only steps up at `lg`; the other three share one size. */
  it('steps the description type up only at lg', async () => {
    const seen: string[] = [];
    for (const size of SIZES) {
      const { fixture } = await setup({ size, label: 'L', description: 'D' });
      seen.push(fixture.componentInstance.descClass().split(' ')[0]);
    }
    expect(seen).toEqual(['text-xs', 'text-xs', 'text-xs', 'text-sm']);
  });
});

describe('SvToggleSwitchComponent — track colour', () => {
  it('greys the track when off, whatever the variant', async () => {
    const { fixture } = await setup({ variant: 'danger', checked: false });
    const cls = fixture.componentInstance.trackClasses();
    expect(cls).toContain('bg-gray-200');
    expect(cls).not.toContain('bg-danger-600');
  });

  it('gives every variant its own on-colour', async () => {
    for (const [variant, cls] of [
      ['primary', 'bg-primary-600'],
      ['success', 'bg-accent-600'],
      ['warning', 'bg-warning-500'],
      ['danger', 'bg-danger-600'],
      ['neutral', 'bg-gray-700'],
    ] as const) {
      const { fixture } = await setup({ variant, checked: true });
      expect(fixture.componentInstance.trackClasses()).toContain(cls);
    }
  });
});

describe('SvToggleSwitchComponent — label placement', () => {
  it('stacks the label above the track for labelPosition="top"', async () => {
    const { fixture } = await setup({ label: 'Sync', labelPosition: 'top' });
    expect(group(fixture).className).toContain('flex-col');
    const label = host(fixture).querySelector('label') as HTMLElement;
    // A stacked label precedes the track in DOM order too.
    expect(label.compareDocumentPosition(track(fixture)) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it('puts the label before the track for labelPosition="left"', async () => {
    const { fixture } = await setup({ label: 'Sync', labelPosition: 'left' });
    expect(group(fixture).className).toContain('flex-row');
    const label = host(fixture).querySelector('label') as HTMLElement;
    expect(label.compareDocumentPosition(track(fixture)) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it('puts the label after the track for the default "right"', async () => {
    const { fixture } = await setup({ label: 'Sync' });
    const label = host(fixture).querySelector('label') as HTMLElement;
    expect(label.compareDocumentPosition(track(fixture)) & Node.DOCUMENT_POSITION_PRECEDING)
      .toBeTruthy();
  });

  /**
   * `hidden` renders no visible label at all, so the accessible name has to come
   * off the control itself — and the group carries it too, since the group has
   * nothing else to name it.
   */
  it('renders no visible label for "hidden" but still names the control', async () => {
    const { fixture } = await setup({ label: 'Sync', labelPosition: 'hidden' });
    expect(host(fixture).querySelector('label')).toBeNull();
    expect(fixture.componentInstance.hasVisibleLabel()).toBe(false);
    expect(track(fixture).getAttribute('aria-label')).toBe('Sync');
    expect(track(fixture).getAttribute('aria-labelledby')).toBeNull();
    expect(group(fixture).getAttribute('aria-label')).toBe('Sync');
  });

  it('points the control at the visible label rather than repeating it', async () => {
    const { fixture } = await setup({ label: 'Sync' });
    expect(fixture.componentInstance.hasVisibleLabel()).toBe(true);
    expect(track(fixture).getAttribute('aria-label')).toBeNull();
    const id = track(fixture).getAttribute('aria-labelledby');
    expect(host(fixture).querySelector(`#${id}`)?.textContent?.trim()).toBe('Sync');
  });

  it('falls back to "Toggle" with no label and no aria-label', async () => {
    const { fixture } = await setup({});
    expect(fixture.componentInstance.resolvedAriaLabel()).toBe('Toggle');
    expect(track(fixture).getAttribute('aria-label')).toBe('Toggle');
  });

  it('lets ariaLabel outrank the visible label as the accessible name', async () => {
    const { fixture } = await setup({ label: 'Sync', ariaLabel: 'Sync with server' });
    expect(fixture.componentInstance.resolvedAriaLabel()).toBe('Sync with server');
  });

  it('renders the description and wires aria-describedby to it', async () => {
    const { fixture } = await setup({ label: 'Sync', description: 'Every 5 minutes' });
    const id = track(fixture).getAttribute('aria-describedby');
    expect(id).not.toBeNull();
    expect(host(fixture).querySelector(`#${id}`)?.textContent?.trim()).toBe('Every 5 minutes');
  });

  it('drops aria-describedby entirely when there is nothing to describe', async () => {
    const { fixture } = await setup({ label: 'Sync' });
    expect(track(fixture).getAttribute('aria-describedby')).toBeNull();
  });

  it('uses an explicit inputId when given, and a unique one otherwise', async () => {
    const explicit = await setup({ label: 'Sync', inputId: 'my-toggle' });
    expect(track(explicit.fixture).getAttribute('id')).toBe('my-toggle');

    // Both instances must share an application: ids are per application (svUniqueId).
    const a = await setup({ label: 'A' });
    const b = TestBed.createComponent(SvToggleSwitchComponent);
    b.componentRef.setInput('label', 'B');
    b.detectChanges();
    expect(a.fixture.componentInstance.resolvedId())
      .not.toBe(b.componentInstance.resolvedId());
  });
});

describe('SvToggleSwitchComponent — track labels and thumb icons', () => {
  it('shows the ON label only when on, and the OFF label only when off', async () => {
    const on = await setup({ onLabel: 'ON', offLabel: 'OFF', checked: true });
    expect(on.fixture.componentInstance.showOnLabel()).toBe(true);
    expect(on.fixture.componentInstance.showOffLabel()).toBe(false);
    expect(track(on.fixture).textContent).toContain('ON');
    expect(track(on.fixture).textContent).not.toContain('OFF');

    const off = await setup({ onLabel: 'ON', offLabel: 'OFF', checked: false });
    expect(off.fixture.componentInstance.showOnLabel()).toBe(false);
    expect(off.fixture.componentInstance.showOffLabel()).toBe(true);
    expect(track(off.fixture).textContent).toContain('OFF');
  });

  it('shows neither track label when neither is configured', async () => {
    const { fixture } = await setup({ checked: true });
    expect(fixture.componentInstance.showOnLabel()).toBe(false);
    expect(fixture.componentInstance.showOffLabel()).toBe(false);
    expect(track(fixture).textContent?.trim()).toBe('');
  });

  /**
   * `onIcon`/`offIcon` were `onIconPath`/`offIconPath` — raw `<path d="…">`
   * strings — so this used to read the `d` attribute straight back. `[name]`
   * is not reflected to the DOM, so the check is now "the two states draw
   * DIFFERENT shapes", which is the claim the `d` comparison stood in for.
   */
  const thumbGlyph = (f: { nativeElement: unknown }) => {
    const svg = track(f).querySelector('sv-icon svg');
    if (!svg) return '';
    return [...svg.querySelectorAll('path, circle, line, polyline, polygon, rect')]
      .map((n) => `${n.tagName},${n.getAttribute('d') ?? ''},${n.getAttribute('x1') ?? ''}`)
      .join('|');
  };

  it('shows the state icon matching the current state', async () => {
    const on = await setup({ onIcon: 'check', offIcon: 'close', checked: true });
    expect(on.fixture.componentInstance.hasThumbIcon()).toBe(true);
    expect(on.fixture.componentInstance.currentThumbIcon()).toBe('check');
    // Assert something WAS drawn before comparing shapes — two blanks are equal.
    expect(thumbGlyph(on.fixture)).not.toBe('');

    const off = await setup({ onIcon: 'check', offIcon: 'close', checked: false });
    expect(off.fixture.componentInstance.currentThumbIcon()).toBe('close');
    expect(thumbGlyph(off.fixture)).not.toBe('');
    expect(thumbGlyph(off.fixture)).not.toBe(thumbGlyph(on.fixture));
  });

  /** Only one half of the icon pair configured means the other state is plain. */
  it('renders no icon for the state whose name is missing', async () => {
    const { fixture } = await setup({ onIcon: 'check', checked: false });
    expect(fixture.componentInstance.hasThumbIcon()).toBe(false);
    expect(track(fixture).querySelector('sv-icon')).toBeNull();
  });

  /** The spinner replaces the icon — they must never draw on top of each other. */
  it('replaces the thumb icon with the spinner while loading', async () => {
    const { fixture } = await setup({ onIcon: 'check', checked: true, loading: true });
    expect(track(fixture).querySelector('sv-spinner-arc')).not.toBeNull();
    expect(track(fixture).querySelector('sv-icon')).toBeNull();
    expect(track(fixture).getAttribute('aria-busy')).toBe('true');
  });
});

describe('SvToggleSwitchComponent — blocked states', () => {
  it('refuses to toggle while loading, and says so', async () => {
    const spy = vi.fn();
    const { fixture } = await setup({ label: 'Sync', loading: true });
    fixture.componentInstance.toggled.subscribe(spy);

    track(fixture).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.checked()).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    expect(group(fixture).className).toContain('cursor-not-allowed');
  });

  /**
   * `setDisabledState` is how a reactive form disables the control. It is a
   * different path from the `[disabled]` input and has to block interaction too.
   */
  it('refuses to toggle when the form disabled it, not just the input', async () => {
    const spy = vi.fn();
    const { fixture } = await setup({ label: 'Sync' });
    fixture.componentInstance.toggled.subscribe(spy);

    fixture.componentInstance.setDisabledState(true);
    fixture.detectChanges();

    expect(fixture.componentInstance.resolvedDisabled()).toBe(true);
    expect(track(fixture).getAttribute('tabindex')).toBe('-1');
    fixture.componentInstance.toggle();
    expect(spy).not.toHaveBeenCalled();

    fixture.componentInstance.setDisabledState(false);
    fixture.componentInstance.toggle();
    expect(spy).toHaveBeenCalledWith(true);
  });

  it('ignores keys that are neither Space nor Enter', async () => {
    const spy = vi.fn();
    const { fixture } = await setup({ label: 'Sync' });
    fixture.componentInstance.toggled.subscribe(spy);

    const event = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    fixture.componentInstance.onKeydown(event);

    expect(spy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('is cursor-pointer when it can actually be used', async () => {
    const { fixture } = await setup({ label: 'Sync' });
    expect(group(fixture).className).toContain('cursor-pointer');
  });

  it('merges customClass onto the group', async () => {
    const { fixture } = await setup({ label: 'Sync', customClass: 'mt-4' });
    expect(group(fixture).className).toContain('mt-4');
  });

  it('marks itself required when asked', async () => {
    const { fixture } = await setup({ label: 'Sync', required: true });
    expect(track(fixture).getAttribute('aria-required')).toBe('true');
  });
});

describe('SvToggleSwitchComponent — CVA callbacks', () => {
  it('reports every change to the form, and marks itself touched', async () => {
    const changes: boolean[] = [];
    const touched = vi.fn();
    const { fixture } = await setup({ label: 'Sync' });
    fixture.componentInstance.registerOnChange((v: boolean) => changes.push(v));
    fixture.componentInstance.registerOnTouched(touched);

    fixture.componentInstance.toggle();
    fixture.componentInstance.toggle();

    expect(changes).toEqual([true, false]);
    expect(touched).toHaveBeenCalledTimes(2);
  });

  it('coerces a non-boolean writeValue rather than storing it', async () => {
    const { fixture } = await setup({ label: 'Sync' });
    (fixture.componentInstance as unknown as { writeValue(v: unknown): void })
      .writeValue(null);
    expect(fixture.componentInstance.checked()).toBe(false);
  });

  it('does not report a writeValue back to the form as a user change', async () => {
    const changes: boolean[] = [];
    const { fixture } = await setup({ label: 'Sync' });
    fixture.componentInstance.registerOnChange((v: boolean) => changes.push(v));

    fixture.componentInstance.writeValue(true);

    expect(fixture.componentInstance.checked()).toBe(true);
    expect(changes).toEqual([]);
  });
});

describe('SvToggleSwitchComponent — validation error', () => {
  it('shows a client-side error and points aria-describedby at it', async () => {
    const { fixture } = await setup({ label: 'Terms', errorMessage: 'You must accept' });
    expect(track(fixture).getAttribute('aria-invalid')).toBe('true');

    const ids = (track(fixture).getAttribute('aria-describedby') ?? '').split(' ');
    const errorEl = ids
      .map((id) => host(fixture).querySelector(`#${id}`))
      .find((n) => n?.textContent?.includes('You must accept'));
    expect(errorEl).toBeTruthy();
  });

  /**
   * Both can be present at once, and `aria-describedby` takes a list — writing
   * one over the other is how a rejection ends up announced nowhere.
   */
  it('describes the control by the description AND the error together', async () => {
    const { fixture } = await setup({
      label: 'Terms',
      description: 'Required to continue',
      errorMessage: 'You must accept',
    });
    const ids = (track(fixture).getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids).toHaveLength(2);
    const text = ids.map((id) => host(fixture).querySelector(`#${id}`)?.textContent ?? '').join(' ');
    expect(text).toContain('Required to continue');
    expect(text).toContain('You must accept');
  });

  it('is not invalid when there is no error', async () => {
    const { fixture } = await setup({ label: 'Terms' });
    expect(track(fixture).getAttribute('aria-invalid')).toBeNull();
  });

  /** A server rejection outranks the client message while it still applies. */
  it('lets a server error outrank the client message', async () => {
    const { fixture } = await setup({
      label: 'Terms',
      errorMessage: 'client says no',
      serverError: 'server says no',
    });
    expect(host(fixture).textContent).toContain('server says no');
    expect(host(fixture).textContent).not.toContain('client says no');
  });

  /** …and expires the moment the value it described changes. */
  it('drops the server error once the value changes', async () => {
    const { fixture } = await setup({ label: 'Terms', serverError: 'server says no' });
    expect(host(fixture).textContent).toContain('server says no');

    fixture.componentInstance.toggle();
    fixture.detectChanges();

    expect(host(fixture).textContent).not.toContain('server says no');
    expect(track(fixture).getAttribute('aria-invalid')).toBeNull();
  });
});

// ─── Icons come from the library ──────────────────────────────────────────────

/**
 * The thumb glyph was an inline `<svg>` bound to `onIconPath`/`offIconPath`.
 *
 * ★ `check:ui`'s `inline-svg-glyph` rule could not see it: its only size lived
 * in `[ngClass]="[thumbIconClass(), …]"`, and both halves of the rule's "is it
 * sized like an icon" test read literal classes off the open tag. Eight glyphs
 * kit-wide were hiding behind a bound class, this one among them, while the
 * ledger said the sweep was finished. The rule now treats a bound class as
 * "size unknown, therefore a candidate" — but a per-package DOM assertion does
 * not share the detector's blind spots at all, which is why this exists too.
 *
 * `sv-spinner-arc` is a GRAPHIC, not a glyph, and is allowed to draw its own.
 */
describe('SvToggleSwitchComponent — icons come from the library', () => {
  const byHand = (f: { nativeElement: unknown }) =>
    [...host(f).querySelectorAll('svg')].filter(
      (n) => !n.closest('sv-icon') && !n.closest('sv-spinner-arc'),
    );

  it.each([
    ['on', { onIcon: 'check', offIcon: 'close', checked: true }],
    ['off', { onIcon: 'check', offIcon: 'close', checked: false }],
    ['on only, showing', { onIcon: 'check', checked: true }],
    ['loading over an icon', { onIcon: 'check', checked: true, loading: true }],
    ['with a validation error', { onIcon: 'check', label: 'Terms', errorMessage: 'Required' }],
  ] as const)('draws no glyph by hand — %s', async (_label, inputs) => {
    const { fixture } = await setup(inputs as Partial<ComponentInput<SvToggleSwitchComponent>>);
    // Something must be on screen first: a branch that renders nothing would
    // satisfy "no hand-drawn glyphs" without proving anything at all.
    expect(host(fixture).querySelectorAll('svg').length).toBeGreaterThan(0);
    expect(byHand(fixture)).toEqual([]);
  });
});
