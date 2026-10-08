/**
 * `sv-signature-pad` — the stroke model.
 *
 * ★★★ THE SIGNATURE IS DATA, NOT PIXELS.
 *
 * The obvious implementation draws straight onto the canvas and keeps nothing.
 * It works until the canvas is resized — and setting `canvas.width` or
 * `canvas.height` **wipes the bitmap**, which the browser does on every
 * orientation change, every responsive breakpoint, and every device-pixel-ratio
 * change (dragging a window between a laptop screen and an external monitor).
 * A pad that only has pixels loses the signature at all three, silently, after
 * the user has already signed.
 *
 * Holding strokes as points and re-rendering makes resize a redraw, undo a
 * `pop()`, "is it empty" a length check, and an SVG export possible at all.
 */

/** One sampled point, in CSS pixels relative to the canvas box. */
export interface SignaturePoint {
  readonly x: number;
  readonly y: number;
  /**
   * Pointer pressure, 0–1. `0.5` is what a mouse reports and what a pen that
   * does not support pressure reports, so it is also the fallback.
   */
  readonly pressure: number;
}

/** One continuous mark — pointer down, move…, up. */
export interface SignatureStroke {
  readonly points: readonly SignaturePoint[];
}

/** What `signatureChange` carries. */
export interface SignatureValue {
  readonly strokes: readonly SignatureStroke[];
  /** Canvas box in CSS pixels at capture time, so a consumer can rescale. */
  readonly width: number;
  readonly height: number;
  /**
   * The name the signer typed, or `''`.
   *
   * ── Why this is part of the value (`FI-21-M2`) ────────────────────────────
   *
   * ★★★ A CANVAS YOU MUST DRAW ON CANNOT BE OPERATED FROM A KEYBOARD, AND THAT
   *     IS NOT A DEGRADED EXPERIENCE — IT IS A FIELD THAT CANNOT BE COMPLETED.
   *     A screen-reader user, a keyboard-only user, and anyone with a tremor
   *     hits a control with no path through it at all. WCAG 2.1.1 has no
   *     partial credit.
   *
   * ★★ AND THE TYPED NAME IS THE MORE LEGALLY MEANINGFUL OF THE TWO. E-SIGN and
   *    eIDAS care about intent and attribution, not about ink: a drawn squiggle
   *    from an unattended tablet proves less than a typed name attached to an
   *    authenticated session. The kit does not decide which one a host relies
   *    on — it carries both and lets the host say.
   *
   * ⚠️ The attestation wording ("By typing my name I agree…") belongs to the
   *    HOST. A component that invents legal text is a component writing
   *    contracts it has not read.
   *
   * ★★ OPTIONAL, AND THE `?` IS A DECISION RATHER THAN A SHRUG. Making it
   *    required broke every existing construction site — including three specs
   *    in this repo, which is how the cost showed up — and `SignatureValue` is a
   *    published type that hosts build themselves to call `setValue`. A required
   *    field here is a breaking change to their code in exchange for nothing:
   *    the component always emits it, so every value that comes OUT carries it,
   *    and `setValue` treats a missing one as `''`.
   */
  readonly typedName?: string;

  /**
   * What was agreed to, when, and a digest over all of it — present only once
   * `attest()` has been called. See `SignatureAttestation`.
   */
  readonly attestation?: SignatureAttestation;
}

/**
 * The three fields that turn a drawing into a record (`FI-21-M1`).
 *
 * ── What a drawn signature is not ───────────────────────────────────────────
 *
 * ★★★ A SQUIGGLE ON A CANVAS PROVES ALMOST NOTHING ON ITS OWN, AND THE
 *     AFFORDANCE STRONGLY IMPLIES OTHERWISE (`FI-21-I1`). It is a picture. It
 *     does not establish who drew it, that they meant to agree to anything, or
 *     what the thing they were agreeing to said. An unattended tablet in a
 *     lobby produces the same artefact as a deliberate act by the named party.
 *
 *     E-SIGN, UETA and eIDAS all care about the same three things and none of
 *     them is ink: **intent to sign**, **attribution to a person**, and
 *     **association with the record signed**. A stroke list addresses none.
 *     What follows is the component's contribution to all three — which is a
 *     contribution, not a compliance feature.
 *
 * ── ★★★ THE HASH IS NOT TAMPER-EVIDENCE, AND SAYING SO IS THE POINT ─────────
 *
 * It is computed **in the signer's own browser, by the party being attested**.
 * Anyone who can change the strokes can change the hash, so it proves nothing
 * against the signer and it is not a seal. What it does do, and what it is
 * worth having for:
 *
 *   • It **binds the consent wording to the artefact**. A hash over only the
 *     image proves nothing about what was agreed to — which is the flaw in
 *     essentially every home-grown version of this. Here the digest covers the
 *     consent text, the strokes, the typed name and the timestamp together, so
 *     a record cannot later be paired with different wording without the digest
 *     disagreeing.
 *   • It makes **accidental drift** detectable: a re-encode, a lossy export, a
 *     migration that rescales coordinates, a database round trip that drops the
 *     typed name.
 *
 * ⚠️ THE EVIDENTIARY STEP IS THE SERVER'S. Counter-sign or timestamp this on
 *    receipt, from a clock and a key the signer does not control. Until then it
 *    is a checksum with good provenance, and a checksum presented as proof is
 *    worse than no checksum.
 */
export interface SignatureAttestation {
  /**
   * The exact wording the signer was shown, verbatim.
   *
   * ⚠️ SUPPLIED BY THE HOST AND NEVER INVENTED. A component that writes its own
   *    legal text is a component writing contracts it has not read — and the
   *    wording is jurisdiction-, product- and language-specific. Without it
   *    `attest()` returns `null` rather than producing a record that attests to
   *    nothing.
   */
  readonly consentText: string;

  /**
   * When the field was attested, ISO-8601 in UTC.
   *
   * ⚠️ FROM THE SIGNER'S OWN CLOCK, which they can set to anything. Useful for
   *    ordering and for spotting nonsense; not evidence of when anything
   *    happened. The server's receipt time is the one worth keeping.
   */
  readonly signedAt: string;

  /** Lower-case hex SHA-256 over `svSignatureRecord(...)`. */
  readonly hash: string;

  /**
   * How the digest was produced, so it can be recomputed in five years by
   * somebody who has only the stored record.
   *
   * ★★ VERSIONED ON PURPOSE. The canonical serialisation is a format, and a
   *    format with no version is a format that can never change: the day a
   *    field is added, every previously stored hash silently stops verifying
   *    with no way to tell that from tampering.
   */
  readonly hashAlgorithm: 'SHA-256';
  readonly recordFormat: 'sv-signature-v1';

  /**
   * Whatever the host knows about the signer — an account id, an IP, a session,
   * an authentication method. Opaque to the component and included in the
   * digest.
   *
   * ★★ THIS IS THE ATTRIBUTION HALF, and it is the half the component cannot
   *    supply. A canvas knows that a pointer moved; it does not know who was
   *    holding it. An authenticated session id is worth more here than the
   *    drawing is.
   */
  readonly signer?: Readonly<Record<string, string>>;
}

export type SignaturePadSize = 'sm' | 'md' | 'lg';

/**
 * Is there anything a human would call a signature here?
 *
 * ★★ A STRAY TAP IS NOT A SIGNATURE. A pointer-down/up with no movement leaves
 * a single dot — enough for `strokes.length > 0` to be true, and not enough for
 * anything else. Treating that as signed is how a form accepts a consent
 * nobody actually gave, so a lone one-point stroke does not count.
 */
export function isSignatureEmpty(strokes: readonly SignatureStroke[]): boolean {
  const marks = strokes.filter((s) => s.points.length > 1);
  return marks.length === 0;
}

/**
 * Has the field been completed, by either route?
 *
 * ★ Separate from `isSignatureEmpty`, which is about the CANVAS and is used for
 *   "is there anything to export / undo / clear". This is about the FIELD, and a
 *   typed name completes it without a single stroke.
 */
export function isSigned(strokes: readonly SignatureStroke[], typedName: string): boolean {
  return !isSignatureEmpty(strokes) || typedName.trim().length > 0;
}

/** Total sampled points — used by tests and by the `strokeCount` output. */
export function pointCount(strokes: readonly SignatureStroke[]): number {
  return strokes.reduce((n, s) => n + s.points.length, 0);
}

/**
 * Rescale strokes captured at one box size into another.
 *
 * ★ What makes a stored signature portable. Points are captured in the CSS
 * pixels of the box the user signed in; replaying them into a differently sized
 * pad (a print view, a PDF, a read-only summary) without rescaling draws a
 * signature that is the wrong size and clipped.
 */
export function rescale(
  value: SignatureValue,
  width: number,
  height: number,
): readonly SignatureStroke[] {
  if (value.width <= 0 || value.height <= 0) return value.strokes;
  const sx = width / value.width;
  const sy = height / value.height;
  if (sx === 1 && sy === 1) return value.strokes;
  return value.strokes.map((s) => ({
    points: s.points.map((p) => ({ x: p.x * sx, y: p.y * sy, pressure: p.pressure })),
  }));
}

/**
 * The strokes as an SVG path document.
 *
 * ★ Offered because a signature is a VECTOR: a PNG of one is resolution-bound
 * the moment it is captured, and a contract printed at 300 dpi from a 96-dpi
 * bitmap looks like a fax. Returns `null` when there is nothing to draw, rather
 * than an empty document that a caller would happily file as a signature.
 */
export function toSvg(
  strokes: readonly SignatureStroke[],
  width: number,
  height: number,
  color = '#111827',
  lineWidth = 2,
): string | null {
  if (isSignatureEmpty(strokes)) return null;
  const paths = strokes
    .filter((s) => s.points.length > 1)
    .map((s) => {
      const d = s.points
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(' ');
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${lineWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">${paths}</svg>`
  );
}

// ─── Attestation (`FI-21-M1`) ─────────────────────────────────────────────────

/** The version tag baked into every record this file produces. */
export const SV_SIGNATURE_RECORD_FORMAT = 'sv-signature-v1' as const;

/**
 * The exact bytes that get hashed.
 *
 * ★★★ IT IS A PURE, SYNCHRONOUS, EXPORTED FUNCTION, AND THAT IS DELIBERATE. A
 *     digest nobody can reproduce is a digest nobody can check, so the
 *     serialisation has to be something a server — in another language, five
 *     years later — can implement from the source. Hiding it inside an async
 *     crypto call would make it exactly the sort of checksum that gets believed
 *     because nobody can argue with it.
 *
 * ── The rules, each of which is a way this goes wrong ───────────────────────
 *
 * ★★ NEWLINE-SEPARATED FIELDS WITH NAMED KEYS, not JSON. `JSON.stringify` has
 *    no guaranteed key order across engines and versions, and a canonical form
 *    whose bytes depend on the engine is not canonical. It also escapes
 *    non-ASCII differently depending on the input, which would make the same
 *    name hash differently depending on how it arrived.
 *
 * ★★ COORDINATES ARE ROUNDED TO 2dp. Points are captured from pointer events as
 *    floats; a device-pixel-ratio change, a rescale for a print view, or a
 *    round trip through a database column with a different precision all
 *    perturb the last digits. At 2dp of a CSS pixel the drawing is identical to
 *    any eye and the digest survives the trip. Pressure likewise.
 *
 * ★★ THE CONSENT TEXT IS INCLUDED, AND IT IS THE MOST IMPORTANT FIELD HERE. A
 *    hash over the image alone proves nothing about what was agreed to, which
 *    is the flaw in essentially every home-grown version of this.
 *
 * ★ SIGNER KEYS ARE SORTED. Object key order is insertion order, so two hosts
 *   building the same metadata in a different order would otherwise produce two
 *   different digests for the same facts.
 */
export function svSignatureRecord(
  value: SignatureValue,
  consentText: string,
  signedAt: string,
  signer?: Readonly<Record<string, string>>,
): string {
  const n = (x: number): string => (Math.round(x * 100) / 100).toFixed(2);
  const lines: string[] = [
    `format:${SV_SIGNATURE_RECORD_FORMAT}`,
    `signedAt:${signedAt}`,
    `box:${n(value.width)}x${n(value.height)}`,
    `typedName:${(value.typedName ?? '').trim()}`,
    `consent:${consentText}`,
    `strokes:${value.strokes.length}`,
  ];
  for (const [i, stroke] of value.strokes.entries()) {
    lines.push(
      `stroke:${i}:` +
        stroke.points.map((p) => `${n(p.x)},${n(p.y)},${n(p.pressure)}`).join(' '),
    );
  }
  const keys = Object.keys(signer ?? {}).sort();
  for (const key of keys) lines.push(`signer:${key}:${signer![key]}`);
  return lines.join('\n');
}

/**
 * SHA-256 of a record, lower-case hex — or `null` where the browser will not
 * do it.
 *
 * ⚠️ `crypto.subtle` EXISTS ONLY IN A SECURE CONTEXT. On plain `http://`, and
 *    under SSR, it is simply absent — so this returns `null` rather than
 *    throwing, and `attest()` refuses to produce a record rather than producing
 *    one with an empty hash field. An attestation with a blank digest is worse
 *    than no attestation: it looks like one.
 */
export async function svSignatureHash(record: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const bytes = new TextEncoder().encode(record);
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Recompute a stored attestation's digest and compare.
 *
 * ★ Exported because the party who should be doing this is not this component —
 *   it is whatever reads the record back. Returns `false` for a record whose
 *   `recordFormat` this build does not know how to serialise, rather than
 *   guessing: a format mismatch is not a failed verification, and reporting it
 *   as one turns a deployment mistake into an accusation.
 */
export async function svVerifySignature(
  value: SignatureValue,
): Promise<'ok' | 'mismatch' | 'unknown-format' | 'no-attestation' | 'unavailable'> {
  const a = value.attestation;
  if (!a) return 'no-attestation';
  if (a.recordFormat !== SV_SIGNATURE_RECORD_FORMAT) return 'unknown-format';
  const hash = await svSignatureHash(svSignatureRecord(value, a.consentText, a.signedAt, a.signer));
  if (hash === null) return 'unavailable';
  return hash === a.hash ? 'ok' : 'mismatch';
}
