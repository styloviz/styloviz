import { SV_AI_LABELS } from './ai.labels';
import { SV_AI_LABELS_DE, SV_AI_LABELS_JA } from './ai.labels.packs';

describe('@styloviz/ai labels', () => {
  it('has English for every key', () => {
    for (const [key, value] of Object.entries(SV_AI_LABELS)) expect(value.trim(), key).not.toBe('');
  });

  it('ships packs with the same keys and slots', () => {
    for (const pack of [SV_AI_LABELS_DE.ai, SV_AI_LABELS_JA.ai]) {
      expect(Object.keys(pack).sort()).toEqual(Object.keys(SV_AI_LABELS).sort());
      expect(pack.copyFailed).toContain('{shortcut}');
    }
  });
});
