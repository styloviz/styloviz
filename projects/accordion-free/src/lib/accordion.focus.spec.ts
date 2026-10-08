import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { provideSvNavLocation, svQueryParamNavLocation } from '@styloviz/core';
import { SvAccordionComponent, type AccordionItem } from './accordion.component';

/**
 * ============================================================================
 *  Focus when a panel holding it collapses — `X-14`, `NV-01-I4`, `NV-01-M3`
 * ============================================================================
 *
 * ★ Collapsing a panel that contains focus drops it to `<body>` — focus at the
 * TOP OF THE DOCUMENT, so the reader's next Tab goes to the site's first link.
 * They collapsed a section and were returned to the start of the page.
 *
 * `NV-01-M3`'s policy is the panel's **own header**: it is what they just
 * collapsed, it is adjacent to where they were, and it is the control that
 * reopens it if collapsing was a mistake.
 */

const ITEMS: AccordionItem[] = [
  { id: 'a', title: 'Shipping', content: 'Ships in 2 days.' },
  { id: 'b', title: 'Returns', content: '30 days.' },
];

async function setup(inputs: Partial<ComponentInput<SvAccordionComponent>> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAccordionComponent, {
    inputs: { items: ITEMS, expandMode: 'multi', ...inputs } as ComponentInput<SvAccordionComponent>,
  });
  return fixture;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const headers = (f: { nativeElement: unknown }) =>
  [...el(f).querySelectorAll<HTMLElement>('[aria-expanded]')];

describe('SvAccordionComponent — focus on collapse', () => {
  /**
   * ★ The defect. A link inside the panel holds focus; the panel closes; the
   * link is gone and focus has nowhere to be.
   */
  it('moves focus to the panel`s own header, never to body', async () => {
    const f = await setup();
    const header = headers(f)[0];

    header.click();
    f.detectChanges();

    // Stand in for anything focusable the host projected into the panel.
    const panel = el(f).querySelector<HTMLElement>('[role="region"], [id$="-panel-a"]')!;
    const link = document.createElement('a');
    link.href = '/somewhere';
    panel.appendChild(link);
    link.focus();
    expect(document.activeElement).toBe(link);

    header.click();
    f.detectChanges();

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(header);
  });

  /**
   * ★ And it must NOT steal focus otherwise. Collapsing a panel from its own
   * header, or from anywhere outside the panel, is not a focus emergency — a
   * component that grabs focus on every toggle is worse than one that drops it,
   * because it fights the user on every interaction rather than one in twenty.
   */
  it('leaves focus alone when it was never inside the panel', async () => {
    const f = await setup();
    const [first, second] = headers(f);

    first.click();
    f.detectChanges();

    second.focus();
    first.click();
    f.detectChanges();

    expect(document.activeElement).toBe(second);
  });

  it('does nothing on the way OPEN', async () => {
    const f = await setup();
    const [first, second] = headers(f);

    second.focus();
    first.click();
    f.detectChanges();

    expect(document.activeElement).toBe(second);
  });
});

/**
 * ============================================================================
 *  Collapses that do not go through the toggled panel — `NV-01-I4`, `NV-01-M3`
 * ============================================================================
 *
 * ★ The first fix only asked about the panel being TOGGLED. In `single` mode
 * opening B closes A, and if focus was inside A it dropped to `<body>` all the
 * same. A back button rewriting the URL, and a host writing `openIds`, collapse
 * panels without passing through `toggle` at all. Each lands on the collapsed
 * panel's OWN header.
 */
describe('SvAccordionComponent — focus when another path collapses the panel', () => {
  /** Put something focusable inside panel `id` and focus it. */
  function focusInside(f: { nativeElement: unknown }, id: string): HTMLElement {
    const panel = el(f).querySelector<HTMLElement>(`[id$="-panel-${id}"]`)!;
    const link = document.createElement('a');
    link.href = '/somewhere';
    panel.appendChild(link);
    link.focus();
    expect(document.activeElement).toBe(link);
    return link;
  }

  it('single mode: opening B while focus is inside A returns focus to A`s header', async () => {
    const f = await setup({ expandMode: 'single' });
    const [a, b] = headers(f);
    a.click();
    f.detectChanges();
    focusInside(f, 'a');

    b.click();
    f.detectChanges();

    expect([...f.componentInstance.openIds()]).toEqual(['b']);
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(a);
  });

  it('a host `openIds` write that collapses the focused panel returns focus to its header', async () => {
    const f = await setup();
    const [a] = headers(f);
    a.click();
    f.detectChanges();
    focusInside(f, 'a');

    f.componentRef.setInput('openIds', new Set<string>());
    f.detectChanges();

    expect(document.activeElement).toBe(a);
  });

  it('a host write that leaves the focused panel open does not move focus', async () => {
    const f = await setup();
    const [a] = headers(f);
    a.click();
    f.detectChanges();
    const link = focusInside(f, 'a');

    f.componentRef.setInput('openIds', new Set(['a', 'b']));
    f.detectChanges();

    expect(document.activeElement).toBe(link);
  });

  it('back/forward collapsing the focused panel returns focus to its header', async () => {
    window.history.replaceState(null, '', '/faq?open=a');
    TestBed.resetTestingModule();
    const { fixture: f } = await render(SvAccordionComponent, {
      inputs: { items: ITEMS, expandMode: 'multi', urlKey: 'open' } as ComponentInput<SvAccordionComponent>,
      providers: [provideSvNavLocation(svQueryParamNavLocation())],
    });
    f.detectChanges();
    const [a] = headers(f);
    expect([...f.componentInstance.openIds()]).toEqual(['a']);
    focusInside(f, 'a');

    window.history.replaceState(null, '', '/faq?open=b');
    window.dispatchEvent(new PopStateEvent('popstate'));
    f.detectChanges();

    expect([...f.componentInstance.openIds()]).toEqual(['b']);
    expect(document.activeElement).toBe(a);
    window.history.replaceState(null, '', '/');
  });
});

