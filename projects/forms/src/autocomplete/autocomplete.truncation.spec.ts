import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvAutocompleteComponent, type AutocompleteOption } from './autocomplete.component';

/**
 * `FI-01-I2` — the boundary was there all along; it was SILENT.
 *
 * ★★★ THE FILED DEFECT SAYS "no virtualized or server-filtered boundary". There
 *     is a boundary, and a hard one: `filtered()` ends in
 *     `.slice(0, maxItems())` and `maxItems` defaults to **8**. A query
 *     matching 500 options showed eight, offered eight to the keyboard, and
 *     said nothing about the other 492 — so a user whose entry was 300th in the
 *     list concluded it was not there and typed something else.
 *
 * ⚠️ AND IT IS NOT AN `aria-setsize` PROBLEM, which is what it looks like at
 *    first glance. The unrendered options are genuinely unreachable — no key
 *    gets to them — so declaring a set size of 500 would promise items that are
 *    not in the document at all. A screen-reader user would be told there are
 *    500 and find 8. What was missing is the DISCLOSURE, in words, for
 *    everybody.
 */

const many = (n: number): AutocompleteOption[] =>
  Array.from({ length: n }, (_, i) => ({ value: `v${i}`, label: `Result ${i}` }));

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAutocompleteComponent, { inputs });
  fixture.detectChanges();
  const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
  return { fixture, input, c: fixture.componentInstance, host: fixture.nativeElement as HTMLElement };
}

/** The panel is portalled into <body>, so panel assertions query the document. */
const portal = () => document.querySelector<HTMLElement>('.sv-ac-portal');

/** Open it the way a user does — the panel only mounts on the real path. */
function openWith(
  s: { fixture: { detectChanges(): void }; input: HTMLInputElement }, text: string,
): void {
  s.input.dispatchEvent(new Event('focus'));
  s.input.value = text;
  s.input.dispatchEvent(new Event('input', { bubbles: true }));
  s.fixture.detectChanges();
}

afterEach(() => {
  document.querySelectorAll('.sv-ac-portal').forEach((n) => n.remove());
  TestBed.resetTestingModule();
});

describe('sv-autocomplete — counting what is not shown', () => {
  it('counts every match, not just the ones that survived the slice', async () => {
    const { c } = await setup({ options: many(500) });
    c.query.set('Result');
    expect(c.filtered()).toHaveLength(8);
    expect(c.matchCount()).toBe(500);
    expect(c.hiddenCount()).toBe(492);
    expect(c.isTruncated()).toBe(true);
  });

  it('says nothing when everything fits', async () => {
    const { c } = await setup({ options: many(5) });
    c.query.set('Result');
    expect(c.filtered()).toHaveLength(5);
    expect(c.hiddenCount()).toBe(0);
    expect(c.isTruncated()).toBe(false);
    expect(c.truncationNote()).toBe('');
  });

  it('says nothing at exactly the limit', async () => {
    // The off-by-one: eight of eight is not a truncation, and claiming one
    // would teach the user to distrust the message when it matters.
    const { c } = await setup({ options: many(8) });
    c.query.set('Result');
    expect(c.filtered()).toHaveLength(8);
    expect(c.isTruncated()).toBe(false);
  });

  it('counts matches, not the whole list', async () => {
    const options = [...many(3), { value: 'x', label: 'Something else' }];
    const { c } = await setup({ options, maxItems: 2 });
    c.query.set('Result');
    expect(c.matchCount()).toBe(3);
    expect(c.hiddenCount()).toBe(1);
  });

  it('truncates the unfiltered list too, and says so', async () => {
    // Opening with an empty query shows `maxItems` of everything. That is the
    // same silent cut, and it is the one a user meets first.
    const { c } = await setup({ options: many(500) });
    expect(c.query()).toBe('');
    expect(c.filtered()).toHaveLength(8);
    expect(c.isTruncated()).toBe(true);
  });
});

describe('sv-autocomplete — what it says', () => {
  it('offers the action that actually narrows the list', async () => {
    const { c } = await setup({ options: many(500) });
    c.query.set('Result');
    expect(c.truncationNote()).toBe('Showing 8 of 500 — keep typing to narrow');
  });

  it('drops the advice when the host owns the query', async () => {
    // ⚠️ "Keep typing" is only true when THIS component is filtering. Under
    //    `serverSide` the host decides what a narrower query returns, and
    //    promising otherwise is a guess about somebody else's endpoint.
    const { c } = await setup({ options: many(50), serverSide: true });
    c.query.set('Result');
    expect(c.truncationNote()).toBe('Showing 8 of 50');
  });

  it('believes the server’s total over the length of one page', async () => {
    // ★★ Under `serverSide` the array IS one page, so counting it understates
    //    the answer — "8 of 20" when the server has 4,312.
    const { c } = await setup({ options: many(20), serverSide: true, totalCount: 4312 });
    c.query.set('Result');
    expect(c.matchCount()).toBe(4312);
    expect(c.truncationNote()).toBe('Showing 8 of 4,312');
  });

  it('ignores totalCount when it is doing the filtering itself', async () => {
    // Without `serverSide` the array is everything, and a host's count would
    // simply be wrong.
    const { c } = await setup({ options: many(50), totalCount: 4312 });
    c.query.set('Result');
    expect(c.matchCount()).toBe(50);
  });

  it('ignores a nonsense total rather than rendering it', async () => {
    const { c } = await setup({ options: many(50), serverSide: true, totalCount: -1 });
    c.query.set('Result');
    expect(c.matchCount()).toBe(50);
  });
});

describe('sv-autocomplete — how it says it', () => {
  it('renders the note inside the panel, hidden from the listbox’s semantics', async () => {
    // ★★★ A bare <li> inside `role="listbox"` is an unlabelled OPTION to
    //     assistive tech. Left plain, this row announces as a ninth result that
    //     no key can reach — trading one silent failure for a louder one.
    const s = await setup({ options: many(500) });
    openWith(s, 'Result');

    const row = portal()!.querySelector('[data-sv-state="truncated"]');
    expect(row).not.toBeNull();
    expect(row!.getAttribute('role')).toBe('presentation');
    expect(row!.getAttribute('aria-hidden')).toBe('true');
    expect(row!.textContent).toContain('Showing 8 of 500');
  });

  it('announces it once through a status region outside the listbox', async () => {
    const s = await setup({ options: many(500) });
    openWith(s, 'Result');

    const status = s.host.querySelector('[data-sv-state="truncation-status"]')!;
    expect(status.getAttribute('role')).toBe('status');
    expect(status.closest('[role="listbox"]')).toBeNull();
    expect(status.textContent).toContain('Showing 8 of 500');
  });

  it('keeps the status empty while the panel is shut', async () => {
    // A region that announces a count for a panel nobody has opened is noise.
    const s = await setup({ options: many(500) });
    openWith(s, 'Result');
    s.c.open.set(false);
    s.fixture.detectChanges();

    expect(s.host.querySelector('[data-sv-state="truncation-status"]')!.textContent!.trim())
      .toBe('');
  });

  it('does not claim a set size the document cannot deliver', async () => {
    // The wrong fix, pinned as wrong. If a later change adds `aria-setsize` to
    // the options, this fails — and it should, because the unrendered options
    // are unreachable.
    const s = await setup({ options: many(500) });
    openWith(s, 'Result');

    const options = Array.from(portal()!.querySelectorAll('[role="option"]'));
    expect(options.length).toBe(8);
    for (const o of options) expect(o.hasAttribute('aria-setsize')).toBe(false);
  });
});
