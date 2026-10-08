import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  SvDescriptionActionDirective,
  SvDescriptionsComponent,
  type DescriptionItem,
} from './descriptions.component';

/**
 * Per-row actions, and what happens to a pair on a phone.
 *
 * ★★★ A `<dd>` is the DEFINITION of its term, and HTML leaves no sibling
 * position for anything else: inside a `<dl>`'s wrapping `<div>` only `<dt>` and
 * `<dd>` are allowed. So an action cannot live beside the definition — it has to
 * live inside it, which is exactly why the treatment is not stylistic.
 */

const ITEMS: DescriptionItem[] = [
  { id: 'total', label: 'Order total', value: '£42.00' },
  { id: 'ref', label: 'Reference', value: 'ORD-9912' },
];

async function withAction() {
  TestBed.resetTestingModule();
  return render(
    `<sv-descriptions [items]="items">
       <ng-template svDescriptionAction let-item>
         <button type="button" [attr.aria-label]="'Copy ' + item.label">Copy</button>
       </ng-template>
     </sv-descriptions>`,
    {
      imports: [SvDescriptionsComponent, SvDescriptionActionDirective],
      componentProperties: { items: ITEMS },
    },
  );
}

async function plain(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  return render(SvDescriptionsComponent, { inputs: { items: ITEMS, ...inputs } });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

describe('SvDescriptionsComponent — a per-row action', () => {
  it('renders nothing extra when the host supplied no template', async () => {
    const { fixture } = await plain();
    expect(el(fixture).querySelector('[data-sv-action]')).toBeNull();
    // The value is still the whole content of its definition.
    expect(el(fixture).querySelector('dd')?.textContent?.trim()).toBe('£42.00');
  });

  it('gives every row the template, with its own item', async () => {
    const { fixture } = await withAction();
    const actions = el(fixture).querySelectorAll('[data-sv-action]');
    expect(actions).toHaveLength(2);
    // ★ The name has to carry the TERM: a listener who lands on the button is
    //   inside the definition and has no other way to know which pair they are
    //   in. The component supplies the item so the host can say it.
    expect(screen.getByRole('button', { name: 'Copy Order total' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy Reference' })).toBeTruthy();
    // Named by the LABEL, not the value — the term is what identifies the pair.
    expect(screen.queryByRole('button', { name: 'Copy ORD-9912' })).toBeNull();
  });

  it('keeps the action out of the value text', async () => {
    const { fixture } = await withAction();
    const value = el(fixture).querySelector('dd > span > span')!;
    // The value keeps its own box, so a control cannot push the text around —
    // the alignment half of the fix.
    expect(value.textContent?.trim()).toBe('£42.00');
    expect(value.querySelector('button')).toBeNull();
  });

  it('leaves the action inside the definition, because HTML has nowhere else', async () => {
    const { fixture } = await withAction();
    const action = el(fixture).querySelector('[data-sv-action]')!;
    expect(action.closest('dd')).not.toBeNull();
    // A sibling <span> in the wrapping <div> would be invalid markup.
    expect(action.parentElement?.closest('dd')).not.toBeNull();
  });

  it('still works', async () => {
    const { fixture } = await withAction();
    await userEvent.click(screen.getByRole('button', { name: 'Copy Order total' }));
    expect(el(fixture).querySelectorAll('button')).toHaveLength(2);
  });
});

describe('SvDescriptionsComponent — stacking on a narrow screen', () => {
  const cell = (f: { nativeElement: unknown }) =>
    (el(f).querySelector('dl > div') as HTMLElement).className;
  const term = (f: { nativeElement: unknown }) =>
    (el(f).querySelector('dt') as HTMLElement).className;

  it('gives a stacked pair vertical spacing', async () => {
    const { fixture } = await plain();
    // ★ THE BUG. The old class list went straight from block layout to
    //   `sm:flex`, so below the breakpoint the <dt> and <dd> were two block
    //   elements with no gap — on a phone that reads as one wrapped sentence
    //   rather than a label and a value.
    expect(cell(fixture)).toContain('flex flex-col gap-1');
    expect(cell(fixture)).toContain('sm:flex-row');
  });

  it('moves the breakpoint where the host asks', async () => {
    for (const [at, prefix] of [
      ['md', 'md:flex-row'],
      ['lg', 'lg:flex-row'],
    ] as const) {
      const { fixture } = await plain({ stackAt: at });
      expect(cell(fixture)).toContain(prefix);
      // The label column has to unstack at the same width, or it is 40% wide
      // while stacked.
      expect(term(fixture)).toContain(`${at}:w-2/5`);
    }
  });

  it('can be told never to stack', async () => {
    const { fixture } = await plain({ stackAt: 'never' });
    expect(cell(fixture)).toContain('flex items-baseline gap-3');
    expect(cell(fixture)).not.toContain('flex-col');
    expect(term(fixture)).toContain('w-2/5');
  });

  it('leaves the vertical layout alone — it was already stacked', async () => {
    const { fixture } = await plain({ layout: 'vertical', stackAt: 'never' });
    expect(cell(fixture)).toContain('flex flex-col gap-1');
  });

  it('emits complete class names, never ones assembled from a breakpoint token', async () => {
    // ★ The rule is about CLASS NAMES, not template literals: Tailwind scans
    //   source for whole strings, so `sm:flex-row` written out is generated and
    //   a `${at}:flex-row` built at runtime is not — the layout then silently
    //   stays whatever the base class said. Asserted by rendering every value of
    //   the union and checking the class actually arrives.
    for (const [at, expected] of [
      ['sm', 'sm:flex-row'],
      ['md', 'md:flex-row'],
      ['lg', 'lg:flex-row'],
    ] as const) {
      const { fixture } = await plain({ stackAt: at });
      expect(cell(fixture)).toContain(expected);
    }
  });
});
