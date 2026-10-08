import { describe, expect, it, vi } from 'vitest';
import { svWarnSimulating } from './simulate-warning';

/**
 * The warning is a development aid for a demo switch left on. Both tests below
 * provoke it, so it is captured and asserted rather than printed — a passing
 * suite that shouts on every run teaches people to ignore it.
 */
describe('svWarnSimulating', () => {
  it('names the component and says the work was faked', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    svWarnSimulating('sv-thing');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('<sv-thing>'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no real work happened'));
    warn.mockRestore();
  });

  it('warns once per component, so a grid of twelve cards logs once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    svWarnSimulating('sv-repeat');
    svWarnSimulating('sv-repeat');
    svWarnSimulating('sv-repeat');
    expect(warn).toHaveBeenCalledTimes(1);
    // A different component still gets its own warning.
    svWarnSimulating('sv-other');
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
