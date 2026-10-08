import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvLineClampComponent } from './line-clamp.component';

/**
 * Truncation is CSS; the component's job is to know whether it happened. That
 * matters because the toggle only appears when the text really overflows —
 * offering "Show more" on three words is noise, and withholding it on a wall of
 * text is a trap. Overflow is measured, not guessed, which is why `isClamped`
 * is driven directly here: jsdom has no layout to measure.
 */

async function setup(attrs = '', content = 'A reasonably long paragraph of text.') {
  TestBed.resetTestingModule();
  const view = await render(`<sv-line-clamp ${attrs}>${content}</sv-line-clamp>`, {
    imports: [SvLineClampComponent],
  });
  const debug = view.fixture.debugElement.children[0];
  return { ...view, clamp: debug.componentInstance as SvLineClampComponent };
}

type View = Awaited<ReturnType<typeof setup>>;

const el = (v: View) => v.fixture.nativeElement as HTMLElement;
const content = (v: View) => el(v).querySelector('[id^="sv-line-clamp-"]') as HTMLElement;
const toggle = () => screen.queryByRole('button');

/**
 * Pretend the text overflows, since jsdom reports every height as zero.
 *
 * The tick first: the component runs its own measurement on a 
 * after mount, and that would otherwise land mid-test and set the flag back.
 */
async function overflowing(v: View) {
  await new Promise((r) => setTimeout(r, 0));
  v.clamp.isClamped.set(true);
  v.fixture.detectChanges();
}

describe('SvLineClampComponent — the toggle appears only when it is needed', () => {
  it('offers nothing for text that fits', async () => {
    const v = await setup();
    expect(v.clamp.isClamped()).toBe(false);
    expect(toggle()).toBeNull();
  });

  it('offers a way in once the text is actually cut off', async () => {
    const v = await setup();
    await overflowing(v);
    expect(screen.getByRole('button', { name: /Show more/ })).toBeTruthy();
  });

  it('stays available once expanded, so the text can be put back', async () => {
    const v = await setup();
    await overflowing(v);
    await userEvent.click(toggle()!);
    v.fixture.detectChanges();

    v.clamp.isClamped.set(false);
    v.fixture.detectChanges();
    expect(screen.getByRole('button', { name: /Show less/ })).toBeTruthy();
  });

  it('can be suppressed entirely', async () => {
    const v = await setup('[showToggle]="false"');
    await overflowing(v);
    expect(toggle()).toBeNull();
  });
});

describe('SvLineClampComponent — expanding', () => {
  it('says which way it will go, and which way it has gone', async () => {
    const v = await setup();
    await overflowing(v);
    expect(v.clamp.toggleLabel()).toBe('Show more');
    expect(toggle()!.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(toggle()!);
    v.fixture.detectChanges();
    expect(v.clamp.toggleLabel()).toBe('Show less');
    expect(toggle()!.getAttribute('aria-expanded')).toBe('true');
  });

  it('points the toggle at the text it controls', async () => {
    const v = await setup();
    await overflowing(v);
    const controls = toggle()!.getAttribute('aria-controls');
    expect(controls).toBe(v.clamp.contentId);
    expect(content(v).id).toBe(controls);
  });

  it('gives every instance its own id', async () => {
    // The id is what `aria-controls` points at; two on a page must not collide,
    // and a `Math.random()` id would also differ between an SSR render and the
    // hydration that follows it.
    // Both instances must share an application: ids are per application (svUniqueId).
    const a = await setup();
    const first = a.clamp.contentId;
    const b = TestBed.createComponent(SvLineClampComponent);
    b.detectChanges();
    await b.whenStable();
    expect(b.componentInstance.contentId).not.toBe(first);
    // `<prefix>-<APP_ID>-<n>`; TestBed's APP_ID is `a`.
    expect(first).toMatch(/^sv-line-clamp-a-\d+$/);
    expect(content(a).id).toBe(first);
  });

  it('reports the change to the host', async () => {
    const seen: boolean[] = [];
    const v = await setup();
    // `model()` exposes its Change output on the signal itself.
    v.clamp.expanded.subscribe((x) => seen.push(x));
    await overflowing(v);

    await userEvent.click(toggle()!);
    v.fixture.detectChanges();
    await userEvent.click(toggle()!);
    expect(seen).toEqual([true, false]);
  });

  it('takes a starting state, and the labels, from the host', async () => {
    const v = await setup('[expanded]="true" expandLabel="Read the rest" collapseLabel="Collapse"');
    expect(v.clamp.expanded()).toBe(true);
    expect(v.clamp.toggleLabel()).toBe('Collapse');

    const closed = await setup('expandLabel="Read the rest"');
    expect(closed.clamp.toggleLabel()).toBe('Read the rest');
  });
});

describe('SvLineClampComponent — the clamp itself', () => {
  it('clamps to the number of lines it was given', async () => {
    const v = await setup('[lines]="2"');
    expect(content(v).style.getPropertyValue('-webkit-line-clamp')).toBe('2');
    expect(content(v).style.display).toBe('-webkit-box');
  });

  it('lifts the clamp when expanded', async () => {
    const v = await setup('[lines]="2" [expanded]="true"');
    expect(content(v).style.getPropertyValue('-webkit-line-clamp')).toBe('unset');
    expect(content(v).style.display).toBe('block');
  });

  it('projects the text it was handed', async () => {
    const v = await setup('', 'The quick brown fox.');
    expect(el(v).textContent).toContain('The quick brown fox.');
  });
});

describe('SvLineClampComponent — the fade', () => {
  it('fades the cut edge, and hides the fade from a screen reader', async () => {
    const v = await setup();
    await overflowing(v);
    const fade = el(v).querySelector('.pointer-events-none');
    expect(fade).toBeTruthy();
    expect(fade?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows no fade when there is no cut edge', async () => {
    const v = await setup();
    expect(el(v).querySelector('.pointer-events-none')).toBeNull();
  });

  it('drops the fade once the text is open', async () => {
    const v = await setup();
    await overflowing(v);
    await userEvent.click(toggle()!);
    v.fixture.detectChanges();
    expect(el(v).querySelector('.pointer-events-none')).toBeNull();
  });

  it('can be turned off', async () => {
    const v = await setup('[fadeOut]="false"');
    await overflowing(v);
    expect(el(v).querySelector('.pointer-events-none')).toBeNull();
  });
});

describe('SvLineClampComponent — reduced motion (X-11)', () => {
  it.each([false, true])('stills every transition under prefers-reduced-motion (expanded=%s)', async (expanded) => {
    const v = await setup('[lines]="2"', 'A long paragraph. '.repeat(40));
    await overflowing(v);
    if (expanded) {
      toggle()!.click();
      v.fixture.detectChanges();
    }
    const transitioned = Array.from(
      el(v).querySelectorAll<Element>('[class*="transition"]'),
    ).filter((n) => /\btransition(-\w+)?\b/.test(n.getAttribute('class') ?? ''));
    expect(transitioned.length).toBeGreaterThan(0);
    for (const node of transitioned) {
      expect(node.getAttribute('class')).toContain('motion-reduce:transition-none');
    }
  });

  it('does not claim a max-height animation it does not perform', async () => {
    const v = await setup();
    // The content switches display/-webkit-line-clamp; nothing animates height.
    expect(content(v).style.maxHeight).toBe('');
  });
});
