import { signal } from '@angular/core';
import { svMergeSelectFeatures, type SvSelectFeature, type SvSelectFeatureConfig } from './select-feature';

const feature = (config: SvSelectFeatureConfig): SvSelectFeature => ({ config: signal(config) });

describe('svMergeSelectFeatures', () => {
  it('is empty with no features', () => {
    expect(svMergeSelectFeatures([])).toEqual({});
  });

  it('merges features, and an unset member never overwrites a set one', () => {
    const merged = svMergeSelectFeatures([
      feature({ searchable: true, minChars: 2 }),
      feature({ minChars: undefined, virtualThreshold: 50 }),
    ]);
    expect(merged).toEqual({ searchable: true, minChars: 2, virtualThreshold: 50 });
  });

  it('lets the later feature win for a key both set', () => {
    expect(svMergeSelectFeatures([feature({ minChars: 2 }), feature({ minChars: 4 })]).minChars).toBe(4);
  });

  it('keeps a falsy value that was set on purpose', () => {
    const merged = svMergeSelectFeatures([feature({ searchable: false, virtualThreshold: 0, searchPlaceholder: '' })]);
    expect(merged).toEqual({ searchable: false, virtualThreshold: 0, searchPlaceholder: '' });
  });
});
