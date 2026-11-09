import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core/dev';
import { SV_NAV_TELEMETRY, type SvNavEvent, type SvNavTelemetry } from '@styloviz/core/nav';
import { SvJumpMenuComponent, type JumpMenuItem } from './jump-menu.component';

/**
 * ============================================================================
 *  The jump menu on the shared navigation stream — FL-J3-NV-07
 * ============================================================================
 *
 * Every destination taken is a `jump`; a disabled one, or a pick held for the
 * Go button, is not a move yet and records nothing.
 */

const ITEMS: JumpMenuItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'inputs', label: 'Inputs' },
  { id: 'legacy', label: 'Legacy', disabled: true },
];

function sink(retention = '30d', granted = true) {
  const seen: SvNavEvent[] = [];
  const provided: SvNavTelemetry = { kind: 'spec', retention, consent: () => granted, record: (e) => seen.push(e) };
  return { seen, provided };
}

async function setup(inputs: Record<string, unknown> = {}, opts: { retention?: string; granted?: boolean } = {}) {
  TestBed.resetTestingModule();
  svResetWarnOnce();
  const { seen, provided } = sink(opts.retention ?? '30d', opts.granted ?? true);
  const { fixture } = await render(SvJumpMenuComponent, {
    inputs: { items: ITEMS, surfaceId: 'docs-sections', ...inputs },
    providers: [{ provide: SV_NAV_TELEMETRY, useValue: provided }],
  });
  const select = (fixture.nativeElement as HTMLElement).querySelector('select')!;
  const choose = (id: string) => {
    select.value = id;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  return { fixture, c: fixture.componentInstance, seen, choose };
}

describe('SvJumpMenuComponent — SV_NAV_TELEMETRY (FL-J3-NV-07)', () => {
  it('choosing a destination is a jump with its id, label, position and the surface named', async () => {
    const { seen, choose } = await setup();
    choose('inputs');
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ surface: 'jump-menu', surfaceId: 'docs-sections', intent: 'jump', key: 'inputs', label: 'Inputs', index: 1 });
  });

  it('under goButton, the pick records nothing until Go takes it', async () => {
    const { c, seen, choose } = await setup({ goButton: true });
    choose('inputs');
    expect(seen).toEqual([]);
    c.go();
    expect(seen.map((e) => e.key)).toEqual(['inputs']);
  });

  it('retention "none" strips key and label; no consent records nothing', async () => {
    const stripped = await setup({}, { retention: 'none' });
    stripped.choose('overview');
    expect(stripped.seen[0]).toMatchObject({ intent: 'jump', key: null, label: null, index: 0 });

    const silent = await setup({}, { granted: false });
    silent.choose('overview');
    expect(silent.seen).toEqual([]);
  });
});
