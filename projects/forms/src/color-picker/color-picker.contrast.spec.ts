import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvColorPickerComponent } from './color-picker.component';

/**
 * `FI-08-I2` / `FI-08-M1` / `FI-08-M2` — the picker had no opinion about the
 * colour it was helping you choose.
 *
 * ★★★ A PICKER THAT LETS YOU CHOOSE AN UNREADABLE PAIR WITHOUT SAYING SO IS A
 *     COMPONENT THAT MANUFACTURES ACCESSIBILITY BUGS. Somebody picks a pleasant
 *     mid-grey for body text on white, ships it, and finds out at audit — from a
 *     tool that was nowhere near the moment the decision was made. The number
 *     costs nothing to show while it can still change the answer.
 *
 * ★★★ AND `#3B82F6` IS NOT AN ANNOUNCEMENT. A screen reader reads it one
 *     character at a time; the user learns nothing about what they picked.
 */

async function setup(inputs: Partial<ComponentInput<SvColorPickerComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvColorPickerComponent, { inputs: inputs as ComponentInput<SvColorPickerComponent> });
}

/** The panel is portalled to `document.body`, so open it and look there. */
async function open(fixture: { nativeElement: unknown; detectChanges(): void }) {
  const trigger = (fixture.nativeElement as HTMLElement).querySelector('button')!;
  await userEvent.click(trigger);
  fixture.detectChanges();
}

afterEach(() => document.querySelectorAll('.cp-panel').forEach(n => n.parentElement?.remove()));

describe('SvColorPickerComponent — contrast against a background', () => {
  it('says nothing unless a background is supplied', async () => {
    const { fixture } = await setup({ value: '#767676' });
    expect(fixture.componentInstance.hasContrast()).toBe(false);
    expect(fixture.componentInstance.contrastSummary()).toBe('');
  });

  it('reports the ratio and what it means in words', async () => {
    const { fixture } = await setup({ value: '#767676', contrastBackground: '#ffffff' });
    const c = fixture.componentInstance;
    expect(c.hasContrast()).toBe(true);
    expect(c.contrastGrade()).toBe('AA');
    expect(c.contrastSummary()).toBe('Contrast 4.5:1 — passes AA for body text');
  });

  it('calls a failing pair a failure, in a sentence', async () => {
    // ★★ "2.8:1, Fail" is a fact a specialist can read. "Fails WCAG for any text
    //    size" is the same fact to everybody else — and the person choosing a
    //    colour is usually the second kind of reader.
    const { fixture } = await setup({ value: '#aaaaaa', contrastBackground: '#ffffff' });
    expect(fixture.componentInstance.contrastSummary()).toContain('fails WCAG for any text size');
  });

  it('distinguishes large-text-only from a real pass', async () => {
    const { fixture } = await setup({ value: '#949494', contrastBackground: '#ffffff' });
    expect(fixture.componentInstance.contrastGrade()).toBe('AA Large');
    expect(fixture.componentInstance.contrastSummary()).toContain('large text only');
  });

  it('does not carry the verdict in colour alone', async () => {
    // The chip is coloured AND worded. A red chip reading "4.1:1" tells a
    // colour-blind designer nothing the sentence does not already say.
    const { fixture } = await setup({ value: '#aaaaaa', contrastBackground: '#ffffff' });
    await open(fixture);
    const chip = [...document.querySelectorAll('[role="status"]')]
      .find(e => e.className.includes('ring-1'));
    expect(chip?.textContent).toContain('fails');
  });

  it('ignores a background that is not a colour, rather than reporting 1:1', async () => {
    const { fixture } = await setup({ value: '#767676', contrastBackground: 'not a colour' });
    expect(fixture.componentInstance.hasContrast()).toBe(false);
  });

  it('follows the gradient as it moves', async () => {
    const { fixture } = await setup({ value: '#ffffff', contrastBackground: '#ffffff' });
    const c = fixture.componentInstance;
    expect(c.contrastGrade()).toBe('Fail');
    c.brightness.set(0);
    fixture.detectChanges();
    expect(c.contrastGrade()).toBe('AAA');
  });
});

describe('SvColorPickerComponent — saying the colour out loud', () => {
  it('names the colour and keeps the code after it', async () => {
    const { fixture } = await setup({ value: '#ff0000', label: 'Brand' });
    expect(fixture.componentInstance.triggerAriaLabel()).toBe('Brand: vivid red, #ff0000');
  });

  it('renames as the colour changes', async () => {
    const { fixture } = await setup({ value: '#ff0000' });
    const c = fixture.componentInstance;
    expect(c.colorName()).toBe('vivid red');
    c.hue.set(120);
    fixture.detectChanges();
    expect(c.colorName()).toBe('vivid green');
  });

  it('lets a host supply its own namer, because a component cannot translate', async () => {
    const { fixture } = await setup({
      value: '#ff0000',
      colorNamer: () => 'rouge vif',
    });
    expect(fixture.componentInstance.colorName()).toBe('rouge vif');
    expect(fixture.componentInstance.triggerAriaLabel()).toContain('rouge vif');
  });

  it('puts the name where a reader will meet it', async () => {
    const { fixture } = await setup({ value: '#ff0000' });
    await open(fixture);
    const said = [...document.querySelectorAll('.sr-only')].map(e => e.textContent?.trim());
    expect(said).toContain('vivid red');
  });
});

describe('SvColorPickerComponent — re-verification 2026-09-26', () => {
  it('composites a translucent colour over the background before grading it', async () => {
    // 🔺 30 %-opaque black on white is a light grey. Graded from the opaque hex it
    //    reported 21:1 AAA; the reader sees roughly 2:1.
    const { fixture } = await setup({ value: '#000000', contrastBackground: '#ffffff', showAlpha: true });
    const c = fixture.componentInstance;
    expect(c.contrastGrade()).toBe('AAA');
    c.alpha.set(0.3);
    fixture.detectChanges();
    expect(c.contrastForeground()).toBe('#b3b3b3');
    expect(c.contrastGrade()).toBe('Fail');
    await open(fixture);
    const chip = [...document.querySelectorAll('[role="status"]')].find(e => e.className.includes('ring-1'));
    expect(chip?.textContent).toContain('fails WCAG for any text size');
  });

  it('ignores alpha when the alpha channel is not shown', async () => {
    const { fixture } = await setup({ value: '#000000', contrastBackground: 'fff' });
    fixture.componentInstance.alpha.set(0.3);
    expect(fixture.componentInstance.contrastGrade()).toBe('AAA');
  });

  it('gives the rendered hue rail a value text with a unit and the colour name', async () => {
    const { fixture } = await setup({ value: '#ff0000' });
    await open(fixture);
    const hue = document.querySelector('[role="slider"][aria-label="Hue"]')!;
    expect(hue.getAttribute('aria-valuetext')).toBe('0 degrees, vivid red');
  });
});
