import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvPasswordStrengthComponent } from './password-strength.component';
import { SV_PASSWORD_STRENGTH_LABELS } from './password-strength.labels';

/** FL-B1d: the visible text is the package's English default until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvPasswordStrengthComponent, { inputs: { value: '' }, providers: providers as never[] });
  return fixture.nativeElement as HTMLElement;
}

describe('SvPasswordStrengthComponent — labels', () => {
  it('reads English by default', async () => {
    const el = await setup();
    expect(el.querySelector('[data-sv-band]')?.textContent?.trim()).toBe(SV_PASSWORD_STRENGTH_LABELS.noPasswordEntered);
    expect(screen.getByRole('group', { name: SV_PASSWORD_STRENGTH_LABELS.group })).toBeTruthy();
  });

  it('renders the text an app provides', async () => {
    const el = await setup([
      provideSvLabels({ passwordStrength: { noPasswordEntered: 'Kein Passwort eingegeben', group: 'Passwortstärke' } }),
    ]);
    expect(el.querySelector('[data-sv-band]')?.textContent?.trim()).toBe('Kein Passwort eingegeben');
    expect(screen.getByRole('group', { name: 'Passwortstärke' })).toBeTruthy();
  });

  it('names the band built in code in the language an app provides (FL-B1e)', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvPasswordStrengthComponent, {
      inputs: { value: 'password' },
      providers: [provideSvLabels({ passwordStrength: { bandVeryWeak: 'Sehr schwach' } })],
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-sv-band]')?.textContent?.trim()).toBe('Sehr schwach');
  });
});
