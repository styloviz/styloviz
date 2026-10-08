import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvSignaturePadComponent } from './signature-pad.component';
import { isSigned, isSignatureEmpty, type SignatureStroke } from './signature-pad.types';

/**
 * `FI-21-M2` — a required field with no path through it.
 *
 * ★★★ A `<canvas>` YOU MUST DRAW ON CANNOT BE OPERATED FROM A KEYBOARD. Not "is
 *     awkward to" — cannot. A screen-reader user, a keyboard-only user and
 *     anyone with a tremor met a control they could not complete, and WCAG 2.1.1
 *     has no partial credit. Everything else about this component — the stroke
 *     model, the DPR handling, the SVG export — was care lavished on a field
 *     some people could not fill in.
 *
 * ★★ AND THE TYPED NAME IS THE MORE LEGALLY MEANINGFUL OF THE TWO. E-SIGN and
 *    eIDAS care about intent and attribution, not ink: a drawn squiggle from an
 *    unattended tablet proves less than a typed name attached to an
 *    authenticated session. The component carries both and lets the host decide
 *    which it relies on.
 */

async function setup(inputs: Partial<ComponentInput<SvSignaturePadComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvSignaturePadComponent, {
    inputs: inputs as ComponentInput<SvSignaturePadComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const nameField = (h: HTMLElement) => h.querySelector<HTMLInputElement>('input[type="text"]');

const STROKE: SignatureStroke = {
  points: [
    { x: 1, y: 1, pressure: 0.5 },
    { x: 9, y: 9, pressure: 0.5 },
  ],
};

describe('isSigned — the field, not the canvas', () => {
  it('is false for nothing at all', () => {
    expect(isSigned([], '')).toBe(false);
  });

  it('is true for a drawn mark with no typed name', () => {
    expect(isSigned([STROKE], '')).toBe(true);
  });

  it('is true for a typed name with nothing drawn', () => {
    expect(isSigned([], 'Ada Lovelace')).toBe(true);
  });

  it('does not count whitespace as a name', () => {
    expect(isSigned([], '   ')).toBe(false);
  });

  it('stays separate from isSignatureEmpty, which is about the canvas', () => {
    // ★ A typed name completes the FIELD and leaves nothing to undo or export.
    //   Collapsing the two would make "Undo" enabled with no stroke behind it.
    expect(isSignatureEmpty([])).toBe(true);
    expect(isSigned([], 'Ada Lovelace')).toBe(true);
  });
});

describe('SvSignaturePadComponent — the typed-name field', () => {
  it('is offered by default, because the alternative is a field some people cannot complete', async () => {
    const { fixture } = await setup();
    expect(nameField(el(fixture))).not.toBeNull();
  });

  it('has a real label pointing at it', async () => {
    // ★ Unlike the canvas, which is named by `aria-label` because it has no text
    //   and nothing to associate — here there IS a single control to point at.
    const { fixture } = await setup({ typedNameLabel: 'Or type your full name' });
    const host = el(fixture);
    const label = host.querySelector('label');
    expect(label?.textContent?.trim()).toBe('Or type your full name');
    expect(label?.getAttribute('for')).toBe(nameField(host)!.id);
  });

  it('gives two pads different ids, so two labels do not point at one field', async () => {
    // Both pads must share one application: ids are per application (svUniqueId).
    const a = await setup();
    const b = TestBed.createComponent(SvSignaturePadComponent);
    b.detectChanges();
    await b.whenStable();
    expect(nameField(el(a.fixture))!.id).not.toBe(nameField(el(b))!.id);
  });

  it('can be turned off for a host that provides its own route', async () => {
    const { fixture } = await setup({ allowTyped: false });
    expect(nameField(el(fixture))).toBeNull();
  });

  it('carries the typed name in the value', async () => {
    const { fixture } = await setup();
    fixture.componentInstance.typedName.set('Ada Lovelace');
    expect(fixture.componentInstance.value().typedName).toBe('Ada Lovelace');
  });

  it('reports the field as signed once a name is typed', async () => {
    const { fixture } = await setup();
    const c = fixture.componentInstance;
    expect(c.signed()).toBe(false);
    c.typedName.set('Ada Lovelace');
    expect(c.signed()).toBe(true);
    // Still nothing on the canvas — the two questions stay separate.
    expect(c.isEmpty()).toBe(true);
  });

  it('tells a host wired to emptyChange that the field is no longer empty', async () => {
    // ★★ The case that matters: a submit button disabled on `emptyChange` must
    //    not stay disabled for somebody who typed their name.
    const seen: boolean[] = [];
    TestBed.resetTestingModule();
    const { fixture } = await render(SvSignaturePadComponent, {
      inputs: {} as ComponentInput<SvSignaturePadComponent>,
      on: { emptyChange: (v: boolean) => seen.push(v) },
    });
    const field = nameField(el(fixture))!;
    field.value = 'Ada Lovelace';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(seen.at(-1)).toBe(false);
  });

  it('restores the typed name when a stored signature is replayed', async () => {
    // Dropping it would silently discard the half some hosts rely on as the
    // attestation.
    const { fixture } = await setup();
    fixture.componentInstance.setValue({
      strokes: [], width: 300, height: 120, typedName: 'Grace Hopper',
    });
    expect(fixture.componentInstance.typedName()).toBe('Grace Hopper');
  });

  it('treats a stored value with no typedName as an empty one, not undefined', async () => {
    // ★ The field is OPTIONAL on the published type — making it required broke
    //   every existing construction site, including three specs in this repo,
    //   in exchange for nothing. So a value built before this existed still
    //   replays, and lands as '' rather than leaking `undefined` into a form.
    const { fixture } = await setup();
    fixture.componentInstance.setValue({ strokes: [], width: 300, height: 120 });
    expect(fixture.componentInstance.typedName()).toBe('');
  });

  it('exports nothing from an empty canvas even when a name is typed', async () => {
    // ★ `toSvgString` is about the drawing. A typed name is not a vector, and
    //   returning an empty SVG here would file a picture of nothing as a
    //   signature.
    const { fixture } = await setup();
    fixture.componentInstance.typedName.set('Ada Lovelace');
    expect(fixture.componentInstance.toSvgString()).toBeNull();
  });
});
