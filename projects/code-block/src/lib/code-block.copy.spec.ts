import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { until } from '@testing/async';
import { SvCodeBlockComponent } from './code-block.component';
import type { CodeFile, DiffHunk, TerminalLine } from './code-block.types';

/**
 * Copying, and the confirmation that follows it.
 *
 * ★ jsdom has no clipboard at all — `navigator.clipboard` is undefined, so an
 * unstubbed `copy()` takes the catch path and every assertion below would pass
 * for the wrong reason. The stub is installed per test and torn down again, and
 * one test deliberately rejects from it to exercise the denied-permission path
 * a real browser produces in an insecure context.
 */

let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard');
});

function setup(inputs: Record<string, unknown> = {}): ComponentFixture<SvCodeBlockComponent> {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(SvCodeBlockComponent);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return fixture;
}

const el = (f: ComponentFixture<SvCodeBlockComponent>) => f.nativeElement as HTMLElement;
const copyButton = (f: ComponentFixture<SvCodeBlockComponent>) =>
  el(f).querySelector<HTMLButtonElement>('button[aria-label]')!;
const status = (f: ComponentFixture<SvCodeBlockComponent>) =>
  el(f).querySelector('[role="status"]')!.textContent?.trim();

describe('SvCodeBlockComponent — what lands on the clipboard', () => {
  it('copies the visible snippet in the block variant', async () => {
    const f = setup({ code: 'const a = 1;', filename: 'a.ts' });
    copyButton(f).click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('const a = 1;');
  });

  it('copies the ACTIVE file in the tabs variant, not the first one', async () => {
    const files: CodeFile[] = [
      { name: 'a.ts', content: 'first' },
      { name: 'b.ts', content: 'second' },
    ];
    const f = setup({ variant: 'tabs', files });
    el(f).querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();
    f.detectChanges();

    copyButton(f).click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('second');
  });

  it('copies the APPLIED side of a diff — additions and context, never removals', async () => {
    // Pasting a diff that still contains the deleted lines produces code that
    // does not compile. This is the whole reason `copyPayload` is per-variant.
    const hunks: DiffHunk[] = [
      {
        id: 'h1',
        lines: [
          { kind: 'context', text: 'const a = 1;', oldNo: 1, newNo: 1 },
          { kind: 'del', text: "const b = 'old';", oldNo: 2, newNo: null },
          { kind: 'add', text: "const b = 'new';", oldNo: null, newNo: 2 },
        ],
      },
    ];
    const f = setup({ variant: 'diff', hunks });
    copyButton(f).click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith("const a = 1;\nconst b = 'new';");
  });

  it('copies terminal lines as plain text without the prompt glyph', async () => {
    const terminalLines: TerminalLine[] = [
      { kind: 'command', text: 'npm run build' },
      { kind: 'stdout', text: 'Build complete.' },
    ];
    const f = setup({ variant: 'terminal', terminalLines });
    copyButton(f).click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('npm run build\nBuild complete.');
  });

  it('does nothing at all when there is nothing to copy', async () => {
    const f = setup({ code: '' });
    copyButton(f).click();
    await Promise.resolve();
    expect(writeText).not.toHaveBeenCalled();
    expect(status(f)).toBe('');
  });

  it('does nothing for a diff variant with no hunks', async () => {
    const f = setup({ variant: 'diff', hunks: [] });
    copyButton(f).click();
    await Promise.resolve();
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe('SvCodeBlockComponent — the confirmation', () => {
  it('announces the copy, renames the button, then reverts on its own', async () => {
    const f = setup({ code: 'const a = 1;' });
    const seen: string[] = [];
    f.componentInstance.copied.subscribe((t) => seen.push(t));

    copyButton(f).click();
    await until(() => {
      f.detectChanges();
      return status(f) === 'Copied to clipboard';
    }, { label: 'the copy confirmation to appear' });

    expect(seen).toEqual(['const a = 1;']);
    expect(copyButton(f).getAttribute('aria-label')).toBe('Copied to clipboard');

    // The component owns the 1.6 s revert; poll the state it clears.
    await until(() => {
      f.detectChanges();
      return status(f) === '';
    }, { timeoutMs: 5000, label: 'the copy confirmation to revert' });
    expect(copyButton(f).getAttribute('aria-label')).toBe('Copy code, without the line numbers');
  });

  it('says nothing and emits nothing when the clipboard refuses', async () => {
    // Insecure context or a denied permission. Failing quietly is the contract;
    // claiming a copy that did not happen is the bug.
    writeText.mockRejectedValue(new Error('NotAllowedError'));
    const f = setup({ code: 'const a = 1;' });
    const seen: string[] = [];
    f.componentInstance.copied.subscribe((t) => seen.push(t));

    copyButton(f).click();
    await Promise.resolve();
    await Promise.resolve();
    f.detectChanges();

    expect(seen).toEqual([]);
    expect(status(f)).toBe('');
    expect(copyButton(f).getAttribute('aria-label')).toBe('Copy code, without the line numbers');
  });

  it('restarts the revert timer rather than stacking two of them', async () => {
    const f = setup({ code: 'const a = 1;' });
    copyButton(f).click();
    await until(() => {
      f.detectChanges();
      return status(f) === 'Copied to clipboard';
    }, { label: 'the first confirmation' });

    const cleared = vi.spyOn(globalThis, 'clearTimeout');
    copyButton(f).click();
    await until(() => cleared.mock.calls.length > 0, { label: 'the first timer to be cancelled' });
    cleared.mockRestore();
  });

  it('cancels a pending revert when the component goes away', async () => {
    const f = setup({ code: 'const a = 1;' });
    copyButton(f).click();
    await until(() => {
      f.detectChanges();
      return status(f) === 'Copied to clipboard';
    }, { label: 'the confirmation to appear' });

    const cleared = vi.spyOn(globalThis, 'clearTimeout');
    f.destroy();
    expect(cleared).toHaveBeenCalled();
    cleared.mockRestore();
  });

  it('has nothing to cancel when nothing was copied', async () => {
    const f = setup({ code: 'const a = 1;' });
    const cleared = vi.spyOn(globalThis, 'clearTimeout');
    f.destroy();
    expect(cleared).not.toHaveBeenCalled();
    cleared.mockRestore();
  });
});
