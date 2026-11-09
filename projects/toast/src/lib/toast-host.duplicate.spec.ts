import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core/dev';
import { type ToastPosition } from '@styloviz/core/services';
import { SvToastHostComponent } from './toast-host.component';

/**
 * FL-J3-OF-10 · OF-19-I6 — a dev warning when two hosts render the same
 * position (each would paint and announce every toast).
 */
@Component({
  standalone: true,
  imports: [SvToastHostComponent],
  template: `
    <sv-toast-host [position]="a()" />
    @if (second()) { <sv-toast-host [position]="b()" /> }
  `,
})
class Host {
  readonly a = signal<ToastPosition>('top-right');
  readonly b = signal<ToastPosition>('top-right');
  readonly second = signal(true);
}

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  svResetWarnOnce();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => warn.mockRestore());

const duplicateWarnings = () =>
  warn.mock.calls.filter(([m]: unknown[]) => String(m).includes('<sv-toast-host> elements are rendering position'));

async function setup(init: Partial<{ a: ToastPosition; b: ToastPosition; second: boolean }> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(Host, {
    componentProperties: {
      a: signal(init.a ?? 'top-right'),
      b: signal(init.b ?? 'top-right'),
      second: signal(init.second ?? true),
    },
  });
  fixture.detectChanges();
  return { fixture, host: fixture.componentInstance };
}

describe('SvToastHostComponent — duplicate hosts (FL-J3-OF-10)', () => {
  it('★ warns once when two hosts render the same position', async () => {
    await setup();
    expect(duplicateWarnings()).toHaveLength(1);
    expect(String(duplicateWarnings()[0][0])).toContain('"top-right"');
  });

  it('says nothing for hosts at different positions', async () => {
    await setup({ b: 'bottom-left' });
    expect(duplicateWarnings()).toHaveLength(0);
  });

  it('says nothing for a single host', async () => {
    await setup({ second: false });
    expect(duplicateWarnings()).toHaveLength(0);
  });

  it('releases a destroyed host, so a later single host is not reported', async () => {
    const { fixture, host } = await setup({ b: 'bottom-left' });
    host.second.set(false);
    fixture.detectChanges();
    host.a.set('bottom-left');
    fixture.detectChanges();
    expect(duplicateWarnings()).toHaveLength(0);
  });

  it('notices a position CHANGE that collides', async () => {
    const { fixture, host } = await setup({ b: 'bottom-left' });
    host.b.set('top-right');
    fixture.detectChanges();
    expect(duplicateWarnings()).toHaveLength(1);
  });
});
