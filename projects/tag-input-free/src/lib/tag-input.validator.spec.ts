import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvLiveAnnouncer } from '@styloviz/core/a11y';
import { SvTagInputComponent, type TagOption, type TagValidator } from './tag-input.component';

/**
 * `FL-J3-FI-15` / `FI-26-M4` / `FI-26-V1` — per-tag validation, the
 * email-recipients case: a rejected tag stays, marked, with its reason read
 * out; the control summarises; a form gets `{ invalidTags }`.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isEmail: TagValidator = (t: TagOption) => (EMAIL.test(t.value) ? null : 'not an email address');
const RECIPIENTS: TagOption[] = [
  { value: 'ada@example.com', label: 'ada@example.com' },
  { value: 'bob@', label: 'bob@' },
  { value: 'carol', label: 'carol' },
];

afterEach(() => TestBed.resetTestingModule());

async function setup(values: string[], inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvTagInputComponent, {
    inputs: { options: RECIPIENTS, values, tagValidator: isEmail, label: 'To', ...inputs },
  });
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance, root: fixture.nativeElement as HTMLElement };
}

describe('sv-tag-input — tagValidator', () => {
  it('marks only the rejected chips, with the reason read with each', async () => {
    const { root } = await setup(['ada@example.com', 'bob@', 'carol']);
    const bad = [...root.querySelectorAll('[data-sv-tag-invalid]')];
    expect(bad.map((b) => b.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
      'bob@ not valid: not an email address',
      'carol not valid: not an email address',
    ]);
    expect(bad[0].className).toContain('ring-danger-300');
  });

  it('summarises under the field, describes the input with it, and sets aria-invalid', async () => {
    const { root } = await setup(['ada@example.com', 'bob@', 'carol']);
    const summary = root.querySelector('[data-sv-tags-invalid]')!;
    expect(summary.textContent!.trim()).toBe('2 entries are not valid: bob@, carol');
    const input = root.querySelector('input[role="combobox"]')!;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain(summary.id);
  });

  it('is quiet when every tag passes, and when there is no validator', async () => {
    const ok = await setup(['ada@example.com']);
    expect(ok.root.querySelector('[data-sv-tags-invalid]')).toBeNull();
    expect(ok.root.querySelector('input[role="combobox"]')!.getAttribute('aria-invalid')).toBeNull();
    const none = await setup(['bob@'], { tagValidator: null });
    expect(none.root.querySelector('[data-sv-tag-invalid]')).toBeNull();
  });

  it('announces the summary through the shared live region when a rejected tag arrives', async () => {
    const { fixture } = await setup(['ada@example.com']);
    const live = TestBed.inject(SvLiveAnnouncer);
    live.clearHistory();
    fixture.componentRef.setInput('values', ['ada@example.com', 'bob@']);
    fixture.detectChanges();
    TestBed.tick();
    expect(live.history().map((h) => h.message)).toContain('1 entry is not valid: bob@');
  });

  it('reports { invalidTags } to a form', async () => {
    TestBed.resetTestingModule();
    const control = new FormControl<string[]>(['ada@example.com', 'carol']);
    const { fixture } = await render(
      `<sv-tag-input [formControl]="control" [options]="options" [tagValidator]="check" />`,
      { imports: [SvTagInputComponent, ReactiveFormsModule], componentProperties: { control, options: RECIPIENTS, check: isEmail } },
    );
    fixture.detectChanges();
    control.updateValueAndValidity();
    expect(control.errors).toEqual({ invalidTags: { values: ['carol'] } });
  });
});
