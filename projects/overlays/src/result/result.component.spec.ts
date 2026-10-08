import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import { SvResultComponent } from './result.component';

/**
 * A whole-page outcome. The one thing it has to get right that a screenshot
 * cannot show is urgency: a failure has to interrupt (`role="alert"`), and a
 * success or an empty list has to wait its turn (`role="status"`). Announcing
 * an empty search result as an alert is as wrong as announcing a failed payment
 * politely.
 */

async function setup(inputs: Partial<ComponentInput<SvResultComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvResultComponent, {
    inputs: { title: 'All done', ...inputs } as ComponentInput<SvResultComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

describe('SvResultComponent — urgency', () => {
  it.each([
    ['error', 'alert'],
    ['warning', 'alert'],
    ['success', 'status'],
    ['info', 'status'],
    ['empty', 'status'],
  ] as const)('announces %s as %s', async (status, role) => {
    const { fixture } = await setup({ status });
    expect(fixture.componentInstance.role()).toBe(role);
    expect(el(fixture).firstElementChild?.getAttribute('role')).toBe(role);
  });

  it('interrupts for a failure', async () => {
    await setup({ status: 'error', title: 'Payment failed' });
    expect(screen.getByRole('alert').textContent).toContain('Payment failed');
  });

  it('waits its turn for an empty list', async () => {
    await setup({ status: 'empty', title: 'No results' });
    expect(screen.getByRole('status').textContent).toContain('No results');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('SvResultComponent — what it says', () => {
  it('makes the title a heading', async () => {
    await setup({ title: 'Order confirmed' });
    expect(screen.getByRole('heading', { name: 'Order confirmed' })).toBeTruthy();
  });

  it('shows a description under it', async () => {
    await setup({ title: 'Order confirmed', description: 'A receipt is on its way.' });
    expect(screen.getByText('A receipt is on its way.')).toBeTruthy();
  });

  it('projects whatever the host wants to offer next', async () => {
    TestBed.resetTestingModule();
    await render('<sv-result title="Order confirmed"><button type="button">Back to shop</button></sv-result>', {
      imports: [SvResultComponent],
    });
    expect(screen.getByRole('button', { name: 'Back to shop' })).toBeTruthy();
  });
});

describe('SvResultComponent — the icon', () => {
  /**
   * ★ THIS BLOCK HAD GONE STALE and was failing: written when `iconPath` held a
   * raw `<path d="…">`, it asserted `resolvedIconName().length > 10` and read
   * the value straight back off `path[d]`. Both stopped being true when the
   * icon sweep made these library NAMES — a name is short, and `[name]` is not
   * reflected to the DOM. The claims survive; the mechanism is the drawn shape.
   */
  const glyphSig = (f: { nativeElement: unknown }) => {
    const svg = el(f).querySelector('sv-icon svg');
    if (!svg) return '';
    return [...svg.querySelectorAll('path, circle, line, polyline, polygon, rect')]
      .map((n) => `${n.tagName},${n.getAttribute('d') ?? ''},${n.getAttribute('x1') ?? ''}`)
      .join('|');
  };

  it.each(['success', 'error', 'warning', 'info', 'empty'] as const)('has its own glyph for %s', async (status) => {
    const { fixture } = await setup({ status });
    const name = fixture.componentInstance.resolvedIconName();
    // A NAME, not a path: lower-case kebab, and never a `d` string.
    expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(name.startsWith('M')).toBe(false);
    // ...and it actually drew something.
    expect(glyphSig(fixture)).not.toBe('');
  });

  it('gives every status a distinct glyph', async () => {
    const names = new Set<string>();
    const shapes = new Set<string>();
    for (const status of ['success', 'error', 'warning', 'info', 'empty'] as const) {
      const { fixture } = await setup({ status });
      names.add(fixture.componentInstance.defaultIconName());
      shapes.add(glyphSig(fixture));
    }
    expect(names.size).toBe(5);
    // Five distinct NAMES could still resolve to fewer distinct glyphs — that is
    // exactly how `file-upload` shipped `pdf` and `doc` as one shape.
    expect(shapes.size).toBe(5);
  });

  it('takes a glyph from the host instead', async () => {
    const custom = await setup({ status: 'success', icon: 'star' });
    const dflt = await setup({ status: 'success' });
    expect(custom.fixture.componentInstance.resolvedIconName()).toBe('star');
    expect(glyphSig(custom.fixture)).not.toBe('');
    expect(glyphSig(custom.fixture)).not.toBe(glyphSig(dflt.fixture));
  });

  it('has no iconPath member left — the raw-path input is gone', async () => {
    const { fixture } = await setup();
    expect((fixture.componentInstance as unknown as Record<string, unknown>)['iconPath'])
      .toBeUndefined();
  });

  it('hides the glyph from a screen reader, since the text already says it', async () => {
    const { fixture } = await setup();
    expect(el(fixture).querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('SvResultComponent — presentation', () => {
  it.each(['sm', 'md', 'lg'] as const)('scales every part together at %s', async (size) => {
    const { fixture } = await setup({ size });
    const c = fixture.componentInstance;
    expect(c.iconContainerClass()).toMatch(/h-\d/);
    expect(c.iconClass()).toMatch(/h-\d/);
    expect(c.titleClass()).toMatch(/text-/);
    expect(c.descriptionClass()).toMatch(/text-/);
    expect(c.containerPadding()).toMatch(/^py-/);
  });

  it.each(['success', 'error', 'warning', 'info', 'empty'] as const)('has a palette for %s', async (status) => {
    const { fixture } = await setup({ status });
    expect(fixture.componentInstance.iconContainerClass()).not.toContain('undefined');
    expect(fixture.componentInstance.iconClass()).not.toContain('undefined');
  });
});
