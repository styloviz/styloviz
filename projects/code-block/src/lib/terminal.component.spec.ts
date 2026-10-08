import { render, fireEvent } from '@testing-library/angular';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { flush, until } from '@testing/async';
import { SvTerminalComponent } from './terminal.component';
import { out, err, type TerminalCommand } from './terminal.types';

/**
 * ============================================================================
 *  sv-terminal
 * ============================================================================
 *
 * A prompt on a public page is an input box that looks like it executes code.
 * Most of this file is about the two properties that follow from that: nothing
 * typed is ever evaluated, and the control stays operable by a keyboard and a
 * screen reader.
 */

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const text = (f: { nativeElement: unknown }) => (el(f).textContent ?? '').replace(/\s+/g, ' ');
const input = (f: { nativeElement: unknown }) =>
  el(f).querySelector<HTMLInputElement>('input[type="text"]')!;

let sideEffect = 0;

const COMMANDS: TerminalCommand[] = [
  { name: 'help', summary: 'List commands', run: () => ({ lines: out('help text') }) },
  {
    name: 'whoami',
    summary: 'Who',
    run: () => {
      sideEffect++;
      return { lines: out('ada') };
    },
  },
  {
    name: 'open',
    summary: 'Open a project',
    usage: 'open <project>',
    args: () => ['ledger', 'lexer', 'drift'],
    run: (a) => ({ lines: out(`opening ${a[0] ?? ''}`) }),
  },
  { name: 'copy', summary: 'Copy', run: () => ({ lines: out('copied') }) },
  { name: 'clear', summary: 'Clear', run: () => ({ clear: true }) },
  { name: 'fail', summary: 'Fails', run: () => ({ lines: err('nope'), code: 2 }) },
  {
    name: 'boom',
    summary: 'Throws',
    run: () => {
      throw new Error('handler bug');
    },
  },
  { name: 'secret', summary: 'Hidden', hidden: true, run: () => ({ lines: out('shh') }) },
];

async function setup(inputs: Record<string, unknown> = {}) {
  // Each render gets a fresh module: two instances in one spec otherwise trip
  // "test module has already been instantiated".
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

async function enter(f: ComponentFixture<SvTerminalComponent>) {
  await fireEvent.keyDown(input(f), { key: 'Enter' });
  f.detectChanges();
  await flush();
  f.detectChanges();
}

async function run(f: ComponentFixture<SvTerminalComponent>, line: string) {
  await type(f, line);
  await enter(f);
}

beforeEach(() => {
  sideEffect = 0;
});

describe('SvTerminalComponent — dispatch', () => {
  it('runs a registered command and prints what it returns', async () => {
    const f = await setup();
    await run(f, 'whoami');
    expect(text(f)).toContain('ada');
    expect(sideEffect).toBe(1);
  });

  it('matches the command name case-insensitively but exactly', async () => {
    const f = await setup();
    await run(f, 'WHOAMI');
    expect(sideEffect).toBe(1);

    await run(f, 'whoam');
    expect(sideEffect).toBe(1);
    expect(text(f)).toContain('command not found');
  });

  /**
   * ★★★ THE PROPERTY THIS WHOLE COMPONENT IS BUILT AROUND. Anything not in the
   *     registry does not run — there is no fallback that interprets the line,
   *     and therefore no path from typed characters to execution.
   */
  it('never executes input that is not a registered command', async () => {
    const f = await setup();
    const probe = ((globalThis as Record<string, unknown>)['__svTerminalProbe'] = { hit: 0 });

    await run(f, "globalThis.__svTerminalProbe.hit = 1");
    await run(f, 'alert(1)');
    await run(f, '1 + 1');

    expect(probe.hit).toBe(0);
    expect(text(f)).toContain('command not found');
    delete (globalThis as Record<string, unknown>)['__svTerminalProbe'];
  });

  it('tells the visitor what to do instead of failing silently', async () => {
    const f = await setup();
    await run(f, 'sudo rm -rf /');
    expect(text(f)).toContain('command not found');
    expect(text(f)).toContain('help');
  });

  it('echoes a bare Return without running anything', async () => {
    const f = await setup();
    await run(f, '   ');
    expect(text(f)).not.toContain('command not found');
    expect(sideEffect).toBe(0);
  });

  it('prints an exit line when a command reports a non-zero code', async () => {
    const f = await setup();
    await run(f, 'fail');
    expect(text(f)).toContain('nope');
    expect(text(f)).toContain('exit 2');
  });

  /**
   * ★ A handler that throws is the HOST's bug. It must not take the page down
   *   or leave a dead prompt with no explanation.
   */
  it('survives a handler that throws', async () => {
    const f = await setup();
    await run(f, 'boom');
    expect(text(f)).toContain('command failed');

    await run(f, 'whoami');
    expect(sideEffect).toBe(1);
    expect(input(f).disabled).toBe(false);
  });

  it('clears the scrollback when a command asks it to', async () => {
    const f = await setup();
    await run(f, 'whoami');
    expect(text(f)).toContain('ada');
    await run(f, 'clear');
    expect(text(f)).not.toContain('ada');
  });

  it('reports what ran, including the misses', async () => {
    const seen: { input: string; unknown: boolean }[] = [];
    const f = await setup();
    f.componentInstance.ran.subscribe((e) => seen.push({ input: e.input, unknown: e.unknown }));

    await run(f, 'whoami');
    await run(f, 'nope');

    expect(seen).toEqual([
      { input: 'whoami', unknown: false },
      { input: 'nope', unknown: true },
    ]);
  });
});

describe('SvTerminalComponent — runLine', () => {
  /**
   * ★ The path a tappable chip takes on a phone. It must be indistinguishable
   *   from typing, or the two drift and only one of them gets tested.
   */
  it('runs a line as though it had been typed', async () => {
    const f = await setup();
    await f.componentInstance.runLine('whoami');
    f.detectChanges();
    await flush();
    f.detectChanges();

    expect(sideEffect).toBe(1);
    expect(text(f)).toContain('ada');
  });

  it('puts the line in history, so Arrow Up finds it', async () => {
    const f = await setup();
    await f.componentInstance.runLine('whoami');
    f.detectChanges();
    await flush();
    f.detectChanges();

    await fireEvent.keyDown(input(f), { key: 'ArrowUp' });
    f.detectChanges();
    expect(input(f).value).toBe('whoami');
  });
});

describe('SvTerminalComponent — history', () => {
  it('walks back through submitted lines with ArrowUp', async () => {
    const f = await setup();
    await run(f, 'whoami');
    await run(f, 'help');

    await fireEvent.keyDown(input(f), { key: 'ArrowUp' });
    f.detectChanges();
    expect(input(f).value).toBe('help');

    await fireEvent.keyDown(input(f), { key: 'ArrowUp' });
    f.detectChanges();
    expect(input(f).value).toBe('whoami');
  });

  /**
   * ★★ THE EDIT SURVIVES THE ROUND TRIP. Arrowing up over a half-typed line
   *    and back down must return the draft, not an empty field — losing it is
   *    the single most irritating bug a command line can have.
   */
  it('restores a half-typed draft on the way back down', async () => {
    const f = await setup();
    await run(f, 'whoami');

    await type(f, 'op');
    await fireEvent.keyDown(input(f), { key: 'ArrowUp' });
    f.detectChanges();
    expect(input(f).value).toBe('whoami');

    await fireEvent.keyDown(input(f), { key: 'ArrowDown' });
    f.detectChanges();
    expect(input(f).value).toBe('op');
  });

  it('does nothing on ArrowUp with no history', async () => {
    const f = await setup();
    await fireEvent.keyDown(input(f), { key: 'ArrowUp' });
    f.detectChanges();
    expect(input(f).value).toBe('');
  });
});

describe('SvTerminalComponent — completion', () => {
  /**
   * ★★ THE LONGEST COMMON PREFIX, NOT THE FIRST MATCH. With `copy` and `clear`
   *    both matching `c`, jumping to `clear` silently picks one and hides the
   *    other — which is how a completion actively misleads.
   */
  it('completes to the longest common prefix', async () => {
    const f = await setup();
    await type(f, 'c');
    await fireEvent.keyDown(input(f), { key: 'Tab' });
    f.detectChanges();
    // `clear` and `copy` share only "c", so nothing is added.
    expect(input(f).value).toBe('c');

    await type(f, 'cl');
    await fireEvent.keyDown(input(f), { key: 'Tab' });
    f.detectChanges();
    expect(input(f).value).toBe('clear');
  });

  it('completes an argument from the command that owns it', async () => {
    const f = await setup();
    await type(f, 'open le');
    await fireEvent.keyDown(input(f), { key: 'Tab' });
    f.detectChanges();
    // `ledger` and `lexer` share "le" only — no change.
    expect(input(f).value).toBe('open le');

    await type(f, 'open led');
    await fireEvent.keyDown(input(f), { key: 'Tab' });
    f.detectChanges();
    expect(input(f).value).toBe('open ledger');
  });

  it('never completes a hidden command', async () => {
    const f = await setup();
    await type(f, 'sec');
    await fireEvent.keyDown(input(f), { key: 'Tab' });
    f.detectChanges();
    expect(input(f).value).toBe('sec');
  });

  /**
   * ★★★ TAB HAS TO KEEP LEAVING. A handler that claims every Tab traps a
   *     keyboard user inside the terminal with no way out — worse than the
   *     control being unreachable in the first place.
   */
  it('lets Tab move focus on when there is nothing to complete', async () => {
    const f = await setup();
    await type(f, 'zzz');
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true });
    input(f).dispatchEvent(event);
    f.detectChanges();
    expect(event.defaultPrevented).toBe(false);
  });

  it('claims Tab only when it actually completes something', async () => {
    const f = await setup();
    await type(f, 'wh');
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true });
    input(f).dispatchEvent(event);
    f.detectChanges();
    expect(event.defaultPrevented).toBe(true);
    expect(input(f).value).toBe('whoami');
  });
});

describe('SvTerminalComponent — control keys', () => {
  it('abandons the line on Ctrl+C without running it', async () => {
    const f = await setup();
    await type(f, 'whoami');
    await fireEvent.keyDown(input(f), { key: 'c', ctrlKey: true });
    f.detectChanges();
    expect(input(f).value).toBe('');
    expect(sideEffect).toBe(0);
    expect(text(f)).toContain('^C');
  });

  it('clears the screen on Ctrl+L', async () => {
    const f = await setup();
    await run(f, 'whoami');
    expect(text(f)).toContain('ada');
    await fireEvent.keyDown(input(f), { key: 'l', ctrlKey: true });
    f.detectChanges();
    expect(text(f)).not.toContain('ada');
  });
});

describe('SvTerminalComponent — accessibility', () => {
  /**
   * ★★★ A REAL TEXT FIELD. A `contenteditable` div with a fake caret loses
   *     dictation, IME composition, autocorrect and the phone keyboard — for
   *     a control whose entire purpose is typing.
   */
  it('takes input through a real <input>, not a contenteditable', async () => {
    const f = await setup();
    expect(input(f)).not.toBeNull();
    expect(el(f).querySelector('[contenteditable]')).toBeNull();
  });

  it('announces output as a log rather than re-reading the session', async () => {
    const f = await setup();
    const log = el(f).querySelector('[role="log"]')!;
    expect(log.getAttribute('aria-live')).toBe('polite');
    expect(log.getAttribute('aria-atomic')).toBe('false');
  });

  it('labels the prompt and points it at its own output', async () => {
    const f = await setup({ inputLabel: 'Ask the terminal' });
    const field = input(f);
    expect(field.getAttribute('aria-label')).toBe('Ask the terminal');
    const described = field.getAttribute('aria-describedby');
    expect(described).toBeTruthy();
    expect(el(f).querySelector(`#${described}`)?.getAttribute('role')).toBe('log');
  });

  it('gives every instance its own ids', async () => {
    // Both instances must share an application: ids are per application (svUniqueId).
    const a = await setup();
    const b = TestBed.createComponent(SvTerminalComponent);
    b.componentRef.setInput('commands', COMMANDS);
    b.componentRef.setInput('typeIntro', false);
    b.detectChanges();
    await b.whenStable();
    expect(input(a).id).toBeTruthy();
    expect(input(a).id).not.toBe(input(b).id);
  });
});

describe('SvTerminalComponent — scrollback', () => {
  it('drops the oldest lines rather than growing without bound', async () => {
    const f = await setup({ maxLines: 4 });
    await run(f, 'whoami');
    await run(f, 'help');
    await run(f, 'copy');
    // Four lines max. Counted on the output rows only — the live prompt is a
    // sibling inside the log and is not scrollback.
    const lines = el(f).querySelectorAll('[data-sv-line]');
    expect(lines.length).toBeLessThanOrEqual(4);
    expect(text(f)).not.toContain('ada');
  });

  it('prints the intro immediately when typing is off', async () => {
    const f = await setup({ intro: [{ kind: 'stdout' as const, text: 'welcome aboard' }] });
    await until(() => text(f).includes('welcome aboard'));
    expect(text(f)).toContain('welcome aboard');
  });
});

// ── The intro animation, and stopping it ─────────────────────────────────────

/**
 * ============================================================================
 *  A second intro must not talk over the first
 * ============================================================================
 *
 * ★★★ FOUND BY LOOKING AT THE PAGE, NOT BY READING THE CODE. The dev-portfolio
 *     hero derives its transcript from live data, so the intro's identity
 *     changes once the catalogue lands. The effect cleared the scrollback and
 *     started a second typer — while the first was still appending, one
 *     `setTimeout` per character — and the two interleaved into a transcript
 *     with every line printed twice. Every unit test passed throughout: the
 *     final scrollback is only wrong while both runs are alive.
 *
 *     So these tests assert on the state MID-FLIGHT, which is the only place
 *     the bug exists.
 * ============================================================================
 */
describe('intro animation', () => {
  const LINES = [
    { kind: 'command' as const, text: 'whoami' },
    { kind: 'stdout' as const, text: 'somebody' },
  ];
  const OTHER = [
    { kind: 'command' as const, text: 'whoami' },
    { kind: 'stdout' as const, text: 'somebody else entirely' },
  ];

  const rows = (host: HTMLElement) =>
    [...host.querySelectorAll('[data-sv-line]')].map((l) => (l.textContent ?? '').trim());

  it('never prints a line twice when the intro changes mid-animation', async () => {
    TestBed.resetTestingModule();
    const { fixture, rerender } = await render(SvTerminalComponent, {
      inputs: { intro: LINES, commands: [], typeIntro: true, typeSpeedMs: 1 },
    });
    const host = fixture.nativeElement as HTMLElement;

    // Swap the intro while the first run is still typing.
    await new Promise((r) => setTimeout(r, 4));
    await rerender({ inputs: { intro: OTHER, commands: [], typeIntro: true, typeSpeedMs: 1 } });

    await new Promise((r) => setTimeout(r, 400));
    fixture.detectChanges();

    const printed = rows(host).filter(Boolean);
    expect(new Set(printed).size, printed.join(' | ')).toBe(printed.length);
    expect(printed.join(' ')).toContain('somebody else entirely');
  });

  /**
   * ★ A prompt that keeps typing its own introduction over the command you
   *   just ran is the most irritating thing an animated terminal can do.
   */
  it('shows the rest of the intro at once when the visitor takes over', async () => {
    TestBed.resetTestingModule();
    const long = Array.from({ length: 6 }, (_, i) => ({
      kind: 'stdout' as const,
      text: `line number ${i} with enough characters to still be typing`,
    }));
    const { fixture } = await render(SvTerminalComponent, {
      inputs: { intro: long, commands: [], typeIntro: true, typeSpeedMs: 5 },
    });
    const host = fixture.nativeElement as HTMLElement;
    const component = fixture.componentInstance as unknown as {
      runLine: (s: string) => Promise<void>;
    };

    await new Promise((r) => setTimeout(r, 10));
    await component.runLine('nope');
    fixture.detectChanges();

    const printed = rows(host).filter(Boolean);
    // Every intro line is present, complete, and exactly once…
    for (const line of long) {
      expect(printed.filter((p) => p === line.text).length, line.text).toBe(1);
    }
    // …and the visitor's line is the last thing that happened.
    expect(printed.join(' ')).toContain('nope');

    await new Promise((r) => setTimeout(r, 250));
    fixture.detectChanges();
    const settled = rows(host).filter(Boolean);
    expect(new Set(settled).size, settled.join(' | ')).toBe(settled.length);
  });
});
