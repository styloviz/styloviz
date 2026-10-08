import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvLikeComponent } from './like.component';

/**
 * Paths the component's own spec does not reach — each one a state a user can
 * produce: a disabled control pressed anyway, a keyboard shortcut used before
 * the panel is open, a section that starts collapsed.
 */

// ── sv-like ──────────────────────────────────────────────────────────────────

describe('SvLikeComponent — disabled', () => {
  async function setup(inputs: ComponentInput<SvLikeComponent> = {}) {
    TestBed.resetTestingModule();
    return render(SvLikeComponent, { inputs });
  }

  it('does not toggle, burst or emit when disabled', async () => {
    const { fixture } = await setup({ liked: false, disabled: true });
    const seen: boolean[] = [];
    fixture.componentInstance.likeChange.subscribe((e) => seen.push(e.liked));

    fixture.componentInstance.toggle();
    fixture.detectChanges();

    expect(fixture.componentInstance.liked()).toBe(false);
    expect(fixture.componentInstance.isBursting()).toBe(false);
    expect(seen).toEqual([]);
  });

  it('toggles and emits when it is not disabled', async () => {
    const { fixture } = await setup({ liked: false });
    const seen: boolean[] = [];
    fixture.componentInstance.likeChange.subscribe((e) => seen.push(e.liked));
    fixture.componentInstance.toggle();
    expect(fixture.componentInstance.liked()).toBe(true);
    expect(seen).toEqual([true]);
  });
});
