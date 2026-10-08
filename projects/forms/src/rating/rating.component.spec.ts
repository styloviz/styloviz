import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvRatingComponent } from './rating.component';

/**
 * A star rating is three different widgets wearing one selector: an editable
 * slider, a read-only image, and a review summary. They have different roles
 * and different keyboard contracts, and the interesting behaviour — toggling
 * a rating off by re-picking it, half steps, clamping — is invisible in a
 * screenshot.
 */

async function setup(inputs: ComponentInput<SvRatingComponent> = {}) {
  TestBed.resetTestingModule();
  return render(SvRatingComponent, { inputs });
}

const slider = () => screen.getByRole('slider');
const stars = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLElement>('[role="slider"] > span')];

describe('SvRatingComponent', () => {
  // ── Roles: what it says it is ──────────────────────────────────────────────

  it('is a slider when it can be changed', async () => {
    await setup({ value: 3 });
    expect(slider().getAttribute('aria-valuenow')).toBe('3');
    expect(slider().getAttribute('aria-valuemax')).toBe('5');
    expect(slider().getAttribute('tabindex')).toBe('0');
  });

  it('is an image, not a slider, when read-only — nothing to operate', async () => {
    const { fixture } = await setup({ value: 4, readonly: true });
    expect(screen.queryByRole('slider')).toBeNull();
    const img = (fixture.nativeElement as HTMLElement).querySelector('[role="img"]');
    expect(img?.getAttribute('aria-label')).toBe('4 of 5 stars');
  });

  it('drops out of the tab order when disabled', async () => {
    const { fixture } = await setup({ value: 2, disabled: true });
    const widget = (fixture.nativeElement as HTMLElement).querySelector('[role="img"], [role="slider"]');
    expect(widget?.getAttribute('tabindex')).toBeNull();
    expect(widget?.getAttribute('aria-disabled')).toBe('true');
  });

  it('agrees the noun with the SCALE, not the score', async () => {
    // "1 of 5 star" is what you get from pluralising on the value, and it reads
    // as a bug to anyone listening to it.
    await setup({ value: 1 });
    expect(slider().getAttribute('aria-valuetext')).toBe('1 of 5 stars');

    await setup({ value: 3 });
    expect(slider().getAttribute('aria-valuetext')).toBe('3 of 5 stars');

    // A one-point scale is the only singular case.
    await setup({ value: 1, max: 1 });
    expect(slider().getAttribute('aria-valuetext')).toBe('1 of 1 star');
  });

  // ── Keyboard ───────────────────────────────────────────────────────────────

  it('steps with the arrows in both orientations', async () => {
    const { fixture } = await setup({ value: 2 });
    slider().focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(fixture.componentInstance.value()).toBe(3);
    await userEvent.keyboard('{ArrowUp}');
    expect(fixture.componentInstance.value()).toBe(4);
    await userEvent.keyboard('{ArrowLeft}{ArrowDown}');
    expect(fixture.componentInstance.value()).toBe(2);
  });

  it('clamps at both ends instead of wrapping', async () => {
    const { fixture } = await setup({ value: 5 });
    slider().focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(fixture.componentInstance.value()).toBe(5);

    await userEvent.keyboard('{Home}{ArrowLeft}');
    expect(fixture.componentInstance.value()).toBe(0);
  });

  it('Home and End jump to the ends', async () => {
    const { fixture } = await setup({ value: 2 });
    slider().focus();
    await userEvent.keyboard('{End}');
    expect(fixture.componentInstance.value()).toBe(5);
    await userEvent.keyboard('{Home}');
    expect(fixture.componentInstance.value()).toBe(0);
  });

  it('steps by a half when half ratings are allowed', async () => {
    const { fixture } = await setup({ value: 2, half: true });
    slider().focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(fixture.componentInstance.value()).toBe(2.5);
  });

  it('emits once per accepted change, and not at all for one that is clamped away', async () => {
    const seen: number[] = [];
    const { fixture } = await setup({ value: 5 });
    fixture.componentInstance.changed.subscribe((v) => seen.push(v));
    slider().focus();
    await userEvent.keyboard('{ArrowRight}'); // already at max
    expect(seen).toEqual([]);
    await userEvent.keyboard('{ArrowLeft}');
    expect(seen).toEqual([4]);
  });

  // One case per test, and the key goes to the widget rather than to whatever
  // happens to hold focus. Mounting twice in one test resets the TestBed, which
  // destroys the first ApplicationRef while its DOM is still listening — every
  // run then printed "NG0406: This instance of the ApplicationRef has already
  // been destroyed" from a test that passed. And a stray keystroke aimed at
  // <body> would have "passed" against a widget that never received it.
  for (const mode of ['readonly', 'disabled'] as const) {
    it(`ignores the keyboard when ${mode}`, async () => {
      const { fixture } = await setup({ value: 3, [mode]: true });
      const widget = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
        '[role="img"], [role="slider"]',
      );
      expect(widget, 'the widget should still render').toBeTruthy();

      widget!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      fixture.detectChanges();

      expect(fixture.componentInstance.value()).toBe(3);
    });
  }

  // ── Pointer ────────────────────────────────────────────────────────────────

  it('clicking a star sets that rating', async () => {
    const { fixture } = await setup({ value: 0 });
    await userEvent.click(stars(fixture.nativeElement)[2]);
    expect(fixture.componentInstance.value()).toBe(3);
  });

  it('clicking the CURRENT rating clears it — the only way back to unrated', async () => {
    const { fixture } = await setup({ value: 3 });
    await userEvent.click(stars(fixture.nativeElement)[2]);
    expect(fixture.componentInstance.value()).toBe(0);
  });

  it('does not respond to clicks when disabled', async () => {
    const { fixture } = await setup({ value: 2, disabled: true });
    const widget = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
      '[role="img"] > span',
    );
    await userEvent.click(widget[4]);
    expect(fixture.componentInstance.value()).toBe(2);
  });

  // ── Summary mode ───────────────────────────────────────────────────────────

  it('summarises a distribution as an average out of the total', async () => {
    const { fixture } = await setup({
      summary: true,
      distribution: [2, 3, 5, 40, 50], // 1★…5★
    });
    const img = (fixture.nativeElement as HTMLElement).querySelector('[role="img"]');
    // (2·1 + 3·2 + 5·3 + 40·4 + 50·5) / 100 = 4.33
    expect(img?.getAttribute('aria-label')).toContain('Average 4.3 of 5 stars');
    expect(img?.getAttribute('aria-label')).toContain('100 reviews');
  });

  it('survives a distribution of all zeroes rather than dividing by it', async () => {
    const { fixture } = await setup({ summary: true, distribution: [0, 0, 0, 0, 0] });
    const img = (fixture.nativeElement as HTMLElement).querySelector('[role="img"]');
    expect(img?.getAttribute('aria-label')).toContain('Average 0.0 of 5');
    expect(fixture.componentInstance.histogram().every((r) => r.pct === 0)).toBe(true);
  });

  it('is not operable in summary mode', async () => {
    await setup({ summary: true, distribution: [1, 1, 1, 1, 1] });
    expect(screen.queryByRole('slider')).toBeNull();
  });

  // ── The error slot ─────────────────────────────────────────────────────────

  it('renders a client-side message', async () => {
    await setup({ errorMessage: 'Pick a rating before submitting.' });
    expect(screen.getByRole('alert').textContent).toContain('Pick a rating before submitting.');
  });

  it('marks the widget invalid and points at the message', async () => {
    // Regression: the bindings that do this were once inserted into an HTML
    // comment, so the message rendered and nothing referenced it — the control
    // announced as valid while showing a rejection.
    await setup({ errorMessage: 'Pick a rating.' });
    expect(slider().getAttribute('aria-invalid')).toBe('true');

    const errorId = screen.getByRole('alert').getAttribute('id') ?? '';
    expect(errorId).not.toBe('');
    expect(slider().getAttribute('aria-describedby')).toBe(errorId);
  });

  it('leaves aria-invalid off when there is nothing wrong', async () => {
    await setup({ value: 3 });
    expect(slider().hasAttribute('aria-invalid')).toBe(false);
  });

  it('expires a server rejection once the rating changes', async () => {
    const { fixture } = await setup({ value: 1, serverError: 'Ratings below 2 need a comment.' });
    expect(screen.getByRole('alert').textContent).toContain('Ratings below 2 need a comment.');

    slider().focus();
    await userEvent.keyboard('{ArrowRight}');
    fixture.detectChanges();

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
