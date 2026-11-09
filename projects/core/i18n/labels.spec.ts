import { TestBed } from '@angular/core/testing';
import { injectSvLabels, provideSvLabels } from './labels';

// A package adds its namespace exactly like this — and so must this spec: every
// augmentation targets '@styloviz/core', or TypeScript keeps two registries and
// the packages' namespaces vanish from the one `injectSvLabels` reads.
interface SvTestLabels {
  readonly close: string;
  readonly next: string;
}
declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    svTest: SvTestLabels;
  }
}

const DEFAULTS: SvTestLabels = { close: 'Close', next: 'Next' };

function labels(...providers: ReturnType<typeof provideSvLabels>[]) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers });
  return TestBed.runInInjectionContext(() => injectSvLabels('svTest', DEFAULTS));
}

describe('injectSvLabels', () => {
  it('is the package defaults when nothing is provided', () => {
    expect(labels()).toEqual(DEFAULTS);
  });

  it('applies a partial override, key by key', () => {
    expect(labels(provideSvLabels({ svTest: { close: 'Schließen' } }))).toEqual({ close: 'Schließen', next: 'Next' });
  });

  it('layers several providers in order, later winning', () => {
    const l = labels(
      provideSvLabels({ svTest: { close: 'Schließen', next: 'Weiter' } }),
      provideSvLabels({ svTest: { close: 'Zumachen' } }),
    );
    expect(l).toEqual({ close: 'Zumachen', next: 'Weiter' });
  });

  it('ignores what a malformed pack cannot mean: unknown keys, blanks, non-strings', () => {
    const bad = { svTest: { close: '  ', next: 42, extra: 'x' } } as unknown as Parameters<typeof provideSvLabels>[0];
    const l = labels(provideSvLabels(bad));
    expect(l).toEqual(DEFAULTS);
    expect('extra' in l).toBe(false);
  });

  it('hands out a frozen object, so a component cannot rename a sibling', () => {
    expect(Object.isFrozen(labels())).toBe(true);
  });
});
