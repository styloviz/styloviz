import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';
import { SvCopyToClipboardComponent } from './copy-to-clipboard.component';

/**
 * Copying is the one thing here that can silently not happen. The async
 * Clipboard API is unavailable over plain HTTP, inside some iframes, and
 * without a user gesture; the `execCommand` fallback is deprecated and returns
 * `false` rather than throwing when it declines. So the case worth pinning
 * hardest is the one where both fail: the button must not turn green and
 * announce "Copied!" over an empty clipboard.
 */

let writeText: ReturnType<typeof vi.fn>;
let execCommand: ReturnType<typeof vi.fn>;

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  execCommand = vi.fn().mockReturnValue(true);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
});

afterEach(() => vi.useRealTimers());

async function setup(inputs: Partial<ComponentInput<SvCopyToClipboardComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvCopyToClipboardComponent, {
    inputs: { text: 'npm i @styloviz/core', ...inputs } as ComponentInput<SvCopyToClipboardComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const copyButton = () => screen.getByRole('button');
const liveRegion = (f: { nativeElement: unknown }) => el(f).querySelector('[role="status"]')!;

describe('SvCopyToClipboardComponent — copying', () => {
  it('puts the text on the clipboard and says it did', async () => {
    let copies = 0;
    const { fixture } = await setup();
    fixture.componentInstance.copied.subscribe(() => { copies += 1; });

    await userEvent.click(copyButton());
    expect(writeText).toHaveBeenCalledWith('npm i @styloviz/core');
    expect(copies).toBe(1);
    expect(fixture.componentInstance.isCopied()).toBe(true);
  });

  it('changes what the button is called once it has copied', async () => {
    const { fixture } = await setup();
    expect(copyButton().getAttribute('aria-label')).toBe('Copy to clipboard');

    await userEvent.click(copyButton());
    fixture.detectChanges();
    expect(copyButton().getAttribute('aria-label')).toBe('Copied!');
  });

  it('announces the result in a polite live region', async () => {
    const { fixture } = await setup({ successLabel: 'Command copied' });
    expect(liveRegion(fixture).getAttribute('aria-live')).toBe('polite');
    expect(liveRegion(fixture).textContent?.trim()).toBe('');

    await userEvent.click(copyButton());
    fixture.detectChanges();
    expect(liveRegion(fixture).textContent?.trim()).toBe('Command copied');
  });

  it('goes back to normal after the success window', async () => {
    const { fixture } = await setup({ successDuration: 1_000 });
    vi.useFakeTimers();
    await fixture.componentInstance.copy();
    expect(fixture.componentInstance.isCopied()).toBe(true);

    vi.advanceTimersByTime(1_000);
    fixture.detectChanges();
    expect(fixture.componentInstance.isCopied()).toBe(false);
    expect(liveRegion(fixture).textContent?.trim()).toBe('');
  });

  it('restarts the window on a second copy rather than reverting early', async () => {
    const { fixture } = await setup({ successDuration: 1_000 });
    vi.useFakeTimers();
    await fixture.componentInstance.copy();

    vi.advanceTimersByTime(600);
    await fixture.componentInstance.copy();

    // 600 ms after the second copy is 1,200 ms after the first: still shown.
    vi.advanceTimersByTime(600);
    expect(fixture.componentInstance.isCopied()).toBe(true);

    vi.advanceTimersByTime(500);
    expect(fixture.componentInstance.isCopied()).toBe(false);
  });

  it('does nothing at all when there is nothing to copy', async () => {
    let copies = 0;
    const { fixture } = await setup({ text: '' });
    fixture.componentInstance.copied.subscribe(() => { copies += 1; });

    await userEvent.click(copyButton());
    expect(writeText).not.toHaveBeenCalled();
    expect(copies).toBe(0);
    expect(fixture.componentInstance.isCopied()).toBe(false);
  });

  it('stops the revert timer when it is torn down', async () => {
    const { fixture } = await setup({ successDuration: 1_000 });
    vi.useFakeTimers();
    await fixture.componentInstance.copy();
    const c = fixture.componentInstance;

    fixture.destroy();
    vi.advanceTimersByTime(2_000);
    // The timer was cleared, so the state it would have reset is untouched.
    expect(c.isCopied()).toBe(true);
  });
});

describe('SvCopyToClipboardComponent — when the Clipboard API is not available', () => {
  it('falls back to the older command, and still reports success', async () => {
    writeText.mockRejectedValue(new Error('NotAllowedError'));
    let copies = 0;
    const { fixture } = await setup();
    fixture.componentInstance.copied.subscribe(() => { copies += 1; });

    await userEvent.click(copyButton());
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(copies).toBe(1);
    expect(fixture.componentInstance.isCopied()).toBe(true);
  });

  it('cleans up the scratch element it borrowed', async () => {
    writeText.mockRejectedValue(new Error('NotAllowedError'));
    await setup();
    await userEvent.click(copyButton());
    expect(document.querySelectorAll('textarea').length).toBe(0);
  });

  it('does not claim success when the fallback declines', async () => {
    // `execCommand` returns false rather than throwing. Treated as success, the
    // button would go green and announce "Copied!" over an empty clipboard.
    writeText.mockRejectedValue(new Error('NotAllowedError'));
    execCommand.mockReturnValue(false);
    const errors: unknown[] = [];
    let copies = 0;
    const { fixture } = await setup();
    fixture.componentInstance.copyError.subscribe((e) => errors.push(e));
    fixture.componentInstance.copied.subscribe(() => { copies += 1; });

    await userEvent.click(copyButton());
    fixture.detectChanges();
    expect(fixture.componentInstance.isCopied()).toBe(false);
    expect(copies).toBe(0);
    expect(errors.length).toBe(1);
    expect(liveRegion(fixture).textContent?.trim()).toBe('Copy failed');
  });

  it('reports the failure when the fallback throws outright', async () => {
    writeText.mockRejectedValue(new Error('NotAllowedError'));
    execCommand.mockImplementation(() => { throw new Error('not supported'); });
    const errors: unknown[] = [];
    const { fixture } = await setup();
    fixture.componentInstance.copyError.subscribe((e) => errors.push(e));

    await userEvent.click(copyButton());
    expect((errors[0] as Error).message).toBe('not supported');
    expect(fixture.componentInstance.isCopied()).toBe(false);
  });
});

describe('SvCopyToClipboardComponent — the three shapes', () => {
  it.each(['inline', 'block', 'icon-only'] as const)('gives %s exactly one copy button', async (variant) => {
    await setup({ variant });
    expect(screen.getAllByRole('button').length).toBe(1);
  });

  it('shows the text beside the button for inline and block', async () => {
    const { fixture: inline } = await setup({ variant: 'inline', label: 'npm i styloviz' });
    expect(el(inline).textContent).toContain('npm i styloviz');

    const { fixture: block } = await setup({ variant: 'block', label: 'npm i styloviz' });
    expect(el(block).textContent).toContain('npm i styloviz');
  });

  it('shows nothing but the button for icon-only', async () => {
    const { fixture } = await setup({ variant: 'icon-only', label: 'npm i styloviz' });
    expect(el(fixture).textContent).not.toContain('npm i styloviz');
  });

  it.each(['inline', 'block'] as const)('projects the host content in the %s shape', async (variant) => {
    TestBed.resetTestingModule();
    await render(
      `<sv-copy-to-clipboard text="abc" variant="${variant}"><code>projected text</code></sv-copy-to-clipboard>`,
      { imports: [SvCopyToClipboardComponent] },
    );
    expect(screen.getByText('projected text')).toBeTruthy();
  });

  it('scales the icon and the text together', async () => {
    const { fixture } = await setup({ size: 'lg' });
    expect(fixture.componentInstance.iconSize()).toBe('h-5 w-5');
    expect(fixture.componentInstance.textSize()).toBe('text-base');
    expect(fixture.componentInstance.buttonClass()).toContain('h-8 w-8');
  });

  it('turns the button green only once it has copied', async () => {
    const { fixture } = await setup();
    expect(fixture.componentInstance.buttonClass()).not.toContain('accent');

    await userEvent.click(copyButton());
    expect(fixture.componentInstance.buttonClass()).toContain('accent');
  });
});
