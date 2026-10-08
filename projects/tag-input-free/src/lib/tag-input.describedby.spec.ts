import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvTagInputComponent, type TagOption } from './tag-input.component';

/**
 * `FI-27-I3` / `FI-27-M1` — this control used to describe itself with NOTHING.
 *
 * The hint, the validation message and the `n / max` counter all rendered as
 * bare `<p>` elements with no ids, and there was no `aria-describedby` anywhere
 * in the component. A screen-reader user reaching the combobox was told neither
 * the instruction nor the rejection.
 *
 * It was invisible to every gate for a reason worth remembering: **there was no
 * wrong id to catch, because there was no id.** A rule looking for a broken
 * `aria-describedby` finds nothing to complain about in a component that has
 * none — absence is the one defect a reference check cannot see.
 */

const OPTIONS = (): TagOption[] => [
  { value: 'ng', label: 'Angular' },
  { value: 'react', label: 'React' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvTagInputComponent, {
    inputs: { options: OPTIONS(), ...inputs },
  });
  return fixture;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const combobox = (f: { nativeElement: unknown }) =>
  el(f).querySelector<HTMLElement>('[role="combobox"]')!;

/** The ids in `aria-describedby` — it is a LIST. */
const ids = (t: HTMLElement): string[] =>
  (t.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);

const describedText = (f: { nativeElement: unknown }, t: HTMLElement): string =>
  ids(t).map((id) => el(f).querySelector(`#${id}`)?.textContent ?? '').join(' ');

describe('SvTagInputComponent — what the combobox says it is described by', () => {
  it('describes the hint', async () => {
    const f = await setup({ hint: 'Press Enter after each tag' });
    expect(describedText(f, combobox(f))).toContain('Press Enter after each tag');
  });

  it('describes the validation message, and marks itself invalid', async () => {
    const f = await setup({ errorMessage: 'Pick at least one tag' });
    const box = combobox(f);

    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(describedText(f, box)).toContain('Pick at least one tag');
  });

  it('names only elements that are actually on the page', async () => {
    // An id pointing at nothing announces nothing AND reports nothing — the
    // failure mode that makes this worth asserting per-id rather than by count.
    const f = await setup({ hint: 'Press Enter after each tag' });
    const list = ids(combobox(f));

    expect(list.length).toBeGreaterThan(0);
    for (const id of list) {
      expect(el(f).querySelector(`#${id}`), id).not.toBeNull();
    }
  });

  it('says nothing when there is genuinely nothing to say', async () => {
    const f = await setup();
    expect(combobox(f).getAttribute('aria-describedby')).toBeNull();
    expect(combobox(f).getAttribute('aria-invalid')).toBeNull();
  });
});
