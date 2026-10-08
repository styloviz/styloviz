import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvLikeComponent } from './like.component';

/**
 * The burst's end timer is owned (1.0 release audit, M8): a second like
 * restarts it rather than being cut short by the first one's timer, and
 * destroying the component clears it.
 */
describe('SvLikeComponent — burst timer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function setup() {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvLikeComponent, { inputs: { liked: false, signedIn: true } });
    return fixture;
  }

  it('a quick unlike → like keeps the second burst for its full length', async () => {
    const fixture = await setup();
    const like = fixture.componentInstance;
    like.toggle();
    vi.advanceTimersByTime(400);
    like.toggle();
    like.toggle();
    expect(like.isBursting()).toBe(true);
    vi.advanceTimersByTime(300); // the FIRST timer would have fired here
    expect(like.isBursting()).toBe(true);
    vi.advanceTimersByTime(300);
    expect(like.isBursting()).toBe(false);
  });

  it('leaves no timer behind after destroy', async () => {
    const fixture = await setup();
    const like = fixture.componentInstance;
    like.toggle();
    expect(like.isBursting()).toBe(true);
    fixture.destroy();
    // The end timer was cleared, so nothing writes to the destroyed component.
    vi.advanceTimersByTime(1_000);
    expect(like.isBursting()).toBe(true);
  });
});
