import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvSkeletonLoaderComponent } from './skeleton-loader.component';

/**
 * FL-J3-OF-06 · OF-17-I8 / OF-17-M4 — `showAfterMs` / `minVisibleMs` on the
 * skeleton. Defaults keep today's behaviour.
 */
@Component({
  standalone: true,
  imports: [SvSkeletonLoaderComponent],
  template: `<sv-skeleton-loader preset="text-block" [active]="loading()" [showAfterMs]="200" [minVisibleMs]="400"
                                 (visibleChange)="changes.push($event)" />`,
})
class Host {
  readonly loading = signal(true);
  readonly changes: boolean[] = [];
}

async function setup() {
  TestBed.resetTestingModule();
  const { fixture } = await render(Host);
  const bones = () => (fixture.nativeElement as HTMLElement).querySelector('sv-skeleton-loader > div');
  const tick = (ms: number) => { vi.advanceTimersByTime(ms); fixture.detectChanges(); };
  return { fixture, host: fixture.componentInstance, bones, tick };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('SvSkeletonLoaderComponent — delayed show / minimum duration (FL-J3-OF-06)', () => {
  it('renders at once with the defaults', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvSkeletonLoaderComponent);
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="status"]')).not.toBeNull();
  });

  it('★ never flashes bones for a fast response', async () => {
    const { bones, tick, host, fixture } = await setup();
    tick(100);
    expect(bones()).toBeNull();
    host.loading.set(false);
    fixture.detectChanges();
    tick(1000);
    expect(bones()).toBeNull();
    expect(host.changes).toEqual([]);
  });

  it('★ once shown, holds for the minimum instead of flickering', async () => {
    const { bones, tick, host, fixture } = await setup();
    tick(200);
    expect(bones()).not.toBeNull();
    host.loading.set(false);
    fixture.detectChanges();
    tick(399);
    expect(bones()).not.toBeNull();
    tick(1);
    expect(bones()).toBeNull();
    expect(host.changes).toEqual([true, false]);
  });
});
