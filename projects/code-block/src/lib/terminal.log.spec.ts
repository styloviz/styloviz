import { render, fireEvent } from '@testing-library/angular';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { flush } from '@testing/async';
import { SvTerminalComponent } from './terminal.component';
import type { TerminalLine } from './code-block.types';

/**
 * sv-terminal as a LOG VIEWER (FL-E8): a host-owned, append-only `lines`
 * stream, the ANSI colour subset, autoscroll that pauses when the reader
 * scrolls up, "jump to latest", copy, and the read-only mode.
 */

const ESC = '\u001b';
const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const rows = (f: ComponentFixture<unknown>) => [...el(f).querySelectorAll<HTMLElement>('[data-sv-line]')];
const texts = (f: ComponentFixture<unknown>) => rows(f).map((r) => r.textContent ?? '');
const log = (f: ComponentFixture<unknown>) => el(f).querySelector<HTMLElement>('[role="log"]')!;

const out = (...t: string[]): TerminalLine[] => t.map((text) => ({ kind: 'stdout' as const, text }));

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvTerminalComponent, { inputs: { typeIntro: false, ...inputs } });
  return fixture as ComponentFixture<SvTerminalComponent>;
}

async function setLines(f: ComponentFixture<SvTerminalComponent>, lines: readonly TerminalLine[]) {
  f.componentRef.setInput('lines', lines);
  f.detectChanges();
  await flush();
  f.detectChanges();
}

/** jsdom has no layout: give the log box the scroll metrics a browser would. */
function metrics(box: HTMLElement, m: { scrollTop: number; scrollHeight: number; clientHeight: number }) {
  Object.defineProperty(box, 'scrollHeight', { configurable: true, get: () => m.scrollHeight });
  Object.defineProperty(box, 'clientHeight', { configurable: true, get: () => m.clientHeight });
  Object.defineProperty(box, 'scrollTop', { configurable: true, writable: true, value: m.scrollTop });
}

describe('sv-terminal — the host stream', () => {
  it('prints lines as they are appended, after the intro', async () => {
    const f = await setup({ intro: [{ kind: 'info', text: 'Connected to build 4812' }], interactive: false });
    await setLines(f, out('one'));
    await setLines(f, out('one', 'two', 'three'));
    expect(texts(f)).toEqual(['Connected to build 4812', 'one', 'two', 'three']);
    expect(rows(f)[0]!.getAttribute('data-sv-kind')).toBe('info');
  });

  it('clears and reprints when the array gets shorter — a new run', async () => {
    const f = await setup({ interactive: false });
    await setLines(f, out('old 1', 'old 2', 'old 3'));
    await setLines(f, out('new 1'));
    expect(texts(f)).toEqual(['new 1']);
  });

  it('keeps only the newest maxLines lines', async () => {
    const f = await setup({ interactive: false, maxLines: 3 });
    await setLines(f, out('1', '2', '3', '4', '5'));
    expect(texts(f)).toEqual(['3', '4', '5']);
  });

  it('prints the intro at once, not typed, while a host log is on screen', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvTerminalComponent, {
      inputs: { typeIntro: true, interactive: false, intro: out('hello'), lines: out('log') },
    });
    expect(texts(fixture)).toEqual(['hello', 'log']);
  });
});

describe('sv-terminal — read-only mode', () => {
  it('drops the prompt when interactive is false', async () => {
    const f = await setup({ interactive: false });
    expect(el(f).querySelector('input')).toBeNull();
  });

  it('still names the log and keeps it keyboard-scrollable', async () => {
    const f = await setup({ interactive: false, logLabel: 'Deploy log' });
    expect(log(f).getAttribute('aria-label')).toBe('Deploy log');
    expect(log(f).getAttribute('tabindex')).toBe('0');
  });

  it('can switch the live region off for a stream too fast to follow', async () => {
    const f = await setup({ live: 'off' });
    expect(log(f).getAttribute('aria-live')).toBe('off');
  });
});

describe('sv-terminal — ANSI colour', () => {
  it('renders SGR colours as styled spans, never as escape debris', async () => {
    const f = await setup({ interactive: false });
    await setLines(f, out(`${ESC}[32m✓${ESC}[0m 12 passed  ${ESC}[1;31m2 failed${ESC}[0m`));
    expect(texts(f)).toEqual(['✓ 12 passed  2 failed']);
    const green = el(f).querySelector<HTMLElement>('[data-sv-ansi="green"]')!;
    expect(green.textContent).toBe('✓');
    expect(green.className).toContain('text-accent-700');
    const red = el(f).querySelector<HTMLElement>('[data-sv-ansi="red"]')!;
    expect(red.className).toContain('font-bold');
    expect(red.className).toContain('text-danger-700');
  });

  it('never lets an escape code recolour stderr, but keeps bold', async () => {
    const f = await setup({ interactive: false });
    await setLines(f, [{ kind: 'stderr', text: `${ESC}[1;32mlooks fine` }]);
    const span = rows(f)[0]!.querySelector('span')!;
    expect(span.className).toContain('font-bold');
    expect(span.className).not.toContain('accent');
  });

  it('strips every sequence and colours by kind only when ansi is false', async () => {
    const f = await setup({ interactive: false, ansi: false });
    await setLines(f, out(`${ESC}[31mred`));
    expect(texts(f)).toEqual(['red']);
    expect(el(f).querySelector('[data-sv-ansi]')).toBeNull();
  });

  it('prints markup in a line as characters', async () => {
    const f = await setup({ interactive: false });
    await setLines(f, out('<b>not bold</b>'));
    expect(rows(f)[0]!.querySelector('b')).toBeNull();
    expect(texts(f)).toEqual(['<b>not bold</b>']);
  });
});

describe('sv-terminal — autoscroll pauses when the reader scrolls up', () => {
  it('follows new output while the reader is at the bottom', async () => {
    const f = await setup({ interactive: false });
    await setLines(f, out('a'));
    metrics(log(f), { scrollTop: 600, scrollHeight: 1000, clientHeight: 400 });
    log(f).dispatchEvent(new Event('scroll'));
    f.detectChanges();
    expect(el(f).querySelector('[data-sv-jump-latest]')).toBeNull();
  });

  it('stops following and offers "jump to latest" with a count once scrolled up', async () => {
    const f = await setup({ interactive: false });
    await setLines(f, out('a'));
    const box = log(f);
    metrics(box, { scrollTop: 100, scrollHeight: 1000, clientHeight: 400 });
    box.dispatchEvent(new Event('scroll'));
    f.detectChanges();

    const jump = () => el(f).querySelector<HTMLButtonElement>('[data-sv-jump-latest]');
    expect(jump()?.textContent?.trim()).toBe('Jump to latest');

    await setLines(f, out('a', 'b', 'c'));
    // Paused: nothing yanked the reader down, and the button counts what arrived.
    expect(box.scrollTop).toBe(100);
    expect(jump()?.textContent).toContain('2 new lines');

    fireEvent.click(jump()!);
    await flush();
    f.detectChanges();
    expect(box.scrollTop).toBe(1000);
    expect(jump()).toBeNull();
  });

  it('never scrolls on its own when autoScroll is false', async () => {
    const f = await setup({ interactive: false, autoScroll: false });
    const box = log(f);
    metrics(box, { scrollTop: 0, scrollHeight: 1000, clientHeight: 400 });
    await setLines(f, out('a', 'b'));
    expect(box.scrollTop).toBe(0);
  });
});

describe('sv-terminal — copy', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  });

  it('copies the scrollback as plain text, escape codes removed', async () => {
    let written = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (t: string) => { written = t; } },
    });
    const f = await setup({ interactive: false });
    await setLines(f, out(`${ESC}[33mwarn${ESC}[0m one`, 'two'));
    let emitted = '';
    f.componentInstance.copied.subscribe((t) => (emitted = t));

    fireEvent.click(el(f).querySelector('[data-sv-terminal-copy]')!);
    await flush();
    f.detectChanges();
    expect(written).toBe('warn one\ntwo');
    expect(emitted).toBe(written);
    expect(el(f).querySelector('[role="status"]')?.textContent).toContain('Copied');
  });

  it('says so when the clipboard is unavailable, rather than confirming a copy that did not happen', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => { throw new Error('denied'); } },
    });
    const f = await setup({ interactive: false });
    await setLines(f, out('x'));
    fireEvent.click(el(f).querySelector('[data-sv-terminal-copy]')!);
    await flush();
    f.detectChanges();
    expect(el(f).querySelector('[data-sv-copy-failed]')).not.toBeNull();
  });

  it('can be turned off', async () => {
    const f = await setup({ copyable: false });
    expect(el(f).querySelector('[data-sv-terminal-copy]')).toBeNull();
  });
});

describe('sv-terminal — clearing does not bring the intro back', () => {
  it('keeps the screen clear after Ctrl+L and a later command', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvTerminalComponent, {
      inputs: {
        typeIntro: false,
        intro: out('intro line'),
        commands: [{ name: 'hi', summary: '', run: () => ({ lines: out('hello') }) }],
      },
    });
    const field = el(fixture).querySelector('input')!;
    await fireEvent.keyDown(field, { key: 'l', ctrlKey: true });
    fixture.detectChanges();
    await fireEvent.input(field, { target: { value: 'hi' } });
    await fireEvent.keyDown(field, { key: 'Enter' });
    await flush();
    fixture.detectChanges();
    expect(texts(fixture).join('\n')).not.toContain('intro line');
    expect(texts(fixture)).toContain('hello');
  });
});
