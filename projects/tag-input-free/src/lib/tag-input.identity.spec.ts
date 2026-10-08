import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvTagInputComponent, type TagOption } from './tag-input.component';

/**
 * ============================================================================
 *  The free twin's identity and paste paths  ·  `FI-26-M1` / `FI-26-M3`
 *  (re-verified 2026-09-26)
 * ============================================================================
 *
 * ★★★ `compareWith` REACHED THIS TWIN AND WAS HALF-WIRED. Resolution and
 *     removal used it; the suggestion list and `selectOption` still compared
 *     raw values with a `Set`, so under a case-insensitive comparator a held
 *     tag stayed on offer and could be added twice.
 *
 * ★★★ AND THERE WAS NO PASTE HANDLER. The Pro twin got one; this one put a
 *     pasted list in the query box as one string and said "No results found".
 */

const PEOPLE = (): TagOption[] => [
  { value: 'u1', label: 'Alex Chen', sublabel: 'Design' },
  { value: 'u2', label: 'Alex Chen', sublabel: 'Engineering' },
  { value: 'u3', label: 'Priya Nair', sublabel: 'Design' },
  { value: 'u4', label: 'Sam Lee', disabled: true },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvTagInputComponent, {
    inputs: { options: PEOPLE(), ...inputs },
  });
  return fixture;
}

afterEach(() => {
  document.querySelectorAll('.sv-tag-input-portal').forEach((el) => el.remove());
  TestBed.resetTestingModule();
});

const paste = (c: SvTagInputComponent, text: string): ClipboardEvent => {
  const e = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(e, 'clipboardData', { value: { getData: () => text } });
  c.onPaste(e);
  return e;
};

const ci = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

describe('compareWith — every path agrees', () => {
  it('strict equality by default, so nothing changes without one', async () => {
    const f = await setup({ values: ['U1'] });
    expect(f.componentInstance.filteredOptions().map((o) => o.value)).toContain('u1');
  });

  it('takes a held tag off the suggestion list by the comparator', async () => {
    const f = await setup({ values: ['U1'], compareWith: ci });
    expect(f.componentInstance.filteredOptions().map((o) => o.value)).not.toContain('u1');
  });

  it('refuses to add a second copy through selectOption', async () => {
    const f = await setup({ values: ['U1'], compareWith: ci });
    f.componentInstance.selectOption(PEOPLE()[0]);
    expect(f.componentInstance.values()).toEqual(['U1']);
  });

  it('renders the list without the held tag', async () => {
    const f = await setup({ values: ['U3'], compareWith: ci });
    f.componentInstance.open();
    f.detectChanges();
    const labels = [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent!.trim());
    expect(labels).not.toContain('Priya Nair');
    expect(labels).toContain('Alex Chen');
  });
});

describe('pasting a list', () => {
  it('makes several tags from option labels, not one query string', async () => {
    const f = await setup({ values: [] });
    const e = paste(f.componentInstance, 'Priya Nair\nu1');
    expect(e.defaultPrevented).toBe(true);
    expect(f.componentInstance.values()).toEqual(['u3', 'u1']);
    expect(f.componentInstance.query()).toBe('');
  });

  it('leaves a single-entry paste to the browser', async () => {
    const f = await setup({ values: [] });
    const e = paste(f.componentInstance, 'Priya Nair');
    expect(e.defaultPrevented).toBe(false);
    expect(f.componentInstance.values()).toEqual([]);
  });

  it('refuses what it cannot hold, an ambiguous label, and a disabled option — and says so', async () => {
    const f = await setup({ values: [] });
    paste(f.componentInstance, 'Priya Nair, nobody@nowhere, Alex Chen, Sam Lee');
    expect(f.componentInstance.values()).toEqual(['u3']);
    const reasons = f.componentInstance.pasteReport()!.rejected.map((r) => r.reason).sort();
    expect(reasons).toEqual(['ambiguous', 'invalid', 'invalid']);
    expect(f.componentInstance.pasteMessage()).toContain('not recognised');
  });

  it('does not duplicate a held tag, by the comparator', async () => {
    const f = await setup({ values: ['U3'], compareWith: ci });
    paste(f.componentInstance, 'Priya Nair, u1');
    expect(f.componentInstance.values()).toEqual(['U3', 'u1']);
    expect(f.componentInstance.pasteReport()!.rejected[0].reason).toBe('duplicate');
  });

  it('renders the report as a status, links it from the input, and dismisses it', async () => {
    const f = await setup({ values: [] });
    paste(f.componentInstance, 'Priya Nair, nobody@nowhere');
    f.detectChanges();

    const host = f.nativeElement as HTMLElement;
    const report = host.querySelector('[role="status"]')!;
    expect(report).not.toBeNull();
    expect(report.textContent).toContain('not recognised');
    expect(host.querySelector('input')!.getAttribute('aria-describedby')).toContain(report.getAttribute('id'));

    f.componentInstance.dismissPasteReport();
    f.detectChanges();
    expect(host.querySelector('[role="status"]')).toBeNull();
  });

  it('is wired to the input’s (paste) event', async () => {
    const f = await setup({ values: [] });
    const input = (f.nativeElement as HTMLElement).querySelector('input')!;
    const e = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(e, 'clipboardData', { value: { getData: () => 'Priya Nair, u1' } });
    input.dispatchEvent(e);
    expect(f.componentInstance.values()).toEqual(['u3', 'u1']);
  });
});
