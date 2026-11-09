import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvSuggestionsComponent, type SvSuggestion } from './suggestions.component';

const PROMPTS: readonly SvSuggestion[] = [
  { id: 'a', label: 'Summarise', prompt: 'Summarise this week', description: 'A short digest', icon: 'sparkles' },
  { id: 'b', label: 'Draft a reply' },
  { id: 'c', label: 'Explain the spike' },
  { id: 'd', label: 'Find anomalies' },
];

async function mount(inputs: Record<string, unknown> = {}, providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvSuggestionsComponent, {
    inputs: { suggestions: PROMPTS, ...inputs } as never,
    providers: providers as never[],
  });
  fixture.detectChanges();
  return fixture;
}

const buttons = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('li button')];

afterEach(() => TestBed.resetTestingModule());

describe('SvSuggestionsComponent', () => {
  it('renders one button per suggestion in a named list', async () => {
    const f = await mount();
    const el = f.nativeElement as HTMLElement;
    expect(buttons(el)).toHaveLength(4);
    expect(el.querySelector('ul')?.getAttribute('aria-label')).toBe('Suggested prompts');
  });

  it('emits the suggestion it was pressed for', async () => {
    const f = await mount();
    const seen: string[] = [];
    f.componentInstance.selected.subscribe((s) => seen.push(s.id));
    buttons(f.nativeElement)[1].click();
    expect(seen).toEqual(['b']);
  });

  it('caps the list at max, and treats 0 or nonsense as "all"', async () => {
    expect(buttons((await mount({ max: 2 })).nativeElement)).toHaveLength(2);
    expect(buttons((await mount({ max: 0 })).nativeElement)).toHaveLength(4);
    expect(buttons((await mount({ max: Number.NaN })).nativeElement)).toHaveLength(4);
    expect(buttons((await mount({ max: -3 })).nativeElement)).toHaveLength(4);
  });

  it('shows descriptions in the list layout and drops them in chips', async () => {
    expect((await mount()).nativeElement.textContent).toContain('A short digest');
    expect((await mount({ layout: 'chips' })).nativeElement.textContent).not.toContain('A short digest');
  });

  it('emits nothing while disabled', async () => {
    const f = await mount({ disabled: true });
    const seen: string[] = [];
    f.componentInstance.selected.subscribe((s) => seen.push(s.id));
    const first = buttons(f.nativeElement)[0];
    expect(first.disabled).toBe(true);
    first.click();
    expect(seen).toEqual([]);
  });

  it('renders the text an app provides', async () => {
    const f = await mount({}, [provideSvLabels({ ai: { suggestions: 'Vorschläge' } })]);
    expect(f.nativeElement.querySelector('ul')?.getAttribute('aria-label')).toBe('Vorschläge');
  });

  it('prefers the per-instance aria label', async () => {
    const f = await mount({ ariaLabel: 'Follow-ups' });
    expect(f.nativeElement.querySelector('ul')?.getAttribute('aria-label')).toBe('Follow-ups');
  });
});
