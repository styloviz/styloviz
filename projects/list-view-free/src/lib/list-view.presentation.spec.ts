import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { ICON_REGISTRY } from '@styloviz/icons';
import { SvListViewComponent } from './list-view.component';
import type { ListViewCallType, ListViewItem } from './list-view.component';

/** Resets TestBed so a single test can render more than once. */
async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvListViewComponent, {
    inputs: { items: [{ id: 1, title: 'Alpha invoice' }] as ListViewItem[], ...inputs },
  });
  return fixture;
}

const rootEl = (f: { nativeElement: HTMLElement }) =>
  f.nativeElement.querySelector('[role="region"]') as HTMLElement;

describe('SvListViewComponent — container styling', () => {
  it.each([
    ['default', 'border-gray-200/80'],
    ['soft', 'bg-primary-50/40'],
    ['outlined', 'border-2'],
  ])('paints the %s variant', async (variant, marker) => {
    const f = await setup({ variant });
    expect(rootEl(f).className).toContain(marker);
  });

  /** Every variant keeps the shared base classes — a variant is an addition. */
  it('keeps the base shell whichever variant is chosen', async () => {
    for (const variant of ['default', 'soft', 'outlined']) {
      const f = await setup({ variant });
      expect(rootEl(f).className).toContain('rounded-2xl');
    }
  });

  it('appends the host classes without dropping the variant', async () => {
    const f = await setup({ variant: 'outlined', customClass: 'my-list h-40' });
    expect(rootEl(f).className).toContain('my-list h-40');
    expect(rootEl(f).className).toContain('border-2');
  });

  /** An empty customClass must not leave a double space in the class list. */
  it('leaves no empty slot when no host class is supplied', async () => {
    const f = await setup();
    expect(f.componentInstance.rootClasses()).not.toMatch(/\s{2}/);
    expect(f.componentInstance.rootClasses().endsWith(' ')).toBe(false);
  });

  it.each([
    ['compact', 'px-3 py-2'],
    ['comfortable', 'px-4 py-3'],
    ['spacious', 'px-5 py-4'],
  ])('uses %s row padding', async (density, expected) => {
    const f = await setup({ density });
    expect(f.componentInstance.rowPadding()).toBe(expected);
    expect(
      (f.nativeElement.querySelector('[data-lv-row-btn="1"]')?.parentElement as HTMLElement)
        .className,
    ).toContain(expected);
  });

  it('labels the region for assistive tech', async () => {
    const f = await setup({ ariaLabel: 'Recent invoices' });
    expect(rootEl(f).getAttribute('aria-label')).toBe('Recent invoices');
  });

  it('uses the host empty message rather than the default copy', async () => {
    const f = await setup({ items: [] as ListViewItem[], emptyMessage: 'No invoices yet.' });
    expect(f.nativeElement.querySelector('[data-sv-state="empty"]')?.textContent).toContain(
      'No invoices yet.',
    );
  });

  it('shows the visible-row tally, and the selected tally only when selectable', async () => {
    const plain = await setup({ items: [{ id: 1, title: 'A' }, { id: 2, title: 'B' }] });
    expect(plain.nativeElement.textContent).toContain('2 items');
    expect(plain.nativeElement.textContent).not.toContain('selected');

    const selectable = await setup({ selectionMode: 'single' });
    expect(selectable.nativeElement.textContent).toContain('0 selected');
  });
});

describe('SvListViewComponent — row rendering', () => {
  it('shows the avatar image when the row has one', async () => {
    const f = await setup({ items: [{ id: 1, title: 'Ada Lovelace', avatarUrl: '/a.png' }] });
    const img = f.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/a.png');
    expect(img.getAttribute('alt')).toBe('Ada Lovelace');
  });

  /** No image, no broken box: the initials stand in. */
  it('falls back to initials when there is no avatar', async () => {
    const f = await setup({ items: [{ id: 1, title: 'Ada Lovelace' }] });
    expect(f.nativeElement.querySelector('img')).toBeNull();
    expect(f.nativeElement.textContent).toContain('AL');
  });

  it.each([
    ['Ada Lovelace', 'AL'],
    ['Ada Byron King Lovelace', 'AB'],
    ['ada', 'A'],
    ['  spaced   out  ', 'SO'],
    ['', 'NA'],
    ['   ', 'NA'],
  ])('reduces %o to %s', async (title, expected) => {
    const f = await setup();
    expect(f.componentInstance.initials({ id: 1, title })).toBe(expected);
  });

  it('prefers meta over timestamp, and subtitle over description', async () => {
    const f = await setup({
      items: [
        {
          id: 1,
          title: 'Row',
          meta: 'META',
          timestamp: 'STAMP',
          subtitle: 'SUB',
          description: 'DESC',
        },
      ],
    });
    const text = f.nativeElement.textContent ?? '';
    expect(text).toContain('META');
    expect(text).not.toContain('STAMP');
    expect(text).toContain('SUB');
    expect(text).not.toContain('DESC');
  });

  it('falls back to timestamp and description when the preferred field is absent', async () => {
    const f = await setup({
      items: [{ id: 1, title: 'Row', timestamp: 'STAMP', description: 'DESC' }],
    });
    const text = f.nativeElement.textContent ?? '';
    expect(text).toContain('STAMP');
    expect(text).toContain('DESC');
  });

  it('prefers duration over amount in the trailing slot', async () => {
    const withBoth = await setup({ items: [{ id: 1, title: 'Row', duration: '3m', amount: '€9' }] });
    expect(withBoth.nativeElement.textContent).toContain('3m');
    expect(withBoth.nativeElement.textContent).not.toContain('€9');

    const amountOnly = await setup({ items: [{ id: 1, title: 'Row', amount: '€9' }] });
    expect(amountOnly.nativeElement.textContent).toContain('€9');
  });

  it('renders a badge only when the row carries one', async () => {
    const withBadge = await setup({ items: [{ id: 1, title: 'Row', badge: 'NEW' }] });
    expect(withBadge.nativeElement.textContent).toContain('NEW');

    const without = await setup();
    expect(without.nativeElement.querySelector('.bg-primary-100')).toBeNull();
  });

  it('tints an unread row and dims a disabled one', async () => {
    const f = await setup({
      items: [
        { id: 1, title: 'Unread', unread: true },
        { id: 2, title: 'Off', disabled: true },
      ] as ListViewItem[],
    });
    const rows = [...f.nativeElement.querySelectorAll('.divide-y > div')] as HTMLElement[];
    expect(rows[0].className).toContain('bg-primary-50/45');
    expect(rows[1].className).toContain('opacity-50');
    // A disabled row must not also advertise a hover affordance.
    expect(rows[1].className).not.toContain('hover:bg-gray-50/70');
  });

  it('indents each tree level by a fixed step', async () => {
    const f = await setup();
    expect(f.componentInstance.nestedIndent(0)).toBe('0.5rem');
    expect(f.componentInstance.nestedIndent(1)).toBe('1.7rem');
    expect(f.componentInstance.nestedIndent(3)).toBe('4.1rem');
  });
});

describe('SvListViewComponent — call history', () => {
  const call = (callType?: ListViewCallType): ListViewItem[] => [
    { id: 1, title: 'Ada Lovelace', callType },
  ];

  /** Four call types, four distinct glyphs — a shared path would make the
   *  direction of a call unreadable. */
  it('gives each call type its own glyph', async () => {
    const f = await setup();
    const c = f.componentInstance;
    const paths = (['incoming', 'outgoing', 'video', 'missed'] as const).map((t) =>
      c.callTypeIcon(t),
    );
    expect(new Set(paths).size).toBe(4);
  });

  /**
   * ★★★ THE ARROWS POINTED THE WRONG WAY, and this spec did not notice because
   * it only ever asserted that the four glyphs were DISTINCT. `incoming`
   * returned `arrow-up` and `outgoing` returned `arrow-down` — backwards from
   * iOS Phone, the Android dialer, WhatsApp, Skype and Teams, all of which draw
   * an incoming call coming DOWN-and-IN and an outgoing call going UP-and-OUT.
   *
   * "Four distinct values" is satisfied just as well by four wrong ones.
   * **Assert the MEANING, not only the distinctness.**
   */
  it('points an incoming call IN and an outgoing call OUT', async () => {
    const c = (await setup()).componentInstance;
    expect(c.callTypeIcon('incoming')).toBe('arrow-down-left');
    expect(c.callTypeIcon('outgoing')).toBe('arrow-up-right');
  });

  it.each([
    ['incoming', 'accent'],
    ['outgoing', 'primary'],
    ['video', 'violet'],
    ['missed', 'danger'],
  ])('colours a %s call', async (type, hue) => {
    const f = await setup();
    expect(f.componentInstance.callTypeClass(type as ListViewCallType)).toContain(hue);
  });

  /**
   * ★★★ WAS "falls back to the missed colour for an unset call type", and it
   * pinned a defect: `missed` was reached only through the DEFAULT branch, so
   * an item carrying no `callType` at all was painted red with a cross and
   * announced a missed call that never happened. An assertion pins a bug just
   * as firmly as it pins a feature.
   *
   * `missed` is its own branch now, and unknown is neutral.
   */
  it('does not report an unknown call type as a missed call', async () => {
    const c = (await setup()).componentInstance;
    expect(c.callTypeIcon(undefined)).not.toBe(c.callTypeIcon('missed'));
    expect(c.callTypeClass(undefined)).not.toBe(c.callTypeClass('missed'));
    expect(c.callTypeClass(undefined)).not.toContain('danger');
    expect(c.callTypeLabel(undefined)).not.toContain('Missed');
  });

  /**
   * ★★ Colour is not an accessible discriminator. `incoming` (green) and
   * `missed` (red) must differ in SHAPE too, or a red/green colour-blind reader
   * cannot tell a returned call from a lost one.
   */
  it('separates incoming from missed by shape, not only by colour', async () => {
    const c = (await setup()).componentInstance;
    expect(c.callTypeIcon('missed')).not.toBe(c.callTypeIcon('incoming'));
  });

  /**
   * ★★★ The direction is the whole point of a call-history row, and it reached
   * NOBODY using assistive technology: the glyph is decorative (`<sv-icon>`
   * with no `title` renders `aria-hidden`), the colour says nothing, and there
   * was no text. Every type now carries an `sr-only` announcement.
   */
  it.each(['incoming', 'outgoing', 'video', 'missed'] as const)(
    'announces a %s call to a screen reader',
    async (type) => {
      const f = await setup({ mode: 'call-history', items: call(type) });
      // ★ Scoped to the call badge. The component also renders a top-level
      // `.sr-only` live region, which is EMPTY at rest — an unscoped
      // `querySelector('.sr-only')` finds that one first and compares '' to the
      // label, which is a passing-looking failure waiting to become a false
      // negative if the order ever changes.
      const badge = (f.nativeElement as HTMLElement)
        .querySelector('[role="listitem"], li, [class*="rounded-lg"]');
      const sr = [...(f.nativeElement as HTMLElement).querySelectorAll('.sr-only')]
        .find((n) => n.textContent?.trim());
      expect(badge, 'no call row rendered').not.toBeNull();
      expect(sr, 'no sr-only call-type label rendered').not.toBeUndefined();
      expect(sr!.textContent?.trim()).toBe(
        f.componentInstance.callTypeLabel(type),
      );
    },
  );

  /** The call badge replaces the avatar — a call row shows direction, not a face. */
  it('replaces the avatar with the call glyph in call-history mode', async () => {
    const f = await setup({ mode: 'call-history', items: call('incoming') });
    expect(f.componentInstance.isCallHistoryMode()).toBe(true);
    expect(f.nativeElement.querySelector('img')).toBeNull();
    expect(f.nativeElement.textContent).not.toContain('AL');

    const plain = await setup({ items: call('incoming') });
    expect(plain.nativeElement.textContent).toContain('AL');
  });
});

describe('SvListViewComponent — template mode', () => {
  const tagged = (): ListViewItem[] => [
    { id: 1, title: 'Row', description: 'Long form copy', subtitle: 'SUB', tags: ['a', 'b'] },
  ];

  /** Template mode swaps the one-line subtitle for description + tag pills. */
  it('shows the description and the tags instead of the subtitle', async () => {
    const f = await setup({ mode: 'template', items: tagged() });
    expect(f.componentInstance.isTemplateMode()).toBe(true);
    const text = f.nativeElement.textContent ?? '';
    expect(text).toContain('Long form copy');
    expect(text).toContain('a');
    expect(text).not.toContain('SUB');
  });

  it('shows the subtitle and no tags outside template mode', async () => {
    const f = await setup({ items: tagged() });
    expect(f.nativeElement.textContent).toContain('SUB');
    expect(f.nativeElement.textContent).not.toContain('Long form copy');
  });

  /** A row without tags must not render an empty pill strip. */
  it('renders no tag strip for a row with no tags', async () => {
    const f = await setup({
      mode: 'template',
      items: [{ id: 1, title: 'Row', description: 'Copy' }] as ListViewItem[],
    });
    expect(f.nativeElement.querySelector('.flex-wrap.gap-1\\.5')).toBeNull();
  });
});

describe('SvListViewComponent — action tones', () => {
  it.each([
    ['primary', 'primary'],
    ['danger', 'danger'],
  ])('paints the %s tone', async (tone, hue) => {
    const f = await setup();
    expect(f.componentInstance.actionToneClass(tone as 'primary' | 'danger')).toContain(hue);
  });

  /** An unset tone must land on neutral, not on whatever came last. */
  it('falls back to neutral for an unset tone', async () => {
    const f = await setup();
    const neutral = f.componentInstance.actionToneClass('neutral');
    expect(f.componentInstance.actionToneClass(undefined)).toBe(neutral);
    expect(neutral).toContain('border-gray-200');
  });

  it('paints a quick action with its own tone', async () => {
    const f = await setup({
      showQuickActions: true,
      quickActions: [{ id: 'del', label: 'Delete', tone: 'danger' }],
    });
    const button = [...f.nativeElement.querySelectorAll('button[aria-label="Delete"]')][0];
    expect(button.className).toContain('danger');
  });
});

// ─── Icons come from the library ──────────────────────────────────────────────

/**
 * The five glyphs here sit in three places that are each gated by different
 * inputs, so a single render reaches none of them — measured before writing
 * this: with only `items`, every mode renders **zero** `<svg>`.
 *
 *   quick actions  → `showQuickActions` AND a non-empty `quickActions`
 *   bulk actions   → `bulkActions` AND something checked
 *   call glyph     → `mode: 'call-history'`
 *
 * ★ The sixth inline `<svg>` in this template was a **spinner**, not a glyph: a
 * 0.2-opacity ring under a quarter-arc. It is now the same CSS rotating border
 * the kit's own `sv-spinner` uses for `spinnerStyle="border"` — no icon could
 * have reproduced a two-layer arc, and a spinner is not an icon-set glyph.
 */
describe('SvListViewComponent — icons come from the library', () => {
  const SURFACES: readonly (readonly [string, Record<string, unknown>])[] = [
    ['quick actions', { showQuickActions: true, quickActions: [{ id: 'r', label: 'Reply', icon: 'send' }] }],
    ['bulk actions',  { bulkActions: [{ id: 'd', label: 'Delete', icon: 'trash' }], selectionMode: 'multiple', checkable: true, checkedIds: new Set([1]) }],
    ['call history',  { mode: 'call-history' }],
  ];

  it.each(SURFACES)('draws no glyph by hand on the %s surface', async (_label, inputs) => {
    const f = await setup({
      items: [{ id: 1, title: 'Ada Lovelace', callType: 'video' }, { id: 2, title: 'Alan Turing' }] as ListViewItem[],
      ...inputs,
    });
    const host = f.nativeElement as HTMLElement;
    const svgs = [...host.querySelectorAll('svg')];
    expect(svgs.length).toBeGreaterThan(0);
    expect(svgs.every((n) => n.closest('sv-icon'))).toBe(true);
  });

  /**
   * ★★ `callTypeIcon('video')` used to return only the LENS WEDGE of a
   * video-camera glyph — `[attr.d]` binds one path, so the camera body was
   * dropped when it was copied. At the 14px this list uses it read as a
   * squiggle. Names cannot lose half a glyph, and this proves all four resolve.
   */
  it('resolves every call-type name in the registry', async () => {
    const f = await setup();
    const c = f.componentInstance;
    const names = (['incoming', 'outgoing', 'video', 'missed'] as const).map((t) => c.callTypeIcon(t));
    expect(new Set(names).size).toBe(4);
    for (const n of names) {
      expect(n).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(ICON_REGISTRY[n as keyof typeof ICON_REGISTRY], n).toBeTruthy();
    }
  });
});
