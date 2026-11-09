import { svDayPeriods, svParseTime } from './time-parse';

/**
 * `FL-J3-FI-06` / `FI-28-I3` / `FI-28-M4` — a locale's own day periods, read
 * from `Intl`, and a parser that reads them back (before or after the digits).
 */
describe('svDayPeriods', () => {
  it('is AM/PM, after the time, for English', () => {
    expect(svDayPeriods('en-US')).toEqual({ am: 'AM', pm: 'PM', before: false });
  });

  it('is 午前/午後 and written FIRST for Japanese', () => {
    expect(svDayPeriods('ja')).toEqual({ am: '午前', pm: '午後', before: true });
  });

  it('is 上午/下午, first, for Simplified Chinese', () => {
    expect(svDayPeriods('zh-CN')).toEqual({ am: '上午', pm: '下午', before: true });
  });

  it('is never the English literals for a locale that has its own', () => {
    for (const locale of ['ja', 'zh-CN', 'ko', 'ar', 'es']) {
      const p = svDayPeriods(locale);
      expect(p.am, locale).not.toBe('AM');
      expect(p.am).not.toBe(p.pm);
    }
  });

  it('falls back to AM/PM for a tag Intl cannot read', () => {
    expect(svDayPeriods('not a locale!')).toEqual({ am: 'AM', pm: 'PM', before: false });
  });
});

describe('svParseTime — locale day periods', () => {
  it('reads a leading CJK period without being told the locale', () => {
    expect(svParseTime('午後2:30')).toEqual({ hour: 2, minute: 30, second: 0, period: 'PM' });
    expect(svParseTime('오전 9:05')).toEqual({ hour: 9, minute: 5, second: 0, period: 'AM' });
    expect(svParseTime('下午 11:00')).toEqual({ hour: 11, minute: 0, second: 0, period: 'PM' });
  });

  it('reads the locale’s own markers, spaced however Intl spaced them', () => {
    const { pm, am } = svDayPeriods('es');
    expect(svParseTime(`2:30 ${pm}`, { locale: 'es' })?.period).toBe('PM');
    expect(svParseTime(`2:30 ${am}`, { locale: 'es' })?.period).toBe('AM');
    expect(svParseTime('2:30 p. m.', { locale: 'es' })?.period).toBe('PM');
  });

  it('round-trips what a 12-hour picker displays in each pack language', () => {
    for (const locale of ['en', 'de', 'fr', 'es', 'pt-BR', 'it', 'nl', 'pl', 'tr', 'ja', 'zh-CN', 'ar']) {
      const { pm, before } = svDayPeriods(locale);
      const shown = before ? `${pm} 02:30` : `02:30 ${pm}`;
      expect(svParseTime(shown, { locale }), `${locale}: ${shown}`).toEqual({ hour: 2, minute: 30, second: 0, period: 'PM' });
    }
  });

  it('refuses two periods', () => {
    expect(svParseTime('午後2:30 pm')).toBeNull();
  });
});
