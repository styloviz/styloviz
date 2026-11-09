import { svHighlightSegments } from '@styloviz/core/security';
import { svFoldText, svTextMatches } from './text-fold';

/** `FL-J3-FI-08` / `FI-01-I4` / `FI-01-M2` — folded matching and highlighting. */
const marked = (text: string, query: string, opts = {}) =>
  svHighlightSegments(text, query, opts).filter((s) => s.match).map((s) => s.text);

describe('svFoldText', () => {
  it('drops accents and lower-cases', () => {
    expect(svFoldText('José Müller Ångström')).toBe('jose muller angstrom');
  });

  it('lower-cases in the locale — Turkish dotted and dotless I', () => {
    expect(svFoldText('İSTANBUL', 'tr')).toBe('istanbul');
    expect(svFoldText('ISPARTA', 'tr')).toBe('ısparta');
  });
});

describe('svTextMatches', () => {
  it('finds José from “jose” and Müller from “MULLER”', () => {
    expect(svTextMatches('José Ramos', 'jose')).toBe(true);
    expect(svTextMatches('Anna Müller', 'MULLER')).toBe(true);
  });

  it('prefix mode: the start of the text or of a word, never the middle', () => {
    expect(svTextMatches('Lovelace, Ada', 'ada', { mode: 'prefix' })).toBe(true);
    expect(svTextMatches('Canada', 'ada', { mode: 'prefix' })).toBe(false);
    expect(svTextMatches('Canada', 'ada', { mode: 'substring' })).toBe(true);
  });

  it('an empty query matches everything; an empty text nothing', () => {
    expect(svTextMatches('x', '  ')).toBe(true);
    expect(svTextMatches('', 'x')).toBe(false);
  });
});

describe('svHighlightSegments — folded', () => {
  it('marks the original characters, accents and capitals kept', () => {
    expect(marked('José Ramos', 'jose')).toEqual(['José']);
    expect(marked('über alles', 'UBER')).toEqual(['über']);
  });

  it('never splits a combining accent from its letter (decomposed input)', () => {
    const decomposed = 'José Ramos';
    expect(marked(decomposed, 'jose')).toEqual(['José']);
    expect(svHighlightSegments(decomposed, 'jose').map((s) => s.text).join('')).toBe(decomposed);
  });

  it('marks every occurrence, and rejoins to the original exactly', () => {
    const text = 'Éclair, eclair, ÉCLAIR';
    expect(marked(text, 'eclair')).toEqual(['Éclair', 'eclair', 'ÉCLAIR']);
    expect(svHighlightSegments(text, 'eclair').map((s) => s.text).join('')).toBe(text);
  });

  it('prefix mode marks word starts only', () => {
    expect(marked('Canada and Ada', 'ada', { mode: 'prefix' })).toEqual(['Ada']);
  });

  it('keeps an astral character whole', () => {
    expect(svHighlightSegments('😀 Zoë', 'zoe').map((s) => s.text)).toEqual(['😀 ', 'Zoë']);
  });
});
