import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { SvCodeBlockComponent } from './code-block.component';
import type { CodeFile } from './code-block.types';

/**
 * The header: which file is showing, what it is called, what language it is in,
 * and the roving-tabindex tab strip that switches between files.
 *
 * `selectTab` / `onTabKeydown` are `protected`, so everything here goes through
 * the rendered DOM — which is the right place for a keyboard contract anyway.
 */

const FILES: readonly CodeFile[] = [
  { name: 'app.component.ts', content: 'const a = 1;' },
  { name: 'styles.css', content: '.a { color: red; }' },
  { name: 'data.json', content: '{"a":1}' },
];

function setup(inputs: Record<string, unknown> = {}): ComponentFixture<SvCodeBlockComponent> {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(SvCodeBlockComponent);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return fixture;
}

const el = (f: ComponentFixture<SvCodeBlockComponent>) => f.nativeElement as HTMLElement;
const tabs = (f: ComponentFixture<SvCodeBlockComponent>) =>
  [...el(f).querySelectorAll<HTMLButtonElement>('[role="tab"]')];
const selected = (f: ComponentFixture<SvCodeBlockComponent>) =>
  tabs(f).map((t) => t.getAttribute('aria-selected'));
const shownCode = (f: ComponentFixture<SvCodeBlockComponent>) =>
  el(f).querySelector('code')?.textContent ?? '';

describe('SvCodeBlockComponent — resolving what to show', () => {
  it('synthesises a single file from code + filename when no files are given', () => {
    const f = setup({ code: 'const a = 1;', filename: 'demo.ts' });
    expect(el(f).textContent).toContain('demo.ts');
    expect(shownCode(f)).toContain('const a = 1;');
  });

  it('prefers the files list over code + filename when both are set', () => {
    const f = setup({ code: 'IGNORED', filename: 'ignored.ts', variant: 'tabs', files: FILES });
    expect(shownCode(f)).toContain('const a = 1;');
    expect(el(f).textContent).not.toContain('IGNORED');
  });

  it('shows no name and no language badge for a bare snippet', () => {
    // Neither `filename` nor `language` — the header must not render an empty
    // name chip or a "plaintext" badge nobody asked for.
    const f = setup({ code: 'hello' });
    const header = el(f).querySelector('.border-b')!;
    expect(header.textContent?.trim()).toBe('');
    expect(el(f).querySelector('[role="region"]')?.getAttribute('aria-label')).toBe(
      'plaintext code',
    );
  });

  it('infers the language from the file extension', () => {
    const f = setup({ code: '.a { color: red; }', filename: 'styles.css' });
    expect(el(f).textContent).toContain('css');
  });

  it('lets an explicit language override the extension', () => {
    const f = setup({ code: 'x', filename: 'mystery.css', language: 'python' });
    expect(el(f).textContent).toContain('python');
  });

  it('lets a per-file language beat the component-wide one', () => {
    // Single file so the header shows the language badge rather than a tab
    // strip — the badge is the only place the resolved language is visible.
    const f = setup({
      language: 'python',
      files: [{ name: 'a.txt', language: 'json', content: '{}' }] satisfies CodeFile[],
    });
    expect(el(f).textContent).toContain('json');
    expect(el(f).textContent).not.toContain('python');
  });

  it('names the region after the file, and falls back through to the language', () => {
    const label = (f: ComponentFixture<SvCodeBlockComponent>) =>
      el(f).querySelector('[role="region"]')!.getAttribute('aria-label');

    expect(label(setup({ ariaLabel: 'Install script', filename: 'a.ts', code: 'x' }))).toBe(
      'Install script',
    );
    expect(label(setup({ filename: 'a.ts', code: 'x' }))).toBe('a.ts');
    expect(label(setup({ code: 'x', language: 'bash' }))).toBe('bash code');
  });

  it('hides the whole header when asked to', () => {
    const f = setup({ code: 'x', filename: 'a.ts', showHeader: false });
    expect(el(f).textContent).not.toContain('a.ts');
    expect(el(f).querySelector('button')).toBeNull();
  });

  it('drops the copy button without dropping the header', () => {
    const f = setup({ code: 'x', filename: 'a.ts', copyable: false });
    expect(el(f).textContent).toContain('a.ts');
    expect(el(f).querySelector('button[aria-label]')).toBeNull();
  });
});

describe('SvCodeBlockComponent — the tab strip', () => {
  it('renders no tab strip for a single file, even in the tabs variant', () => {
    // One tab is not a choice; the header shows the file name instead.
    const f = setup({ variant: 'tabs', files: [FILES[0]] });
    expect(tabs(f)).toEqual([]);
    expect(el(f).textContent).toContain('app.component.ts');
  });

  it('renders no tab strip outside the tabs variant', () => {
    const f = setup({ variant: 'block', files: FILES });
    expect(tabs(f)).toEqual([]);
  });

  it('opens on the first file and keeps only that one in the tab order', () => {
    const f = setup({ variant: 'tabs', files: FILES });
    expect(selected(f)).toEqual(['true', 'false', 'false']);
    expect(tabs(f).map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });

  it('switches file on click and reports which one', () => {
    const f = setup({ variant: 'tabs', files: FILES });
    const seen: CodeFile[] = [];
    f.componentInstance.tabChange.subscribe((file) => seen.push(file));

    tabs(f)[1].click();
    f.detectChanges();

    expect(selected(f)).toEqual(['false', 'true', 'false']);
    expect(shownCode(f)).toContain('color: red');
    expect(seen.map((s) => s.name)).toEqual(['styles.css']);
  });

  it('stays quiet when the active tab is clicked again', () => {
    // Re-selecting is not a change, and a host that refetches on `tabChange`
    // would refetch on every stray click.
    const f = setup({ variant: 'tabs', files: FILES });
    const seen: CodeFile[] = [];
    f.componentInstance.tabChange.subscribe((file) => seen.push(file));

    tabs(f)[0].click();
    f.detectChanges();
    expect(seen).toEqual([]);
  });

  it('clamps an out-of-range activeTab instead of rendering nothing', () => {
    const high = setup({ variant: 'tabs', files: FILES, activeTab: 99 });
    expect(shownCode(high)).toContain('{"a":1}');

    const low = setup({ variant: 'tabs', files: FILES, activeTab: -5 });
    expect(shownCode(low)).toContain('const a = 1;');
  });

  const press = (f: ComponentFixture<SvCodeBlockComponent>, index: number, key: string) => {
    const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    tabs(f)[index].dispatchEvent(ev);
    f.detectChanges();
    return ev;
  };

  it('walks right and left with the arrow keys', () => {
    const f = setup({ variant: 'tabs', files: FILES });
    press(f, 0, 'ArrowRight');
    expect(selected(f)).toEqual(['false', 'true', 'false']);
    press(f, 1, 'ArrowLeft');
    expect(selected(f)).toEqual(['true', 'false', 'false']);
  });

  it('wraps at both ends', () => {
    const f = setup({ variant: 'tabs', files: FILES });
    press(f, 0, 'ArrowLeft');
    expect(selected(f)).toEqual(['false', 'false', 'true']);
    press(f, 2, 'ArrowRight');
    expect(selected(f)).toEqual(['true', 'false', 'false']);
  });

  it('jumps to the ends with Home and End', () => {
    const f = setup({ variant: 'tabs', files: FILES });
    press(f, 0, 'End');
    expect(selected(f)).toEqual(['false', 'false', 'true']);
    press(f, 2, 'Home');
    expect(selected(f)).toEqual(['true', 'false', 'false']);
  });

  it('claims the key it acts on and leaves every other one alone', () => {
    const f = setup({ variant: 'tabs', files: FILES });
    expect(press(f, 0, 'ArrowRight').defaultPrevented).toBe(true);

    // A key with no meaning here must reach the page — Tab and typeahead still
    // have to work.
    const ignored = press(f, 1, 'a');
    expect(ignored.defaultPrevented).toBe(false);
    expect(selected(f)).toEqual(['false', 'true', 'false']);
  });
});
