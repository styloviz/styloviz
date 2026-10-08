import { evaluatePassword } from './password-strength';

describe('evaluatePassword', () => {
  it('returns the weakest band and a call to action for an empty password', () => {
    const result = evaluatePassword('');
    expect(result.band).toBe(0);
    expect(result.label).toBe('Very weak');
    expect(result.suggestions).toEqual(['Enter a password']);
    expect(result.fromBreachCheck).toBe(false);
  });

  it('puts well-known common passwords at the bottom regardless of length', () => {
    expect(evaluatePassword('password').band).toBe(0);
    expect(evaluatePassword('123456789').band).toBe(0);
    expect(evaluatePassword('PASSWORD').band).toBe(0); // case-insensitive match
  });

  it('says why a common password is bad, in words that mean something', () => {
    const result = evaluatePassword('qwerty');
    expect(result.suggestions.some((s) => s.includes('most-guessed'))).toBe(true);
  });

  it('penalizes sequential character runs', () => {
    const result = evaluatePassword('abcd1234EFGH');
    expect(result.suggestions.some((s) => s.includes('abcd'))).toBe(true);
  });

  it('penalizes repeated character runs', () => {
    const result = evaluatePassword('aaaaB1!cdefgh');
    expect(result.suggestions.some((s) => s.includes('aaaa'))).toBe(true);
  });

  it('leaves a long, varied, non-pattern password alone on both counts', () => {
    const result = evaluatePassword('xqjr7412ZKmp');
    expect(result.suggestions.some((s) => s.includes('abcd'))).toBe(false);
    expect(result.suggestions.some((s) => s.includes('aaaa'))).toBe(false);
  });

  describe('length beats variety', () => {
    // ★ This is the whole reframing, stated as arithmetic. Composition rules
    //   produce `Password1!`; length is the lever that actually moves
    //   guessability, so it has to win here or the component is teaching the
    //   thing the audit called the bug.

    it('rates a four-word passphrase above a short complicated password', () => {
      const passphrase = evaluatePassword('correct horse battery staple');
      const gibberish = evaluatePassword('K7$mP!a');
      expect(passphrase.band).toBeGreaterThan(gibberish.band);
    });

    it('does not let punctuation rescue something short', () => {
      // Four character classes, seven characters. Under the old scorer this
      // reached "Good" on variety alone.
      expect(evaluatePassword('Aa1!Aa1').band).toBe(0);
    });

    it('gives variety nothing until the length minimum is met', () => {
      const short = evaluatePassword('Aa1!Aa1!', { minLength: 12 });
      expect(short.band).toBe(0);
      expect(short.suggestions.some((s) => s.includes('12 characters'))).toBe(true);
    });

    it('reaches the top band on length, with or without symbols', () => {
      expect(evaluatePassword('thistlewood harbour lantern').band).toBe(3);
      expect(evaluatePassword('thistlewood Harbour lantern7').band).toBe(4);
    });

    it('always suggests more length until well past the minimum', () => {
      const result = evaluatePassword('xqjr7412ZKmp');
      expect(result.suggestions.some((s) => s.includes('Longer is stronger'))).toBe(true);
    });
  });

  describe('breach status', () => {
    it('overrides everything when the password is known breached', () => {
      // A 28-character passphrase that the local heuristic would call Strong.
      const result = evaluatePassword('thistlewood harbour lantern', { breach: 'breached' });
      expect(result.band).toBe(0);
      expect(result.fromBreachCheck).toBe(true);
      expect(result.suggestions).toEqual([
        'This password has appeared in a data breach. Choose a different one.',
      ]);
    });

    it('overrides an empty password too, rather than asking for one twice', () => {
      expect(evaluatePassword('', { breach: 'breached' }).band).toBe(0);
      expect(evaluatePassword('', { breach: 'breached' }).fromBreachCheck).toBe(true);
    });

    it('says an outage happened without changing the band', () => {
      const quiet = evaluatePassword('thistlewood harbour lantern');
      const outage = evaluatePassword('thistlewood harbour lantern', { breach: 'unavailable' });
      expect(outage.band).toBe(quiet.band);
      expect(outage.fromBreachCheck).toBe(false);
      expect(outage.suggestions.some((s) => s.includes('could not check'))).toBe(true);
    });

    it('treats safe and checking as no local change at all', () => {
      const quiet = evaluatePassword('xqjr7412ZKmp');
      for (const breach of ['unknown', 'checking', 'safe'] as const) {
        const result = evaluatePassword('xqjr7412ZKmp', { breach });
        expect(result.band).toBe(quiet.band);
        expect(result.suggestions).toEqual(quiet.suggestions);
      }
    });
  });

  it('never returns more than three suggestions', () => {
    expect(evaluatePassword('a').suggestions.length).toBeLessThanOrEqual(3);
    expect(evaluatePassword('aaaa1234', { breach: 'unavailable' }).suggestions.length)
      .toBeLessThanOrEqual(3);
  });

  it('never returns a band outside the 0–4 range', () => {
    const samples = ['', 'a', 'aaaaaaaaaaaa', 'ABCDEFGHIJKL1234!!!!', 'correct horse battery staple'];
    for (const pw of samples) {
      const { band } = evaluatePassword(pw);
      expect(band).toBeGreaterThanOrEqual(0);
      expect(band).toBeLessThanOrEqual(4);
    }
  });
});
