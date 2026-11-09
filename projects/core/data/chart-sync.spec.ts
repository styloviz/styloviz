import { Component, input, signal } from '@angular/core';
import { render } from '@testing-library/angular';
import { SvChartSyncDirective, injectSvChartSync } from './chart-sync';

/**
 * FL-D5 — chart synchronisation groups. Charts naming the same `svChartSync`
 * group share one hovered category and one zoom window, by LABEL; a remote
 * state is never published back.
 */

@Component({ selector: 'sv-sync-probe', standalone: true, template: '' })
class ProbeComponent {
  readonly categories = input<readonly string[]>([]);
  readonly hovered = signal<number | null>(null);
  readonly window = signal<[number | null, number | null] | null>(null);
  readonly sync = injectSvChartSync({
    categories: () => this.categories(),
    hover: (i) => this.hovered.set(i),
    zoom: (start, end) => this.window.set([start, end]),
  });
}

@Component({
  standalone: true,
  imports: [ProbeComponent, SvChartSyncDirective],
  template: `
    <sv-sync-probe svChartSync="ops" [categories]="a" />
    <sv-sync-probe svChartSync="ops" [categories]="b" />
    <sv-sync-probe svChartSync="other" [categories]="a" />
    <sv-sync-probe [categories]="a" />`,
})
class HostComponent {
  /** `b` starts a day later: index 0 is a different day in each. */
  readonly a = ['Mon', 'Tue', 'Wed', 'Thu'];
  readonly b = ['Tue', 'Wed', 'Thu', 'Fri'];
}

async function setup() {
  const { fixture, debugElement } = await render(HostComponent);
  const probes = debugElement.queryAll((d) => d.componentInstance instanceof ProbeComponent)
    .map((d) => d.componentInstance as ProbeComponent);
  /** Effects run on change detection. */
  const flush = () => fixture.detectChanges();
  return { fixture, probes, flush };
}

describe('svChartSync (FL-D5)', () => {
  it('a chart in no group gets no handle and pays for nothing', async () => {
    const { probes } = await setup();
    expect(probes[3].sync).toBeNull();
    expect(probes[0].sync).not.toBeNull();
  });

  it('hover is shared by category label, not index, within the group only', async () => {
    const { probes, flush } = await setup();
    const [a, b, other] = probes;
    a.sync!.publishHover(1); // Tue
    flush();
    expect(b.hovered()).toBe(0); // Tue is index 0 in b
    expect(other.hovered()).toBeNull();
    // Its own hover is never read back.
    expect(a.hovered()).toBeNull();

    a.sync!.publishHover(0); // Mon — b has no Monday, so it shows nothing
    flush();
    expect(b.hovered()).toBeNull();

    a.sync!.publishHover(null);
    flush();
    expect(b.hovered()).toBeNull();
  });

  it('a late leave from one chart does not wipe another chart\'s hover', async () => {
    const { probes, flush } = await setup();
    const [a, b] = probes;
    b.sync!.publishHover(1); // Wed in b
    flush();
    expect(a.hovered()).toBe(2);
    a.sync!.publishHover(null); // a never set it
    flush();
    expect(a.hovered()).toBe(2);
  });

  it('zoom is shared by label and a reset reaches everyone; nothing bounces back', async () => {
    const { probes, flush } = await setup();
    const [a, b] = probes;
    a.sync!.publishZoom({ start: 1, end: 3 }); // Tue–Thu
    flush();
    expect(b.window()).toEqual([0, 2]);
    expect(a.window()).toBeNull();

    a.sync!.publishZoom(null);
    flush();
    expect(b.window()).toEqual([null, null]);
  });

  it('a window a chart cannot show is left alone, not guessed', async () => {
    const { probes, flush } = await setup();
    const [a, b] = probes;
    a.sync!.publishZoom({ start: 0, end: 2 }); // Mon–Wed; b has no Monday
    flush();
    expect(b.window()).toBeNull();
  });
});
