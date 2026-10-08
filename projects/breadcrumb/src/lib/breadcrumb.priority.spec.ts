import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvBreadcrumbComponent, type BreadcrumbItem } from './breadcrumb.component';

/**
 * ============================================================================
 *  Which crumbs survive a collapse — `NV-03-M3`
 * ============================================================================
 *
 * The source item: *"Today which crumbs survive is incidental."* It was: collapse
 * kept the first and the last and nothing else, whatever `maxVisible` said — so
 * `maxVisible` was a THRESHOLD rather than a maximum, and every value of it gave
 * the same two crumbs.
 *
 * ★ And the one crumb a reader most often wants was the one always thrown away.
 * On `/admin/orders/1042/items`, "go back to the order" is the overwhelmingly
 * common move — and the parent was behind the ellipsis every time, while the site
 * root, which the logo already links to, was always on screen.
 *
 * The priority now, in order: **root, current, then backwards from the parent.**
 * Root because it orients, current because it is where you are, parent next
 * because it is where you are most likely going.
 */

const TRAIL: BreadcrumbItem[] = [
  { label: 'Root', routerLink: '/' },
  { label: 'A', routerLink: '/a' },
  { label: 'B', routerLink: '/a/b' },
  { label: 'C', routerLink: '/a/b/c' },
  { label: 'Current' },
];

async function labelsFor(maxVisible: number, items = TRAIL) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvBreadcrumbComponent, {
    inputs: { items, maxVisible } as ComponentInput<SvBreadcrumbComponent>,
  });
  return fixture.componentInstance
    .visibleItems()
    .filter((i): i is BreadcrumbItem => i !== '__ellipsis__')
    .map((i) => i.label);
}

describe('SvBreadcrumbComponent — collapse priority', () => {
  it('keeps root and current at the tightest budget', async () => {
    expect(await labelsFor(2)).toEqual(['Root', 'Current']);
  });

  /** ★ The parent is the third thing kept, not the second-to-last thing dropped. */
  it('adds the parent next', async () => {
    expect(await labelsFor(3)).toEqual(['Root', 'C', 'Current']);
  });

  it('then walks backwards from the parent', async () => {
    expect(await labelsFor(4)).toEqual(['Root', 'B', 'C', 'Current']);
  });

  /**
   * ★ `maxVisible` is a MAXIMUM now. Before, every one of these produced the same
   * two crumbs, which is what made the survivors incidental.
   */
  it('gives a different answer for every budget', async () => {
    const answers = await Promise.all([labelsFor(2), labelsFor(3), labelsFor(4)]);
    expect(new Set(answers.map((a) => a.join('/'))).size).toBe(3);
  });

  /**
   * ★ Never fewer than root + current. A breadcrumb showing only the page you are
   * on is not a breadcrumb, so a budget of 1 is not taken literally into
   * uselessness.
   */
  it('refuses to go below two, whatever the budget says', async () => {
    expect(await labelsFor(1, [TRAIL[0], TRAIL[1], TRAIL[4]])).toEqual(['Root', 'Current']);
  });

  it('shows everything when the trail already fits', async () => {
    expect(await labelsFor(5)).toEqual(['Root', 'A', 'B', 'C', 'Current']);
  });

  /** The kept crumbs stay in document order, whatever order they were chosen in. */
  it('keeps document order', async () => {
    const shown = await labelsFor(4);
    const positions = shown.map((l) => TRAIL.findIndex((i) => i.label === l));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
