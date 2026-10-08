import { render } from '@testing-library/angular';
import { PHONE_COUNTRIES } from './phone-countries';
import { SvPhoneFlagComponent } from './phone-flag.component';

describe('SvPhoneFlagComponent', () => {
  for (const country of PHONE_COUNTRIES) {
    it(`renders a labelled svg for ${country.code}`, async () => {
      const { container } = await render(SvPhoneFlagComponent, { inputs: { code: country.code } });
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('aria-label')).toBe(country.code);
      expect(svg?.getAttribute('role')).toBe('img');
    });
  }

  it('falls back to a neutral placeholder for an unrecognized code', async () => {
    const { container } = await render(SvPhoneFlagComponent, { inputs: { code: 'ZZ' } });
    const rect = container.querySelector('svg > rect');
    expect(rect).not.toBeNull();
    expect(rect?.getAttribute('fill')).toBe('currentColor');
  });
});
