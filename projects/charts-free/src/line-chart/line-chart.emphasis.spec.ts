import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvLiveAnnouncer } from '@styloviz/core/a11y';
import { SvLineChartComponent, type LineChartSeries } from './line-chart.component';

/**
 * FL-J3-CH-03 · CH-07-I5 / CH-07-M5 — series emphasis on the line chart.
 * The legend is a toolbar of toggle buttons with ONE tab stop: focusing or
 * hovering an entry fades the other series, Enter/Space/click hides or shows
 * it, and the arrow keys move between series.
 */
const CATS = ['Jan', 'Feb', 'Mar', 'Apr'];
const SERIES: LineChartSeries[] = [
  { label: 'Users', data: [10, 30, 20, 40] },
  { label: 'Sessions', data: [5, 15, 25, 10] },
  { label: 'Signups', data: [1, 3, 2, 4] },
];

async function setup(inputs: Partial<ComponentInput<SvLineChartComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvLineChartComponent, {
    inputs: { categories: CATS, series: SERIES, ...inputs } as ComponentInput<SvLineChartComponent>,
  });
  return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

const group = (host: HTMLElement, name: string) => host.querySelector<SVGGElement>(`g[data-sv-series="${name}"]`);
const legendButton = (name: string) => screen.getByRole('button', { name });

describe('SvLineChartComponent — interactive legend (FL-J3-CH-03)', () => {
  it('renders the legend as a named toolbar of pressed toggle buttons with one tab stop', async () => {
    const { host } = await setup();
    const bar = screen.getByRole('toolbar', { name: 'Series' });
    const buttons = Array.from(bar.querySelectorAll('button'));
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Users', 'Sessions', 'Signups']);
    expect(buttons.every((b) => b.getAttribute('aria-pressed') === 'true')).toBe(true);
    expect(buttons.map((b) => b.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    const hint = host.querySelector(`#${bar.getAttribute('aria-describedby')}`);
    expect(hint?.textContent).toContain('Arrow keys');
  });

  it('fades the other series while an entry is focused, and restores them on blur', async () => {
    const { host, fixture } = await setup();
    legendButton('Sessions').focus();
    fixture.detectChanges();
    expect(group(host, 'Users')?.getAttribute('opacity')).toBe('0.18');
    expect(group(host, 'Users')?.hasAttribute('data-sv-dimmed')).toBe(true);
    expect(group(host, 'Sessions')?.getAttribute('opacity')).toBe('1');
    legendButton('Sessions').blur();
    fixture.detectChanges();
    expect(group(host, 'Users')?.getAttribute('opacity')).toBe('1');
  });

  it('isolates on hover too', async () => {
    const { host, fixture } = await setup();
    await userEvent.hover(legendButton('Signups'));
    fixture.detectChanges();
    expect(group(host, 'Users')?.getAttribute('opacity')).toBe('0.18');
    await userEvent.unhover(legendButton('Signups'));
    fixture.detectChanges();
    expect(group(host, 'Users')?.getAttribute('opacity')).toBe('1');
  });

  it('hides and shows a series with a click, Enter or Space, announced, and two-way bound', async () => {
    const { host, fixture, c } = await setup();
    const announce = vi.spyOn(TestBed.inject(SvLiveAnnouncer), 'announce');
    const changes: (readonly string[])[] = [];
    c.hiddenSeries.subscribe((v) => changes.push(v));

    await userEvent.click(legendButton('Users'));
    fixture.detectChanges();
    expect(group(host, 'Users')).toBeNull();
    expect(legendButton('Users').getAttribute('aria-pressed')).toBe('false');
    expect(announce).toHaveBeenLastCalledWith('Users hidden');
    expect(changes.at(-1)).toEqual(['Users']);

    legendButton('Users').focus();
    await userEvent.keyboard('{Enter}');
    fixture.detectChanges();
    expect(group(host, 'Users')).not.toBeNull();
    expect(announce).toHaveBeenLastCalledWith('Users shown');

    await userEvent.keyboard(' ');
    fixture.detectChanges();
    expect(group(host, 'Users')).toBeNull();
  });

  it('moves between series with the arrow keys — the keyboard path between series', async () => {
    const { host, fixture } = await setup();
    legendButton('Users').focus();
    await userEvent.keyboard('{ArrowRight}');
    fixture.detectChanges();
    expect(document.activeElement).toBe(legendButton('Sessions'));
    expect(legendButton('Sessions').getAttribute('tabindex')).toBe('0');
    expect(legendButton('Users').getAttribute('tabindex')).toBe('-1');
    expect(group(host, 'Users')?.getAttribute('opacity')).toBe('0.18');
    await userEvent.keyboard('{End}');
    expect(document.activeElement).toBe(legendButton('Signups'));
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(legendButton('Users'));
  });

  it('keeps the last visible series on screen', async () => {
    const { host, fixture } = await setup({ hiddenSeries: ['Users', 'Sessions'] });
    await userEvent.click(legendButton('Signups'));
    fixture.detectChanges();
    expect(group(host, 'Signups')).not.toBeNull();
    expect(legendButton('Signups').getAttribute('aria-pressed')).toBe('true');
  });

  it('honours a hidden set the host binds, and drops hidden series from the tooltip', async () => {
    const { host, c, fixture } = await setup({ hiddenSeries: ['Sessions'] });
    expect(group(host, 'Sessions')).toBeNull();
    const svg = host.querySelector('svg')!;
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 300, right: 600, bottom: 300, x: 0, y: 0 }) as DOMRect;
    svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 56 + 520 / 3, clientY: 128, bubbles: true }));
    fixture.detectChanges();
    expect(c.tooltip().items.map((i) => i.series)).toEqual(['Users', 'Signups']);
  });

  it('keeps the hidden series in the data table — hiding is a view, not a deletion', async () => {
    const { host } = await setup({ hiddenSeries: ['Sessions'] });
    expect(host.querySelector('table')?.textContent).toContain('Sessions');
  });

  it('fades with opacity only, stilled under reduced motion', async () => {
    const { host } = await setup();
    const cls = group(host, 'Users')!.getAttribute('class')!;
    expect(cls).toContain('transition-opacity');
    expect(cls).toContain('motion-reduce:transition-none');
  });

  it('keeps the static legend when interactiveLegend is false', async () => {
    const { host } = await setup({ interactiveLegend: false });
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Users' })).toBeNull();
    expect(host.querySelector('[data-sv-series-index]')).toBeNull();
    expect(screen.getAllByText('Users').some((el) => el.tagName === 'SPAN')).toBe(true);
  });
});
