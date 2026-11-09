import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { SvErrorShellComponent } from '@styloviz/core/data';
import { svFormatLabel } from './label-format';
import { provideSvLabels } from './labels';
import * as packs from './core.labels.packs';

/**
 * FL-B2: a generated language pack is a real `provideSvLabels()` argument —
 * every one of the twelve renders its own words, and a correction passed
 * after it wins key by key.
 */
const LANGUAGES = Object.entries(packs) as [string, { readonly core: typeof packs.SV_CORE_LABELS_EN.core }][];

async function setup(...overrides: Parameters<typeof provideSvLabels>) {
  TestBed.resetTestingModule();
  return render(SvErrorShellComponent, {
    inputs: { error: 'The request timed out.' },
    providers: [provideSvLabels(...overrides)],
  });
}

afterEach(() => TestBed.resetTestingModule());

describe('core language packs (FL-B2)', () => {
  it('ships twelve', () => {
    expect(LANGUAGES.map(([name]) => name).sort()).toEqual(
      ['AR', 'DE', 'EN', 'ES', 'FR', 'IT', 'JA', 'NL', 'PL', 'PT_BR', 'TR', 'ZH_CN'].map((s) => `SV_CORE_LABELS_${s}`),
    );
  });

  it.each(LANGUAGES)('%s titles a failure and names the retry in its language', async (_, pack) => {
    await setup(pack);
    expect(screen.getByText(pack.core.errorTitle)).toBeTruthy();
    expect(screen.getByRole('button', { name: pack.core.retry })).toBeTruthy();
  });

  it('translates, rather than repeating the English', () => {
    expect(packs.SV_CORE_LABELS_DE.core.retry).not.toBe(packs.SV_CORE_LABELS_EN.core.retry);
    expect(packs.SV_CORE_LABELS_JA.core.errorTitle).not.toBe(packs.SV_CORE_LABELS_EN.core.errorTitle);
  });

  it('lets a correction passed after the pack win', async () => {
    await setup(packs.SV_CORE_LABELS_DE, { core: { retry: 'Nochmal' } });
    expect(screen.getByRole('button', { name: 'Nochmal' })).toBeTruthy();
    expect(screen.getByText(packs.SV_CORE_LABELS_DE.core.errorTitle)).toBeTruthy();
  });

  it("carries its language's plural forms, and the formatter picks them by its rules", () => {
    // Polish needs `few` and `many`; one second and five seconds take different forms.
    const tpl = packs.SV_CORE_LABELS_PL.core.expectedWaitSeconds;
    expect(tpl).toMatch(/\bfew\s*\{/);
    expect(tpl).toMatch(/\bmany\s*\{/);
    const words = (n: number) => svFormatLabel(tpl, { count: n, n: String(n) }, 'pl').replace(String(n), '#');
    expect(words(1)).not.toBe(words(5));
  });
});
