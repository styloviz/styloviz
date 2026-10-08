import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvFileDisplayComponent } from './file-display.component';
import type { FileRetryEvent } from './file-display.component';

/**
 * What the download button is allowed to imply, and what happens to an upload
 * that did not finish.
 *
 * ★ The defect these were written against is not a crash. The button rendered
 * for every file in every state and looked identical each time, so pressing it
 * on a file nobody had scanned was indistinguishable from pressing it on one
 * that had come back clean — and on a file whose upload had FAILED, where the
 * server holds no bytes at all.
 */

async function setup(inputs: Partial<ComponentInput<SvFileDisplayComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvFileDisplayComponent, {
    inputs: {
      fileName: 'quarterly-report.pdf',
      fileSize: 2_400_000,
      mimeType: 'application/pdf',
      ...inputs,
    } as ComponentInput<SvFileDisplayComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const downloadButton = () => screen.queryByRole('button', { name: /^Download quarterly-report/ });

describe('SvFileDisplayComponent — the download is not a safety claim', () => {
  it('says so when nobody checked the file', async () => {
    const { fixture } = await setup();
    // The default. Not a synonym for clean, and it must not read like one.
    expect(el(fixture).textContent).toContain('Not checked for threats');
    expect(downloadButton()).toBeTruthy();
  });

  it('does not stamp the disclosure on a file it offers no download for', async () => {
    const { fixture } = await setup({ downloadable: false });
    // No button, no implied claim — and "Not checked" on every row of a list
    // nobody can download from trains people to ignore the words that matter.
    expect(el(fixture).textContent).not.toContain('Not checked for threats');
  });

  it('distinguishes a clean result from an absent one', async () => {
    const { fixture } = await setup({ scan: 'clean' });
    expect(el(fixture).textContent).toContain('Checked — no threats found');
    expect(downloadButton()).toBeTruthy();
  });

  it('withholds the download while the check is still running', async () => {
    const { fixture } = await setup({ scan: 'pending' });
    expect(downloadButton()).toBeNull();
    expect(el(fixture).textContent).toContain('Being checked for threats');
  });

  it('withholds it outright for a flagged file, and says why', async () => {
    const { fixture } = await setup({ scan: 'flagged', scanNote: 'Matched EICAR-Test-File.' });
    // Absent rather than disabled: a greyed control answers nothing and invites
    // a harder press.
    expect(downloadButton()).toBeNull();
    expect(el(fixture).textContent).toContain('Matched EICAR-Test-File.');
  });

  it('offers a flagged file only behind a confirmation, when the host opts in', async () => {
    const user = userEvent.setup();
    const downloads: number[] = [];
    const { fixture } = await setup({ scan: 'flagged', allowUnsafeDownload: true });
    fixture.componentInstance.download.subscribe(() => downloads.push(1));

    const button = downloadButton();
    expect(button).toBeTruthy();
    await user.click(button!);

    // One press is a question, not a download.
    expect(downloads).toHaveLength(0);
    expect(el(fixture).querySelector('[data-sv-state="confirm-unsafe-download"]')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Download anyway' }));
    expect(downloads).toHaveLength(1);
  });

  it('lets the question be withdrawn', async () => {
    const user = userEvent.setup();
    const downloads: number[] = [];
    const { fixture } = await setup({ scan: 'flagged', allowUnsafeDownload: true });
    fixture.componentInstance.download.subscribe(() => downloads.push(1));

    await user.click(downloadButton()!);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(downloads).toHaveLength(0);
    expect(el(fixture).querySelector('[data-sv-state="confirm-unsafe-download"]')).toBeNull();
  });

  it('offers no download for an upload that failed', async () => {
    const { fixture } = await setup({ status: 'error' });
    // There are no bytes on the server to fetch.
    expect(downloadButton()).toBeNull();
    expect(el(fixture).textContent).toContain('nothing to download yet');
  });

  it('carries the disclosure into the compact variant as an accessible name', async () => {
    await setup({ variant: 'compact', scan: 'flagged', scanNote: 'Contains a macro.' });
    // No room for the sentence, so the glyph has to be the label rather than a
    // decoration sitting on top of one.
    expect(screen.getByRole('img', { name: 'Contains a macro.' })).toBeTruthy();
  });
});

describe('SvFileDisplayComponent — an upload that did not finish', () => {
  it('offers a retry with the reason, where there used to be neither', async () => {
    const user = userEvent.setup();
    const events: FileRetryEvent[] = [];
    const { fixture } = await setup({ status: 'error', uploadError: 'The connection dropped.' });
    fixture.componentInstance.retryUpload.subscribe((e) => events.push(e));

    expect(el(fixture).textContent).toContain('The connection dropped.');
    await user.click(screen.getByRole('button', { name: /Retry from the start/ }));

    expect(events).toHaveLength(1);
    expect(events[0].fileName).toBe('quarterly-report.pdf');
    expect(events[0].resumeFrom).toBe(0);
    expect(events[0].requestKey).toBeTruthy();
  });

  it('says "resume" only when it can actually resume', async () => {
    const { fixture } = await setup({
      status: 'error',
      resumable: true,
      uploadedBytes: 1_200_000,
    });
    // ★ The whole point of the label: a "Retry" that silently re-sends the
    // whole file over a metered connection is a different offer.
    expect(el(fixture).textContent).toContain('Resume from 1.1 MB');
  });

  it('falls back to a full retry when the host says resumable but not how far', async () => {
    const { fixture } = await setup({ status: 'error', resumable: true });
    expect(el(fixture).textContent).toContain('Retry from the start');
  });

  it('refuses an offset that is already past the end of the file', async () => {
    const { fixture } = await setup({
      status: 'error',
      resumable: true,
      fileSize: 1000,
      uploadedBytes: 1000,
    });
    // A stale offset would resume into nothing and report success on an empty
    // upload — worse than starting over.
    expect(fixture.componentInstance.resumeFrom()).toBe(0);
    expect(el(fixture).textContent).toContain('Retry from the start');
  });

  it('lets a running upload be cancelled instead of only removed', async () => {
    const user = userEvent.setup();
    const cancels: { fileName: string }[] = [];
    const { fixture } = await setup({ status: 'uploading', progress: 40 });
    fixture.componentInstance.cancelUpload.subscribe((e) => cancels.push(e));

    await user.click(screen.getByRole('button', { name: 'Cancel uploading quarterly-report.pdf' }));
    expect(cancels).toEqual([{ fileName: 'quarterly-report.pdf' }]);
  });

  it('does not offer a retry while the upload is still running', async () => {
    await setup({ status: 'uploading', progress: 40 });
    expect(screen.queryByRole('button', { name: /Retry|Resume/ })).toBeNull();
  });
});
