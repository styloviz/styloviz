import { render, screen } from '@testing-library/angular';
import { SvAvatarComponent } from './avatar.component';

async function setup(inputs: Record<string, unknown> = {}) {
  const { fixture } = await render(SvAvatarComponent, { inputs });
  return fixture.componentInstance;
}

describe('SvAvatarComponent — initials', () => {
  it('derives two-letter initials from a full name', async () => {
    expect((await setup({ name: 'Ada Lovelace' })).initials()).toBe('AL');
  });

  it('takes the first two letters of a single name', async () => {
    expect((await setup({ name: 'Ada' })).initials()).toBe('AD');
  });

  it('is empty when no name is given', async () => {
    expect((await setup({})).initials()).toBe('');
  });
});

describe('SvAvatarComponent — display precedence', () => {
  it('shows the image when a src is set', async () => {
    const c = await setup({ src: 'https://example.com/a.png', name: 'Ada' });
    expect(c.showImage()).toBe(true);
    expect(c.showIcon()).toBe(false);
  });

  it('falls back to the generic icon with no image and no name', async () => {
    const c = await setup({});
    expect(c.showImage()).toBe(false);
    expect(c.showIcon()).toBe(true);
  });
});

describe('SvAvatarComponent — badge', () => {
  it('caps the badge count at badgeMax', async () => {
    const c = await setup({ badgeCount: 12, badgeMax: 9 });
    expect(c.displayBadge()).toBe('9+');
    expect(c.showBadge()).toBe(true);
  });

  it('hides the badge when the count is zero', async () => {
    expect((await setup({ badgeCount: 0 })).showBadge()).toBe(false);
  });
});

describe('SvAvatarComponent — click', () => {
  it('emits avatarClick only when clickable', async () => {
    const spy = vi.fn();
    const c = await setup({ clickable: true, name: 'Ada' });
    c.avatarClick.subscribe(spy);
    c.onClick(new MouseEvent('click'));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not emit when not clickable', async () => {
    const spy = vi.fn();
    const c = await setup({ clickable: false, name: 'Ada' });
    c.avatarClick.subscribe(spy);
    c.onClick(new MouseEvent('click'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('renders initials text in the DOM', async () => {
    await setup({ name: 'Grace Hopper' });
    expect(screen.getByText('GH')).toBeTruthy();
  });
});
