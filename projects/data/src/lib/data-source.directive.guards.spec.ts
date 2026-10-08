import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import type { SvPage } from '@styloviz/core';
import { untilRendered } from '@testing/async';
import { SvDataSourceDirective } from './data-source.directive';
import type { SvDataSource } from './types';

/**
 * The directive builds its controller inside an `effect`, so there is a window
 * — first render, and any render where the source has not been set — in which
 * there is no controller at all. Every binding has to survive that window, and
 * every *action* has to fail loudly in it rather than silently doing nothing:
 * a "Sort" button that quietly no-ops is far harder to diagnose than one that
 * throws with the reason.
 */

const listOf = (items: string[]): SvPage<string> => ({
  items,
  total: items.length,
  cursor: 'next-page',
});

describe('SvDataSourceDirective — before the controller exists', () => {
  /** Build the directive without ever flushing its effect. */
  function bare() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.runInInjectionContext(() => new SvDataSourceDirective<string>());
  }

  it('reads as an empty, unfiltered, unpaged list rather than throwing', async () => {
    const d = bare();
    expect(d.items()).toEqual([]);
    expect(d.loading()).toBe(false);
    expect(d.error()).toBeNull();
    expect(d.total()).toBeNull();
    expect(d.cursor()).toBeNull();
    expect(d.filtered()).toBe(false);
    expect(d.hasMore()).toBe(false);
    expect(d.query()).toBeNull();
  });

  it.each([
    ['setQuery', (d: SvDataSourceDirective<string>) => d.setQuery({} as never)],
    ['patch', (d: SvDataSourceDirective<string>) => d.patch({})],
    ['search', (d: SvDataSourceDirective<string>) => d.search('x')],
    ['goToPage', (d: SvDataSourceDirective<string>) => d.goToPage(2)],
    ['sortBy', (d: SvDataSourceDirective<string>) => d.sortBy('name')],
    ['filter', (d: SvDataSourceDirective<string>) => d.filter('status', 'open')],
    ['clearFilters', (d: SvDataSourceDirective<string>) => d.clearFilters()],
    ['reload', (d: SvDataSourceDirective<string>) => d.reload()],
  ] as const)('says so by name when %s is called too early', async (_name, act) => {
    const d = bare();
    expect(() => act(d)).toThrowError(/svDataSource used before its source was set/);
  });
});

@Component({
  standalone: true,
  imports: [SvDataSourceDirective],
  template: `
    <div [svDataSource]="source()" [debounceMs]="0" #src="svDataSource">
      <p data-testid="sorts">{{ (src.query()?.sorts ?? []).map(sortLabel).join('|') }}</p>
      <p data-testid="cursor">{{ src.cursor() }}</p>
      <p data-testid="more">{{ src.hasMore() }}</p>
      <button type="button" (click)="src.sortBy('name')">sort name</button>
      <button type="button" (click)="src.sortBy('age', true)">add age</button>
    </div>
  `,
})
class SortHost {
  readonly source = signal<SvDataSource<string>>(async () => listOf(['a']));
  readonly sortLabel = (s: { key: string; direction: string }) => `${s.key}:${s.direction}`;
}

describe('SvDataSourceDirective — sortBy', () => {
  async function setup() {
    TestBed.resetTestingModule();
    const { fixture } = await render(SortHost);
    return fixture;
  }

  const text = (f: { nativeElement: unknown }, id: string) =>
    (f.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`)!.textContent!.trim();
  const button = (f: { nativeElement: unknown }, i: number) =>
    (f.nativeElement as HTMLElement).querySelectorAll('button')[i];

  it('replaces the sort by default, rather than accumulating one per click', async () => {
    // `multi` defaults to false. A default of true would give a table a growing
    // sort list nobody asked for, and the second column would never take effect
    // because the first still wins.
    const fixture = await setup();
    await untilRendered(fixture, () => text(fixture, 'cursor') === 'next-page', {
      label: 'the first page',
    });

    button(fixture, 0).click();
    await untilRendered(fixture, () => text(fixture, 'sorts') === 'name:asc', {
      label: 'the first sort',
    });

    button(fixture, 1).click(); // sortBy('age', true) — explicit multi
    await untilRendered(fixture, () => text(fixture, 'sorts').includes('age'), {
      label: 'the second sort',
    });
    expect(text(fixture, 'sorts')).toBe('name:asc|age:asc');

    button(fixture, 0).click(); // sortBy('name') — default, single
    await untilRendered(fixture, () => !text(fixture, 'sorts').includes('age'), {
      label: 'the sort list to collapse',
    });
    expect(text(fixture, 'sorts')).toBe('name:desc');
  });

  it('reports a cursor and more-to-come once a page has landed', async () => {
    const fixture = await setup();
    await untilRendered(fixture, () => text(fixture, 'cursor') === 'next-page', {
      label: 'the first page',
    });
    expect(text(fixture, 'more')).toBe('true');
  });
});
