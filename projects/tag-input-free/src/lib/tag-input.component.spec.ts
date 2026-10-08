import { render } from '@testing-library/angular';
import { SvTagInputComponent, type TagOption } from './tag-input.component';

const OPTIONS: TagOption[] = [
  { value: 'ng', label: 'Angular' },
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
  { value: 'svelte', label: 'Svelte', disabled: true },
];

async function setup(extra: Record<string, unknown> = {}) {
  const { fixture } = await render(SvTagInputComponent, {
    inputs: { options: OPTIONS, ...extra },
  });
  return fixture.componentInstance;
}

describe('SvTagInputComponent — selecting', () => {
  it('adds a tag and emits tagsChange with values + resolved tags', async () => {
    const spy = vi.fn();
    const c = await setup();
    c.tagsChange.subscribe(spy);

    c.selectOption(OPTIONS[0]);
    expect(c.values()).toEqual(['ng']);
    expect(spy).toHaveBeenCalledWith({
      values: ['ng'],
      tags: [{ value: 'ng', label: 'Angular' }],
    });
  });

  it('ignores disabled options', async () => {
    const c = await setup();
    c.selectOption(OPTIONS[3]); // Svelte, disabled
    expect(c.values()).toEqual([]);
  });
});

describe('SvTagInputComponent — filtering', () => {
  it('excludes already-selected options from the list', async () => {
    const c = await setup({ values: ['ng'] });
    expect(c.filteredOptions().map((o) => o.value)).not.toContain('ng');
  });

  it('filters by a case-insensitive query', async () => {
    const c = await setup();
    c.query.set('re');
    expect(c.filteredOptions().map((o) => o.value)).toEqual(['react']);
  });

  it('reports no results for a non-matching query', async () => {
    const c = await setup();
    c.query.set('zzz');
    expect(c.noResults()).toBe(true);
  });
});

describe('SvTagInputComponent — removing', () => {
  it('removes a specific tag', async () => {
    const c = await setup({ values: ['ng', 'react'] });
    c.removeTag('ng');
    expect(c.values()).toEqual(['react']);
  });

  it('clears all tags', async () => {
    const c = await setup({ values: ['ng', 'react'] });
    c.clearAll();
    expect(c.values()).toEqual([]);
  });

  it('Backspace on an empty query removes the last tag', async () => {
    const c = await setup({ values: ['ng', 'react'] });
    c.onKeydown(new KeyboardEvent('keydown', { key: 'Backspace' }));
    expect(c.values()).toEqual(['ng']);
  });
});
