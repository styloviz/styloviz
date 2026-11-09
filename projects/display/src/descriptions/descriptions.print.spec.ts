import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvDescriptionsComponent, type DescriptionItem } from './descriptions.component';

/** FL-J3-DD-32 — a printed page break never separates a `<dt>` from its `<dd>`. */
const ITEMS: DescriptionItem[] = [
  { id: 'status', label: 'Status', value: 'Shipped' },
  { id: 'carrier', label: 'Carrier', value: 'DHL Express' },
];

describe.each([
  ['horizontal', 'plain'],
  ['horizontal', 'bordered'],
  ['vertical', 'plain'],
  ['vertical', 'bordered'],
] as const)('SvDescriptionsComponent — print, %s / %s (DD-10-I3 / M5)', (layout, variant) => {
  async function pairs() {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvDescriptionsComponent, { inputs: { items: ITEMS, layout, variant } });
    fixture.detectChanges();
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll('dl > div')];
  }

  it('keeps every term/value pair together across a page break', async () => {
    const cells = await pairs();
    expect(cells).toHaveLength(2);
    for (const cell of cells) {
      expect(cell.className).toContain('print:break-inside-avoid');
      expect(cell.querySelector('dt')!.className).toContain('print:break-after-avoid');
      expect(cell.querySelector('dd')).not.toBeNull();
    }
  });
});
