import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvResultComponent } from './result.component';

/**
 * FL-J3-OF-15 · OF-16-I5 — a long localized title or description wraps
 * instead of overflowing the centred layout at 320px. jsdom has no layout, so
 * the contract pinned is the wrapping utilities on the rendered elements:
 * `wrap-anywhere` (overflow-wrap:anywhere — the only value that lets an
 * unbreakable word's min-content shrink inside a centred flex column),
 * `hyphens-auto`, and a max width on the title.
 */
const TITLE = 'Datenschutzgrundverordnungskonformitätsprüfung fehlgeschlagen';
const DESCRIPTION = 'Käyttöoikeustarkistusjärjestelmänvalvontapalvelu ei vastannut.';

async function setup(size: 'sm' | 'md' | 'lg' = 'md') {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvResultComponent, {
    inputs: { status: 'error', title: TITLE, description: DESCRIPTION, size },
  });
  const root = fixture.nativeElement as HTMLElement;
  return { title: root.querySelector('h2') as HTMLElement, description: root.querySelector('p') as HTMLElement };
}

describe('SvResultComponent — long localized text (FL-J3-OF-15)', () => {
  it.each(['sm', 'md', 'lg'] as const)('wraps a long title at size %s', async (size) => {
    const { title } = await setup(size);
    expect(title.textContent?.trim()).toBe(TITLE);
    for (const cls of ['max-w-xl', 'wrap-anywhere', 'hyphens-auto', 'text-balance']) expect(title.className).toContain(cls);
  });

  it('wraps a long description', async () => {
    const { description } = await setup();
    for (const cls of ['max-w-md', 'wrap-anywhere', 'hyphens-auto']) expect(description.className).toContain(cls);
  });
});
