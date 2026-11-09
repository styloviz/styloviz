import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { untilRendered } from '../../../../src/testing/async';
import { SvPaginationComponent } from './pagination.component';

/**
 * FL-G4 — "Go to page" and the `load-more` variant.
 *
 * The jump box clamps like every other entry point (`goTo`), so a number past
 * either end lands on the first or last page rather than nowhere. Load more is
 * one button that asks for the next page and a count of what is on screen; it
 * goes when there is nothing more, and focus goes to the landmark rather than
 * to `<body>`.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const pages: number[] = [];
  const { fixture } = await render(SvPaginationComponent, {
    inputs: { totalItems: 200, pageSize: 10, ...inputs },
    on: { pageChange: (p: number) => pages.push(p) },
  });
  return { fixture, pages, el: fixture.nativeElement as HTMLElement };
}

function jump(el: HTMLElement, value: string, fixture: { detectChanges(): void }) {
  const field = el.querySelector<HTMLInputElement>('input[type="number"]')!;
  field.value = value;
  field.form!.dispatchEvent(new Event('submit', { cancelable: true }));
  fixture.detectChanges();
  return field;
}

describe('SvPaginationComponent — jump to page (FL-G4)', () => {
  it('is not drawn unless asked for', async () => {
    const { el } = await setup();
    expect(el.querySelector('input[type="number"]')).toBeNull();
  });

  it('goes to the page typed, and clears the field', async () => {
    const { el, fixture, pages } = await setup({ jumpToPage: true });
    const field = jump(el, '7', fixture);
    expect(fixture.componentInstance.currentPage()).toBe(7);
    expect(pages).toEqual([7]);
    expect(field.value).toBe('');
    expect(el.querySelector('form label')?.textContent).toContain('Go to page');
    expect(field.getAttribute('max')).toBe('20');
  });

  it('clamps past either end, and ignores what is not a number', async () => {
    const { el, fixture } = await setup({ jumpToPage: true });
    jump(el, '999', fixture);
    expect(fixture.componentInstance.currentPage()).toBe(20);
    jump(el, '-3', fixture);
    expect(fixture.componentInstance.currentPage()).toBe(1);
    jump(el, '', fixture);
    expect(fixture.componentInstance.currentPage()).toBe(1);
  });

  it('needs a known total: none in cursor mode or with an unknown count', async () => {
    const { el } = await setup({ jumpToPage: true, totalItems: null });
    expect(el.querySelector('input[type="number"]')).toBeNull();
  });
});

describe('SvPaginationComponent — load more (FL-G4)', () => {
  it('is one button and a count of what is on screen — no page numbers, no size picker', async () => {
    const { el } = await setup({ variant: 'load-more', totalItems: 95, pageSize: 20 });
    expect(el.querySelector('[data-sv-load-more-count]')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Showing 20 of 95');
    expect(el.querySelector('[aria-label="Load more"]')).not.toBeNull();
    expect(el.querySelector('[aria-current="page"]')).toBeNull();
    expect(el.querySelector('select')).toBeNull();
  });

  it('asks for the next page and counts it in', async () => {
    const { el, fixture, pages } = await setup({ variant: 'load-more', totalItems: 95, pageSize: 20 });
    el.querySelector<HTMLButtonElement>('[aria-label="Load more"]')!.click();
    fixture.detectChanges();
    expect(pages).toEqual([2]);
    expect(el.querySelector('[data-sv-load-more-count]')?.textContent).toContain('40');
  });

  it('refuses a press while a page loads, without dropping focus', async () => {
    const { el, fixture, pages } = await setup({ variant: 'load-more', totalItems: 95, pageSize: 20, loading: true });
    const more = el.querySelector<HTMLButtonElement>('[aria-label="Load more"]')!;
    // aria-disabled, not disabled: a disabled button would lose focus mid-load.
    expect(more.disabled).toBe(false);
    expect(more.getAttribute('aria-disabled')).toBe('true');
    more.focus();
    more.click();
    fixture.detectChanges();
    expect(pages).toEqual([]);
    expect(document.activeElement).toBe(more);
  });

  it('goes when everything is shown, and focus lands on the landmark, not <body>', async () => {
    const { el, fixture } = await setup({ variant: 'load-more', totalItems: 30, pageSize: 20 });
    const more = el.querySelector<HTMLButtonElement>('[aria-label="Load more"]')!;
    more.focus();
    more.click();
    fixture.detectChanges();
    expect(el.querySelector('[aria-label="Load more"]')).toBeNull();
    expect(el.querySelector('[data-sv-load-more-count]')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Showing 30 of 30');
    await untilRendered(fixture, () => document.activeElement !== document.body);
    expect(document.activeElement).toBe(el.querySelector('nav'));
  });

  it('follows hasMore when there is no total', async () => {
    const { el } = await setup({ variant: 'load-more', totalItems: null, hasMore: false });
    expect(el.querySelector('[aria-label="Load more"]')).toBeNull();
    expect(el.querySelector('[data-sv-load-more-count]')).toBeNull();
  });
});
