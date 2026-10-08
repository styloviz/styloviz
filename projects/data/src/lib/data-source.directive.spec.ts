import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import type { SvPage } from '@styloviz/core';
import { untilRendered } from '@testing/async';
import { SvDataSourceDirective } from './data-source.directive';
import type { SvDataSource } from './types';

const listOf = (items: string[]): SvPage<string> => ({ items, total: items.length, cursor: null });

@Component({
  standalone: true,
  imports: [SvDataSourceDirective],
  template: `
    <div [svDataSource]="source()" [debounceMs]="0" #src="svDataSource">
      <p data-testid="rows">{{ src.items().join(',') }}</p>
      <p data-testid="loading">{{ src.loading() }}</p>
      <p data-testid="error">{{ src.error()?.message ?? '' }}</p>
      <button type="button" (click)="src.search('x')">search</button>
      <button type="button" (click)="src.reload()">reload</button>
    </div>
  `,
})
class HostComponent {
  readonly source = signal<SvDataSource<string>>(async () => listOf(['a']));
}

async function setup() {
  TestBed.resetTestingModule();
  const { fixture } = await render(HostComponent);
  return fixture;
}

type Fixture = Awaited<ReturnType<typeof setup>>;

const text = (fixture: Fixture, id: string) =>
  (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`)!.textContent!.trim();

const button = (fixture: Fixture, index: number) =>
  (fixture.nativeElement as HTMLElement).querySelectorAll('button')[index];

/**
 * ★ Every wait here polls the rendered DOM rather than guessing at a duration.
 * `untilRendered` runs change detection between polls, which a fixture will not
 * do on its own. See the header of `@testing/async` for why the fixed waits
 * this file used to carry were a release-gate flake waiting to happen.
 */
describe('SvDataSourceDirective', () => {
  it('fetches and exposes the rows without the class declaring anything', async () => {
    const fixture = await setup();

    await untilRendered(fixture, () => text(fixture, 'rows') === 'a', { label: 'the rows to render' });

    expect(text(fixture, 'rows')).toBe('a');
    expect(text(fixture, 'loading')).toBe('false');
  });

  it('drives the query from the template', async () => {
    const seen: string[] = [];
    const fixture = await setup();
    fixture.componentInstance.source.set(async (q) => { seen.push(q.search); return listOf([q.search || 'all']); });

    await untilRendered(fixture, () => text(fixture, 'rows') === 'all', { label: 'the swapped source to load' });

    button(fixture, 0).click();

    await untilRendered(fixture, () => text(fixture, 'rows') === 'x', { label: 'the search results' });

    expect(text(fixture, 'rows')).toBe('x');
    expect(seen).toContain('x');
  });

  it('refetches from scratch when the source is swapped', async () => {
    // A new endpoint is a new dataset. Keeping the old rows under it would
    // show one tenant's data labelled as another's.
    const fixture = await setup();
    await untilRendered(fixture, () => text(fixture, 'rows') === 'a', { label: 'the first source to load' });

    fixture.componentInstance.source.set(async () => listOf(['b']));

    await untilRendered(fixture, () => text(fixture, 'rows') === 'b', { label: 'the second source to load' });

    expect(text(fixture, 'rows')).toBe('b');
  });

  it('surfaces a failure and recovers on reload', async () => {
    let fail = true;
    const fixture = await setup();
    fixture.componentInstance.source.set(async () => {
      if (fail) throw { status: 404, message: 'Gone' };
      return listOf(['back']);
    });

    await untilRendered(fixture, () => text(fixture, 'error') === 'Gone', { label: 'the 404 to reach the DOM' });
    expect(text(fixture, 'error')).toBe('Gone');

    fail = false;
    button(fixture, 1).click();

    await untilRendered(fixture, () => text(fixture, 'rows') === 'back', { label: 'the reload to land' });

    expect(text(fixture, 'error')).toBe('');
    expect(text(fixture, 'rows')).toBe('back');
  });
});
