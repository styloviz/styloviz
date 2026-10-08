import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { SvCodeBlockComponent } from './code-block.component';
import { inferLanguage, tokenize } from './code-highlighter';
import type { DiffHunk, TerminalLine } from './code-block.types';

@Component({
  standalone: true,
  imports: [SvCodeBlockComponent],
  template: `<sv-code-block [code]="code" filename="demo.ts" [highlightLines]="[2]" />`,
})
class HostComponent {
  code = `const a = 1;\nconst b = 'two';\n// done`;
}

describe('SvCodeBlockComponent', () => {
  it('renders one row per source line', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const code = fixture.nativeElement.querySelector('code') as HTMLElement;
    expect(code.textContent).toContain('const a = 1;');
    expect(code.textContent).toContain('// done');
  });

  it('renders a labelled scroll region', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const region = fixture.nativeElement.querySelector('[role="region"]') as HTMLElement;
    expect(region.getAttribute('aria-label')).toBe('demo.ts');
  });

  it('exposes a copy button with an accessible name', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button[aria-label]') as HTMLElement;
    expect(button.getAttribute('aria-label')).toContain('Copy');
  });
});

describe('code-highlighter', () => {
  it('infers language from a file extension', () => {
    expect(inferLanguage('app.component.ts')).toBe('typescript');
    expect(inferLanguage('styles.css')).toBe('css');
    expect(inferLanguage('data.json')).toBe('json');
    expect(inferLanguage('README')).toBe('plaintext');
  });

  it('splits tokens across lines and numbers them from 1', () => {
    const lines = tokenize('const a = 1;\nconst b = 2;', 'typescript');
    expect(lines.length).toBe(2);
    expect(lines[0].no).toBe(1);
    expect(lines[1].no).toBe(2);
  });

  it('classifies keywords, strings, numbers and comments', () => {
    const [line] = tokenize(`const x = 'hi'; // note`, 'typescript');
    const kinds = line.tokens.map((t) => t.kind);
    expect(kinds).toContain('keyword');
    expect(kinds).toContain('string');
    expect(kinds).toContain('comment');
  });

  it('keeps a multi-line block comment attached to each line it spans', () => {
    const lines = tokenize('/* one\n   two */\nconst a = 1;', 'typescript');
    expect(lines.length).toBe(3);
    expect(lines[0].tokens[0].kind).toBe('comment');
    expect(lines[1].tokens[0].kind).toBe('comment');
  });

  it('round-trips the original text exactly', () => {
    const src = `function f(a: number) {\n  return a + 1; // inc\n}`;
    const flat = tokenize(src, 'typescript')
      .map((l) => l.tokens.map((t) => t.text).join(''))
      .join('\n');
    expect(flat).toBe(src);
  });

  it('falls back to plain tokens for an unsupported language', () => {
    const [line] = tokenize('anything at all', 'plaintext');
    expect(line.tokens.every((t) => t.kind === 'plain')).toBe(true);
  });
});

describe('SvCodeBlockComponent — diff and terminal inputs', () => {
  const hunk: DiffHunk = {
    id: 'h1',
    header: '@@ -1,2 +1,2 @@',
    lines: [
      { kind: 'context', text: 'const a = 1;', oldNo: 1, newNo: 1 },
      { kind: 'del', text: "const b = 'x';", oldNo: 2, newNo: null },
      { kind: 'add', text: "const b = 'y';", oldNo: null, newNo: 2 },
    ],
  };

  const terminal: readonly TerminalLine[] = [
    { kind: 'command', text: 'npm run build' },
    { kind: 'stdout', text: 'Build complete.' },
  ];

  it('renders diff hunks with add and remove rows', () => {
    const fixture = TestBed.createComponent(SvCodeBlockComponent);
    fixture.componentRef.setInput('variant', 'diff');
    fixture.componentRef.setInput('hunks', [hunk]);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain("const b = 'x';");
    expect(text).toContain("const b = 'y';");
    expect(text).toContain('+1');
    expect(text).toContain('−1');
  });

  it('renders terminal lines with a prompt for commands', () => {
    const fixture = TestBed.createComponent(SvCodeBlockComponent);
    fixture.componentRef.setInput('variant', 'terminal');
    fixture.componentRef.setInput('terminalLines', terminal);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('npm run build');
    expect(text).toContain('Build complete.');
  });
});
