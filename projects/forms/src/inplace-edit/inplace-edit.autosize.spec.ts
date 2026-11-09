import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvInplaceEditComponent } from './inplace-edit.component';

/** `FL-J3-FI-16` / `FI-12-M5` — the textarea editor grows with its text. */
async function open(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvInplaceEditComponent, {
    inputs: { mode: 'textarea', value: 'one', label: 'Notes', ...inputs, editing: true },
  });
  fixture.detectChanges();
  return { fixture, area: (fixture.nativeElement as HTMLElement).querySelector('textarea') };
}

describe('sv-inplace-edit — autosize', () => {
  it('puts the autosizing directive on the textarea editor, rows as the floor', async () => {
    const { area } = await open({ autosize: true, rows: 2, maxRows: 6 });
    expect(area).not.toBeNull();
    expect(area!.getAttribute('rows')).toBe('2');
    expect(area!.hasAttribute('data-sv-autosize')).toBe(true);
  });

  it('re-measures as the draft changes (the measured path jsdom takes)', async () => {
    const { fixture, area } = await open({ autosize: true });
    Object.defineProperty(area!, 'scrollHeight', { configurable: true, value: 150 });
    area!.value = 'a\nb\nc\nd\ne\nf';
    area!.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(area!.style.height).toBe('150px');
  });

  it('is off by default — a fixed box of `rows`', async () => {
    const { area } = await open({});
    expect(area!.hasAttribute('data-sv-autosize')).toBe(false);
    expect(area!.style.height).toBe('');
  });
});
