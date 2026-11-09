import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvAvatarComponent, type AvatarSize } from './avatar.component';

/**
 * `SR-40` — the fallback glyph was `h-[55%] w-[55%]` on the <svg>. The icon
 * host is content-sized, so 55 % resolved against the icon's own 20 px: an
 * 11 px glyph in every avatar from 24 px to 80 px. It is now sized in px.
 */
const EXPECTED: Record<AvatarSize, number> = { xs: 13, sm: 18, md: 22, lg: 26, xl: 35, '2xl': 44 };

describe('SvAvatarComponent — glyph size (SR-40)', () => {
  for (const [size, px] of Object.entries(EXPECTED) as [AvatarSize, number][]) {
    it(`${size}: the fallback glyph is ${px} px`, async () => {
      TestBed.resetTestingModule();
      const { fixture } = await render(SvAvatarComponent, { inputs: { size } });
      const svg = (fixture.nativeElement as HTMLElement).querySelector<SVGElement>('sv-icon svg');
      expect(svg, 'no name and no image shows the fallback glyph').not.toBeNull();
      expect(svg!.getAttribute('width')).toBe(String(px));
      expect(svg!.getAttribute('class') ?? '').not.toContain('%');
    });
  }
});
