import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvDividerComponent } from './divider/divider.component';
import { SvToolbarComponent, type ToolbarAction } from './toolbar/toolbar.component';

/**
 * `X-7` forced colors — the Layout package's accents that would vanish under
 * `forced-colors: active` (a gradient background, a translucent tint, a
 * box-shadow ring) and the system-colour fallback each renders instead.
 *
 * ⚠️ jsdom cannot emulate forced colors, so these pin the fallback CLASS on the
 * rendered node; `scripts/check-reduced-motion.mjs` pins the same claims in
 * source. That the browser honours author system colours in the mode is the
 * platform's contract, not something a unit test can observe.
 */

describe('Divider — forced-colors fallback (X-7)', () => {
  it.each(['horizontal', 'vertical'] as const)('a %s gradient rule falls back to a CanvasText border', async (orientation) => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvDividerComponent, {
      inputs: { variant: 'gradient', orientation } as ComponentInput<SvDividerComponent>,
    });
    const line = (fixture.nativeElement as HTMLElement).querySelector('[class*="bg-gradient"]');
    expect(line?.className).toContain('forced-colors:border-[CanvasText]');
    expect(line?.className).toContain(orientation === 'horizontal' ? 'forced-colors:border-t' : 'forced-colors:border-l');
  });

  it('leaves border variants alone — forced colors already paints borders', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvDividerComponent, {
      inputs: { variant: 'dashed' } as ComponentInput<SvDividerComponent>,
    });
    expect(fixture.componentInstance.lineClass()).not.toContain('forced-colors:');
  });
});

describe('Toolbar — forced-colors fallback (X-7)', () => {
  const ACTIONS: readonly ToolbarAction[] = [
    { id: 'bold', label: 'Bold', icon: 'bold', dividerAfter: true },
    { id: 'italic', label: 'Italic', icon: 'italic' },
  ];

  /**
   * Rendered, not computed: a pressed toggle and an idle one side by side in
   * the DOM, so the assertion covers the template's `[class]` binding and its
   * `isActive()` wiring, not just the class-building method.
   */
  it.each(['default', 'primary', 'danger', 'success'] as const)('a pressed %s toggle renders a Highlight edge; an idle one does not', async (variant) => {
    TestBed.resetTestingModule();
    const actions: readonly ToolbarAction[] = [
      { id: 'on', label: 'On', icon: 'bold', variant, toggle: true },
      { id: 'idle', label: 'Idle', icon: 'italic', variant, toggle: true },
    ];
    const { fixture } = await render(SvToolbarComponent, {
      inputs: { actions, activeIds: new Set(['on']) } as ComponentInput<SvToolbarComponent>,
    });
    const root = fixture.nativeElement as HTMLElement;
    const on = root.querySelector('[data-action-id="on"]') as HTMLElement;
    const idle = root.querySelector('[data-action-id="idle"]') as HTMLElement;
    expect(on.getAttribute('aria-pressed')).toBe('true');
    expect(idle.getAttribute('aria-pressed')).toBe('false');
    expect(on.classList.contains('forced-colors:border-[Highlight]')).toBe(true);
    expect(on.classList.contains('forced-colors:border')).toBe(true);
    expect(idle.classList.contains('forced-colors:border-[Highlight]')).toBe(false);
  });

  it.each(['default', 'primary', 'danger', 'success'] as const)('a clicked (momentarily pressed) %s action renders a Highlight edge', async (variant) => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvToolbarComponent, {
      inputs: { actions: [{ id: 'go', label: 'Go', icon: 'bold', variant }] } as ComponentInput<SvToolbarComponent>,
    });
    const btn = (fixture.nativeElement as HTMLElement).querySelector('[data-action-id="go"]') as HTMLButtonElement;
    expect(btn.classList.contains('forced-colors:border-[Highlight]')).toBe(false);
    btn.click();
    fixture.detectChanges();
    expect(btn.classList.contains('forced-colors:border-[Highlight]')).toBe(true);
  });

  it('renders separators in CanvasText', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvToolbarComponent, {
      inputs: { actions: ACTIONS } as ComponentInput<SvToolbarComponent>,
    });
    const separators = (fixture.nativeElement as HTMLElement).querySelectorAll('[role="separator"]');
    expect(separators.length).toBeGreaterThan(0);
    for (const sep of Array.from(separators)) expect(sep.className).toContain('forced-colors:bg-[CanvasText]');
  });
});
