import { render, type ComponentInput } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import { SvSignaturePadComponent } from './signature-pad.component';
import { svVerifySignature, type SignatureValue } from './signature-pad.types';

/**
 * Re-verification of `FI-21-I2` / `FI-21-M1` / `FI-21-M2` (2026-09-26).
 *
 * The docs said `setValue()` "keeps any attestation already on it". It did
 * not: `value()` rebuilt the value from the rescaled strokes and dropped the
 * attestation, and `signedValue()` then minted a fresh one dated to the moment
 * the record was opened.
 */

async function setup(inputs: Partial<ComponentInput<SvSignaturePadComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvSignaturePadComponent, {
    inputs: inputs as ComponentInput<SvSignaturePadComponent>,
  });
  return { ...r, pad: r.fixture.componentInstance };
}

const CONSENT = 'By signing I agree to the terms of service dated 2026-01-01.';
const SIGNED_AT = new Date('2026-01-02T09:00:00.000Z');
const OPENED_AT = new Date('2026-09-26T12:00:00.000Z');

const draft: SignatureValue = {
  strokes: [{ points: [{ x: 10, y: 20, pressure: 0.5 }, { x: 30, y: 40, pressure: 0.5 }] }],
  width: 300,
  height: 120,
  typedName: 'Ada Lovelace',
};

/** A stored record: signed in one pad, persisted, reopened in another. */
async function storedRecord(): Promise<SignatureValue> {
  const { pad } = await setup({ consentText: CONSENT });
  pad.setValue(draft);
  return pad.signedValue(SIGNED_AT);
}

describe('setValue keeps an existing attestation (FI-21-I2)', () => {
  it('value() still carries it, and it still verifies', async () => {
    const record = await storedRecord();
    const { pad } = await setup({ consentText: CONSENT });
    pad.setValue(record);

    expect(pad.value().attestation).toEqual(record.attestation);
    expect(await svVerifySignature(pad.value())).toBe('ok');
  });

  it('signedValue() returns it rather than re-dating the record on load', async () => {
    const record = await storedRecord();
    const { pad } = await setup({ consentText: CONSENT });
    pad.setValue(record);

    const again = await pad.signedValue(OPENED_AT);
    expect(again.attestation?.signedAt).toBe('2026-01-02T09:00:00.000Z');
    expect(again.attestation?.hash).toBe(record.attestation?.hash);
  });

  it('drops it once the signer changes what is signed', async () => {
    const record = await storedRecord();
    const { pad, fixture } = await setup({ consentText: CONSENT });
    pad.setValue(record);

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(`#${pad.typedNameId}`)!;
    input.value = 'Grace Hopper';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(pad.value().attestation).toBeUndefined();
    const fresh = await pad.signedValue(OPENED_AT);
    expect(fresh.attestation?.signedAt).toBe('2026-09-26T12:00:00.000Z');
    expect(await svVerifySignature(fresh)).toBe('ok');
  });

  it('drops it on clear()', async () => {
    const record = await storedRecord();
    const { pad } = await setup({ consentText: CONSENT });
    pad.setValue(record);
    pad.clear();
    expect(pad.value().attestation).toBeUndefined();
  });

  it('keeps nothing for a value that came without one', async () => {
    const { pad } = await setup({ consentText: CONSENT });
    pad.setValue(draft);
    expect(pad.value().attestation).toBeUndefined();
  });
});

describe('the typed-name field is described by the hint (FI-21-M2)', () => {
  it('links both the consent wording and the hint', async () => {
    const hint = 'By typing my name I agree this is my signature.';
    const { fixture, pad } = await setup({ consentText: CONSENT, hint });
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector(`#${pad.typedNameId}`)!;

    expect(input.getAttribute('aria-describedby')).toBe(`${pad.consentId} ${pad.hintId}`);
    expect(root.querySelector(`#${pad.hintId}`)?.textContent).toContain(hint);
  });

  it('links the hint alone when there is no consent text', async () => {
    const { fixture, pad } = await setup({ hint: 'Type your legal name.' });
    const input = (fixture.nativeElement as HTMLElement).querySelector(`#${pad.typedNameId}`)!;
    expect(input.getAttribute('aria-describedby')).toBe(pad.hintId);
  });
});
