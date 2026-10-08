import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvTerminalComponent } from './terminal.component';

/**
 * ★★ 1.0 audit H2 — the typed intro schedules one timer per character. On the
 *    server it is printed whole, so the render does not wait it out and the
 *    HTML sent is the finished text. A destroyed terminal also stops typing.
 */
const LINES = [
  { kind: 'command' as const, text: 'whoami' },
  { kind: 'stdout' as const, text: 'somebody' },
];

async function setup(platform: 'server' | 'browser') {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvTerminalComponent, {
    inputs: { intro: LINES, commands: [], typeIntro: true, typeSpeedMs: 20 },
    providers: [{ provide: PLATFORM_ID, useValue: platform }],
  });
  return fixture;
}

describe('SvTerminalComponent — the typed intro and the server', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('prints the whole intro at once on the server, with no timers', async () => {
    const fixture = await setup('server');
    expect(vi.getTimerCount()).toBe(0);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('somebody');
  });

  it('still types it out in the browser', async () => {
    const fixture = await setup('browser');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('somebody');
    await vi.advanceTimersByTimeAsync(2_000);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('somebody');
  });

  it('stops typing when destroyed mid-intro', async () => {
    const fixture = await setup('browser');
    await vi.advanceTimersByTimeAsync(30);
    fixture.destroy();
    const setTimeout = vi.spyOn(globalThis, 'setTimeout');
    await vi.advanceTimersByTimeAsync(200);
    // At most the one character timer already pending when it was destroyed —
    // after that the loop sees the bumped run and stops scheduling.
    expect(setTimeout.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
