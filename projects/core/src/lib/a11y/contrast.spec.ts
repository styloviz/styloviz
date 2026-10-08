import {
  svColorName,
  svContrastRatio,
  svFormatRatio,
  svRelativeLuminance,
  svWcagGrade,
} from './contrast';

/**
 * `FI-08-M1` / `FI-08-M2` — the contrast maths, and saying a colour out loud.
 *
 * ★★★ THIS CODE ALREADY EXISTED, IN THE APP. `theme-builder.color.ts` carried a
 *     complete WCAG audit that no library could import, so the colour picker's
 *     own contrast item was one copy-paste from becoming the kit's SECOND
 *     contrast checker. Two of them drift until a designer's audit and a
 *     component's badge disagree about the same pair of colours. It moved here;
 *     the theme builder re-exports it under its old names.
 */

describe('svContrastRatio — the numbers an auditor will use', () => {
  it('gives black on white the maximum', () => {
    expect(svContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('gives a colour against itself the minimum', () => {
    expect(svContrastRatio('#3b82f6', '#3b82f6')).toBeCloseTo(1, 5);
  });

  it('does not care which argument is the foreground', () => {
    expect(svContrastRatio('#767676', '#ffffff')).toBeCloseTo(
      svContrastRatio('#ffffff', '#767676'), 10,
    );
  });

  it('puts #767676 on white exactly on the 4.5 line, as the WCAG examples do', () => {
    // The canonical "smallest grey that passes AA on white". A rounding change
    // anywhere in the luminance chain shows up here first.
    expect(svContrastRatio('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(svContrastRatio('#777777', '#ffffff')).toBeLessThan(4.5);
  });

  it('reads shorthand hex and a missing #', () => {
    expect(svContrastRatio('#fff', '000')).toBeCloseTo(21, 5);
  });

  it('weights green far above blue, which is what makes yellow text unreadable', () => {
    expect(svRelativeLuminance({ r: 0, g: 255, b: 0 }))
      .toBeGreaterThan(svRelativeLuminance({ r: 0, g: 0, b: 255 }));
  });
});

describe('svWcagGrade / svFormatRatio', () => {
  it('grades on the thresholds, inclusive', () => {
    expect(svWcagGrade(7)).toBe('AAA');
    expect(svWcagGrade(6.99)).toBe('AA');
    expect(svWcagGrade(4.5)).toBe('AA');
    expect(svWcagGrade(4.49)).toBe('AA Large');
    expect(svWcagGrade(3)).toBe('AA Large');
    expect(svWcagGrade(2.99)).toBe('Fail');
  });

  it('floors rather than rounding, so it cannot report a pass that is a fail', () => {
    // ★★★ `4.47` printed as "4.5:1" beside a green AA badge is a component
    //     telling a designer their text passes when it does not — and the error
    //     is invisible precisely because the number looks like the threshold.
    expect(svFormatRatio(4.47)).toBe('4.4:1');
    expect(svFormatRatio(4.5)).toBe('4.5:1');
  });
});

describe('svColorName — a hex is not an announcement', () => {
  it('names the primaries', () => {
    expect(svColorName('#ff0000')).toBe('vivid red');
    expect(svColorName('#00ff00')).toBe('vivid green');
    expect(svColorName('#0000ff')).toBe('vivid blue');
  });

  it('names the achromatics by lightness, with no hue invented', () => {
    expect(svColorName('#000000')).toBe('black');
    expect(svColorName('#ffffff')).toBe('white');
    expect(svColorName('#808080')).toBe('grey');
    expect(svColorName('#222222')).toBe('dark grey');
    expect(svColorName('#e8e8e8')).toBe('light grey');
  });

  it('qualifies by lightness and saturation, in the order people say them', () => {
    // "pale muted blue", never "muted pale blue".
    const name = svColorName('#c3d4e8');
    expect(name).toContain('blue');
    expect(name.startsWith('pale')).toBe(true);
  });

  it('distinguishes hues a hex code cannot', () => {
    const names = ['#ff0000', '#ff8800', '#ffee00', '#00b3b3', '#7a00cc'].map(svColorName);
    expect(new Set(names).size).toBe(5);
  });

  it('says something usable for a near-grey with a trace of hue', () => {
    // The case a 148-entry CSS colour table answers with "LightSlateGray" —
    // a name for a hex code rather than a description of a colour.
    const name = svColorName('#6b7280');
    expect(name).toMatch(/grey|muted/);
  });
});
