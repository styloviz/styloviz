import { svFrames, SV_ASPECT_TOLERANCE } from './image-compare.geometry';

/**
 * Which kind of mismatch, not just that there is one.
 *
 * ★★★ "Different shapes" is a symptom. A pair whose ratios are RECIPROCAL —
 * 4000×3000 against 3000×4000 — is not a reframing at all: it is one file
 * carrying an EXIF orientation tag the other does not, and the answer is to
 * re-export, not to re-crop. Telling that reader their images are "different
 * shapes" sends them to fix the one thing that is not wrong.
 */

describe('svFrames', () => {
  it('says nothing about a pair it has not measured', () => {
    const f = svFrames(0, 0, 0, 0);
    expect(f.verdict).toBe('unknown');
    expect(f.warning).toBe('');
    expect(f.note).toBe('');
  });

  it('says nothing about two files of identical size', () => {
    const f = svFrames(1920, 1080, 1920, 1080);
    expect(f.verdict).toBe('identical');
    expect(f.warning).toBe('');
    expect(f.note).toBe('');
  });

  it('notes a scaled pair without warning about it', () => {
    const f = svFrames(4000, 3000, 800, 600);
    // The wipe IS honest here — same framing, different resolution. Said anyway,
    // because a soft "after" beside a sharp "before" reads as a regression and
    // the cause is the upscale rather than anything in the picture.
    expect(f.verdict).toBe('scaled');
    expect(f.warning).toBe('');
    expect(f.note).toContain('4000×3000 against 800×600');
    expect(f.note).toContain('softer');
  });

  it('diagnoses a quarter turn as EXIF orientation, not a reframing', () => {
    const f = svFrames(4000, 3000, 3000, 4000);
    expect(f.verdict).toBe('rotated');
    expect(f.warning).toContain('quarter turn');
    expect(f.warning).toContain('EXIF');
    // The instruction has to be the RIGHT one.
    expect(f.warning).toContain('re-export');
    expect(f.warning).not.toContain('cropped or stretched');
  });

  it('does not call a square pair rotated', () => {
    // ★ A square is its own reciprocal, so without the guard every square pair
    // would be reported as a quarter turn out.
    const f = svFrames(1000, 1000, 1000, 1000);
    expect(f.verdict).toBe('identical');
    expect(svFrames(1000, 1000, 500, 500).verdict).toBe('scaled');
  });

  it('falls back to a reframing when the shapes genuinely differ', () => {
    const f = svFrames(1600, 1200, 1920, 1080);
    expect(f.verdict).toBe('reshaped');
    expect(f.warning).toContain('different shapes');
    expect(f.warning).not.toContain('EXIF');
  });

  it('keeps the one-percent slack it had, so a one-pixel export is not flagged', () => {
    const f = svFrames(1920, 1080, 1920, 1081);
    expect(f.aspect.mismatched).toBe(false);
    expect(f.verdict).toBe('scaled');
    expect(f.warning).toBe('');
  });

  it('holds the rotation test to the same tolerance', () => {
    // A near-reciprocal pair, off by well under the tolerance, is still a
    // rotation — an EXIF-rotated re-export rarely lands on the exact pixel.
    const nearly = svFrames(4000, 3000, 3000, 4000 * (1 + SV_ASPECT_TOLERANCE / 2));
    expect(nearly.verdict).toBe('rotated');
  });

  it('carries the aspect object through untouched', () => {
    const f = svFrames(1600, 1200, 1920, 1080);
    expect(f.aspect.known).toBe(true);
    expect(f.aspect.before).toBeCloseTo(4 / 3, 6);
    expect(f.aspect.after).toBeCloseTo(16 / 9, 6);
  });
});
