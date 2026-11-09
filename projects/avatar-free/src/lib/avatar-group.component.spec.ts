import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvAvatarGroupComponent, type AvatarGroupMember } from './avatar-group.component';

/** FL-J3-DD-30 (free tier) — the cross-tier contract lives in `projects/avatar/src/lib/avatar-group.component.spec.ts`. */
describe('SvAvatarGroupComponent (free)', () => {
  it('draws max avatars and a named "+N" for the rest', async () => {
    TestBed.resetTestingModule();
    const members: AvatarGroupMember[] = ['A B', 'C D', 'E F', 'G H', 'I J'].map((name) => ({ name }));
    const { fixture } = await render(SvAvatarGroupComponent, { inputs: { members, max: 2, locale: 'en-US' } });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('sv-avatar')).toHaveLength(2);
    expect(el.querySelector('[role="img"][aria-label^="3 more"]')?.textContent?.trim()).toBe('+3');
  });
});
