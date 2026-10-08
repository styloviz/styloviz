import { SvFileUploadComponent } from './file-upload.component';
import { render } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import type { SvUploadContext, SvUploadResult, UploadFile } from './file-upload.component';

/**
 * The upload contract — the async promise in the vocabulary this component
 * actually has.
 *
 * It sat in `scripts/data-contract.untested.json` because the shared harness
 * models loading / error / retry over a fetched collection, and none of those
 * words fit here. There is nothing to load and nothing to be empty: the user
 * supplies the files. What can fail is the **send**, per file, and what has to
 * work is the `AbortSignal` — an uploader that ignores it leaks the request and
 * lets a dead upload finish against a destroyed view.
 *
 * So this asserts the three things a host depends on: progress reaches the
 * entry, a failure is reported per file rather than for the batch, and cancel
 * actually aborts.
 */
const file = (name = 'a.txt') => new File(['x'], name, { type: 'text/plain' });

const flush = () => new Promise((r) => setTimeout(r, 0));

interface UploadInternals {
  addFiles(files: File[]): void;
}

/** `addFiles` is private; see the note above. */
const add = (f: { componentInstance: unknown }, files: File[]) =>
  (f.componentInstance as UploadInternals).addFiles(files);

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvFileUploadComponent, {
    inputs: { autoUpload: true, ...inputs },
  });
  return fixture;
}

describe('SvFileUploadComponent — sending files', () => {
  it('reports progress from the host uploader onto the entry', async () => {
    const held: { report?: (n: number) => void } = {};
    const uploader = (ctx: SvUploadContext): Promise<SvUploadResult> => {
      held.report = ctx.onProgress;
      return new Promise<SvUploadResult>(() => {
        /* never settles — the point is the progress channel, not completion */
      });
    };

    const f = await setup({ uploader });
    add(f, [file()]);
    await flush();
    held.report?.(42);
    f.detectChanges();

    const entry = f.componentInstance.files()[0] as UploadFile;
    expect(entry.progress).toBe(42);
    expect(entry.status).toBe('uploading');
  });

  it('clamps a nonsense progress value instead of drawing a bar off the card', async () => {
    const held: { report?: (n: number) => void } = {};
    const uploader = (ctx: SvUploadContext): Promise<SvUploadResult> => {
      held.report = ctx.onProgress;
      return new Promise<SvUploadResult>(() => { /* see above */ });
    };
    const f = await setup({ uploader });
    add(f, [file()]);
    await flush();
    held.report?.(420);
    f.detectChanges();
    expect(f.componentInstance.files()[0].progress).toBeLessThanOrEqual(100);
  });

  it('fails ONE file without condemning the rest of the batch', async () => {
    // A batch that fails as a unit makes the user re-pick every file to retry
    // the one that broke.
    const uploader = (ctx: SvUploadContext): Promise<SvUploadResult> =>
      ctx.file.name === 'bad.txt'
        ? Promise.reject(new Error('Storage rejected it'))
        : Promise.resolve({ id: 'remote-1' });

    const f = await setup({ uploader });
    const failed: UploadFile[] = [];
    f.componentInstance.uploadError.subscribe((u) => failed.push(u));

    add(f, [file('good.txt'), file('bad.txt')]);
    await flush();
    await flush();
    f.detectChanges();

    const byName = Object.fromEntries(f.componentInstance.files().map((u) => [u.name, u]));
    expect(byName['bad.txt'].status).toBe('error');
    expect(byName['good.txt'].status).toBe('success');
    expect(failed.map((u) => u.name)).toEqual(['bad.txt']);
  });

  it('keeps what the server said about a stored file', async () => {
    // The id and URL are the server's to assign; dropping them means the host
    // cannot reference the file it just uploaded.
    const uploader = (): Promise<SvUploadResult> =>
      Promise.resolve({ id: 'remote-9', url: 'https://example.test/f/9' });

    const f = await setup({ uploader });
    add(f, [file()]);
    await flush();
    await flush();

    const entry = f.componentInstance.files()[0];
    expect(entry.remoteId).toBe('remote-9');
    expect(entry.url).toBe('https://example.test/f/9');
  });

  it('aborts the request when the user cancels — not just the UI', async () => {
    let aborted = false;
    const uploader = (ctx: SvUploadContext): Promise<SvUploadResult> => {
      ctx.signal.addEventListener('abort', () => (aborted = true));
      return new Promise<SvUploadResult>(() => { /* held open so cancel has something to abort */ });
    };

    const f = await setup({ uploader });
    add(f, [file()]);
    await flush();
    f.componentInstance.cancelUpload(f.componentInstance.files()[0].id);
    await flush();

    expect(aborted, 'cancel left the request running — a leaked upload').toBe(true);
  });

  it('aborts in-flight uploads when the component is destroyed', async () => {
    let aborted = false;
    const uploader = (ctx: SvUploadContext): Promise<SvUploadResult> => {
      ctx.signal.addEventListener('abort', () => (aborted = true));
      return new Promise<SvUploadResult>(() => { /* see above */ });
    };

    const f = await setup({ uploader });
    add(f, [file()]);
    await flush();
    f.destroy();
    await flush();

    expect(aborted, 'a dead upload can still resolve against a destroyed view').toBe(true);
  });

  it('invents no progress of its own when no uploader is supplied', async () => {
    // `demoMode` is the fakery switch. Without it and without an uploader the
    // component must sit still rather than animate a bar to 100%.
    const f = await setup({ uploader: null, demoMode: false });
    add(f, [file()]);
    await flush();
    expect(f.componentInstance.files()[0].progress).toBe(0);
  });
});
