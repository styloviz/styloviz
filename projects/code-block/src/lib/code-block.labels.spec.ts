import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvCodeBlockComponent } from './code-block.component';
import { SV_CODE_BLOCK_LABELS } from './code-block.labels';
import type { CodeFile, DiffHunk } from './code-block.types';

const FILES: CodeFile[] = [
  { name: 'a.ts', content: 'const a = 1;' },
  { name: 'b.ts', content: 'const b = 2;' },
];

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvCodeBlockComponent, {
    inputs: { variant: 'tabs', files: FILES },
    providers: providers as never[],
  });
}

describe('SvCodeBlockComponent — accessible names', () => {
  it('names the file tab strip in English by default', async () => {
    await setup();
    expect(screen.getByRole('tablist', { name: SV_CODE_BLOCK_LABELS.fileTabs })).toBeTruthy();
  });

  it('renders the names an app provides', async () => {
    await setup([provideSvLabels({ codeBlock: { fileTabs: 'Dateien' } })]);
    expect(screen.getByRole('tablist', { name: 'Dateien' })).toBeTruthy();
    expect(screen.queryByRole('tablist', { name: 'Files' })).toBeNull();
  });
});

const HUNKS: readonly DiffHunk[] = [
  { id: 'h1', lines: [{ kind: 'add', text: 'one', oldNo: null, newNo: 1 }] },
  { id: 'h2', lines: [{ kind: 'del', text: 'two', oldNo: 2, newNo: null }] },
];

describe('SvCodeBlockComponent — composed accessible names (FL-B1c)', () => {
  it('fills a translated template whose slots sit in different positions', async () => {
    TestBed.resetTestingModule();
    await render(SvCodeBlockComponent, {
      inputs: { variant: 'diff', reviewable: true, hunks: HUNKS },
      providers: [provideSvLabels({ codeBlock: { acceptChange: 'Von {total} Änderungen Nr. {index} annehmen' } })],
    });
    expect(screen.getByRole('button', { name: 'Von 2 Änderungen Nr. 1 annehmen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Accept change 1 of 2' })).toBeNull();
  });
});

describe('SvCodeBlockComponent — visible text (FL-B1d)', () => {
  it('renders the button words an app provides', async () => {
    TestBed.resetTestingModule();
    await render(SvCodeBlockComponent, {
      inputs: { variant: 'diff', reviewable: true, hunks: HUNKS },
      providers: [provideSvLabels({ codeBlock: { accept: 'Annehmen', reject: 'Ablehnen' } })],
    });
    expect(screen.getAllByText('Annehmen').length).toBe(2);
    expect(screen.getAllByText('Ablehnen').length).toBe(2);
    expect(screen.queryByText('Accept')).toBeNull();
  });
});

describe('SvCodeBlockComponent — TS-built text (FL-B1e)', () => {
  it('names the copy button from a translated template with the file name in its slot', async () => {
    await setup([provideSvLabels({ codeBlock: { copyNamedFile: 'Nur die geöffnete Datei {name} kopieren' } })]);
    expect(screen.getByRole('button', { name: 'Nur die geöffnete Datei a.ts kopieren' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Copy a.ts — the open file only' })).toBeNull();
  });
});
