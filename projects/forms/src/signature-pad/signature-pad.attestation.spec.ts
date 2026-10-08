import { render, type ComponentInput } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import { SvSignaturePadComponent } from './signature-pad.component';
import {
  SV_SIGNATURE_RECORD_FORMAT,
  svSignatureHash,
  svSignatureRecord,
  svVerifySignature,
  type SignatureValue,
} from './signature-pad.types';

/**
 * ============================================================================
 *  A drawn signature is not identity or consent  ·  `FI-21-I1` / `FI-21-M1`
 * ============================================================================
 *
 * ★★★ A SQUIGGLE ON A CANVAS PROVES ALMOST NOTHING, AND THE AFFORDANCE
 *     STRONGLY IMPLIES OTHERWISE. It is a picture. It does not establish who
 *     drew it, that they meant to agree to anything, or what the thing they
 *     were agreeing to said — an unattended tablet in a lobby produces the same
 *     artefact as a deliberate act by the named party. E-SIGN, UETA and eIDAS
 *     all care about intent, attribution and association with the record
 *     signed; a stroke list addresses none of the three.
 *
 * ★★★ AND THE HASH IS NOT TAMPER-EVIDENCE. It is computed in the signer's own
 *     browser by the party being attested, so anyone who can change the strokes
 *     can change the digest. What it is worth having for is the other thing:
 *     it **binds the consent wording to the artefact**, which is the flaw in
 *     essentially every home-grown version — those hash the image and prove
 *     nothing about what was agreed to. The tests below are mostly about that
 *     binding, and about the three cases where the component refuses to produce
 *     a record at all rather than producing a hollow one.
 * ============================================================================
 */

async function setup(inputs: Partial<ComponentInput<SvSignaturePadComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvSignaturePadComponent, {
    inputs: inputs as ComponentInput<SvSignaturePadComponent>,
  });
  return { ...r, pad: r.fixture.componentInstance };
}

const CONSENT = 'By signing I agree to the terms of service dated 2026-01-01.';
const AT = new Date('2026-09-13T10:00:00.000Z');

/** A value with one real (multi-point) stroke, which `isSigned` accepts. */
const signedValue = (over: Partial<SignatureValue> = {}): SignatureValue => ({
  strokes: [
    {
      points: [
        { x: 1.004, y: 2, pressure: 0.5 },
        { x: 3, y: 4, pressure: 0.5 },
      ],
    },
  ],
  width: 300,
  height: 120,
  typedName: '',
  ...over,
});

describe('svSignatureRecord — the bytes that get hashed', () => {
  it('includes the consent text, which is the whole point', async () => {
    // ★★★ A digest over the image alone says somebody drew a shape. This is
    //     what makes it say what they were agreeing to when they drew it.
    const a = svSignatureRecord(signedValue(), CONSENT, AT.toISOString());
    const b = svSignatureRecord(signedValue(), 'Something else entirely', AT.toISOString());
    expect(a).toContain(CONSENT);
    expect(a).not.toBe(b);
  });

  it('changes when the strokes change', () => {
    const moved = signedValue({
      strokes: [{ points: [{ x: 9, y: 2, pressure: 0.5 }, { x: 3, y: 4, pressure: 0.5 }] }],
    });
    expect(svSignatureRecord(signedValue(), CONSENT, AT.toISOString()))
      .not.toBe(svSignatureRecord(moved, CONSENT, AT.toISOString()));
  });

  it('changes when the typed name changes', () => {
    // The typed name is the more legally meaningful half of this control, so a
    // record that ignored it would bind the weaker artefact and not the other.
    expect(svSignatureRecord(signedValue({ typedName: 'Ada' }), CONSENT, AT.toISOString()))
      .not.toBe(svSignatureRecord(signedValue({ typedName: 'Grace' }), CONSENT, AT.toISOString()));
  });

  it('survives sub-pixel jitter, because coordinates are rounded to 2dp', () => {
    /**
     * ★★ Points come from pointer events as floats. A device-pixel-ratio
     *    change, a rescale for a print view, or a round trip through a column
     *    with different precision all perturb the last digits. At 2dp of a CSS
     *    pixel the drawing is identical to any eye — so the digest has to
     *    survive the trip, or every stored record fails verification for
     *    reasons that look exactly like tampering.
     */
    const jittered = signedValue({
      strokes: [{ points: [{ x: 1.0041, y: 2, pressure: 0.5 }, { x: 3, y: 4, pressure: 0.5 }] }],
    });
    expect(svSignatureRecord(jittered, CONSENT, AT.toISOString()))
      .toBe(svSignatureRecord(signedValue(), CONSENT, AT.toISOString()));
  });

  it('does not survive a change a person could see', () => {
    // The other half of the rounding claim: it must not round away real motion.
    const real = signedValue({
      strokes: [{ points: [{ x: 1.5, y: 2, pressure: 0.5 }, { x: 3, y: 4, pressure: 0.5 }] }],
    });
    expect(svSignatureRecord(real, CONSENT, AT.toISOString()))
      .not.toBe(svSignatureRecord(signedValue(), CONSENT, AT.toISOString()));
  });

  it('sorts signer keys, so two hosts building the same facts agree', () => {
    // ★ Object key order is insertion order. Without sorting, the same metadata
    //   assembled in a different order hashes differently — and the failure
    //   presents as a verification mismatch, which reads as tampering.
    const one = svSignatureRecord(signedValue(), CONSENT, AT.toISOString(), { b: '2', a: '1' });
    const two = svSignatureRecord(signedValue(), CONSENT, AT.toISOString(), { a: '1', b: '2' });
    expect(one).toBe(two);
  });

  it('still changes when the signer metadata changes', () => {
    expect(svSignatureRecord(signedValue(), CONSENT, AT.toISOString(), { user: '1' }))
      .not.toBe(svSignatureRecord(signedValue(), CONSENT, AT.toISOString(), { user: '2' }));
  });

  it('carries a format version', () => {
    // ★★ A canonical serialisation with no version can never change: the day a
    //    field is added, every stored hash silently stops verifying with no way
    //    to tell that from tampering.
    expect(svSignatureRecord(signedValue(), CONSENT, AT.toISOString()))
      .toContain(`format:${SV_SIGNATURE_RECORD_FORMAT}`);
  });

  it('is reproducible from the source, which is why it is exported', async () => {
    // A digest nobody can recompute is a digest nobody can check. A server, in
    // another language, five years later, has to be able to implement this.
    const record = svSignatureRecord(signedValue(), CONSENT, AT.toISOString());
    expect(await svSignatureHash(record)).toBe(await svSignatureHash(record));
  });
});

describe('attest()', () => {
  it('refuses when nothing has been signed', async () => {
    const { pad } = await setup({ consentText: CONSENT });
    expect(await pad.attest(AT)).toBeNull();
  });

  it('refuses when there is no consent text', async () => {
    /**
     * ★★★ A RECORD WITH AN EMPTY CONSENT FIELD ATTESTS TO NOTHING — it says
     *     somebody drew a shape at a time. Producing one anyway would let a
     *     host believe they had evidence, which is the failure this whole item
     *     is about.
     */
    const { pad } = await setup();
    pad.setValue(signedValue());
    expect(pad.signed()).toBe(true);
    expect(await pad.attest(AT)).toBeNull();
  });

  it('refuses on whitespace-only consent text', async () => {
    const { pad } = await setup({ consentText: '   ' });
    pad.setValue(signedValue());
    expect(await pad.attest(AT)).toBeNull();
  });

  it('produces a complete record when it has everything', async () => {
    const { pad } = await setup({ consentText: CONSENT, signerMetadata: { userId: 'u-1' } });
    pad.setValue(signedValue({ typedName: 'Ada Lovelace' }));

    const a = (await pad.attest(AT))!;
    expect(a.consentText).toBe(CONSENT);
    expect(a.signedAt).toBe('2026-09-13T10:00:00.000Z');
    expect(a.hashAlgorithm).toBe('SHA-256');
    expect(a.recordFormat).toBe(SV_SIGNATURE_RECORD_FORMAT);
    expect(a.signer).toEqual({ userId: 'u-1' });
    // Lower-case hex, 32 bytes.
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('attests a typed name with no strokes at all', async () => {
    // The keyboard-accessible route (`FI-21-M2`) has to produce a record too,
    // or the alternative is an alternative to the field and not to the act.
    const { pad } = await setup({ consentText: CONSENT });
    pad.setValue(signedValue({ strokes: [], typedName: 'Ada Lovelace' }));
    expect((await pad.attest(AT))!.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives two different signings two different digests', async () => {
    const { pad } = await setup({ consentText: CONSENT });
    pad.setValue(signedValue());
    const first = (await pad.attest(AT))!;
    const later = (await pad.attest(new Date('2026-09-13T10:00:01.000Z')))!;
    expect(later.hash).not.toBe(first.hash);
  });
});

describe('signedValue()', () => {
  it('returns one object a host can send', async () => {
    const { pad } = await setup({ consentText: CONSENT });
    pad.setValue(signedValue());
    const v = await pad.signedValue(AT);
    expect(v.attestation?.consentText).toBe(CONSENT);
    expect(v.strokes).toHaveLength(1);
  });

  it('returns the plain value when no attestation can be produced', async () => {
    // Not an error and not a throw: a pad with no consent text is a perfectly
    // ordinary signature pad, and this method is the one a host calls anyway.
    const { pad } = await setup();
    pad.setValue(signedValue());
    const v = await pad.signedValue(AT);
    expect(v.attestation).toBeUndefined();
    expect(v.strokes).toHaveLength(1);
  });
});

describe('svVerifySignature — for whoever reads the record back', () => {
  it('confirms a record that has not moved', async () => {
    const { pad } = await setup({ consentText: CONSENT, signerMetadata: { userId: 'u-1' } });
    pad.setValue(signedValue({ typedName: 'Ada' }));
    expect(await svVerifySignature(await pad.signedValue(AT))).toBe('ok');
  });

  it('catches a record whose consent wording was swapped', async () => {
    // ★★★ THE CLAIM THE WHOLE FEATURE EXISTS FOR. Pairing a stored signature
    //     with different terms is the thing a hash over the image alone cannot
    //     see, and it is the manipulation that matters in a dispute.
    const { pad } = await setup({ consentText: CONSENT });
    pad.setValue(signedValue());
    const v = await pad.signedValue(AT);

    const tampered: SignatureValue = {
      ...v,
      attestation: { ...v.attestation!, consentText: 'You agree to pay us £10,000.' },
    };
    expect(await svVerifySignature(tampered)).toBe('mismatch');
  });

  it('catches strokes that changed under a kept attestation', async () => {
    const { pad } = await setup({ consentText: CONSENT });
    pad.setValue(signedValue());
    const v = await pad.signedValue(AT);

    const redrawn: SignatureValue = {
      ...v,
      strokes: [{ points: [{ x: 50, y: 50, pressure: 1 }, { x: 60, y: 60, pressure: 1 }] }],
    };
    expect(await svVerifySignature(redrawn)).toBe('mismatch');
  });

  it('catches a dropped typed name — the round trip nobody tests', async () => {
    const { pad } = await setup({ consentText: CONSENT });
    pad.setValue(signedValue({ typedName: 'Ada Lovelace' }));
    const v = await pad.signedValue(AT);
    expect(await svVerifySignature({ ...v, typedName: '' })).toBe('mismatch');
  });

  it('reports an unknown format as such, not as a failure', async () => {
    /**
     * ★★ A FORMAT MISMATCH IS NOT A FAILED VERIFICATION, and reporting it as
     *    one turns a deployment mistake — an old record read by a new build —
     *    into an accusation against a signer.
     */
    const { pad } = await setup({ consentText: CONSENT });
    pad.setValue(signedValue());
    const v = await pad.signedValue(AT);
    const old = {
      ...v,
      attestation: { ...v.attestation!, recordFormat: 'sv-signature-v0' as never },
    };
    expect(await svVerifySignature(old)).toBe('unknown-format');
  });

  it('says so plainly when there is no attestation', async () => {
    expect(await svVerifySignature(signedValue())).toBe('no-attestation');
  });
});

describe('the consent text on screen', () => {
  it('renders above the pad and is described by both inputs', async () => {
    /**
     * ★★★ IT HAS TO BE READABLE BEFORE THE ACT. "I didn't see that" is the
     *     whole substance of a disputed e-signature, and a sentence under the
     *     canvas is one a signer on a phone reaches only by scrolling past the
     *     thing they came to do.
     */
    const { fixture, pad } = await setup({ consentText: CONSENT });
    const root = fixture.nativeElement as HTMLElement;

    const paragraph = root.querySelector(`#${pad.consentId}`);
    expect(paragraph?.textContent).toContain(CONSENT);

    // It precedes the canvas in document order, which is what "above" means to
    // a screen reader as well as to an eye.
    const canvas = root.querySelector('canvas')!;
    expect(paragraph!.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();

    expect(canvas.getAttribute('aria-describedby')).toBe(pad.consentId);
    expect(root.querySelector(`#${pad.typedNameId}`)!.getAttribute('aria-describedby'))
      .toBe(pad.consentId);
  });

  it('renders nothing, and describes nothing, when there is no consent text', async () => {
    const { fixture, pad } = await setup();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector(`#${pad.consentId}`)).toBeNull();
    expect(root.querySelector('canvas')!.getAttribute('aria-describedby')).toBeNull();
  });
});
