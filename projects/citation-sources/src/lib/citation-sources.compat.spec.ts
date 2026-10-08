import { svPlacementLabel } from './citation-sources.attribution';
import type { SvCitationPlacement, SvCitationPlacements } from './citation-sources.attribution';

/**
 * ============================================================================
 *  Public-type compatibility
 * ============================================================================
 *
 * Compile-level guards: a consumer that switched exhaustively over the
 * published `SvCitationPlacement` members, or built an `SvCitationPlacements`
 * literal before `missingClaims` existed, must still type-check. Adding a
 * union member or a required field fails this file under `tsc`, not just a
 * runtime assertion.
 */

function describePlacement(placement: SvCitationPlacement): string {
  switch (placement) {
    case 'anchor':
      return 'anchor';
    case 'offsets':
      return 'offsets';
    case 'drifted':
      return 'drifted';
    case 'unplaced':
      return 'unplaced';
    default: {
      const unreachable: never = placement;
      return unreachable;
    }
  }
}

describe('public types stay backward compatible', () => {
  it('SvCitationPlacement is exactly the published four members', () => {
    const all: readonly SvCitationPlacement[] = ['anchor', 'offsets', 'drifted', 'unplaced'];
    expect(all.map(describePlacement)).toEqual(['anchor', 'offsets', 'drifted', 'unplaced']);
  });

  it('accepts an SvCitationPlacements without missingClaims, read as 0', () => {
    const legacy: SvCitationPlacements = {
      placed: [],
      unplaced: [{ id: 'c1', sourceId: 's1', start: 0, end: 4, quote: 'q' }],
      drifted: 0,
    };
    expect(svPlacementLabel(legacy)).toContain('1 citation could not be located');
    expect(svPlacementLabel(legacy)).not.toContain('names a claim');
  });
});
