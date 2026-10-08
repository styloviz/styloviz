import {
  InjectionToken,
  inject,
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from '@angular/core';
import { svCompilePattern } from '../security/pattern';
import { svWarnOnce } from '../dev/warn-once';

/**
 * ============================================================================
 *  `X-2` — one privacy and redaction contract for the AI pack
 * ============================================================================
 *
 * ★★★ EVERY COMPONENT IN THE PACK RENDERS SAFELY AND THE PORTFOLIO HAS NO
 *     POLICY, which is a different defect from an unsafe component and a harder
 *     one to see. Tool arguments, approval edits, reasoning content, voice
 *     transcripts, chat messages and retrieved chunks can all carry a key, a
 *     customer's address or a patient identifier — and a host that wants those
 *     masked had to configure eight components separately, in eight shapes, and
 *     keep them agreeing with each other for ever. The first one it forgets is
 *     the leak.
 *
 * ★★ MASKING IS A RENDER-TIME TRANSFORM AND NEVER TOUCHES THE DATA. Same rule
 *    as the scale ceiling: the host's array is not edited, the model is not
 *    rewritten, and a copy of the ORIGINAL is what a permitted export gets.
 *    A component that masked its own inputs would corrupt the thing it was
 *    handed, and the corruption would survive into whatever the host persisted
 *    next.
 *
 * ★★ THE PATTERNS ARE HOST-SUPPLIED SOURCES, COMPILED THROUGH
 *    `svCompilePattern`, because a mask pattern is exactly the untrusted regex
 *    that module exists for — and worse than the case it was written for: a
 *    catastrophic pattern that froze one field on one keystroke here runs over
 *    every message in a transcript on every render. A pattern that cannot be
 *    compiled safely is dropped with one dev warning naming it, and masking
 *    carries on with the rest; refusing the whole policy would turn one bad
 *    regex into no redaction at all, which is the failure mode that matters.
 */

/** One thing to mask, and what to show instead. */
export interface SvAiMaskPattern {
  /** Stable id, used in warnings and by hosts toggling patterns. */
  readonly id: string;
  /**
   * The regular expression SOURCE — a string, not a `RegExp`.
   *
   * ★★ A `RegExp` handed over by a host is either stateful (the `g` flag keeps
   *    `lastIndex`, so a policy object shared by two surfaces skips matches in
   *    the second) or not global, in which case it can only ever mask the FIRST
   *    secret in a message. Taking the source and compiling it here is what
   *    makes both impossible.
   */
  readonly source: string;
  /** What replaces a match. `'[REDACTED]'` when omitted. */
  readonly label?: string;
}

export interface SvAiPrivacyPolicy {
  /**
   * What to mask. Empty by default — see {@link SV_AI_COMMON_PATTERNS}.
   *
   * ★★★ NO PATTERNS BY DEFAULT, DELIBERATELY. A default mask set would rewrite
   *     content in every existing surface the moment this shipped, and the
   *     rewrite that matters is the wrong one: a code block containing `sk-` or
   *     a sentence containing an `@` would come out mangled, in a component
   *     whose job is to show the user what the model said. The patterns that
   *     are right vary per tenant, which is the definition of a policy rather
   *     than a default. `SV_AI_COMMON_PATTERNS` is one call away.
   */
  readonly patterns: readonly SvAiMaskPattern[];
  /**
   * May a viewer unmask what was masked?
   *
   * ★★★ FALSE BY DEFAULT, AND THIS IS THE ONE DEFAULT THAT IS NOT NEGOTIABLE.
   *     A reveal control that exists unless a host turns it off is a leak
   *     unless a host remembers — and the host that most needs masking is the
   *     one least likely to audit for an affordance it never asked for. Role
   *     gating lives with the host: it knows who is looking.
   */
  readonly reveal: boolean;
  /**
   * May a viewer copy or export content from these surfaces?
   *
   * ★ TRUE by default, because copy is a shipped feature of `sv-ai-chat` and
   *   flipping it would silently remove a control people use. A host that
   *   masks on screen and wants the export masked too sets this `false` and
   *   offers its own export path — the component cannot know whether the
   *   clipboard is going into a ticket or a support channel.
   */
  readonly copy: boolean;
  /**
   * May a surface include content in analytics or telemetry events?
   *
   * ★★★ FALSE by default. Content-bearing telemetry that is on unless someone
   *     turns it off is the worst available default in this whole contract: it
   *     exfiltrates continuously, to a third party, with no UI anywhere that
   *     shows it happening.
   */
  readonly telemetry: boolean;
}

/** The policy a surface applies when the host has provided none. */
export const SV_AI_PRIVACY_DEFAULT: SvAiPrivacyPolicy = Object.freeze({
  patterns: Object.freeze([]) as readonly SvAiMaskPattern[],
  reveal: false,
  copy: true,
  telemetry: false,
});

/**
 * A conservative, opt-in mask set for the things that are secrets whatever the
 * tenant: provider keys, bearer tokens, JWTs, and private-key blocks.
 *
 * ★★ WHAT IS NOT IN HERE IS THE POINT. No e-mail pattern, no phone pattern, no
 *    credit-card pattern — those match legitimate content constantly (a chat
 *    about a customer, a tool argument that IS an address), and a mask set that
 *    eats the answer is the over-redaction failure `sv-guardrail-panel` exists
 *    to make visible. Add those per tenant, having decided they are worth it.
 */
export const SV_AI_COMMON_PATTERNS: readonly SvAiMaskPattern[] = Object.freeze([
  { id: 'provider-key', source: '\\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}', label: '[API KEY]' },
  { id: 'bearer', source: '\\bBearer\\s+[A-Za-z0-9._~+/-]{12,}=*', label: 'Bearer [TOKEN]' },
  { id: 'jwt', source: '\\bey[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}', label: '[JWT]' },
  { id: 'aws-key', source: '\\b(?:AKIA|ASIA)[A-Z0-9]{16}', label: '[AWS KEY]' },
  {
    id: 'private-key',
    source: '-----BEGIN [A-Z ]*PRIVATE KEY-----[\\s\\S]*?-----END [A-Z ]*PRIVATE KEY-----',
    label: '[PRIVATE KEY]',
  },
  /**
   * ★★ A URL IS A CREDENTIAL CARRIER THAT DOES NOT LOOK LIKE ONE. Connection
   *    strings put the password in the userinfo (`postgres://app:hunter2@db`),
   *    and a failing client echoes the URL it called into its error message.
   *    Only the userinfo is replaced, so the host and path — what the reader
   *    needs to diagnose the call — stay on screen. A bare short user name
   *    (`ssh://git@host`) is left alone: it is not a secret, and masking it is
   *    the over-redaction this set is written to avoid. A long one is a token
   *    used as the user name (`https://ghp_…@github.com`) and is masked.
   */
  {
    id: 'url-credentials',
    source: '(?<=://)(?:[^\\s/?#@:]*:[^\\s/?#@]+|[^\\s/?#@:]{16,})(?=@)',
    label: '[CREDENTIALS]',
  },
  /**
   * ★ Query and fragment parameters that are secrets by name — `?token=`,
   *   `&api_key=`, `#access_token=` (the OAuth implicit flow), and the signed-URL
   *   parameters S3 presigning adds. The parameter NAME stays, so the reader can
   *   still see which kind of URL it was.
   */
  {
    id: 'url-secret-param',
    source:
      '(?<=[?&#;](?:access_token|refresh_token|id_token|token|api_key|apikey|api-key|key|' +
      'secret|client_secret|password|passwd|pwd|auth|sig|signature|' +
      'X-Amz-Signature|X-Amz-Credential|X-Amz-Security-Token)=)[^&#\\s]+',
    label: '[REDACTED]',
  },
]);

export const SV_AI_PRIVACY = new InjectionToken<SvAiPrivacyPolicy>('SvAiPrivacyPolicy');

/**
 * Configure masking, reveal, copy and telemetry for the whole AI pack, once.
 *
 * @example
 * ```ts
 * providers: [
 *   provideSvAiPrivacy({ patterns: SV_AI_COMMON_PATTERNS, copy: false }),
 * ]
 * ```
 */
export function provideSvAiPrivacy(policy: Partial<SvAiPrivacyPolicy> = {}): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: SV_AI_PRIVACY, useValue: { ...SV_AI_PRIVACY_DEFAULT, ...policy } },
  ]);
}

/**
 * The policy in force, for a component to read.
 *
 * ★ Optional injection with the default as the fallback, so every surface in
 *   the pack works in an app that has never heard of this contract — which is
 *   every app that upgrades into it.
 */
export function svAiPrivacy(): SvAiPrivacyPolicy {
  return inject(SV_AI_PRIVACY, { optional: true }) ?? SV_AI_PRIVACY_DEFAULT;
}

export interface SvAiMasked {
  /** The text to render. */
  readonly text: string;
  /** How many matches were replaced. */
  readonly count: number;
  /** Ids of the patterns that matched, in the order they first did. */
  readonly matched: readonly string[];
}

interface Span {
  readonly start: number;
  readonly end: number;
  readonly label: string;
  readonly id: string;
}

/**
 * Mask every match in one string.
 *
 * ★★★ `policy.reveal` IS DELIBERATELY NOT READ HERE. `reveal` is a PERMISSION
 *     for a viewer to unmask one value on request, never an instruction to stop
 *     masking: a host that sets it `true` wants a reveal control, and still
 *     wants every surface masked until somebody uses it. A mask that honoured
 *     `reveal` would turn that flag into "masking off" for the whole pack. The
 *     surface owns the per-value reveal state (`sv-agent-approval`'s argument
 *     reveal, `sv-mcp-tool-registry`'s per-server reveal) and simply renders the
 *     original text for a value the viewer has revealed; it offers the control
 *     only when `reveal` is true and this function reported `count > 0`.
 *
 * ★★★ MATCHES ARE COLLECTED, MERGED AND THEN SPLICED ONCE — never replaced one
 *     pattern at a time. Two patterns matching overlapping ranges (a bearer
 *     header that contains a JWT) spliced in sequence shift every offset after
 *     the first replacement, and the visible result is a mangled
 *     `Bearer [RE[JWT]D]`: the same defect `svMergeSpans` documents for
 *     redaction in `sv-guardrail-panel`, arrived at from the other direction.
 *
 * ★★ THE LONGEST MATCH WINS AN OVERLAP, because the longer span is the more
 *    complete secret. A `Bearer eyJ…` masked as `[JWT]` leaves the word Bearer
 *    and a truncated token on screen; masked as the whole header it leaves
 *    nothing.
 */
export function svAiMask(text: string, policy: SvAiPrivacyPolicy): SvAiMasked {
  if (!text || policy.patterns.length === 0) return { text, count: 0, matched: [] };

  const spans: Span[] = [];
  for (const pattern of policy.patterns) {
    const compiled = svCompilePattern(pattern.source, { anchor: false });
    if (!compiled.regexp) {
      svWarnOnce(
        `sv-ai-privacy/pattern/${pattern.id}`,
        `sv-ai privacy: mask pattern "${pattern.id}" was dropped — ${compiled.reason} ` +
          'The other patterns are still applied; one bad expression must not turn ' +
          'redaction off altogether.',
      );
      continue;
    }
    const rx = new RegExp(compiled.regexp.source, 'g');
    for (const match of text.matchAll(rx)) {
      if (match.index === undefined || match[0].length === 0) continue;
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        label: pattern.label ?? '[REDACTED]',
        id: pattern.id,
      });
    }
  }

  if (spans.length === 0) return { text, count: 0, matched: [] };

  // Longest first at a given start, so the more complete secret wins an overlap.
  spans.sort((a, b) => a.start - b.start || b.end - a.end);

  const kept: Span[] = [];
  for (const span of spans) {
    const last = kept[kept.length - 1];
    if (last && span.start < last.end) continue;   // inside a span already kept
    kept.push(span);
  }

  let out = '';
  let cursor = 0;
  const matched: string[] = [];
  for (const span of kept) {
    out += text.slice(cursor, span.start) + span.label;
    cursor = span.end;
    if (!matched.includes(span.id)) matched.push(span.id);
  }
  out += text.slice(cursor);

  return { text: out, count: kept.length, matched };
}
