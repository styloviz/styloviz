import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core/dev';
import { vi } from 'vitest';
import { SvGroupComponent } from './group.component';

/**
 * `FL-J3-FI-19` / `FI-11-I2` — `role="group"` only with a name. An unnamed
 * group is announced as "group" and nothing else; every split button used to
 * announce one.
 */
async function setup(attrs: string) {
  TestBed.resetTestingModule();
  svResetWarnOnce();
  const { fixture } = await render(`<sv-group ${attrs}><button type="button">One</button></sv-group>`, {
    imports: [SvGroupComponent],
  });
  return fixture.nativeElement as HTMLElement;
}

afterEach(() => vi.restoreAllMocks());

describe('sv-group — named or role-less', () => {
  it('a visible label names the group', async () => {
    const host = await setup('label="Notifications"');
    const g = host.querySelector('[role="group"]')!;
    expect(document.getElementById(g.getAttribute('aria-labelledby')!)!.textContent!.trim()).toBe('Notifications');
    expect(g.hasAttribute('aria-label')).toBe(false);
  });

  it('ariaLabel names a group with no visible label', async () => {
    const host = await setup('ariaLabel="Shipping options"');
    const g = host.querySelector('[role="group"]')!;
    expect(g.getAttribute('aria-label')).toBe('Shipping options');
    expect(g.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('an unnamed group has no role, no aria-invalid, and stays a plain wrapper', async () => {
    const host = await setup('orientation="horizontal"');
    expect(host.querySelector('[role="group"]')).toBeNull();
    expect(host.querySelector('[aria-invalid]')).toBeNull();
    expect(host.querySelector('button')).not.toBeNull();
  });

  it('warns in dev when an unnamed group carries group semantics (an error, a collapse)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await setup('errorMessage="Pick one"');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no `label` or `ariaLabel`'));
  });

  it('does not warn for a layout-only wrapper', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await setup('orientation="horizontal" [fused]="true"');
    expect(warn).not.toHaveBeenCalled();
  });
});
