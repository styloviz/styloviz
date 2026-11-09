import { render, type ComponentInput } from '@testing-library/angular';
import { SvRadarChartComponent } from './radar-chart.component';

/** The SVG box holds every axis label (the visual matrix proves it in real engines). */
describe('SvRadarChartComponent — label frame', () => {
  const axes = [
    { label: 'Latency (ms)', max: 100 },
    { label: 'Throughput', max: 100 },
    { label: 'Accuracy', max: 100 },
    { label: 'Cost', max: 100 },
    { label: 'Availability', max: 100 },
  ];
  const series = [{ name: 'Service', color: '#6366f1', values: [60, 80, 70, 40, 90] }];

  it('grows the viewBox past `size` so the side labels are inside it', async () => {
    const { fixture } = await render(SvRadarChartComponent, {
      inputs: { axes, series, size: 300 } as ComponentInput<SvRadarChartComponent>,
    });
    const chart = fixture.componentInstance;
    const frame = chart.frame();
    const [x, y, w, h] = frame.viewBox.split(' ').map(Number);
    expect(w).toBeGreaterThan(300);
    for (const lp of chart.labelPoints()) {
      const width = lp.label.length * 10 * 0.6;
      const anchor = chart.textAnchor(lp.x);
      const left = anchor === 'end' ? lp.x - width : anchor === 'middle' ? lp.x - width / 2 : lp.x;
      expect(left).toBeGreaterThanOrEqual(x);
      expect(left + width).toBeLessThanOrEqual(x + w);
      expect(lp.y - 5).toBeGreaterThanOrEqual(y);
      expect(lp.y + 5).toBeLessThanOrEqual(y + h);
    }
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg[role="group"]')!;
    expect(svg.getAttribute('viewBox')).toBe(frame.viewBox);
    expect(svg.getAttribute('width')).toBe(String(frame.width));
  });
});
