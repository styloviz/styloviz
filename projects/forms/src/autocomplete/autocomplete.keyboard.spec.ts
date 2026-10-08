import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvAutocompleteComponent } from './autocomplete.component';
import type { AutocompleteOption } from './autocomplete.component';

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Paths the component's own spec does not reach — each one a state a user can
 * produce: a disabled control pressed anyway, a keyboard shortcut used before
 * the panel is open, a section that starts collapsed.
 */

// ── sv-autocomplete ──────────────────────────────────────────────────────────

describe('SvAutocompleteComponent — Home and End before the panel is open', () => {
  const OPTIONS: AutocompleteOption[] = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Bravo' },
    { value: 'c', label: 'Charlie' },
  ];

  async function setup(inputs: Partial<ComponentInput<SvAutocompleteComponent>> = {}) {
    TestBed.resetTestingModule();
    return render(SvAutocompleteComponent, {
      inputs: { options: OPTIONS, ...inputs } as ComponentInput<SvAutocompleteComponent>,
    });
  }

  const key = (k: string) =>
    new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });

  afterEach(() => {
    document.querySelectorAll('.sv-ac-portal').forEach((n) => n.remove());
  });

  it('leaves Home and End to the text field while the list is closed', async () => {
    // Home and End are the caret's own keys. Swallowing them with the list shut
    // would stop the user jumping to the start of what they have typed.
    const { fixture } = await setup();
    const c = fixture.componentInstance;
    expect(c.open()).toBe(false);

    const home = key('Home');
    c.onKeydown(home);
    expect(home.defaultPrevented).toBe(false);

    const end = key('End');
    c.onKeydown(end);
    expect(end.defaultPrevented).toBe(false);
    expect(c.highlightIdx()).toBe(-1);
  });

  it('takes Home and End for the list once it is open', async () => {
    const { fixture } = await setup();
    const c = fixture.componentInstance;
    c.onKeydown(key('ArrowDown')); // opens
    fixture.detectChanges();
    expect(c.open()).toBe(true);

    const end = key('End');
    c.onKeydown(end);
    expect(end.defaultPrevented).toBe(true);
    expect(c.highlightIdx()).toBe(OPTIONS.length - 1);

    const home = key('Home');
    c.onKeydown(home);
    expect(home.defaultPrevented).toBe(true);
    expect(c.highlightIdx()).toBe(0);
  });

  it('does not mount a second panel when asked to open twice', async () => {
    const { fixture } = await setup();
    const c = fixture.componentInstance;
    c.onKeydown(key('ArrowDown'));
    fixture.detectChanges();
    c.onKeydown(key('ArrowDown'));
    fixture.detectChanges();
    expect(document.querySelectorAll('.sv-ac-portal')).toHaveLength(1);
  });

  it('coalesces a burst of scrolls into one recalculation, and ignores them while closed', async () => {
    const { fixture } = await setup();
    const c = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;
    const input = host.querySelector('input') as HTMLElement;
    let measurements = 0;
    // ★ An explicit rect — jsdom measures nothing, so the COUNT is what is
    // under test, not the geometry.
    const r = { top: 100, bottom: 130, left: 40, right: 240, width: 200, height: 30, x: 40, y: 100 };
    input.getBoundingClientRect = () => {
      measurements++;
      return { ...r, toJSON: () => r } as DOMRect;
    };

    window.dispatchEvent(new Event('scroll'));
    await nextFrame();
    expect(measurements).toBe(0); // closed: nothing to track

    c.onKeydown(key('ArrowDown'));
    fixture.detectChanges();
    const afterOpen = measurements;

    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    await nextFrame();
    expect(measurements).toBe(afterOpen + 1);
  });

  it('cancels a queued frame when destroyed', async () => {
    const { fixture } = await setup();
    fixture.componentInstance.onKeydown(key('ArrowDown'));
    fixture.detectChanges();
    window.dispatchEvent(new Event('scroll'));
    expect(() => fixture.destroy()).not.toThrow();
    await nextFrame();
    expect(document.querySelectorAll('.sv-ac-portal')).toHaveLength(0);
  });
});
