import { createSvTooltipGroup } from './tooltip-group';

describe('createSvTooltipGroup (SR-35)', () => {
  it('the first tooltip waits the group delay; a sibling right after shows at once', () => {
    let t = 0;
    const group = createSvTooltipGroup({ delay: 600, skipDelay: 300, now: () => t });
    expect(group.delayFor(0)).toBe(600);
    expect(group.delayFor(150)).toBe(150); // its own delay wins over the group's
    group.opened('a', () => undefined);
    expect(group.delayFor(0)).toBe(0); // one is up
    group.closed('a');
    t = 200;
    expect(group.delayFor(0)).toBe(0); // within skipDelay
    t = 600;
    expect(group.delayFor(0)).toBe(600); // the reading stopped
  });

  it('only one member is visible: opening a sibling hides the other', () => {
    const group = createSvTooltipGroup();
    const hideA = vi.fn();
    group.opened('a', hideA);
    group.opened('b', () => undefined);
    expect(hideA).toHaveBeenCalledTimes(1);
  });

  it('reads delays lazily, so a host can bind them', () => {
    let delay = 100;
    const group = createSvTooltipGroup({ delay: () => delay });
    expect(group.delayFor(0)).toBe(100);
    delay = 900;
    expect(group.delayFor(0)).toBe(900);
  });

  it('closing something that never opened changes nothing', () => {
    let t = 0;
    const group = createSvTooltipGroup({ now: () => t });
    group.closed('ghost');
    t = 1;
    expect(group.delayFor(0)).toBe(600);
  });
});
