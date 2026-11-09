import { Component, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvChartFrameComponent } from '@styloviz/core/data';
import { SvChartDataTableDirective, provideSvChartA11y, type SvChartDataTableMode } from './chart-a11y';
import type { SvDataSummary } from './data-summary';

/**
 * FL-D5 — the chart accessibility module. Every chart hands `sv-chart-frame`
 * its `SvDataSummary`; the frame owns the hidden table and, when the app or
 * the chart asks, a "Show data table" button that puts the same rows on screen.
 */

const SUMMARY: SvDataSummary = {
  caption: 'Revenue by month',
  columns: ['Month', 'Revenue'],
  rows: [
    { key: 'jan', header: 'Jan', cells: ['4,000'] },
    { key: 'feb', header: 'Feb', cells: ['5,500'] },
  ],
};

/** A stand-in chart: its own view renders the frame, as every chart does. */
@Component({
  selector: 'sv-test-chart',
  standalone: true,
  imports: [SvChartFrameComponent],
  template: `<sv-chart-frame [summary]="summary()" [loading]="loading()" [nativeAlternative]="native()"><svg role="img" aria-label="Revenue"></svg></sv-chart-frame>`,
})
class TestChartComponent {
  readonly summary = signal<SvDataSummary | null>(SUMMARY);
  readonly loading = signal(false);
  readonly native = signal(false);
}

@Component({
  standalone: true,
  imports: [TestChartComponent, SvChartDataTableDirective],
  template: `
    @if (mode() === null) { <sv-test-chart /> }
    @else if (mode() === '') { <sv-test-chart svChartDataTable /> }
    @else { <sv-test-chart [svChartDataTable]="mode()!" /> }`,
})
class HostComponent {
  readonly mode = signal<SvChartDataTableMode | '' | null>(null);
}

const toggle = () => screen.queryByRole('button', { name: /data table/i });
const hiddenTable = (root: Element) => root.querySelector('.sv-summary table');
const visibleRegion = (root: Element) => root.querySelector('[data-sv-summary-visible]');

describe('chart a11y module (FL-D5)', () => {
  it('by default the table is for assistive technology only — no button', async () => {
    const { fixture } = await render(HostComponent);
    expect(toggle()).toBeNull();
    expect(hiddenTable(fixture.nativeElement)?.querySelector('caption')?.textContent?.trim()).toBe('Revenue by month');
  });

  it('the bare svChartDataTable attribute shows the button, which puts the same rows on screen and back', async () => {
    const { fixture } = await render(HostComponent, { componentProperties: {} });
    fixture.componentInstance.mode.set('');
    fixture.detectChanges();
    const button = toggle()!;
    expect(button.textContent?.trim()).toBe('Show data table');
    expect(button.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.textContent?.trim()).toBe('Hide data table');
    const region = visibleRegion(fixture.nativeElement)!;
    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(region.getAttribute('aria-label')).toBe('Revenue by month');
    // The button controls the box it opened.
    expect(region.closest(`#${button.getAttribute("aria-controls")}`)).not.toBeNull();
    expect([...region.querySelectorAll('tbody th')].map((th) => th.textContent?.trim())).toEqual(['Jan', 'Feb']);
    // Shown on screen, so not ALSO hidden: one copy, read once.
    expect(hiddenTable(fixture.nativeElement)).toBeNull();

    await userEvent.click(button);
    expect(visibleRegion(fixture.nativeElement)).toBeNull();
    expect(hiddenTable(fixture.nativeElement)).not.toBeNull();
  });

  it('provideSvChartA11y turns the button on app-wide, and svChartDataTable="hidden" opts one chart out', async () => {
    const { fixture } = await render(HostComponent, { providers: [provideSvChartA11y({ dataTable: 'toggle' })] });
    expect(toggle()).not.toBeNull();
    fixture.componentInstance.mode.set('hidden');
    fixture.detectChanges();
    expect(toggle()).toBeNull();
  });

  it('only in the plot state: loading has its own words, and no rows means no button', async () => {
    const { fixture } = await render(TestChartComponent, { providers: [provideSvChartA11y({ dataTable: 'toggle' })] });
    fixture.componentInstance.loading.set(true);
    fixture.detectChanges();
    expect(toggle()).toBeNull();
    expect(hiddenTable(fixture.nativeElement)).toBeNull();
    fixture.componentInstance.loading.set(false);
    fixture.componentInstance.summary.set({ ...SUMMARY, rows: [] });
    fixture.detectChanges();
    expect(toggle()).toBeNull();
  });

  it('a native alternative (a grid of named cells) gets the button but never a second hidden copy', async () => {
    const { fixture } = await render(TestChartComponent);
    fixture.componentInstance.native.set(true);
    fixture.detectChanges();
    expect(hiddenTable(fixture.nativeElement)).toBeNull();
  });
});
