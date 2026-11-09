import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core/dev';
import { SvAccordionComponent, type AccordionItem } from './accordion.component';

/**
 * ============================================================================
 *  Print and expand/collapse all — FL-J3-NV-04 (`X-20`, `NV-01-I7`, `NV-01-M2`)
 * ============================================================================
 *
 * A printed FAQ used to be a list of questions: collapsed panels were not on
 * paper. `beforeprint` now reveals every enabled panel through the reveal
 * registry (the seam `reveal('print', …)` was reserved for), rendered
 * synchronously, and `afterprint` withdraws it — the reader's open set, the
 * URL and `itemToggled` never see the print pass.
 */

const ITEMS: AccordionItem[] = [
  { id: 'shipping', title: 'Shipping', content: 'Two days.', defaultOpen: true },
  { id: 'returns', title: 'Returns', content: 'Thirty days.' },
  { id: 'warranty', title: 'Warranty', content: 'One year.' },
  { id: 'legal', title: 'Legal', content: 'Small print.', disabled: true },
];

async function setup(inputs: Partial<ComponentInput<SvAccordionComponent>> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAccordionComponent, {
    inputs: { items: ITEMS, expandMode: 'multi', ...inputs } as ComponentInput<SvAccordionComponent>,
  });
  return fixture;
}

type Fixture = Awaited<ReturnType<typeof setup>>;
const expanded = (f: Fixture) =>
  [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button[aria-controls]')].map(
    (b) => b.getAttribute('aria-expanded'),
  );

describe('SvAccordionComponent — print (FL-J3-NV-04)', () => {
  it('beforeprint shows every enabled panel IN THE DOM at once (no scheduled render needed)', async () => {
    const f = await setup();
    expect(expanded(f)).toEqual(['true', 'false', 'false', 'false']);
    window.dispatchEvent(new Event('beforeprint'));
    // No fixture.detectChanges(): the snapshot follows the event synchronously.
    expect(expanded(f)).toEqual(['true', 'true', 'true', 'false']);
  });

  it('afterprint restores exactly the reader\'s own open set', async () => {
    const f = await setup();
    const toggled: unknown[] = [];
    f.componentInstance.itemToggled.subscribe((e) => toggled.push(e));
    window.dispatchEvent(new Event('beforeprint'));
    window.dispatchEvent(new Event('afterprint'));
    f.detectChanges();
    expect(expanded(f)).toEqual(['true', 'false', 'false', 'false']);
    expect([...f.componentInstance.openIds()]).toEqual(['shipping']);
    expect(toggled).toEqual([]);
  });

  it('a print reveal never touches openIds, even in single mode', async () => {
    const f = await setup({ expandMode: 'single' });
    window.dispatchEvent(new Event('beforeprint'));
    expect([...f.componentInstance.openIds()]).toEqual(['shipping']);
    expect(f.componentInstance.revealedIds().has('warranty')).toBe(true);
    window.dispatchEvent(new Event('afterprint'));
  });

  it('a search reveal survives the print pass being withdrawn', async () => {
    const f = await setup({ searchQuery: 'thirty' });
    f.detectChanges();
    window.dispatchEvent(new Event('beforeprint'));
    window.dispatchEvent(new Event('afterprint'));
    f.detectChanges();
    expect(expanded(f)).toEqual(['true', 'true', 'false', 'false']);
  });

  it('expandOnPrint=false leaves print alone', async () => {
    const f = await setup({ expandOnPrint: false });
    window.dispatchEvent(new Event('beforeprint'));
    f.detectChanges();
    expect(expanded(f)).toEqual(['true', 'false', 'false', 'false']);
  });

  it('the height transition is off for print', async () => {
    const f = await setup();
    const region = (f.nativeElement as HTMLElement).querySelector('[role="region"]')!;
    expect(region.className).toContain('print:transition-none');
    expect(region.firstElementChild!.className).toContain('print:transition-none');
  });

  it('stops listening on destroy', async () => {
    const f = await setup();
    const cmp = f.componentInstance;
    f.destroy();
    window.dispatchEvent(new Event('beforeprint'));
    expect(cmp.revealedIds().size).toBe(0);
  });
});

describe('SvAccordionComponent — expandAll / collapseAll (FL-J3-NV-04)', () => {
  beforeEach(() => svResetWarnOnce());

  it('expandAll opens every enabled panel in multi mode and writes openIds', async () => {
    const f = await setup();
    f.componentInstance.expandAll();
    f.detectChanges();
    expect(expanded(f)).toEqual(['true', 'true', 'true', 'false']);
    expect([...f.componentInstance.openIds()].sort()).toEqual(['returns', 'shipping', 'warranty']);
  });

  it('expandAll is a warned no-op in single mode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const f = await setup({ expandMode: 'single' });
    f.componentInstance.expandAll();
    f.detectChanges();
    expect(expanded(f)).toEqual(['true', 'false', 'false', 'false']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('collapseAll closes the reader\'s panels AND the ones a search is holding open', async () => {
    const f = await setup({ searchQuery: 'year' });
    f.detectChanges();
    expect(expanded(f)).toEqual(['true', 'false', 'true', 'false']);
    f.componentInstance.collapseAll();
    f.detectChanges();
    expect(expanded(f)).toEqual(['false', 'false', 'false', 'false']);
    expect(f.componentInstance.openIds().size).toBe(0);
  });

  it('collapseAll moves focus from inside a closing panel to its header', async () => {
    const f = await setup({ items: [{ ...ITEMS[0], content: 'x' }, ITEMS[1]] });
    const root = f.nativeElement as HTMLElement;
    const region = root.querySelector<HTMLElement>('[role="region"]')!;
    const probe = document.createElement('button');
    region.querySelector('[role="region"] > div > div')!.appendChild(probe);
    probe.focus();
    f.componentInstance.collapseAll();
    f.detectChanges();
    expect(document.activeElement).toBe(root.querySelector('button[aria-controls]'));
  });
});
