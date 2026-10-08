import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvFileDisplayComponent } from './file-display.component';

/**
 * A file row: an icon chosen from the MIME type, a size a human can read, a
 * status, and two actions. The size formatter is the part that quietly goes
 * wrong — every boundary between units is an off-by-one waiting to happen — and
 * the progress bar has to be a real progressbar, not a coloured div, or upload
 * progress is invisible to anyone not watching it.
 */

async function setup(inputs: Partial<ComponentInput<SvFileDisplayComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvFileDisplayComponent, {
    inputs: { fileName: 'report.pdf', mimeType: 'application/pdf', ...inputs } as ComponentInput<SvFileDisplayComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

describe('SvFileDisplayComponent — reading the file', () => {
  it('shows the name, and names the whole row by it', async () => {
    const { fixture } = await setup();
    expect(el(fixture).textContent).toContain('report.pdf');
    expect(screen.getByRole('group', { name: 'report.pdf' })).toBeTruthy();
  });

  it('takes the extension off the end of the name', async () => {
    const { fixture } = await setup({ fileName: 'archive.tar.gz' });
    expect(fixture.componentInstance.fileExtension()).toBe('GZ');

    const { fixture: none } = await setup({ fileName: 'Makefile' });
    expect(none.componentInstance.fileExtension()).toBe('');
  });

  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1023, '1023 B'],
    [1024, '1.0 KB'],
    [1_048_575, '1024.0 KB'],
    [1_048_576, '1.0 MB'],
    [5_242_880, '5.0 MB'],
    [1_073_741_824, '1.0 GB'],
    [3_221_225_472, '3.0 GB'],
  ])('formats %i bytes as %s', async (bytes, expected) => {
    const { fixture } = await setup({ fileSize: bytes });
    expect(fixture.componentInstance.formattedSize()).toBe(expected);
  });

  it('says nothing about a size it was not given', async () => {
    const { fixture } = await setup();
    expect(fixture.componentInstance.formattedSize()).toBe('');
  });
});

describe('SvFileDisplayComponent — the icon', () => {
  it.each([
    ['image/png', 'image'],
    ['application/pdf', 'pdf'],
    ['application/zip', 'archive'],
    ['application/gzip', 'archive'],
    ['video/mp4', 'video'],
    ['audio/mpeg', 'audio'],
    ['application/json', 'code'],
    ['text/html', 'code'],
    ['application/msword', 'doc'],
    // The official XLSX type — it contains the substring 'document', which used
    // to win, so every spreadsheet showed the Word icon.
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'sheet'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'doc'],
    ['application/vnd.ms-excel', 'sheet'],
    ['text/csv', 'sheet'],
    ['application/octet-stream', 'generic'],
    ['', 'generic'],
  ])('picks the %s icon', async (mimeType, expected) => {
    const { fixture } = await setup({ mimeType });
    expect(fixture.componentInstance.iconType()).toBe(expected);
  });

  it('is case-insensitive about the MIME type', async () => {
    const { fixture } = await setup({ mimeType: 'APPLICATION/PDF' });
    expect(fixture.componentInstance.iconType()).toBe('pdf');
  });

  it('has a colour for every icon it can pick', async () => {
    for (const mimeType of ['image/png', 'application/pdf', 'application/zip', 'video/mp4', 'audio/mpeg', 'application/json', 'application/msword', 'application/vnd.ms-excel', 'application/octet-stream']) {
      const { fixture } = await setup({ mimeType });
      expect(fixture.componentInstance.iconColorClass()).toBeTruthy();
      expect(fixture.componentInstance.iconBgClass()).toBeTruthy();
    }
  });

  it('shows a thumbnail only for an image that has one', async () => {
    const { fixture: withUrl } = await setup({ mimeType: 'image/png', previewUrl: 'https://example.test/a.png' });
    expect(withUrl.componentInstance.showPreview()).toBe(true);
    expect(el(withUrl).querySelector('img')).toBeTruthy();

    const { fixture: noUrl } = await setup({ mimeType: 'image/png' });
    expect(noUrl.componentInstance.showPreview()).toBe(false);

    const { fixture: notImage } = await setup({ previewUrl: 'https://example.test/a.png' });
    expect(notImage.componentInstance.showPreview()).toBe(false);
  });
});

describe('SvFileDisplayComponent — status and progress', () => {
  it('shows nothing while it is idle', async () => {
    const { fixture } = await setup();
    expect(fixture.componentInstance.statusIcon()).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('reports upload progress as a progressbar, not a coloured div', async () => {
    await setup({ status: 'uploading', progress: 42 });
    const bar = screen.getByRole('progressbar', { name: 'Upload progress for report.pdf' });
    expect(bar.getAttribute('aria-valuenow')).toBe('42');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });

  it('shows no progress once the upload is over', async () => {
    await setup({ status: 'success', progress: 100 });
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('says how it ended, in words as well as colour', async () => {
    const { fixture: ok } = await setup({ status: 'success' });
    expect(ok.componentInstance.statusIcon()).toBe('check');
    expect(screen.getByRole('img', { name: 'Upload successful' })).toBeTruthy();

    const { fixture: bad } = await setup({ status: 'error' });
    expect(bad.componentInstance.statusIcon()).toBe('x');
    expect(screen.getByRole('img', { name: 'Upload failed' })).toBeTruthy();
  });
});

describe('SvFileDisplayComponent — the actions', () => {
  it('names each action by the file it acts on', async () => {
    await setup();
    expect(screen.getByRole('button', { name: 'Download report.pdf' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove report.pdf' })).toBeTruthy();
  });

  it('reports a download at once, and a removal only once confirmed', async () => {
    let downloads = 0;
    let removals = 0;
    const { fixture } = await setup();
    fixture.componentInstance.download.subscribe(() => { downloads += 1; });
    fixture.componentInstance.remove.subscribe(() => { removals += 1; });

    await userEvent.click(screen.getByRole('button', { name: 'Download report.pdf' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove report.pdf' }));
    expect([downloads, removals]).toEqual([1, 0]);

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(removals).toBe(1);
  });

  it('drops the actions the host does not want', async () => {
    await setup({ downloadable: false });
    expect(screen.queryByRole('button', { name: /Download/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Remove/ })).toBeTruthy();

    await setup({ removable: false, downloadable: false });
    expect(screen.queryByRole('button')).toBeNull();
  });
});

/**
 * Deleting a file is the one write here that nothing can undo: this component
 * renders ONE file, and the list it sits in belongs to the host, so there is
 * nothing for a `rollback()` to put it back into. What it owes instead is the
 * step before — and that step used to be missing entirely.
 */
describe('SvFileDisplayComponent — confirming a delete', () => {
  /** ★★ THE REGRESSION: one stray click on a 28px × permanently deleted a file. */
  it('asks before deleting, by default', async () => {
    const seen: unknown[] = [];
    const { fixture } = await setup();
    fixture.componentInstance.remove.subscribe((e) => seen.push(e));

    await userEvent.click(screen.getByRole('button', { name: 'Remove report.pdf' }));
    expect(seen).toEqual([]);
    expect(el(fixture).querySelector('[data-sv-state="confirm-remove"]')).not.toBeNull();
    expect(el(fixture).textContent).toContain('cannot be undone');
  });

  it('says the delete cannot be undone, and does it when told', async () => {
    const seen: { fileName: string; requestKey: string }[] = [];
    const { fixture } = await setup();
    fixture.componentInstance.remove.subscribe((e) => seen.push(e));

    fixture.componentInstance.toggleConfirm();
    fixture.detectChanges();
    fixture.componentInstance.confirmRemoval();

    expect(seen.length).toBe(1);
    expect(seen[0]!.fileName).toBe('report.pdf');
    expect(seen[0]!.requestKey).toBeTruthy();
    expect(fixture.componentInstance.awaitingConfirm()).toBe(false);
  });

  it('gives every delete its own request key', async () => {
    const seen: { requestKey: string }[] = [];
    const { fixture } = await setup({ confirmRemove: false });
    fixture.componentInstance.remove.subscribe((e) => seen.push(e));
    fixture.componentInstance.toggleConfirm();
    fixture.componentInstance.toggleConfirm();
    expect(seen[0]!.requestKey).not.toBe(seen[1]!.requestKey);
  });

  it('withdraws the question on Keep, and on a second press of the ×', async () => {
    const seen: unknown[] = [];
    const { fixture } = await setup();
    fixture.componentInstance.remove.subscribe((e) => seen.push(e));

    await userEvent.click(screen.getByRole('button', { name: 'Remove report.pdf' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(fixture.componentInstance.awaitingConfirm()).toBe(false);
    expect(el(fixture).querySelector('[data-sv-state="confirm-remove"]')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Remove report.pdf' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel removing report.pdf' }));
    expect(fixture.componentInstance.awaitingConfirm()).toBe(false);
    expect(seen).toEqual([]);
  });

  /** The × keeps its place so the focus that pressed it still has somewhere to be. */
  it('keeps the × in the DOM while the strip is open, and marks it expanded', async () => {
    await setup();
    const x = screen.getByRole('button', { name: 'Remove report.pdf' });
    expect(x.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(x);
    expect(document.activeElement).toBe(x);
    expect(x.getAttribute('aria-expanded')).toBe('true');
  });

  it('skips the question when the host runs its own dialog', async () => {
    const seen: unknown[] = [];
    const { fixture } = await setup({ confirmRemove: false });
    fixture.componentInstance.remove.subscribe((e) => seen.push(e));

    await userEvent.click(screen.getByRole('button', { name: 'Remove report.pdf' }));
    expect(seen.length).toBe(1);
    expect(screen.getByRole('button', { name: 'Remove report.pdf' }).hasAttribute('aria-expanded')).toBe(false);
  });

  it('stops responding while the delete is in flight, so it cannot be sent twice', async () => {
    const seen: unknown[] = [];
    const { fixture } = await setup();
    fixture.componentInstance.remove.subscribe((e) => seen.push(e));
    fixture.componentInstance.toggleConfirm();
    fixture.componentRef.setInput('removing', true);
    fixture.detectChanges();

    const confirm = screen.getByRole('button', { name: /Removing/ });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(confirm.getAttribute('aria-busy')).toBe('true');
    expect((screen.getByRole('button', { name: 'Cancel removing report.pdf' }) as HTMLButtonElement).disabled).toBe(true);

    fixture.componentInstance.confirmRemoval();
    fixture.componentInstance.cancelRemove();
    expect(seen).toEqual([]);
    expect(fixture.componentInstance.awaitingConfirm()).toBe(true);
  });

  /** A failed delete leaves the row where it was — the host never took it out. */
  it('reports a failed delete in place, without hiding the file', async () => {
    const { fixture } = await setup({ removeError: 'The bucket refused the delete.' });
    const bar = el(fixture).querySelector('[data-sv-state="remove-error"]')!;
    expect(bar.getAttribute('role')).toBe('alert');
    expect(bar.textContent).toContain('The bucket refused the delete.');
    expect(el(fixture).textContent).toContain('report.pdf');
    expect(screen.getByRole('button', { name: 'Download report.pdf' })).toBeTruthy();
  });

  it('takes a structured error as well as a bare string', async () => {
    const { fixture } = await setup({
      removeError: { message: 'Retention policy blocks this.', code: 'RETAINED', status: 423 },
    });
    expect(fixture.componentInstance.removeErrorMessage()).toBe('Retention policy blocks this.');
  });

  it('shows nothing when nothing has failed', async () => {
    const { fixture } = await setup();
    expect(el(fixture).querySelector('[data-sv-state="remove-error"]')).toBeNull();
    expect(fixture.componentInstance.removeErrorMessage()).toBe('');
  });
});

describe('SvFileDisplayComponent — layout', () => {
  it.each(['card', 'row', 'compact'] as const)('knows it is the %s variant', async (variant) => {
    const { fixture } = await setup({ variant });
    const c = fixture.componentInstance;
    const flags = [c.isCard(), c.isRow(), c.isCompact()];
    expect(flags.filter(Boolean).length).toBe(1);
  });

  it('defaults to the card', async () => {
    const { fixture } = await setup();
    expect(fixture.componentInstance.isCard()).toBe(true);
  });
});
