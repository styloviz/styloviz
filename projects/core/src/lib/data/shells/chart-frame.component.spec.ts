import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvChartFrameComponent } from './chart-frame.component';
import type { SvDataError } from '../types';

/**
 * `sv-chart-frame` is rendered by 52 charts, so a defect here is 52 defects.
 * What it owes them is narrow and worth pinning exactly: one state visible at a
 * time in a fixed precedence, the plot reserved in every state so the page does
 * not jump, and a retry that reaches the host.
 */

/** A host, because the frame's whole job is deciding whether to project. */
@Component({
  selector: 'sv-frame-host',
  standalone: true,
  imports: [SvChartFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sv-chart-frame
      [loading]="loading()"
      [error]="error()"
      [isEmpty]="isEmpty()"
      [height]="height()"
      [filtered]="filtered()"
      [emptyMessage]="emptyMessage()"
      [errorTitle]="errorTitle()"
      (retry)="retries.set(retries() + 1)"
    >
      <svg data-testid="plot" aria-label="plot"></svg>
    </sv-chart-frame>
  `,
})
class FrameHostComponent {
  readonly loading = input<boolean>(false);
  readonly error = input<SvDataError | string | null>(null);
  readonly isEmpty = input<boolean>(false);
  readonly height = input<number>(240);
  readonly filtered = input<boolean>(false);
  readonly emptyMessage = input<string>('No data to plot');
  readonly errorTitle = input<string>('Could not load this chart');
  readonly retries = signal(0);
}

type HostInputs = Partial<{
  loading: boolean;
  error: SvDataError | string | null;
  isEmpty: boolean;
  height: number;
  filtered: boolean;
  emptyMessage: string;
  errorTitle: string;
}>;

async function setup(inputs: HostInputs = {}) {
  TestBed.resetTestingModule();
  return render(FrameHostComponent, { inputs });
}

/** The state wrapper the frame stamps, or `null` when the plot is showing. */
function state(host: HTMLElement): string | null {
  return host.querySelector('[data-sv-state]')?.getAttribute('data-sv-state') ?? null;
}

describe('SvChartFrameComponent', () => {
  it('projects the plot when there is nothing to say', async () => {
    const { fixture } = await setup();
    expect(screen.getByTestId('plot')).toBeTruthy();
    expect(state(fixture.nativeElement)).toBeNull();
  });

  it('replaces the plot while loading — a chart drawn from half a series is a lie', async () => {
    const { fixture } = await setup({ loading: true });
    expect(state(fixture.nativeElement)).toBe('loading');
    expect(screen.queryByTestId('plot')).toBeNull();
  });

  it('shows the failure instead of the plot', async () => {
    const { fixture } = await setup({ error: 'Upstream timed out' });
    expect(state(fixture.nativeElement)).toBe('error');
    expect(screen.getByRole('alert').textContent).toContain('Upstream timed out');
    expect(screen.queryByTestId('plot')).toBeNull();
  });

  it('shows the empty state instead of an empty pair of axes', async () => {
    const { fixture } = await setup({ isEmpty: true });
    expect(state(fixture.nativeElement)).toBe('empty');
    expect(screen.queryByTestId('plot')).toBeNull();
  });

  // ── Precedence ─────────────────────────────────────────────────────────────
  //
  // The order matters and is not arbitrary: a reload in flight over a failed
  // chart should read as loading, not as still-broken; and a request that
  // failed has no opinion about whether the data is empty, so "error" must win
  // over "empty" or a timeout would be reported to the user as "no data".

  it('prefers loading over a stale error', async () => {
    const { fixture } = await setup({ loading: true, error: 'boom' });
    expect(state(fixture.nativeElement)).toBe('loading');
  });

  it('prefers an error over empty — a failed fetch is not "no data"', async () => {
    const { fixture } = await setup({ error: 'boom', isEmpty: true });
    expect(state(fixture.nativeElement)).toBe('error');
  });

  it('prefers empty over the plot', async () => {
    await setup({ isEmpty: true });
    expect(screen.queryByTestId('plot')).toBeNull();
  });

  // ── Layout stability ───────────────────────────────────────────────────────

  it('reserves the height in every state, so the page does not jump', async () => {
    for (const inputs of [
      { loading: true },
      { error: 'boom' },
      { isEmpty: true },
    ] as HostInputs[]) {
      const { fixture } = await setup({ ...inputs, height: 320 });
      const box = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
        '[data-sv-state]',
      );
      const style = box?.getAttribute('style') ?? '';
      expect(style).toContain('320px');
    }
  });

  it('falls back to the default height rather than collapsing on a bad one', async () => {
    for (const height of [0, -50, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { fixture } = await setup({ loading: true, height });
      const box = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
        '[data-sv-state="loading"]',
      );
      expect(box?.getAttribute('style') ?? '').toContain('240px');
    }
  });

  // ── Copy and recovery ──────────────────────────────────────────────────────

  it('separates "nothing to plot" from "nothing matched the filters"', async () => {
    const plain = await setup({ isEmpty: true });
    const plainText = (plain.fixture.nativeElement as HTMLElement).textContent ?? '';

    const filtered = await setup({ isEmpty: true, filtered: true });
    const filteredText = (filtered.fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(filteredText).not.toBe(plainText);
    expect(filteredText.toLowerCase()).toContain('filter');
  });

  it('lets the host word both states', async () => {
    const empty = await setup({ isEmpty: true, emptyMessage: 'No sessions in this range' });
    expect((empty.fixture.nativeElement as HTMLElement).textContent).toContain(
      'No sessions in this range',
    );

    const failed = await setup({ error: 'x', errorTitle: 'Revenue is unavailable' });
    expect((failed.fixture.nativeElement as HTMLElement).textContent).toContain(
      'Revenue is unavailable',
    );
  });

  it('passes the retry back to the host', async () => {
    const { fixture } = await setup({ error: { message: 'Gateway timeout', status: 504 } });
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(fixture.componentInstance.retries()).toBe(1);
  });

  it('offers no retry for a failure the server said will not succeed', async () => {
    await setup({ error: { message: 'Not found', status: 404, retryable: false } });
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();
  });
});
