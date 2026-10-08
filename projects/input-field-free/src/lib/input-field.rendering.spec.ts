import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvInputFieldComponent, type InputOption, type InputSize, type InputVariant } from './input-field.component';

/**
 * Which element this renders, what sits either side of it, and which of the
 * three mutually-exclusive trailing slots wins.
 *
 * The trailing slot is a four-way `@else if` chain — spinner, password eye,
 * state icon, custom icon — and only one arm can ever be on screen. Three of
 * the four were unreachable by any existing test, which is how a component
 * ends up showing a validation icon where the reveal button should be.
 */

async function setup(inputs: Partial<ComponentInput<SvInputFieldComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvInputFieldComponent, {
    inputs: inputs as ComponentInput<SvInputFieldComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const field = (f: { nativeElement: unknown }) =>
  el(f).querySelector<HTMLInputElement>('input, textarea, select')!;

/**
 * A rendered glyph's shape. `[name]` is not reflected to the DOM, so a spec
 * that used to read `path[d="…"]` straight back has to compare drawn shapes.
 * Walks descendants — the renderer wraps its primitives in a `<g transform>`.
 */
const glyphSig = (root: Element | null) => {
  const svg = root?.querySelector('sv-icon svg');
  if (!svg) return '';
  return [...svg.querySelectorAll('path, circle, line, polyline, polygon, rect')]
    .map((n) => `${n.tagName},${n.getAttribute('d') ?? ''},${n.getAttribute('x1') ?? ''}`)
    .join('|');
};

describe('SvInputFieldComponent — which native control', () => {
  it('renders an <input> by default', async () => {
    const { fixture } = await setup({});
    expect(field(fixture).tagName).toBe('INPUT');
    expect(field(fixture).type).toBe('text');
  });

  it('renders a <textarea> when multiline', async () => {
    const { fixture } = await setup({ multiline: true });
    expect(field(fixture).tagName).toBe('TEXTAREA');
  });

  it('renders a <select> as soon as it has options — options outrank multiline', async () => {
    const options: InputOption[] = [
      { label: 'Draft', value: 'draft' },
      { label: 'Published', value: 'published', disabled: true },
    ];
    const { fixture } = await setup({ options, multiline: true, value: 'draft' });
    expect(field(fixture).tagName).toBe('SELECT');
    expect(fixture.componentInstance.isSelect()).toBe(true);

    const opts = [...el(fixture).querySelectorAll('option')];
    expect(opts.map((o) => o.textContent?.trim())).toEqual(['Draft', 'Published']);
    // `disabled?: boolean` is optional — the undefined case must coerce to false.
    expect(opts[0].disabled).toBe(false);
    expect(opts[1].disabled).toBe(true);
  });

  it('renders a disabled placeholder option only when a placeholder was given', async () => {
    const options: InputOption[] = [{ label: 'Draft', value: 'draft' }];
    const withPh = await setup({ options, placeholder: 'Pick one' });
    const first = el(withPh.fixture).querySelector('option')!;
    expect(first.textContent?.trim()).toBe('Pick one');
    expect(first.hasAttribute('disabled')).toBe(true);

    const without = await setup({ options });
    expect(el(without.fixture).querySelectorAll('option').length).toBe(1);
  });

  it('falls back to an empty option list rather than rendering a select', async () => {
    const { fixture } = await setup({ options: [] });
    expect(fixture.componentInstance.isSelect()).toBe(false);
    expect(field(fixture).tagName).toBe('INPUT');
  });
});

describe('SvInputFieldComponent — the label row', () => {
  it('is absent entirely without a label', async () => {
    const { fixture } = await setup({});
    expect(el(fixture).querySelector('label')).toBeNull();
  });

  it('points at the control it actually rendered', async () => {
    const { fixture } = await setup({ label: 'Email' });
    const label = el(fixture).querySelector<HTMLLabelElement>('label')!;
    expect(label.htmlFor).toBe(field(fixture).id);
    expect(field(fixture).id).not.toBe('');
  });

  it('lets the host own the id', async () => {
    const { fixture } = await setup({ label: 'Email', inputId: 'checkout-email' });
    expect(field(fixture).id).toBe('checkout-email');
    expect(fixture.componentInstance.describedById()).toBe('checkout-email-desc');
  });

  it('gives two unnamed fields different ids', async () => {
    // Both fields must share one application: ids are per application (svUniqueId).
    const a = await setup({ label: 'From' });
    const b = TestBed.createComponent(SvInputFieldComponent);
    b.componentRef.setInput('label', 'To');
    b.detectChanges();
    await b.whenStable();
    expect(field(a.fixture).id).not.toBe('');
    expect(field(a.fixture).id).not.toBe(field(b).id);
  });

  it('shows the asterisk for required and the (optional) tag for neither', async () => {
    const req = await setup({ label: 'Email', required: true, optionalTag: true });
    // `optionalTag` is suppressed by `required` — the two together are a
    // contradiction, and the asterisk is the one that must win.
    expect(el(req.fixture).querySelector('label')?.textContent).toContain('*');
    expect(el(req.fixture).querySelector('label')?.textContent).not.toContain('optional');

    const opt = await setup({ label: 'Email', optionalTag: true });
    expect(el(opt.fixture).querySelector('label')?.textContent).toContain('(optional)');

    const plain = await setup({ label: 'Email' });
    expect(el(plain.fixture).querySelector('label')?.textContent?.trim()).toBe('Email');
  });

  it('marks the control required for an AT, not only visually', async () => {
    const req = await setup({ label: 'Email', required: true });
    expect(field(req.fixture).getAttribute('aria-required')).toBe('true');

    const plain = await setup({ label: 'Email' });
    expect(field(plain.fixture).getAttribute('aria-required')).toBeNull();
  });
});

describe('SvInputFieldComponent — leading and trailing slots', () => {
  // Was a raw `d` string; now a library NAME. `search` is deliberately
  // different from every state glyph so the two can never be confused.
  const ICON = 'search';


  it('has neither slot when nothing was given', async () => {
    const { fixture } = await setup({});
    const c = fixture.componentInstance;
    expect([c.hasLeading(), c.hasTrailing()]).toEqual([false, false]);
  });

  it('renders a leading icon on its own', async () => {
    const { fixture } = await setup({ leadingIcon: ICON });
    expect(fixture.componentInstance.hasLeading()).toBe(true);
    expect(glyphSig(el(fixture))).not.toBe('');
  });

  it('renders a leading addon when there is no icon to outrank it', async () => {
    const { fixture } = await setup({ leadingAddon: 'https://' });
    expect(fixture.componentInstance.hasLeading()).toBe(true);
    expect(el(fixture).textContent).toContain('https://');
  });

  /**
   * ★ DEFECT (fixed): both slots set rendered NEITHER.
   *
   * `leadingAddon` is documented "Ignored when `leadingIcon` is set", and
   * the addon's own guard honoured that — but the icon carried the mirror-image
   * guard `&& !leadingAddon()`, so setting both cancelled them out. Meanwhile
   * `hasLeading()` still reported true, which strips the input's left padding.
   * The user got a blank inset gap with the text jammed against the border and
   * no icon. Same shape on the trailing side. Both twins.
   */
  it('lets a leading icon outrank a leading addon instead of cancelling with it', async () => {
    const { fixture } = await setup({ leadingIcon: ICON, leadingAddon: '$' });
    expect(fixture.componentInstance.hasLeading()).toBe(true);
    expect(glyphSig(el(fixture))).not.toBe('');
    expect(el(fixture).textContent).not.toContain('$');
  });

  it('renders a trailing addon, and lets a trailing icon suppress it', async () => {
    const addon = await setup({ trailingAddon: '.com' });
    expect(el(addon.fixture).textContent).toContain('.com');

    const both = await setup({ trailingAddon: '.com', trailingIcon: ICON });
    expect(el(both.fixture).textContent).not.toContain('.com');
    expect(glyphSig(el(both.fixture))).not.toBe('');
  });

  it('gives the trailing slot to the spinner ahead of everything else', async () => {
    // loading + password + error is the state a submit lands in; showing the
    // eye or the alert there means the user cannot tell the request is running.
    const { fixture } = await setup({
      loading: true, type: 'password', errorMessage: 'Taken', trailingIcon: ICON,
    });
    expect(el(fixture).querySelector('sv-spinner-arc')).not.toBeNull();
    expect(el(fixture).querySelector('[aria-label="Show password"]')).toBeNull();
  });

  it('gives it to the password eye ahead of the state icon', async () => {
    const { fixture } = await setup({ type: 'password', errorMessage: 'Too short' });
    expect(el(fixture).querySelector('[aria-label="Show password"]')).not.toBeNull();
    expect(fixture.componentInstance.stateIconName()).not.toBe('');
  });

  it('shows the state icon only when the host has left the slot free', async () => {
    // A host that asked for a specific trailing icon keeps it; the state is
    // still announced by `aria-invalid` and the message below the field, so
    // nothing is lost by the icon yielding.
    const free = await setup({ errorMessage: 'Taken' });
    expect(free.fixture.componentInstance.stateIconName()).toBe('alert-triangle');
    expect(el(free.fixture).querySelector('sv-icon')).not.toBeNull();

    const taken = await setup({ errorMessage: 'Taken', trailingIcon: ICON });
    expect(taken.fixture.componentInstance.trailingIcon()).toBe(ICON);
    expect(glyphSig(el(taken.fixture))).not.toBe('');

    const addon = await setup({ errorMessage: 'Taken', trailingAddon: 'USD' });
    expect(el(addon.fixture).textContent).toContain('USD');
  });

  it('shows a custom trailing icon when nothing outranks it', async () => {
    const { fixture } = await setup({ trailingIcon: ICON });
    expect(fixture.componentInstance.hasTrailing()).toBe(true);
    expect(glyphSig(el(fixture))).not.toBe('');
  });

  it('counts a password field as having a trailing slot even with no icon set', async () => {
    const { fixture } = await setup({ type: 'password' });
    expect(fixture.componentInstance.hasTrailing()).toBe(true);
  });
});

describe('SvInputFieldComponent — the state icon', () => {
  const cases: { state: 'error' | 'success' | 'warning' | 'default'; name: string; colour: string }[] = [
    { state: 'error',   name: 'alert-triangle', colour: 'text-danger-500' },
    { state: 'success', name: 'check-circle',   colour: 'text-accent-500' },
    { state: 'warning', name: 'alert-triangle', colour: 'text-warning-500' },
    { state: 'default', name: '',               colour: 'text-gray-500 dark:text-gray-400' },
  ];

  for (const { state, name, colour } of cases) {
    it(`names and colours the ${state} state`, async () => {
      const { fixture } = await setup({ state });
      const c = fixture.componentInstance;
      expect(c.stateIconName()).toBe(name);
      expect(c.stateIconColorClass()).toBe(colour);
      // `stateIconPath` — the raw-path map this name replaced — is gone from
      // BOTH twins now; the Pro one was still drawing from it.
      expect((c as unknown as Record<string, unknown>)['stateIconPath']).toBeUndefined();
      expect(glyphSig(el(fixture)) === '').toBe(state === 'default');
      expect(c.hintColorClass()).toContain(
        state === 'error' ? 'danger' : state === 'success' ? 'accent' : state === 'warning' ? 'warning' : 'gray',
      );
    });
  }
});

describe('SvInputFieldComponent — native attributes it forwards', () => {
  it('forwards the numeric constraints, and omits them when null', async () => {
    const set = await setup({ type: 'number', min: 1, max: 10, step: 2, inputMode: 'numeric' });
    const input = field(set.fixture);
    expect([input.getAttribute('min'), input.getAttribute('max'), input.getAttribute('step')])
      .toEqual(['1', '10', '2']);
    expect(input.getAttribute('inputmode')).toBe('numeric');

    const unset = await setup({ type: 'number' });
    const bare = field(unset.fixture);
    expect(bare.hasAttribute('min')).toBe(false);
    expect(bare.hasAttribute('inputmode')).toBe(false);
  });

  it('forwards length attributes only when they are positive', async () => {
    const set = await setup({ maxLength: 5, minLength: 2, pattern: '\\d+', inputName: 'code' });
    const input = field(set.fixture);
    expect(input.getAttribute('maxlength')).toBe('5');
    expect(input.getAttribute('minlength')).toBe('2');
    expect(input.getAttribute('pattern')).toBe('\\d+');
    expect(input.getAttribute('name')).toBe('code');

    const zero = await setup({ maxLength: 0, minLength: 0 });
    expect(field(zero.fixture).hasAttribute('maxlength')).toBe(false);
    expect(field(zero.fixture).hasAttribute('minlength')).toBe(false);
    expect(field(zero.fixture).hasAttribute('name')).toBe(false);
  });

  it('forwards spellcheck in both directions, and leaves it to the browser when null', async () => {
    const on = await setup({ spellcheck: true });
    expect(field(on.fixture).getAttribute('spellcheck')).toBe('true');

    const off = await setup({ spellcheck: false });
    expect(field(off.fixture).getAttribute('spellcheck')).toBe('false');

    const dflt = await setup({});
    expect(field(dflt.fixture).hasAttribute('spellcheck')).toBe(false);
  });

  it('defaults autocomplete for passwords only, and yields to an explicit token', async () => {
    expect((await setup({ type: 'password' })).fixture.componentInstance.resolvedAutocomplete())
      .toBe('current-password');
    expect((await setup({ type: 'password', autocomplete: 'new-password' }))
      .fixture.componentInstance.resolvedAutocomplete()).toBe('new-password');
    expect((await setup({ type: 'email' })).fixture.componentInstance.resolvedAutocomplete())
      .toBeNull();
    expect((await setup({ type: 'email', autocomplete: 'email' }))
      .fixture.componentInstance.resolvedAutocomplete()).toBe('email');
  });

  it('applies readonly without disabling the control', async () => {
    const { fixture } = await setup({ readonly: true, value: 'locked' });
    expect(field(fixture).readOnly).toBe(true);
    expect(field(fixture).disabled).toBe(false);
  });
});

describe('SvInputFieldComponent — appearance class maps', () => {
  const sizes: InputSize[] = ['sm', 'md', 'lg'];
  const variants: InputVariant[] = ['default', 'filled', 'flushed'];

  it('varies the label, icon and side padding by size', async () => {
    const seen = new Set<string>();
    for (const size of sizes) {
      const { fixture } = await setup({ size });
      const c = fixture.componentInstance;
      seen.add([c.labelSizeClass(), c.iconClass(), c.iconPadClass()].join('|'));
    }
    // Three sizes that produce the same classes would mean `size` does nothing.
    expect(seen.size).toBe(3);
  });

  it('gives each variant its own surface', async () => {
    const seen = new Set<string>();
    for (const variant of variants) {
      const { fixture } = await setup({ variant });
      seen.add(fixture.componentInstance.trackClasses());
    }
    expect(seen.size).toBe(3);
  });

  it('uses a different border for flushed than for the boxed variants in every state', async () => {
    for (const state of ['default', 'error', 'success', 'warning'] as const) {
      const boxed = await setup({ variant: 'default', state, errorMessage: '' });
      const flush = await setup({ variant: 'flushed', state, errorMessage: '' });
      expect(
        boxed.fixture.componentInstance.trackClasses(),
        `flushed and default look identical in the ${state} state`,
      ).not.toBe(flush.fixture.componentInstance.trackClasses());
    }
  });

  it('swaps the idle border for a focus ring while focused', async () => {
    const { fixture } = await setup({ variant: 'default' });
    const idle = fixture.componentInstance.trackClasses();
    fixture.componentInstance.isFocused.set(true);
    fixture.detectChanges();
    const focused = fixture.componentInstance.trackClasses();

    expect(idle).not.toBe(focused);
    expect(focused).toContain('ring-2');
    expect(idle).not.toContain('ring-2');
  });

  it('marks the track not-allowed only while disabled', async () => {
    const off = await setup({});
    expect(off.fixture.componentInstance.trackClasses()).not.toContain('cursor-not-allowed');

    const on = await setup({ disabled: true });
    expect(on.fixture.componentInstance.trackClasses()).toContain('cursor-not-allowed');
    expect(field(on.fixture).disabled).toBe(true);
  });

  it('aligns a multiline track to the top instead of the centre', async () => {
    const single = await setup({});
    expect(single.fixture.componentInstance.trackClasses()).toContain('items-center');

    const multi = await setup({ multiline: true });
    const classes = multi.fixture.componentInstance.trackClasses();
    expect(classes).toContain('items-start');
    expect(multi.fixture.componentInstance.nativeInputClasses()).toContain('resize-y');
  });

  it('drops the native padding on whichever side has a slot', async () => {
    const bare = await setup({});
    expect(bare.fixture.componentInstance.nativeInputClasses()).not.toContain('pl-0');

    const both = await setup({ leadingAddon: '$', trailingAddon: 'USD' });
    const classes = both.fixture.componentInstance.nativeInputClasses();
    expect(classes).toContain('pl-0');
    expect(classes).toContain('pr-0');
  });

  it('gives a colour input its own box', async () => {
    const colour = await setup({ type: 'color' });
    expect(colour.fixture.componentInstance.isColor()).toBe(true);
    expect(colour.fixture.componentInstance.nativeInputClasses()).toContain('cursor-pointer');

    const text = await setup({ type: 'text' });
    expect(text.fixture.componentInstance.nativeInputClasses()).not.toContain('cursor-pointer');
  });

  it('appends the host class to the root and copes without one', async () => {
    expect((await setup({})).fixture.componentInstance.rootClasses()).toBe('w-full');
    expect((await setup({ customClass: 'mb-4' })).fixture.componentInstance.rootClasses())
      .toBe('w-full mb-4');
  });

  /**
   * ★ DIVERGENCE FROM THE PRO TWIN, pinned deliberately.
   *
   * `isFloating()` is hard-wired to `false` here, where the Pro twin returns
   * `variant() === 'floating'`. So the free field never floats its label, never
   * renders the in-track label, and `floatingLabelClasses` only ever runs its
   * not-floated arm at rest. Asserting it means the day someone ports the
   * floating variant down, this test is what tells them to port its spec too.
   */
  it('never floats, whatever the variant — the floating variant is Pro-only', async () => {
    for (const variant of variants) {
      const { fixture } = await setup({ variant, label: 'Email', value: 'x' });
      expect(fixture.componentInstance.isFloating()).toBe(false);
      // The in-track floating <label> is gated on isFloating(): exactly one
      // <label> on screen, the ordinary one above the field.
      expect(el(fixture).querySelectorAll('label').length).toBe(1);
    }
  });

  it('still tracks whether the label WOULD float, from focus or from a value', async () => {
    const empty = await setup({ label: 'Email' });
    expect(empty.fixture.componentInstance.labelIsFloated()).toBe(false);

    const filled = await setup({ label: 'Email', value: 'a@b.com' });
    expect(filled.fixture.componentInstance.labelIsFloated()).toBe(true);

    empty.fixture.componentInstance.isFocused.set(true);
    expect(empty.fixture.componentInstance.labelIsFloated()).toBe(true);
  });

  it('positions the floating label around a leading slot, at every size and state', async () => {
    // `floatingLabelClasses` is still computed and still bound; only the
    // element that consumes it is gated off. Exercise its arms directly.
    const plain = await setup({ label: 'Email' });
    const withIcon = await setup({ label: 'Email', leadingAddon: '$' });
    expect(plain.fixture.componentInstance.floatingLabelClasses()).toContain('left-3.5');
    expect(withIcon.fixture.componentInstance.floatingLabelClasses()).toContain('left-10');

    for (const state of ['error', 'success', 'warning', 'default'] as const) {
      const rest = await setup({ label: 'Email', state, value: 'x' });
      const c = rest.fixture.componentInstance;
      const floatedIdle = c.floatingLabelClasses();
      c.isFocused.set(true);
      const floatedFocused = c.floatingLabelClasses();
      // Focus recolours a floated label; if it did not, the two arms of the
      // colour branch would be indistinguishable.
      expect(floatedIdle).not.toBe(floatedFocused);
    }

    for (const size of sizes) {
      const multi = await setup({ label: 'Notes', multiline: true, size });
      // Multiline pins the not-floated label to the top rather than centring it.
      expect(multi.fixture.componentInstance.floatingLabelClasses()).not.toContain('-translate-y-1/2 ');
    }
  });
});

// ─── Icons come from the library ──────────────────────────────────────────────

/**
 * Five glyphs here were inline `<svg>`s: the leading icon, the custom trailing
 * icon, and the state icon (error / success / warning).
 *
 * ★ None of them was ever in `check:ui`'s ledger — each was sized only through
 * `[ngClass]="iconClass()"`, and the rule read literal classes off the open
 * tag. The Pro twin's state icon was the FOURTH half-migration found in this
 * sweep: the free twin already published `stateIconName` and drew through
 * `<sv-icon>` while this one still bound a raw `d`.
 *
 * The trailing slot is a four-way `@else if` chain and only one arm renders,
 * so a single fixture would guard a quarter of it. `sv-spinner-arc` is a
 * GRAPHIC and is allowed its own `<svg>`.
 */
describe('SvInputFieldComponent — icons come from the library', () => {
  const byHand = (f: { nativeElement: unknown }) =>
    [...el(f).querySelectorAll('svg')].filter(
      (n) => !n.closest('sv-icon') && !n.closest('sv-spinner-arc'),
    );

  it.each([
    ['leading icon', { leadingIcon: 'mail' }],
    ['custom trailing icon', { trailingIcon: 'calendar' }],
    ['both ends', { leadingIcon: 'mail', trailingIcon: 'calendar' }],
    ['the error state icon', { state: 'error' as const }],
    ['the success state icon', { state: 'success' as const }],
    ['the warning state icon', { state: 'warning' as const }],
    ['the password eye', { type: 'password' as const }],
    ['the spinner over everything', { loading: true, leadingIcon: 'mail' }],
    ['an error message below the field', { errorMessage: 'Taken', leadingIcon: 'mail' }],
  ])('draws no glyph by hand — %s', async (_label, inputs) => {
    const { fixture } = await setup(inputs);
    expect(el(fixture).querySelectorAll('svg').length).toBeGreaterThan(0);
    expect(byHand(fixture)).toEqual([]);
  });
});

/**
 * ★★★ A PLACEHOLDER IS NOT AN ACCESSIBLE NAME.
 *
 * Until `ariaLabel` existed, a field with no visible `label` rendered an
 * `<input>` with no name at all — no `<label>`, no `aria-label` — which is a
 * WCAG 4.1.2 failure. Label-less fields are an ordinary pattern: a search box,
 * an inline sign-up row, a filter above a table.
 */
describe('SvInputFieldComponent — accessible name', () => {
  it('names a label-less field', async () => {
    const v = await setup({ ariaLabel: 'Work email', placeholder: 'you@company.com' });
    expect(field(v.fixture).getAttribute('aria-label')).toBe('Work email');
  });

  it('leaves a visible label to do the naming', async () => {
    // `aria-label` overrides a visible <label> in the accessibility tree, so
    // letting both apply would let a stale name silently shadow the one on
    // screen.
    const v = await setup({ label: 'Email', ariaLabel: 'Something else' });
    expect(field(v.fixture).getAttribute('aria-label')).toBeNull();
    expect(el(v.fixture).querySelector('label')?.textContent?.trim()).toContain('Email');
  });

  it('adds nothing when neither is given', async () => {
    const v = await setup({ placeholder: 'Search' });
    expect(field(v.fixture).getAttribute('aria-label')).toBeNull();
  });

  it('names a textarea and a select too, not only an input', async () => {
    const area = await setup({ multiline: true, ariaLabel: 'Notes' });
    expect(field(area.fixture).tagName.toLowerCase()).toBe('textarea');
    expect(field(area.fixture).getAttribute('aria-label')).toBe('Notes');

    const select = await setup({
      options: [{ value: 'a', label: 'A' }] as InputOption[],
      ariaLabel: 'Plan',
    });
    expect(field(select.fixture).getAttribute('aria-label')).toBe('Plan');
  });
});

describe('autocomplete reaches every native control (re-verified 2026-09-26)', () => {
  // 🔺 The token was bound on the <input> only. `street-address` is the textarea's
  //    canonical token and `country` / `bday-month` the select's — both silently
  //    dropped, so the browser could not fill a multiline address or a country.
  it('renders the token on the input, and the password default', async () => {
    expect(field((await setup({ type: 'email', autocomplete: 'email' })).fixture).getAttribute('autocomplete')).toBe('email');
    expect(field((await setup({ type: 'password' })).fixture).getAttribute('autocomplete')).toBe('current-password');
  });

  it('renders the token on a multiline textarea', async () => {
    const f = field((await setup({ multiline: true, autocomplete: 'street-address' })).fixture);
    expect(f.tagName).toBe('TEXTAREA');
    expect(f.getAttribute('autocomplete')).toBe('street-address');
  });

  it('renders the token on a native select', async () => {
    const f = field((await setup({
      options: [{ value: 'gb', label: 'United Kingdom' }, { value: 'ie', label: 'Ireland' }],
      autocomplete: 'country',
    })).fixture);
    expect(f.tagName).toBe('SELECT');
    expect(f.getAttribute('autocomplete')).toBe('country');
  });

  it('adds nothing when no token is given', async () => {
    expect(field((await setup({ multiline: true })).fixture).hasAttribute('autocomplete')).toBe(false);
  });
});
