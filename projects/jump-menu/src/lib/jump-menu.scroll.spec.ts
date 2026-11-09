import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { vi } from 'vitest';
import {
  SvJumpMenuComponent,
  type JumpMenuChangeEvent,
  type JumpMenuItem,
  type JumpMenuJumpedEvent,
} from './jump-menu.component';

/**
 * `SR-19` — the jump menu took a choice and did nothing with it: every host
 * had to wire its own scroll, nothing drove the select back from the page, and
 * the WCAG 3.2.2 "Go" mode the class note recommends was not on offer.
 */

const ITEMS: JumpMenuItem[] = [
  { id: 'jm-a', label: 'A' },
  { id: 'jm-b', label: 'B' },
  { id: 'jm-c', label: 'C' },
];

async function setup(inputs: Partial<ComponentInput<SvJumpMenuComponent>> = {}) {
  TestBed.resetTestingModule();
  const jumps: JumpMenuChangeEvent[] = [];
  const jumped: JumpMenuJumpedEvent[] = [];
  const view = await render(SvJumpMenuComponent, {
    inputs: { items: ITEMS, ...inputs } as ComponentInput<SvJumpMenuComponent>,
    on: {
      jump: (e: JumpMenuChangeEvent) => jumps.push(e),
      jumped: (e: JumpMenuJumpedEvent) => jumped.push(e),
    },
  });
  const select = view.container.querySelector('select')!;
  const choose = (id: string) => {
    select.value = id;
    select.dispatchEvent(new Event('change'));
    view.fixture.detectChanges();
  };
  return { ...view, jumps, jumped, select, choose };
}

/** A scroll box holding one section per item, each at a known offset. */
function scrollBox(): HTMLElement {
  const box = document.createElement('div');
  ITEMS.forEach((item, i) => {
    const s = document.createElement('section');
    s.id = item.id;
    s.getBoundingClientRect = () => ({ top: 100 + i * 300 }) as DOMRect;
    box.appendChild(s);
  });
  box.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
  box.scrollTo = vi.fn() as unknown as HTMLElement['scrollTo'];
  document.body.appendChild(box);
  return box;
}

afterEach(() => {
  document.querySelectorAll('section[id^="jm-"]').forEach((n) => n.parentElement?.remove());
  vi.restoreAllMocks();
});

describe('SvJumpMenuComponent — scrollTarget (SR-19)', () => {
  it('scrolls nothing by default, and still emits jump', async () => {
    const box = scrollBox();
    const { choose, jumps, jumped } = await setup();
    choose('jm-b');
    expect(box.scrollTo).not.toHaveBeenCalled();
    expect(jumps.map((j) => j.item.id)).toEqual(['jm-b']);
    expect(jumped).toEqual([]);
  });

  it('★ scrolls a container to the matching section, less the offset, and reports it', async () => {
    const box = scrollBox();
    const { choose, jumped } = await setup({ scrollTarget: box, scrollOffset: 16 });
    choose('jm-c');
    // Section C is 600 px below the box's top; minus the 16 px offset.
    expect(box.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 584 }));
    expect(jumped.map((j) => [j.item.id, j.element.id])).toEqual([['jm-c', 'jm-c']]);
  });

  it('ignores an element with that id outside the container', async () => {
    const box = scrollBox();
    const other = document.createElement('div');
    const { choose, jumped } = await setup({ scrollTarget: other });
    choose('jm-b');
    expect(box.scrollTo).not.toHaveBeenCalled();
    expect(jumped).toEqual([]);
  });

  it('"id" scrolls the page', async () => {
    scrollBox();
    const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const { choose, jumped } = await setup({ scrollTarget: 'id' });
    choose('jm-b');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ top: 400 + window.scrollY }));
    expect(jumped).toHaveLength(1);
  });
});

describe('SvJumpMenuComponent — activeId drives the select (SR-19)', () => {
  it('★ follows a scroll-spy', async () => {
    const { fixture, select } = await setup({ activeId: 'jm-a' });
    expect(select.value).toBe('jm-a');
    fixture.componentRef.setInput('activeId', 'jm-b');
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('jm-b');
    expect(select.value).toBe('jm-b');
  });

  it('ignores an id it has no destination for, and null', async () => {
    const { fixture } = await setup({ value: 'jm-a', activeId: null });
    fixture.componentRef.setInput('activeId', 'nope');
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('jm-a');
  });

  it('★ holds off the spy while its own jump is still scrolling', async () => {
    const box = scrollBox();
    const { fixture, choose } = await setup({ scrollTarget: box, activeId: 'jm-a' });
    choose('jm-c');
    // The smooth scroll passes B on the way: that report must not win.
    fixture.componentRef.setInput('activeId', 'jm-b');
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('jm-c');
    // Arriving releases the hold.
    fixture.componentRef.setInput('activeId', 'jm-c');
    fixture.detectChanges();
    fixture.componentRef.setInput('activeId', 'jm-a');
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('jm-a');
  });
});

describe('SvJumpMenuComponent — goButton (SR-19, WCAG 3.2.2)', () => {
  it('renders no button by default', async () => {
    const { container } = await setup();
    expect(container.querySelector('button')).toBeNull();
  });

  it('★ a choice only marks the destination; Go takes it', async () => {
    const { container, choose, jumps, fixture, select } = await setup({ goButton: true, value: 'jm-a' });
    choose('jm-b');
    expect(jumps).toEqual([]);
    expect(fixture.componentInstance.value()).toBe('jm-a');
    expect(select.value).toBe('jm-b');

    const go = container.querySelector('button')!;
    expect(go.textContent?.trim()).toBe('Go');
    go.click();
    fixture.detectChanges();
    expect(jumps.map((j) => j.item.id)).toEqual(['jm-b']);
    expect(fixture.componentInstance.value()).toBe('jm-b');
  });

  it('Enter on the select takes it too', async () => {
    const { choose, jumps, select } = await setup({ goButton: true, goLabel: 'Open' });
    choose('jm-c');
    select.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(jumps.map((j) => j.item.id)).toEqual(['jm-c']);
  });
});

describe('SvJumpMenuComponent — RTL (SR-19)', () => {
  it('uses logical padding and an end-aligned chevron', async () => {
    const { select, container } = await setup();
    expect(select.className).toMatch(/\bps-3\b/);
    expect(select.className).toMatch(/\bpe-8\b/);
    expect(select.className).not.toMatch(/\bp[lr]-/);
    expect(container.querySelector('sv-icon')?.getAttribute('cssclass') ?? container.innerHTML).toMatch(/end-2/);
  });
});
