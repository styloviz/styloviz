import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import {
  SvEmptyGhostDirective,
  SvEmptyIllustrationDirective,
  SvEmptyMediaDirective,
  SvEmptyStateComponent,
  type EmptyStateStep,
} from './empty-state.component';

/**
 * `SR-34` — empty-state variants (dashed, ghost, glow), illustrations, an
 * onboarding checklist, the query echo with suggestions, error details,
 * request access, xs and xl sizes, a secondary link, an avatar stack, a
 * shortcut hint, a media slot and start alignment.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const view = await render(SvEmptyStateComponent, { inputs });
  return { ...view, component: view.fixture.componentInstance };
}
const root = (c: Element) => c.querySelector<HTMLElement>('[data-sv-empty-variant]')!;

describe('dashed — the whole card is the one action', () => {
  it('becomes a single button that Enter and Space press', async () => {
    const { container, component } = await setup({
      variant: 'dashed', title: 'Create your first project', actions: [{ id: 'new', label: 'New project', icon: 'plus' }],
    });
    const ids: string[] = [];
    component.actionClick.subscribe((id) => ids.push(id));
    const card = root(container);
    expect(card.getAttribute('role')).toBe('button');
    expect(card.getAttribute('tabindex')).toBe('0');
    expect(card.className).toContain('border-dashed');
    expect(card.querySelector('button')).toBeNull(); // no control nested in the control
    card.click();
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true }));
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', cancelable: true }));
    expect(ids).toEqual(['new', 'new', 'new']);
  });

  it('stays a region with real buttons when there is more than one thing to press', async () => {
    const { container } = await setup({ variant: 'dashed', actions: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] });
    expect(root(container).getAttribute('role')).toBe('region');
    expect(root(container).querySelectorAll('button')).toHaveLength(2);
    const one = await setup({ variant: 'dashed', actions: [{ id: 'a', label: 'A' }], secondaryLink: { label: 'Docs', href: '/docs' } });
    expect(root(one.container).getAttribute('role')).toBe('region');
  });
});

@Component({
  standalone: true,
  imports: [SvEmptyStateComponent, SvEmptyGhostDirective, SvEmptyIllustrationDirective, SvEmptyMediaDirective],
  template: `
    <sv-empty-state id="ghost" variant="ghost" title="No invoices yet">
      <div svGhost data-ghost-rows>Row · Row · Row</div>
    </sv-empty-state>
    <sv-empty-state id="illus" title="Inbox zero">
      <img svIllustration src="/x.svg" alt="" data-own-illustration />
    </sv-empty-state>
    <sv-empty-state id="media" title="Watch the tour">
      <img svMedia src="/tour.webp" alt="Product tour" data-own-media />
    </sv-empty-state>`,
})
class Slots {}

describe('slots: ghost, illustration, media', () => {
  it('ghost content sits behind, faint, masked and out of reach; illustration and media replace the rings', async () => {
    TestBed.resetTestingModule();
    const { container } = await render(Slots);
    const ghost = container.querySelector('#ghost [data-sv-empty-ghost]')!;
    expect(ghost.getAttribute('aria-hidden')).toBe('true');
    expect(ghost.hasAttribute('inert')).toBe(true);
    expect(ghost.className).toContain('opacity-40');
    expect(ghost.className).toContain('mask-image');
    expect(ghost.querySelector('[data-ghost-rows]')).toBeTruthy();

    const illus = container.querySelector('#illus')!;
    expect(illus.querySelector('[data-sv-empty-illustration] [data-own-illustration]')).toBeTruthy();
    expect(illus.querySelector('sv-icon')).toBeNull();

    const media = container.querySelector('#media')!;
    expect(media.querySelector('[data-sv-empty-media] [data-own-media]')).toBeTruthy();
    expect(media.querySelector('sv-icon')).toBeNull();
  });
});

describe('built-in illustrations', () => {
  it('auto picks one by reason, and each is a decorative, illustration-sized scene', async () => {
    for (const [reason, tag] of [
      ['no-data', 'sv-illustration-no-data'],
      ['no-results', 'sv-illustration-no-results'],
      ['no-access', 'sv-illustration-no-access'],
      ['error', 'sv-illustration-error'],
    ] as const) {
      const { container } = await setup({ illustration: 'auto', reason });
      const el = container.querySelector(tag)!;
      expect(el).toBeTruthy();
      const svg = el.querySelector('svg')!;
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('viewBox')).toBe('0 0 160 120');
      // Themed with classes, so it follows dark mode.
      expect(svg.innerHTML).toContain('dark:fill-');
    }
    const offline = await setup({ illustration: 'auto', offline: true });
    expect(offline.container.querySelector('sv-illustration-error')).toBeTruthy();
  });

  it('a named one, and glow puts an sv-glow disc behind', async () => {
    const { container } = await setup({ illustration: 'no-results', variant: 'glow' });
    expect(container.querySelector('sv-illustration-no-results')).toBeTruthy();
    expect(container.querySelector('[data-sv-empty-illustration] .sv-glow')).toBeTruthy();
    const plain = await setup({ variant: 'glow' });
    expect(plain.container.querySelector('[data-sv-empty-glow]')?.className).toContain('sv-glow');
    expect(plain.container.innerHTML).not.toMatch(/\bblur-(sm|md|lg|xl|2xl|3xl)\b/);
  });
});

describe('onboarding checklist', () => {
  it('numbers the steps, checks the done ones, marks the next, and reports a click', async () => {
    const steps: EmptyStateStep[] = [
      { id: 'a', label: 'Create a project', done: true },
      { id: 'b', label: 'Invite your team', description: 'Two minutes' },
      { id: 'c', label: 'Connect a data source' },
    ];
    const { container, component } = await setup({ steps });
    const clicked: string[] = [];
    component.stepClick.subscribe((s) => clicked.push(s.id));
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-sv-empty-steps] button'));
    expect(buttons[0].querySelector('sv-icon')).toBeTruthy();
    expect(buttons[0].textContent).toContain('Done:');
    expect(buttons[1].getAttribute('aria-current')).toBe('step');
    expect(buttons[2].textContent).toContain('3');
    buttons[1].click();
    expect(clicked).toEqual(['b']);
  });
});

describe('search: the query echo, suggestions and Clear search', () => {
  it('names the search in the title, offers suggestions and a way out', async () => {
    const { container, component } = await setup({ reason: 'no-results', query: 'invioce', suggestions: ['invoice', 'invoices'] });
    const picked: string[] = [];
    let cleared = 0;
    component.suggestionClick.subscribe((s) => picked.push(s));
    component.clearQuery.subscribe(() => cleared++);
    expect(container.querySelector('h3')?.textContent?.trim()).toBe('No results for “invioce”');
    expect(container.querySelector('[data-sv-empty-suggestions]')?.textContent).toContain('Did you mean');
    container.querySelectorAll<HTMLButtonElement>('[data-sv-empty-suggestions] button')[0].click();
    container.querySelector<HTMLButtonElement>('[data-sv-empty-clear-query]')!.click();
    expect(picked).toEqual(['invoice']);
    expect(cleared).toBe(1);
  });
});

describe('error details and request access', () => {
  it('error details sit behind a disclosure; no-access offers a request', async () => {
    const err = await setup({ reason: 'error', errorDetails: 'GET /api/invoices → 503 (trace 7f3a)' });
    const details = err.container.querySelector('details')!;
    expect(details.querySelector('summary')?.textContent).toBe('Show details');
    expect(details.querySelector('pre')?.textContent).toContain('trace 7f3a');

    const denied = await setup({ reason: 'no-access', requestAccessLabel: 'Request access' });
    let asked = 0;
    denied.component.requestAccess.subscribe(() => asked++);
    denied.container.querySelector<HTMLButtonElement>('[data-sv-empty-request-access]')!.click();
    expect(asked).toBe(1);
    const other = await setup({ reason: 'no-data', requestAccessLabel: 'Request access' });
    expect(other.container.querySelector('[data-sv-empty-request-access]')).toBeNull();
  });
});

describe('sizes xs and xl, start alignment', () => {
  it('xs is one compact row with no rings; xl is a hero', async () => {
    const xs = await setup({ size: 'xs', title: 'No rows', message: 'Add one to begin.', actions: [{ id: 'a', label: 'Add' }] });
    expect(root(xs.container).className).toContain('flex items-center gap-3');
    expect(root(xs.container).querySelectorAll('.rounded-full.border')).toHaveLength(0);
    const xl = await setup({ size: 'xl', title: 'Welcome' });
    expect(xl.container.querySelector('h3')?.className).toContain('text-3xl');
    expect(root(xl.container).className).toContain('py-20');
  });

  it('align="start" puts everything at the start', async () => {
    const { container } = await setup({ align: 'start', actions: [{ id: 'a', label: 'A' }] });
    expect(root(container).className).toContain('items-start text-start');
  });
});

describe('secondary link, avatars and the shortcut hint', () => {
  it('renders a quiet link, a capped avatar stack with +N, and the keys', async () => {
    const { container } = await setup({
      secondaryLink: { label: 'Read the guide', href: '/docs/teams' },
      avatars: [{ name: 'Ada' }, { name: 'Alan' }, { name: 'Grace' }, { name: 'Linus' }, { name: 'Margaret' }, { name: 'Ken' }],
      maxAvatars: 4,
      shortcut: 'mod+i',
      shortcutHint: 'to invite someone',
    });
    expect(container.querySelector<HTMLAnchorElement>('[data-sv-empty-link]')?.getAttribute('href')).toBe('/docs/teams');
    expect(container.querySelectorAll('[data-sv-empty-avatars] sv-avatar')).toHaveLength(4);
    expect(container.querySelector('[data-sv-empty-avatars]')?.textContent).toContain('2 more');
    const hint = container.querySelector('[data-sv-empty-shortcut]')!;
    expect(hint.querySelectorAll('sv-kbd').length).toBe(2);
    expect(hint.textContent?.replace(/\s+/g, ' ').trim()).toMatch(/^Press (Ctrl|⌘)\+I to invite someone$/);
  });

  it('labels override every built-in string', async () => {
    const { container } = await setup({ reason: 'no-results', query: 'x', labels: { noResultsFor: 'Keine Treffer für „{query}“', clearQuery: 'Suche löschen' } });
    expect(container.querySelector('h3')?.textContent?.trim()).toBe('Keine Treffer für „x“');
    expect(container.querySelector('[data-sv-empty-clear-query]')?.textContent).toContain('Suche löschen');
  });
});
