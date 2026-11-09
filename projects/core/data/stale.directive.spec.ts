import { Component, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { SvStaleDirective } from './stale.directive';

@Component({
  selector: 'sv-stale-host',
  imports: [SvStaleDirective],
  template: `<ul role="listbox" class="py-1" [svStale]="stale()"><li>Ada</li></ul>`,
})
class HostComponent {
  // A signal, not a field: flipping a plain field between two `detectChanges()`
  // calls trips dev-mode's check-no-changes pass, which is a property of the
  // test host and not of the directive.
  readonly stale = signal(false);
}

const list = (): HTMLElement => screen.getByRole('listbox');

describe('SvStaleDirective', () => {
  it('says nothing at all when the content is current', async () => {
    await render(HostComponent);

    expect(list().getAttribute('aria-busy')).toBeNull();
    expect(list().getAttribute('data-sv-state')).toBeNull();
    expect(list().classList.contains('opacity-60')).toBe(false);
  });

  it('announces the region as busy and marks it dim when stale', async () => {
    const { fixture } = await render(HostComponent);
    fixture.componentInstance.stale.set(true);
    fixture.detectChanges();

    expect(list().getAttribute('aria-busy')).toBe('true');
    expect(list().getAttribute('data-sv-state')).toBe('stale');
    expect(list().classList.contains('opacity-60')).toBe(true);
  });

  /**
   * The results have to stay reachable. A dimmed list the user cannot click is
   * strictly worse than a blanked one, because it looks available.
   */
  it('leaves the content interactive', async () => {
    const { fixture } = await render(HostComponent);
    fixture.componentInstance.stale.set(true);
    fixture.detectChanges();

    expect(list().classList.contains('pointer-events-none')).toBe(false);
    expect(list().getAttribute('inert')).toBeNull();
    expect(list().getAttribute('aria-disabled')).toBeNull();
  });

  it('keeps the classes the host element already had', async () => {
    const { fixture } = await render(HostComponent);
    fixture.componentInstance.stale.set(true);
    fixture.detectChanges();

    expect(list().classList.contains('py-1')).toBe(true);
  });

  it('clears every trace when the newer answer lands', async () => {
    const { fixture } = await render(HostComponent);
    fixture.componentInstance.stale.set(true);
    fixture.detectChanges();
    fixture.componentInstance.stale.set(false);
    fixture.detectChanges();

    expect(list().getAttribute('aria-busy')).toBeNull();
    expect(list().getAttribute('data-sv-state')).toBeNull();
    expect(list().classList.contains('opacity-60')).toBe(false);
  });
});
