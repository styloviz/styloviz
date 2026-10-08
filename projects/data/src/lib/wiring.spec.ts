import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvDataTableComponent, type TableColumn } from '@styloviz/data-table';
import { untilRendered } from '@testing/async';
import { SvDataSourceDirective } from './data-source.directive';
import { createArrayDataSource } from './array-source';

interface Order extends Record<string, unknown> { id: number; customer: string; amount: number }

const COLUMNS: TableColumn<Order>[] = [
  { key: 'customer', label: 'Customer', sortable: true },
  { key: 'amount', label: 'Amount', sortable: true },
];

const ORDERS: Order[] = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  customer: `Customer ${String(i + 1).padStart(2, '0')}`,
  amount: (i + 1) * 10,
}));

/**
 * The claim Phase 6 makes: a table goes from local demo to server-backed
 * without touching the component. This is that claim, executed.
 */
@Component({
  standalone: true,
  imports: [SvDataTableComponent, SvDataSourceDirective],
  template: `
    <sv-data-table
      [svDataSource]="source" [debounceMs]="0" [retries]="0" #src="svDataSource"
      [columns]="columns" [serverSide]="true" [pageSize]="10"
      [rows]="src.items()" [loading]="src.loading()"
      [error]="src.error()" [totalCount]="src.total()"
      (queryChange)="src.setQuery($event)" (retry)="src.reload()" />
  `,
})
class WiredTableComponent {
  readonly columns = COLUMNS;
  readonly fail = signal(false);
  readonly source = async (query: Parameters<ReturnType<typeof createArrayDataSource<Order>>>[0], signal_: AbortSignal) => {
    if (this.fail()) throw { status: 503, message: 'Upstream is down' };
    return createArrayDataSource(ORDERS)(query, signal_);
  };
}

type Fixture = Awaited<ReturnType<typeof render<WiredTableComponent>>>['fixture'];

const el = (f: Fixture) => f.nativeElement as HTMLElement;
const shows = (f: Fixture, needle: string) => el(f).textContent!.includes(needle);
const errorSlot = (f: Fixture) => el(f).querySelector('[data-sv-state="error"]');

/**
 * ★ Waits poll the rendered table instead of guessing a duration — see the
 * header of `@testing/async`.
 */
async function setup() {
  TestBed.resetTestingModule();
  const { fixture } = await render(WiredTableComponent);
  await untilRendered(fixture, () => shows(fixture, 'Customer 01'), { label: 'the first server page' });
  return fixture;
}

describe('wiring a data table to a source', () => {
  it('renders the first server page without the component knowing about HTTP', async () => {
    const fixture = await setup();
    const text = el(fixture).textContent!;
    expect(text).toContain('Customer 01');
    expect(text).toContain('Customer 10');
    expect(text).not.toContain('Customer 11');
  });

  it('reports the true total, not the page length', async () => {
    // The pagination control needs the whole count; deriving it from the rows
    // on screen caps the table at one page and hides the rest of the data.
    const fixture = await setup();
    expect(el(fixture).textContent).toContain('25');
  });

  it('fetches the next page through the controller', async () => {
    const fixture = await setup();
    const table = fixture.debugElement.children[0].componentInstance as SvDataTableComponent<Order>;

    table.goTo(2);

    await untilRendered(fixture, () => shows(fixture, 'Customer 11'), { label: 'the second page' });

    expect(el(fixture).textContent).toContain('Customer 11');
  });

  it('surfaces a failure through the table’s own error slot', async () => {
    const fixture = await setup();
    fixture.componentInstance.fail.set(true);
    const table = fixture.debugElement.children[0].componentInstance as SvDataTableComponent<Order>;

    table.goTo(2);

    // `[retries]="0"` above, so the failure surfaces without waiting out the
    // jittered backoff — the retry policy itself is covered in controller.spec.
    await untilRendered(fixture, () => errorSlot(fixture) !== null, { label: 'the error slot' });

    expect(errorSlot(fixture)).toBeTruthy();
    expect(el(fixture).textContent).toContain('Upstream is down');
  });

  it('recovers when the host retries', async () => {
    const fixture = await setup();
    fixture.componentInstance.fail.set(true);
    const table = fixture.debugElement.children[0].componentInstance as SvDataTableComponent<Order>;

    table.goTo(2);
    await untilRendered(fixture, () => errorSlot(fixture) !== null, { label: 'the error slot' });

    fixture.componentInstance.fail.set(false);
    table.retry.emit();

    await untilRendered(fixture, () => shows(fixture, 'Customer 11'), { label: 'the retried page' });

    expect(errorSlot(fixture)).toBeNull();
    expect(el(fixture).textContent).toContain('Customer 11');
  });
});
