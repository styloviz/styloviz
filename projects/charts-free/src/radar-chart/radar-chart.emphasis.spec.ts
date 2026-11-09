import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvLiveAnnouncer } from '@styloviz/core/a11y';
import { SvRadarChartComponent, type RadarAxis, type RadarSeries } from './radar-chart.component';

/**
 * FL-J3-CH-03 · CH-13-M4 / CH-13-I3 — series emphasis on the radar. Overlapping
 * polygons were the complaint: the legend now isolates (fades the others) and
 * toggles a series, by keyboard too, and a focused vertex puts its polygon in
 * front.
 */
const AXES: RadarAxis[] = [{ label: 'Speed' }, { label: 'Comfort' }, { label: 'Safety' }];
const SERIES: RadarSeries[] = [
  { name: 'Model A', color: '#3b82f6', values: [80, 70, 90] },
  { name: 'Model B', color: '#f59e0b', values: [60, 85, 65] },
  { name: 'Model C', color: '#10b981', values: [40, 50, 75] },
];

async function setup(inputs: Partial<ComponentInput<SvRadarChartComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvRadarChartComponent, {
    inputs: { axes: AXES, series: SERIES, ...inputs } as ComponentInput<SvRadarChartComponent>,
  });
  return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

const group = (host: HTMLElement, name: string) => host.querySelector<SVGGElement>(`g[data-sv-series="${name}"]`);
const legendButton = (name: string) => screen.getByRole('button', { name });

describe('SvRadarChartComponent — series emphasis (FL-J3-CH-03)', () => {
  it('renders the legend as a named toolbar of pressed toggle buttons with one tab stop', async () => {
    await setup();
    const bar = screen.getByRole('toolbar', { name: 'Series' });
    const buttons = Array.from(bar.querySelectorAll('button'));
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Model A', 'Model B', 'Model C']);
    expect(buttons.every((b) => b.getAttribute('aria-pressed') === 'true')).toBe(true);
    expect(buttons.map((b) => b.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });

  it('isolates a series from its legend entry — focus and hover fade the others', async () => {
    const { host, fixture } = await setup();
    legendButton('Model B').focus();
    fixture.detectChanges();
    expect(group(host, 'Model A')?.getAttribute('opacity')).toBe('0.18');
    expect(group(host, 'Model C')?.getAttribute('opacity')).toBe('0.18');
    expect(group(host, 'Model B')?.getAttribute('opacity')).toBe('1');
    legendButton('Model B').blur();
    await userEvent.hover(legendButton('Model C'));
    fixture.detectChanges();
    expect(group(host, 'Model B')?.getAttribute('opacity')).toBe('0.18');
  });

  it('puts a focused vertex\'s polygon in front (CH-13-M4)', async () => {
    const { host, fixture } = await setup();
    const vertex = screen.getAllByRole('button').find((b) => b.tagName.toLowerCase() === 'circle' && b.getAttribute('aria-label')?.includes('Model C'))!;
    vertex.dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    expect(group(host, 'Model A')?.getAttribute('opacity')).toBe('0.18');
    expect(group(host, 'Model C')?.getAttribute('opacity')).toBe('1');
    vertex.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    expect(group(host, 'Model A')?.getAttribute('opacity')).toBe('1');
  });

  it('hides and shows a series from the legend, announced, and two-way bound', async () => {
    const { host, fixture, c } = await setup();
    const announce = vi.spyOn(TestBed.inject(SvLiveAnnouncer), 'announce');
    const changes: (readonly string[])[] = [];
    c.hiddenSeries.subscribe((v) => changes.push(v));

    await userEvent.click(legendButton('Model A'));
    fixture.detectChanges();
    expect(group(host, 'Model A')).toBeNull();
    expect(legendButton('Model A').getAttribute('aria-pressed')).toBe('false');
    expect(announce).toHaveBeenLastCalledWith('Model A hidden');
    expect(changes.at(-1)).toEqual(['Model A']);

    legendButton('Model A').focus();
    await userEvent.keyboard('{Enter}');
    fixture.detectChanges();
    expect(group(host, 'Model A')).not.toBeNull();
    expect(announce).toHaveBeenLastCalledWith('Model A shown');
  });

  it('moves between series with the arrow keys', async () => {
    const { host, fixture } = await setup();
    legendButton('Model A').focus();
    await userEvent.keyboard('{ArrowRight}');
    fixture.detectChanges();
    expect(document.activeElement).toBe(legendButton('Model B'));
    expect(group(host, 'Model A')?.getAttribute('opacity')).toBe('0.18');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(document.activeElement).toBe(legendButton('Model C'));
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(legendButton('Model A'));
  });

  it('keeps the last visible series, and honours a bound hidden set', async () => {
    const { host, fixture } = await setup({ hiddenSeries: ['Model A', 'Model B'] });
    expect(group(host, 'Model A')).toBeNull();
    expect(group(host, 'Model B')).toBeNull();
    await userEvent.click(legendButton('Model C'));
    fixture.detectChanges();
    expect(group(host, 'Model C')).not.toBeNull();
  });

  it('keeps a hidden series in the summary table', async () => {
    const { host } = await setup({ hiddenSeries: ['Model B'] });
    expect(host.querySelector('table')?.textContent).toContain('Model B');
  });

  it('keeps the static legend when interactiveLegend is false', async () => {
    const { host } = await setup({ interactiveLegend: false });
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(host.querySelector('[data-sv-series-index]')).toBeNull();
  });

  it('meets the 24px target size on every legend button', async () => {
    await setup();
    for (const b of screen.getByRole('toolbar').querySelectorAll('button')) {
      expect(b.className).toContain('min-h-6');
    }
  });
});
