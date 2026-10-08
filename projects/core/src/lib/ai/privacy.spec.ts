import { TestBed } from '@angular/core/testing';
import {
  SV_AI_COMMON_PATTERNS,
  SV_AI_PRIVACY_DEFAULT,
  provideSvAiPrivacy,
  svAiMask,
  svAiPrivacy,
  type SvAiMaskPattern,
  type SvAiPrivacyPolicy,
} from './privacy';
import { svResetWarnOnce } from '../dev/warn-once';

/**
 * ============================================================================
 *  `X-2` — the AI pack's privacy contract
 * ============================================================================
 *
 * ★★★ THE DEFECT IS PORTFOLIO-SHAPED, NOT COMPONENT-SHAPED. Every component
 *     renders safely; a host that wanted masking had to configure eight of them
 *     separately, in eight shapes, and keep them agreeing for ever. The first
 *     one it forgets is the leak.
 */

const policy = (over: Partial<SvAiPrivacyPolicy> = {}): SvAiPrivacyPolicy => ({
  ...SV_AI_PRIVACY_DEFAULT,
  ...over,
});

const pattern = (id: string, source: string, label?: string): SvAiMaskPattern =>
  ({ id, source, ...(label === undefined ? {} : { label }) });

beforeEach(() => svResetWarnOnce());

describe('the default policy', () => {
  /**
   * ★★★ THE REVEAL DEFAULT IS THE ONE THAT IS NOT NEGOTIABLE. A reveal control
   *     that exists unless a host turns it off is a leak unless a host
   *     remembers — and the host that most needs masking is the least likely to
   *     audit for an affordance it never asked for.
   */
  it('masks nothing, reveals nothing, allows copy, and sends no content', () => {
    expect(SV_AI_PRIVACY_DEFAULT.patterns).toEqual([]);
    expect(SV_AI_PRIVACY_DEFAULT.reveal).toBe(false);
    expect(SV_AI_PRIVACY_DEFAULT.copy).toBe(true);
    expect(SV_AI_PRIVACY_DEFAULT.telemetry).toBe(false);
  });

  it('is frozen, so one surface cannot edit the policy every other surface reads', () => {
    expect(Object.isFrozen(SV_AI_PRIVACY_DEFAULT)).toBe(true);
  });

  it('reaches a component that never heard of the contract', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const seen = TestBed.runInInjectionContext(() => svAiPrivacy());
    expect(seen).toEqual(SV_AI_PRIVACY_DEFAULT);
  });

  it('is replaced, field by field, by what the host provided', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideSvAiPrivacy({ reveal: true, patterns: SV_AI_COMMON_PATTERNS })],
    });
    const seen = TestBed.runInInjectionContext(() => svAiPrivacy());

    expect(seen.reveal).toBe(true);
    expect(seen.patterns).toBe(SV_AI_COMMON_PATTERNS);
    // Untouched fields keep the documented default rather than becoming undefined.
    expect(seen.copy).toBe(true);
    expect(seen.telemetry).toBe(false);
  });
});

/**
 * ★★★ `reveal` IS A PERMISSION FOR A CONTROL, NOT A SWITCH ON THE MASK. A host
 *     that allows reveal still wants every value masked until a viewer asks;
 *     the surface keeps the per-value reveal state and shows the original only
 *     for what was revealed (`sv-agent-approval`, `sv-mcp-tool-registry`).
 */
describe('the reveal permission', () => {
  it('does not switch masking off', () => {
    const text = 'key sk-aaaaaaaaaaaaaaaaaa';
    const hidden = svAiMask(text, policy({ patterns: SV_AI_COMMON_PATTERNS, reveal: false }));
    const allowed = svAiMask(text, policy({ patterns: SV_AI_COMMON_PATTERNS, reveal: true }));

    expect(allowed).toEqual(hidden);
    expect(allowed.text).toContain('[API KEY]');
  });
});

describe('masking', () => {
  it('leaves text alone when no patterns are configured', () => {
    const out = svAiMask('sk-live-abcdefghijklmnopqrstuv', policy());
    expect(out.text).toBe('sk-live-abcdefghijklmnopqrstuv');
    expect(out.count).toBe(0);
  });

  it('replaces every match, not only the first', () => {
    // ★★ The `g` flag is applied here rather than taken from the host, so a
    //    pattern cannot be written in a way that masks one secret and misses
    //    the second.
    const out = svAiMask(
      'keys: sk-aaaaaaaaaaaaaaaaaa and sk-bbbbbbbbbbbbbbbbbb',
      policy({ patterns: SV_AI_COMMON_PATTERNS }),
    );
    expect(out.count).toBe(2);
    expect(out.text).toBe('keys: [API KEY] and [API KEY]');
  });

  it('is stable across calls with the same policy object', () => {
    // ★★★ A host-supplied `RegExp` with `g` keeps `lastIndex`, so a policy
    //     shared by two surfaces would skip matches in the second. Compiling
    //     per call is what makes that impossible — and this is the test that
    //     would have caught it.
    const p = policy({ patterns: SV_AI_COMMON_PATTERNS });
    const first = svAiMask('sk-aaaaaaaaaaaaaaaaaa', p);
    const second = svAiMask('sk-aaaaaaaaaaaaaaaaaa', p);
    expect(second).toEqual(first);
  });

  it('reports which patterns matched, for a surface that wants to say so', () => {
    const out = svAiMask(
      'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghij',
      policy({ patterns: SV_AI_COMMON_PATTERNS }),
    );
    expect(out.count).toBeGreaterThan(0);
    expect(out.matched.length).toBeGreaterThan(0);
  });

  /**
   * ★★★ SPLICING ONE PATTERN AT A TIME SHIFTS EVERY OFFSET AFTER THE FIRST
   *     REPLACEMENT, and the visible result is a mangled `Bearer [RE[JWT]D]`.
   *     Collecting, merging and splicing once is the only arrangement that
   *     survives two patterns matching overlapping ranges — the same defect
   *     `svMergeSpans` documents for redaction, reached from the other side.
   */
  it('never mangles the text when two patterns overlap', () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghij';
    const out = svAiMask(`Authorization: Bearer ${token}`, policy({
      patterns: SV_AI_COMMON_PATTERNS,
    }));

    expect(out.text).not.toContain('[RE');
    expect(out.text).not.toContain(']]');
    expect(out.text).not.toContain(token);
    // One span survived the overlap, not two spliced into each other.
    expect(out.count).toBe(1);
  });

  it('gives an overlap to the LONGER match, because it is the more complete secret', () => {
    const out = svAiMask('value abcdefghij', policy({
      patterns: [pattern('short', 'abcde', '[SHORT]'), pattern('long', 'abcdefghij', '[LONG]')],
    }));
    expect(out.text).toBe('value [LONG]');
  });

  it('keeps two separate secrets separate', () => {
    const out = svAiMask('a sk-aaaaaaaaaaaaaaaaaa b AKIAIOSFODNN7EXAMPLE c', policy({
      patterns: SV_AI_COMMON_PATTERNS,
    }));
    expect(out.text).toBe('a [API KEY] b [AWS KEY] c');
    expect(out.matched).toEqual(['provider-key', 'aws-key']);
  });

  it('masks a multi-line private key block as one span', () => {
    const key = [
      '-----BEGIN RSA PRIVATE KEY-----',
      'MIIEowIBAAKCAQEA3s7',
      'sJ8yq0Zq5VqQ==',
      '-----END RSA PRIVATE KEY-----',
    ].join('\n');
    const out = svAiMask(`here:\n${key}\nthanks`, policy({ patterns: SV_AI_COMMON_PATTERNS }));

    expect(out.text).toBe('here:\n[PRIVATE KEY]\nthanks');
  });

  it('falls back to a generic label when a pattern names none', () => {
    const out = svAiMask('secret abcdef', policy({ patterns: [pattern('x', 'abcdef')] }));
    expect(out.text).toBe('secret [REDACTED]');
  });

  it('survives an empty string and an empty match', () => {
    expect(svAiMask('', policy({ patterns: SV_AI_COMMON_PATTERNS })).text).toBe('');
    // A pattern that can match nothing must not splice a label in at every
    // character — an infinite run of `[EMPTY]` is the classic form of this bug.
    const out = svAiMask('abc', policy({ patterns: [pattern('empty', 'x*', '[EMPTY]')] }));
    expect(out.text).toBe('abc');
    expect(out.count).toBe(0);
  });
});

describe('a pattern that cannot be run', () => {
  /**
   * ★★★ ONE BAD REGEX MUST NOT TURN REDACTION OFF ALTOGETHER. Dropping the
   *     policy on a single unparseable pattern is the failure that matters:
   *     the host believes it configured masking, the surface believes it has
   *     none, and nothing on screen says which.
   */
  it('drops the pattern, warns once, and keeps masking with the rest', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const out = svAiMask('sk-aaaaaaaaaaaaaaaaaa and (', policy({
      patterns: [pattern('broken', '('), ...SV_AI_COMMON_PATTERNS],
    }));

    expect(out.text).toContain('[API KEY]');
    const ours = warn.mock.calls.map((a) => String(a[0])).filter((m) => m.startsWith('[styloviz]'));
    expect(ours).toHaveLength(1);
    expect(ours[0]).toContain('"broken"');
    warn.mockRestore();
  });

  /**
   * ★★★ A CATASTROPHIC PATTERN HERE IS WORSE THAN THE CASE `svCompilePattern`
   *     WAS WRITTEN FOR. There it froze one field on one keystroke; here it
   *     would run over every message in a transcript on every render.
   */
  it('refuses a catastrophic pattern instead of running it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const out = svAiMask('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaab', policy({
      patterns: [pattern('evil', '(a+)+b', '[X]')],
    }));

    expect(out.text).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaab');
    expect(out.count).toBe(0);
    expect(warn.mock.calls.map((a) => String(a[0])).filter((m) => m.startsWith('[styloviz]')))
      .toHaveLength(1);
    warn.mockRestore();
  });
});

describe('the opt-in pattern set', () => {
  /**
   * ★★ WHAT IS NOT IN IT IS THE POINT. An e-mail or phone pattern matches
   *    legitimate content constantly — a chat about a customer, a tool argument
   *    that IS an address — and a mask set that eats the answer is the
   *    over-redaction failure the guardrail panel exists to make visible.
   */
  it('covers secrets and leaves ordinary personal data alone', () => {
    const out = svAiMask(
      'mail ada@example.com, call +44 20 7946 0958, key sk-aaaaaaaaaaaaaaaaaa',
      policy({ patterns: SV_AI_COMMON_PATTERNS }),
    );

    expect(out.text).toContain('ada@example.com');
    expect(out.text).toContain('+44 20 7946 0958');
    expect(out.text).toContain('[API KEY]');
  });

  /**
   * ★★ `AI-10-M1`. A URL carries a credential without looking like one: the
   *    password sits in the userinfo, the token in the query, and a failing
   *    client echoes the whole URL into its error message.
   */
  it('masks credentials in a URL but keeps the host, path and parameter names', () => {
    const p = policy({ patterns: SV_AI_COMMON_PATTERNS });

    const userinfo = svAiMask('connect postgres://app:hunter2@db.internal:5432/main failed', p);
    expect(userinfo.text).toBe('connect postgres://[CREDENTIALS]@db.internal:5432/main failed');

    const query = svAiMask('GET https://api.example.com/v1/items?page=2&token=abc123XYZ&sort=asc', p);
    expect(query.text).toBe('GET https://api.example.com/v1/items?page=2&token=[REDACTED]&sort=asc');

    const fragment = svAiMask('https://app.example.com/cb#access_token=zzz999&state=1', p);
    expect(fragment.text).toBe('https://app.example.com/cb#access_token=[REDACTED]&state=1');

    const presigned = svAiMask('https://b.s3.amazonaws.com/f?X-Amz-Signature=deadbeef01', p);
    expect(presigned.text).toContain('X-Amz-Signature=[REDACTED]');

    const tokenUser = svAiMask('https://ghp_abcdefghijklmnopqrstu@github.com/org/repo', p);
    expect(tokenUser.text).toBe('https://[CREDENTIALS]@github.com/org/repo');
  });

  it('leaves an ordinary URL alone, including a short user name', () => {
    const p = policy({ patterns: SV_AI_COMMON_PATTERNS });
    for (const url of [
      'https://api.example.com/v1/items?page=2&sort=asc',
      'ssh://git@github.com/org/repo.git',
      'https://example.com/docs#keyboard-shortcuts',
    ]) {
      expect(svAiMask(url, p).text).toBe(url);
    }
  });

  it('is frozen, so a host cannot push a pattern into the shared set', () => {
    expect(Object.isFrozen(SV_AI_COMMON_PATTERNS)).toBe(true);
  });
});
