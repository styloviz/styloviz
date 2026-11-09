import { TestBed } from '@angular/core/testing';
import { SvOverlayStackService, SV_OVERLAY_Z_FLOOR } from './overlay-stack';

/**
 * Where the kit's interactive surfaces start, relative to the HOST's layers
 * (1.0 release; AI-04-I3 / AI-07-I3 browser tests).
 *
 * The stack's first cut started the interactive band at 1000 — below Bootstrap's
 * modal (1050), MUI's (1300) and the CDK overlay container — so a kit dropdown
 * opened inside a host's own dialog rendered behind it, while every component
 * doc still promised 9999.
 */
const stack = () => {
  TestBed.resetTestingModule();
  return TestBed.inject(SvOverlayStackService);
};

describe('SvOverlayStackService — the interactive floor', () => {
  it('starts the first interactive surface at the documented floor, 9999', () => {
    expect(SV_OVERLAY_Z_FLOOR).toBe(9999);
    expect(stack().push('anchored').zIndex).toBe(SV_OVERLAY_Z_FLOOR);
  });

  it('clears the host overlay systems a page is likely to already have', () => {
    const z = stack().push('modal').zIndex;
    for (const [name, hostZ] of [['Bootstrap modal', 1055], ['MUI modal', 1300], ['CDK overlay', 1000]] as const) {
      expect(z, name).toBeGreaterThan(hostZ);
    }
  });

  it('every surface in a deep nest stays below the ambient bands', () => {
    const s = stack();
    let last = 0;
    for (let i = 0; i < 50; i++) last = s.push(i % 2 ? 'sheet' : 'anchored').zIndex;
    expect(last).toBeLessThan(s.push('toast').zIndex);
  });
});
