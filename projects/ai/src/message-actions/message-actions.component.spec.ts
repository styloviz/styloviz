import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvMessageActionsComponent } from './message-actions.component';

async function mount(inputs: Record<string, unknown> = {}, providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvMessageActionsComponent, {
    inputs: { text: 'Revenue rose 12 percent.', ...inputs } as never,
    providers: providers as never[],
  });
  fixture.detectChanges();
  return fixture;
}

const btn = (el: HTMLElement, label: string) =>
  [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.getAttribute('aria-label')?.startsWith(label)) ?? null;

async function settle(f: Awaited<ReturnType<typeof mount>>): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  f.detectChanges();
}

describe('SvMessageActionsComponent', () => {
  let original: PropertyDescriptor | undefined;
  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  });
  afterEach(() => {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else delete (navigator as { clipboard?: unknown }).clipboard;
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('renders copy, helpful and not helpful by default, in a named group', async () => {
    const el = (await mount()).nativeElement as HTMLElement;
    expect(el.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Message actions');
    expect(btn(el, 'Copy message')).toBeTruthy();
    expect(btn(el, 'Helpful')).toBeTruthy();
    expect(btn(el, 'Not helpful')).toBeTruthy();
    expect(btn(el, 'Regenerate')).toBeNull();
  });

  it('renders only the actions asked for', async () => {
    const el = (await mount({ actions: ['regenerate'] })).nativeElement as HTMLElement;
    expect(el.querySelectorAll('button')).toHaveLength(1);
    expect(btn(el, 'Regenerate')).toBeTruthy();
  });

  it('confirms a copy only once the write resolves, then resets', async () => {
    let resolve: () => void = () => undefined;
    const writeText = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const f = await mount({ copyResetMs: 50 });
    const copied: string[] = [];
    f.componentInstance.copied.subscribe((t) => copied.push(t));

    btn(f.nativeElement, 'Copy message')!.click();
    await settle(f);
    // ★★★ Not before the write lands.
    expect(f.componentInstance.copyState()).toBe('idle');

    resolve();
    await settle(f);
    expect(writeText).toHaveBeenCalledWith('Revenue rose 12 percent.');
    expect(copied).toEqual(['Revenue rose 12 percent.']);
    expect(btn(f.nativeElement, 'Copied!')).toBeTruthy();

    await new Promise((r) => setTimeout(r, 80));
    f.detectChanges();
    expect(f.componentInstance.copyState()).toBe('idle');
  });

  it('shows the failed state, names the shortcut and emits copyFailed when the clipboard refuses', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    const f = await mount();
    let failed = 0;
    f.componentInstance.copyFailed.subscribe(() => failed++);

    await expect(f.componentInstance.copy()).resolves.toBe(false);
    f.detectChanges();
    expect(failed).toBe(1);
    expect(f.nativeElement.querySelector('[data-sv-copy-fallback]')?.textContent).toMatch(/Ctrl\+C|⌘C/);
    expect(btn(f.nativeElement, 'Copying failed')).toBeTruthy();
  });

  it('fails cleanly when there is no clipboard API at all', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    const f = await mount();
    await expect(f.componentInstance.copy()).resolves.toBe(false);
    expect(f.componentInstance.copyState()).toBe('failed');
  });

  it('keeps the thumbs mutually exclusive, and a second press clears', async () => {
    const f = await mount();
    const c = f.componentInstance;
    const el = f.nativeElement as HTMLElement;

    btn(el, 'Helpful')!.click();
    f.detectChanges();
    expect(c.feedback()).toBe('up');
    expect(btn(el, 'Helpful')!.getAttribute('aria-pressed')).toBe('true');

    btn(el, 'Not helpful')!.click();
    f.detectChanges();
    expect(c.feedback()).toBe('down');
    expect(btn(el, 'Helpful')!.getAttribute('aria-pressed')).toBe('false');

    btn(el, 'Not helpful')!.click();
    expect(c.feedback()).toBeNull();
  });

  it('emits regenerate', async () => {
    const f = await mount({ actions: ['regenerate'] });
    let n = 0;
    f.componentInstance.regenerate.subscribe(() => n++);
    btn(f.nativeElement, 'Regenerate')!.click();
    expect(n).toBe(1);
  });

  it('takes per-instance labels over the registry, and the registry over English', async () => {
    const f = await mount({ labels: { markHelpful: 'Gut' } }, [provideSvLabels({ ai: { markNotHelpful: 'Schlecht' } })]);
    expect(btn(f.nativeElement, 'Gut')).toBeTruthy();
    expect(btn(f.nativeElement, 'Schlecht')).toBeTruthy();
  });

  it('clears its reset timer when destroyed', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.resolve() } });
    const f = await mount();
    await f.componentInstance.copy();
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    f.destroy();
    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
  });
});
