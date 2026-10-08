import { render, fireEvent } from '@testing-library/angular';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { flush, untilRendered } from '@testing/async';
import { SvTerminalComponent } from './terminal.component';
import { out, err, type TerminalCommand, type TerminalResult } from './terminal.types';
import type { TerminalLine } from './code-block.types';

/**
 * ============================================================================
 *  sv-terminal — the edges of every interaction
 * ============================================================================
 *
 * `terminal.component.spec.ts` pins the contract a visitor meets first:
 * dispatch, history, completion, the control keys. This file walks the edges
 * of each one — the end of the history list, Shift held on Ctrl+C, a Tab on an
 * empty line, a command that is still running, a click that is really a text
 * selection — because those are the places a prompt either behaves like a
 * shell or quietly does something no shell does.
 */

const host = (f: ComponentFixture<SvTerminalComponent>) => f.nativeElement as HTMLElement;
const input = (f: ComponentFixture<SvTerminalComponent>) =>
  host(f).querySelector<HTMLInputElement>('input[type="text"]')!;
const rows = (f: ComponentFixture<SvTerminalComponent>) =>
  [...host(f).querySelectorAll<HTMLElement>('[data-sv-line]')];
const rowText = (f: ComponentFixture<SvTerminalComponent>) => rows(f).map((r) => r.textContent ?? '');

const COMMANDS: TerminalCommand[] = [
  { name: 'help', summary: 'Help', run: () => ({ lines: out('help text') }) },
  { name: 'ok', summary: 'Succeeds with code 0', run: () => ({ lines: out('fine'), code: 0 }) },
  { name: 'quiet', summary: 'Prints nothing', run: () => ({}) },
  { name: 'bad', summary: 'Fails', run: () => ({ lines: err('broken'), code: 1 }) },
  { name: 'ls', summary: 'List', run: () => ({ lines: out('a b') }) },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvTerminalComponent, {
    inputs: { commands: COMMANDS, typeIntro: false, ...inputs },
  });
  return fixture as ComponentFixture<SvTerminalComponent>;
}

async function type(f: ComponentFixture<SvTerminalComponent>, value: string) {
  await fireEvent.input(input(f), { target: { value } });
  f.detectChanges();
}

async function key(f: ComponentFixture<SvTerminalComponent>, k: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true, ...init });
  input(f).dispatchEvent(event);
  f.detectChanges();
  await flush();
  f.detectChanges();
  return event;
}

async function run(f: ComponentFixture<SvTerminalComponent>, line: string) {
  await type(f, line);
  await key(f, 'Enter');
}

describe('sv-terminal — results', () => {
  it('prints no exit line when a command reports code 0', async () => {
    const f = await setup();
    await run(f, 'ok');
    expect(rowText(f)).toContain('fine');
    expect(rowText(f).some((t) => t.startsWith('exit'))).toBe(false);
  });

  it('prints only the echo for a command that returns no lines', async () => {
    const f = await setup();
    await run(f, 'quiet');
    expect(rowText(f)).toEqual(['$ quiet']);
  });

  it('passes the words after the command to its handler as arguments', async () => {
    const seen: (readonly string[])[] = [];
    const echo: TerminalCommand = {
      name: 'echo',
      summary: 'Echo',
      run: (args) => {
        seen.push(args);
        return { lines: out(args.join('|')) };
      },
    };
    const f = await setup({ commands: [echo] });
    await run(f, '  echo   one   two  ');
    expect(seen).toEqual([['one', 'two']]);
    expect(rowText(f)).toContain('one|two');
  });

  it('colours each kind of line by its role', async () => {
    const f = await setup();
    await run(f, 'bad');
    const byKind = (kind: string) => rows(f).find((r) => r.getAttribute('data-sv-kind') === kind)!;
    expect(byKind('command').className).toContain('text-gray-900');
    expect(byKind('stderr').className).toContain('text-danger-600');
    expect(byKind('exit').className).toContain('text-warning-700');
    expect(byKind('exit').textContent).toBe('exit 1');

    await run(f, 'help');
    expect(byKind('stdout').className).toContain('text-gray-600');
  });
});

describe('sv-terminal — while a command is running', () => {
  it('disables the prompt and marks it busy until the handler settles', async () => {
    let finish!: (result: TerminalResult) => void;
    const f = await setup({
      commands: [
        { name: 'deploy', summary: 'Slow', run: () => new Promise<TerminalResult>((resolve) => (finish = resolve)) },
      ],
    });
    await run(f, 'deploy');

    expect(input(f).disabled).toBe(true);
    expect(input(f).getAttribute('aria-busy')).toBe('true');

    finish({ lines: out('deployed') });
    await untilRendered(f, () => !input(f).disabled);

    expect(input(f).hasAttribute('aria-busy')).toBe(false);
    expect(rowText(f)).toContain('deployed');
  });

  it('re-enables the prompt when an async handler rejects', async () => {
    const f = await setup({
      commands: [{ name: 'flaky', summary: 'Rejects', run: () => Promise.reject(new Error('network')) }],
    });
    await run(f, 'flaky');
    await untilRendered(f, () => !input(f).disabled);
    expect(rowText(f)).toContain('flaky: command failed');
  });
});

describe('sv-terminal — history edges', () => {
  it('ArrowDown on the live line keeps what is typed', async () => {
    const f = await setup();
    await run(f, 'help');
    await type(f, 'draft');
    const event = await key(f, 'ArrowDown');
    expect(input(f).value).toBe('draft');
    expect(event.defaultPrevented).toBe(true);
  });

  it('ArrowUp past the oldest entry stays on the oldest entry', async () => {
    const f = await setup();
    await run(f, 'help');
    await run(f, 'ls');
    await key(f, 'ArrowUp');
    await key(f, 'ArrowUp');
    await key(f, 'ArrowUp');
    expect(input(f).value).toBe('help');
  });

  it('ArrowDown walks forward through history one entry at a time', async () => {
    const f = await setup();
    await run(f, 'help');
    await run(f, 'ls');
    await run(f, 'ok');
    await key(f, 'ArrowUp');
    await key(f, 'ArrowUp');
    await key(f, 'ArrowUp');
    expect(input(f).value).toBe('help');
    await key(f, 'ArrowDown');
    expect(input(f).value).toBe('ls');
    await key(f, 'ArrowDown');
    expect(input(f).value).toBe('ok');
    await key(f, 'ArrowDown');
    expect(input(f).value).toBe('');
  });

  it('does not record a bare Return in history', async () => {
    const f = await setup();
    await run(f, 'help');
    await run(f, '   ');
    await key(f, 'ArrowUp');
    expect(input(f).value).toBe('help');
  });

  it('records an unknown command in history too — the visitor may want to fix a typo', async () => {
    const f = await setup();
    await run(f, 'hlep');
    await key(f, 'ArrowUp');
    expect(input(f).value).toBe('hlep');
  });

  it('Ctrl+C leaves history navigation, so the next ArrowUp starts from the newest entry', async () => {
    const f = await setup();
    await run(f, 'help');
    await run(f, 'ls');
    await key(f, 'ArrowUp');
    await key(f, 'ArrowUp');
    await key(f, 'c', { ctrlKey: true });
    await key(f, 'ArrowUp');
    expect(input(f).value).toBe('ls');
  });
});

describe('sv-terminal — control keys', () => {
  it('honours Ctrl+C with Shift or Caps Lock held', async () => {
    const f = await setup();
    await type(f, 'help');
    const event = await key(f, 'C', { ctrlKey: true, shiftKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(input(f).value).toBe('');
    expect(rowText(f)).toEqual(['$ help^C']);
  });

  it('honours Ctrl+L with Shift or Caps Lock held', async () => {
    const f = await setup();
    await run(f, 'help');
    const event = await key(f, 'L', { ctrlKey: true, shiftKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(rows(f)).toHaveLength(0);
  });

  it('leaves a plain "c" and "l" alone — they are letters, not shortcuts', async () => {
    const f = await setup();
    await run(f, 'help');
    expect((await key(f, 'c')).defaultPrevented).toBe(false);
    expect((await key(f, 'l')).defaultPrevented).toBe(false);
    expect(rowText(f)).toContain('help text');
  });

  it('does not claim keys it has no use for', async () => {
    const f = await setup();
    for (const k of ['a', 'Home', 'Escape', 'ArrowLeft']) {
      expect((await key(f, k)).defaultPrevented, k).toBe(false);
    }
  });
});

describe('sv-terminal — completion edges', () => {
  const ARGS: TerminalCommand[] = [
    { name: 'open', summary: 'Open', args: () => ['ledger', 'lexer'], run: () => ({}) },
    { name: 'echo', summary: 'Echo', run: () => ({}) },
  ];

  it('lets Tab leave an empty prompt', async () => {
    const f = await setup({ commands: ARGS });
    expect((await key(f, 'Tab')).defaultPrevented).toBe(false);
  });

  it('lets Tab leave when the command takes no arguments', async () => {
    const f = await setup({ commands: ARGS });
    await type(f, 'echo he');
    expect((await key(f, 'Tab')).defaultPrevented).toBe(false);
    expect(input(f).value).toBe('echo he');
  });

  it('lets Tab leave when the first word is not a command', async () => {
    const f = await setup({ commands: ARGS });
    await type(f, 'nope le');
    expect((await key(f, 'Tab')).defaultPrevented).toBe(false);
  });

  it('lets Tab leave when no argument matches', async () => {
    const f = await setup({ commands: ARGS });
    await type(f, 'open zz');
    expect((await key(f, 'Tab')).defaultPrevented).toBe(false);
  });

  it('completes the argument after a trailing space to the shared prefix of all of them', async () => {
    const f = await setup({ commands: ARGS });
    await type(f, 'open ');
    const event = await key(f, 'Tab');
    expect(event.defaultPrevented).toBe(true);
    expect(input(f).value).toBe('open le');
  });

  it('matches the command case-insensitively when completing its arguments', async () => {
    const f = await setup({ commands: ARGS });
    await type(f, 'OPEN led');
    await key(f, 'Tab');
    expect(input(f).value).toBe('OPEN ledger');
  });

  it('does not offer a completion that adds nothing to a whole command name', async () => {
    const f = await setup({ commands: ARGS });
    await type(f, 'echo');
    expect((await key(f, 'Tab')).defaultPrevented).toBe(false);
  });

  it('lets Tab leave when the arguments share no prefix at all', async () => {
    const f = await setup({
      commands: [{ name: 'open', summary: 'Open', args: () => ['ledger', 'ark', 'zeta'], run: () => ({}) }],
    });
    await type(f, 'open ');
    expect((await key(f, 'Tab')).defaultPrevented).toBe(false);
    expect(input(f).value).toBe('open ');
  });

  it('completes a command name to the prefix every match shares', async () => {
    const f = await setup({
      commands: [
        { name: 'alpha', summary: '', run: () => ({}) },
        { name: 'beta', summary: '', run: () => ({}) },
        { name: 'alps', summary: '', run: () => ({}) },
      ],
    });
    await type(f, 'a');
    await key(f, 'Tab');
    expect(input(f).value).toBe('alp');
  });
});

describe('sv-terminal — clicking to focus', () => {
  it('focuses the prompt when the terminal body is clicked', async () => {
    const f = await setup();
    host(f).querySelector<HTMLElement>('[role="log"]')!.click();
    expect(document.activeElement).toBe(input(f));
  });

  it('leaves focus alone while the visitor is selecting output to copy', async () => {
    const f = await setup();
    await run(f, 'help');
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();

    const line = rows(f).find((r) => r.textContent === 'help text')!;
    const range = document.createRange();
    range.selectNodeContents(line);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    line.click();

    expect(document.activeElement).toBe(outside);
    selection.removeAllRanges();
    outside.remove();
  });
});

describe('sv-terminal — chrome', () => {
  it('draws no chrome bar when chrome is off', async () => {
    const f = await setup({ chrome: false, title: 'zsh' });
    expect(host(f).querySelector('[data-sv-chrome]')).toBeNull();
    expect(host(f).textContent).not.toContain('zsh');
  });

  it('shows the title in the chrome bar', async () => {
    const f = await setup({ title: 'visitor — zsh' });
    expect(host(f).querySelector('[data-sv-chrome]')?.textContent).toContain('visitor — zsh');
  });

  it('applies the scrollback height bounds', async () => {
    const f = await setup({ minHeight: '10rem', maxHeight: '30rem' });
    const log = host(f).querySelector<HTMLElement>('[role="log"]')!;
    expect(log.style.minHeight).toBe('10rem');
    expect(log.style.maxHeight).toBe('30rem');
  });
});

describe('sv-terminal — intro', () => {
  const INTRO: TerminalLine[] = [
    { kind: 'command', text: 'whoami' },
    { kind: 'stdout', text: 'ada' },
  ];

  it('prints the intro at once under prefers-reduced-motion, even with typing on', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)', media: query }),
    });
    try {
      const f = await setup({ intro: INTRO, typeIntro: true, typeSpeedMs: 50 });
      expect(rowText(f)).toEqual(['whoami', 'ada']);
    } finally {
      if (original) Object.defineProperty(window, 'matchMedia', original);
      else delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });

  it('types the intro when motion is allowed', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({ matches: false, media: query }),
    });
    try {
      const f = await setup({ intro: INTRO, typeIntro: true, typeSpeedMs: 30 });
      const finished = 'whoami|ada';
      // Mid-flight the screen shows a real, non-empty PREFIX of the intro — at
      // least one character typed, the rest still to come. Waited for, because
      // read straight after render nothing has been typed at all, and "not the
      // finished text" would hold for an empty screen as well.
      await untilRendered(f, () => {
        const shown = rowText(f).join('|');
        return shown.length > 0 && shown !== finished && finished.startsWith(shown);
      }, { label: 'the intro to be part-way typed' });
      // …and it finishes as exactly the intro.
      await untilRendered(f, () => rowText(f).join('|') === finished);
    } finally {
      if (original) Object.defineProperty(window, 'matchMedia', original);
      else delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });

  it('does not reprint an intro that has already finished typing when the visitor runs a command', async () => {
    const f = await setup({ intro: INTRO, typeIntro: true, typeSpeedMs: 1 });
    await untilRendered(f, () => rowText(f).join('|') === 'whoami|ada');

    await run(f, 'help');

    expect(rowText(f)).toEqual(['whoami', 'ada', '$ help', 'help text']);
  });

  it('keeps only the newest lines of a long intro within maxLines', async () => {
    const intro = Array.from({ length: 5 }, (_, i): TerminalLine => ({ kind: 'stdout', text: `l${i}` }));
    const f = await setup({ intro, maxLines: 3 });
    expect(rowText(f)).toEqual(['l2', 'l3', 'l4']);
  });
});
