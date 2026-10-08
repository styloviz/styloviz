import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvInputMaskComponent } from './input-mask.component';

/**
 * ============================================================================
 *  The unmasked value, and who gets to see it  ·  `FI-13-I1` / `FI-13-M3`
 * ============================================================================
 *
 * ★★★ FORMATTING A CARD NUMBER PUTS THE HOST'S PAGE IN PCI SCOPE. A payment
 *     page that never touches the PAN — an iframe or a hosted field from the
 *     processor — is SAQ-A. The moment a script on the merchant's own page can
 *     read the digits it is SAQ-A-EP: a different questionnaire, a wider scope,
 *     and every other script on that page inside it. `<sv-input-mask
 *     preset="credit-card">` is such a script. That is a consequence, not a
 *     defect — but nobody should first learn it from an assessor.
 *
 * ★★★ AND THE LEAK NOBODY PLANS FOR IS SESSION REPLAY. FullStory, Hotjar,
 *     Datadog RUM, Clarity, Smartlook and LogRocket record the DOM and ship it
 *     to a third party. A field that is "masked" is masked to the EYE; a replay
 *     recorder reads the value attribute like any other. Without an opt-out the
 *     PAN leaves the page in clear text to a vendor who appears in nobody's
 *     scope document — and it does so from a component whose whole visible job
 *     is to make the number look handled.
 *
 * ★★ These tests are mostly about ATTRIBUTES, which is unusual and is the
 *    point: there is no standard here, each recorder reads only its own opt-out,
 *    and the failure of any one of them is silent by construction. A missing
 *    attribute cannot be noticed by looking at the page.
 * ============================================================================
 */

async function setup(inputs: Partial<ComponentInput<SvInputMaskComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvInputMaskComponent, {
    inputs: inputs as ComponentInput<SvInputMaskComponent>,
  });
  const input = (r.fixture.nativeElement as HTMLElement).querySelector('input')!;
  return { ...r, input, component: r.fixture.componentInstance };
}

/** Every recorder opt-out the component is responsible for setting. */
const SUPPRESSION_ATTRS = [
  'data-private',        // LogRocket
  'data-dd-privacy',     // Datadog RUM
  'data-hj-suppress',    // Hotjar
  'data-clarity-mask',   // Microsoft Clarity
  'data-sl',             // Smartlook
  'data-recording-sensitive',
] as const;

describe('a sensitive preset', () => {
  it('opts out of every session-replay recorder', async () => {
    const { input } = await setup({ preset: 'credit-card' });
    for (const attr of SUPPRESSION_ATTRS) {
      expect(input.hasAttribute(attr), attr).toBe(true);
    }
    // FullStory's API is classes, not attributes — which is exactly the kind of
    // per-vendor detail an integrator should not have to know.
    expect(input.className).toContain('fs-mask');
    expect(input.className).toContain('fs-exclude');
  });

  it('covers the SSN preset too, not just cards', async () => {
    const { input } = await setup({ preset: 'ssn' });
    for (const attr of SUPPRESSION_ATTRS) {
      expect(input.hasAttribute(attr), attr).toBe(true);
    }
  });

  it('suppresses browser autofill', async () => {
    const { input } = await setup({ preset: 'credit-card' });
    expect(input.getAttribute('autocomplete')).toBe('off');
  });
});

describe('an ordinary preset', () => {
  it('carries none of the suppression attributes', async () => {
    // ★★ The negative matters as much as the positive. Marking every field
    //    sensitive would train hosts to ignore the marking, and it would strip
    //    session replay of the ordinary form-completion data it is bought for.
    const { input } = await setup({ preset: 'phone-us' });
    for (const attr of SUPPRESSION_ATTRS) {
      expect(input.hasAttribute(attr), attr).toBe(false);
    }
    expect(input.className).not.toContain('fs-mask');
  });

  it('gets a USEFUL autocomplete token rather than a blanket "off"', async () => {
    // 🔺 The previous behaviour was `autocomplete="off"` hardcoded for every
    //    preset, which was wrong in both directions: on a phone or ZIP field it
    //    denies a real convenience and browsers largely ignore it anyway, and on
    //    a card field it is the right instruction and is ALSO widely ignored —
    //    which is why the attributes above are not optional.
    expect((await setup({ preset: 'phone-us' })).input.getAttribute('autocomplete')).toBe('tel');
    expect((await setup({ preset: 'phone-intl' })).input.getAttribute('autocomplete')).toBe('tel');
    expect((await setup({ preset: 'zip' })).input.getAttribute('autocomplete')).toBe('postal-code');
  });

  it('still says "off" where there is no sensible token', async () => {
    expect((await setup({ preset: 'ip' })).input.getAttribute('autocomplete')).toBe('off');
  });
});

describe('the sensitivity input', () => {
  it('lets a custom mask declare itself sensitive', async () => {
    // A national ID, a policy number, a date of birth — the preset list cannot
    // know about these, and `'auto'` would call them ordinary.
    const { input } = await setup({ preset: 'custom', customMask: '###-###-###', sensitivity: 'sensitive' });
    expect(input.hasAttribute('data-dd-privacy')).toBe(true);
    expect(input.getAttribute('autocomplete')).toBe('off');
  });

  it('lets a host opt a card field OUT, deliberately', async () => {
    // The escape hatch exists because a test fixture or a demo may want the
    // recording. It has to be said out loud, which is the difference between a
    // decision and an accident.
    const { input } = await setup({ preset: 'credit-card', sensitivity: 'ordinary' });
    expect(input.hasAttribute('data-dd-privacy')).toBe(false);
  });
});

describe('maskedValue — so a host never needs the real one', () => {
  /**
   * ★★★ "WHO HOLDS THE UNMASKED VALUE" IS ANSWERED BADLY BY A POLICY DOCUMENT
   *     AND WELL BY MAKING THE REDACTED FORM THE EASIER THING TO REACH FOR.
   *     A confirmation screen, a log line, an analytics event, a support ticket
   *     and a receipt all want "the card ending 4242" — and every one of them
   *     is somewhere a full PAN ends up when the only value on offer is the
   *     full PAN.
   */
  it('keeps the separators so the shape still reads', async () => {
    const { component } = await setup({ preset: 'credit-card', value: '4242 4242 4242 4242' });
    expect(component.maskedValue()).toBe('•••• •••• •••• 4242');
  });

  it('works for an SSN, where the separators are different', async () => {
    const { component } = await setup({ preset: 'ssn', value: '123-45-6789' });
    expect(component.maskedValue()).toBe('•••-••-6789');
  });

  it('redacts EVERYTHING when there are not five digits to spare', async () => {
    // ⚠️ Four digits of a four-digit value is not a redaction. "Show the last
    //    four" applied blindly to a short value publishes it whole — which is
    //    the failure mode of every hand-rolled version of this function.
    const { component } = await setup({ preset: 'custom', customMask: '####', value: '4242' });
    expect(component.maskedValue()).toBe('••••');
    expect(component.last4()).toBe('');
  });

  it('is empty for an empty field', async () => {
    const { component } = await setup({ preset: 'credit-card' });
    expect(component.maskedValue()).toBe('');
    expect(component.last4()).toBe('');
  });

  it('gives the last four on their own for a receipt line', async () => {
    const { component } = await setup({ preset: 'credit-card', value: '4242 4242 4242 4111' });
    expect(component.last4()).toBe('4111');
  });

  it('never contains a digit the value does not have in that position', async () => {
    // The redaction must not INVENT digits — a receipt showing the wrong last
    // four is a support call, and a masked value that drifts from the real one
    // is worse than no masked value at all.
    const { component } = await setup({ preset: 'credit-card', value: '4000 0566 5566 5556' });
    const masked = component.maskedValue();
    expect(masked).toHaveLength('4000 0566 5566 5556'.length);
    expect(masked.endsWith('5556')).toBe(true);
    expect(masked.replace(/[•\s]/g, '')).toBe('5556');
  });
});
