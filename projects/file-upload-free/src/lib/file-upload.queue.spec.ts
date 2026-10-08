import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { until, quietFor, flush } from '../../../../src/testing/async';
import {
  SvFileUploadComponent,
  type SvUploadContext,
  type SvUploadResult,
  type UploadFile,
} from './file-upload.component';

/**
 * The upload engine: a queue, a concurrency limit, an `AbortController` per
 * file, and a completion signal that has to wait for the last one.
 *
 * There is no real network here — a real XHR/fetch would need a stub anyway —
 * so every test supplies its own `uploader` and controls exactly when it
 * settles. That is the only way to hold a file "in flight" long enough to
 * cancel it, or to prove the fourth file waits for a slot.
 */

async function setup(inputs: Partial<ComponentInput<SvFileUploadComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvFileUploadComponent, {
    inputs: { autoUpload: true, ...inputs } as ComponentInput<SvFileUploadComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

const file = (name: string) => new File([new Uint8Array(4)], name, { type: 'text/plain' });

function dropEvent(files: File[]): DragEvent {
  return {
    preventDefault() { /* no-op */ },
    dataTransfer: { files },
  } as unknown as DragEvent;
}

/** An uploader that hands each call's resolvers back to the test. */
function controllable() {
  const calls: { name: string; ctx: SvUploadContext; resolve(r?: SvUploadResult): void; reject(e: unknown): void }[] = [];
  const uploader = (ctx: SvUploadContext): Promise<SvUploadResult | void> =>
    new Promise<SvUploadResult | void>((resolve, reject) => {
      calls.push({ name: ctx.file.name, ctx, resolve, reject });
    });
  return { calls, uploader };
}

const byName = (c: SvFileUploadComponent) =>
  Object.fromEntries(c.files().map((u) => [u.name, u])) as Record<string, UploadFile>;

describe('SvFileUploadComponent — the concurrency limit', () => {
  it('starts only as many uploads as the limit allows, and queues the rest', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader, concurrency: 2 });
    fixture.componentInstance.onDrop(dropEvent([file('a'), file('b'), file('c'), file('d')]));
    await flush();

    expect(calls.map((c) => c.name)).toEqual(['a', 'b']);
    expect(fixture.componentInstance.files().map((u) => u.status))
      .toEqual(['uploading', 'uploading', 'pending', 'pending']);

    calls[0].resolve({});
    await until(() => calls.length === 3, { label: 'the third upload to take the freed slot' });
    expect(calls.map((c) => c.name)).toEqual(['a', 'b', 'c']);
  });

  it('treats a nonsense concurrency as one at a time rather than none at all', async () => {
    // A limit of 0 with a `while (size < limit)` loop starts nothing and the
    // queue never drains — the upload silently never happens.
    for (const concurrency of [0, -3, 0.4, NaN]) {
      const { calls, uploader } = controllable();
      const { fixture } = await setup({ uploader, concurrency });
      fixture.componentInstance.onDrop(dropEvent([file('a'), file('b')]));
      await flush();
      expect(calls.map((c) => c.name), `concurrency ${concurrency}`).toEqual(['a']);
    }
  });

  it('collects without sending when there is no uploader', async () => {
    const { fixture } = await setup({ uploader: null, demoMode: false });
    fixture.componentInstance.onDrop(dropEvent([file('a')]));
    await quietFor();
    expect(fixture.componentInstance.files()[0].status).toBe('pending');
    expect(fixture.componentInstance.files()[0].progress).toBe(0);
  });

  it('collects without sending when autoUpload is off, then sends on demand', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader, autoUpload: false });
    fixture.componentInstance.onDrop(dropEvent([file('a')]));
    await quietFor();
    expect(calls).toEqual([]);
    expect(fixture.componentInstance.files()[0].status).toBe('pending');

    fixture.componentInstance.uploadAll();
    await until(() => calls.length === 1, { label: 'uploadAll to start the file' });
  });

  it('is safe to call uploadAll twice — a double-clicked submit sends once', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader, autoUpload: false });
    fixture.componentInstance.onDrop(dropEvent([file('a'), file('b')]));
    await flush();

    fixture.componentInstance.uploadAll();
    fixture.componentInstance.uploadAll();
    await flush();
    expect(calls.map((c) => c.name)).toEqual(['a', 'b']);
  });

  it('skips files that already finished, failed or are in flight', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader, concurrency: 1 });
    fixture.componentInstance.onDrop(dropEvent([file('a'), file('b')]));
    await flush();
    calls[0].resolve({});
    await until(() => byName(fixture.componentInstance)['a'].status === 'success');

    fixture.componentInstance.uploadAll();
    await flush();
    // 'a' succeeded and 'b' is in flight: nothing new to start.
    expect(calls.map((c) => c.name)).toEqual(['a', 'b']);
  });

  it('does nothing at all from uploadAll while disabled', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader, autoUpload: false });
    fixture.componentInstance.onDrop(dropEvent([file('a')]));
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    fixture.componentInstance.uploadAll();
    await quietFor();
    expect(calls).toEqual([]);
  });
});

describe('SvFileUploadComponent — cancelling', () => {
  it('aborts an in-flight request and puts the row back to pending', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader });
    fixture.componentInstance.onDrop(dropEvent([file('a')]));
    await flush();

    let aborted = false;
    calls[0].ctx.signal.addEventListener('abort', () => { aborted = true; });
    const cancelled: UploadFile[] = [];
    fixture.componentInstance.uploadCancelled.subscribe((u) => cancelled.push(u));

    const id = fixture.componentInstance.files()[0].id;
    fixture.componentInstance.cancelUpload(id);
    fixture.detectChanges();

    expect(aborted, 'the request was left running — a leaked upload').toBe(true);
    expect(fixture.componentInstance.files()[0].status).toBe('pending');
    expect(fixture.componentInstance.files()[0].progress).toBe(0);
    expect(cancelled.map((u) => u.name)).toEqual(['a']);
  });

  it('cancels a file that is still waiting for a slot', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader, concurrency: 1 });
    fixture.componentInstance.onDrop(dropEvent([file('a'), file('b')]));
    await flush();
    expect(calls.map((c) => c.name)).toEqual(['a']);

    const cancelled: UploadFile[] = [];
    fixture.componentInstance.uploadCancelled.subscribe((u) => cancelled.push(u));
    fixture.componentInstance.cancelUpload(byName(fixture.componentInstance)['b'].id);
    await flush();

    expect(cancelled.map((u) => u.name)).toEqual(['b']);
    // Cancelling a queued file must not start it when the slot frees.
    calls[0].resolve({});
    await quietFor();
    expect(calls.map((c) => c.name)).toEqual(['a']);
  });

  it('says nothing about a file that was neither running nor queued', async () => {
    const { uploader } = controllable();
    const { fixture } = await setup({ uploader, autoUpload: false });
    fixture.componentInstance.onDrop(dropEvent([file('a')]));
    const cancelled: UploadFile[] = [];
    fixture.componentInstance.uploadCancelled.subscribe((u) => cancelled.push(u));

    fixture.componentInstance.cancelUpload(fixture.componentInstance.files()[0].id);
    expect(cancelled).toEqual([]);
    expect(fixture.componentInstance.files()[0].status).toBe('pending');
  });

  it('shrugs off a cancel for an id it has never heard of', async () => {
    const { fixture } = await setup({});
    expect(() => fixture.componentInstance.cancelUpload('nope')).not.toThrow();
  });

  it('cancels everything in flight and everything queued at once', async () => {
    const { uploader } = controllable();
    const { fixture } = await setup({ uploader, concurrency: 2 });
    const cancelled: UploadFile[] = [];
    fixture.componentInstance.uploadCancelled.subscribe((u) => cancelled.push(u));
    fixture.componentInstance.onDrop(dropEvent([file('a'), file('b'), file('c')]));
    await flush();

    fixture.componentInstance.cancelAll();
    await quietFor();
    expect(fixture.componentInstance.files().every((u) => u.status === 'pending')).toBe(true);
    expect(cancelled.map((u) => u.name).sort()).toEqual(['a', 'b', 'c']);
  });

  /**
   * ★ DEFECT (fixed): cancelling everything STARTED the files being cancelled.
   *
   * `cancelAll` walked the in-flight and queued ids calling `cancelUpload` on
   * each, and `cancelUpload` ends with `pump()`. So freeing the slot held by
   * file 1 immediately started file 4 — which the loop then reached, aborted,
   * and freed a slot for file 5. Cancelling ten queued uploads opened and
   * aborted all ten requests, on a connection the user had just said to stop
   * using. Both twins.
   */
  it('does not open a request for a queued file while cancelling it', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader, concurrency: 1 });
    fixture.componentInstance.onDrop(dropEvent([file('a'), file('b'), file('c')]));
    await flush();
    expect(calls.map((c) => c.name)).toEqual(['a']);

    fixture.componentInstance.cancelAll();
    await quietFor();
    expect(calls.map((c) => c.name)).toEqual(['a']);
    expect(fixture.componentInstance.files().every((u) => u.status === 'pending')).toBe(true);
  });

  it('clearAll cancels without opening requests either', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader, concurrency: 1 });
    fixture.componentInstance.onDrop(dropEvent([file('a'), file('b'), file('c')]));
    await flush();

    fixture.componentInstance.clearAll();
    await quietFor();
    expect(calls.map((c) => c.name)).toEqual(['a']);
    expect(fixture.componentInstance.files()).toEqual([]);
  });

  it('ignores a resolution that lands after the cancel', async () => {
    // A request that was aborted can still settle; letting it through would
    // flip a row the user cancelled back to "Uploaded".
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader });
    fixture.componentInstance.onDrop(dropEvent([file('a')]));
    await flush();

    const id = fixture.componentInstance.files()[0].id;
    fixture.componentInstance.cancelUpload(id);
    calls[0].resolve({ id: 'remote-1' });
    await quietFor();

    expect(fixture.componentInstance.files()[0].status).toBe('pending');
    expect(fixture.componentInstance.files()[0].remoteId).toBeUndefined();
  });

  it('ignores a rejection that lands after the cancel — a cancel is not a failure', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader });
    fixture.componentInstance.onDrop(dropEvent([file('a')]));
    await flush();

    const failed: UploadFile[] = [];
    fixture.componentInstance.uploadError.subscribe((u) => failed.push(u));
    fixture.componentInstance.cancelUpload(fixture.componentInstance.files()[0].id);
    calls[0].reject(new Error('aborted'));
    await quietFor();

    expect(fixture.componentInstance.files()[0].status).toBe('pending');
    expect(failed).toEqual([]);
  });

  it('ignores progress reported after the cancel', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader });
    fixture.componentInstance.onDrop(dropEvent([file('a')]));
    await flush();

    fixture.componentInstance.cancelUpload(fixture.componentInstance.files()[0].id);
    calls[0].ctx.onProgress(80);
    expect(fixture.componentInstance.files()[0].progress).toBe(0);
  });
});

describe('SvFileUploadComponent — progress', () => {
  it('clamps everything a host can report into 0–100', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader });
    fixture.componentInstance.onDrop(dropEvent([file('a')]));
    await flush();
    const report = calls[0].ctx.onProgress;
    const progress = () => fixture.componentInstance.files()[0].progress;

    report(42.6);
    expect(progress()).toBe(43);
    report(420);
    expect(progress()).toBe(100);
    report(-5);
    expect(progress()).toBe(0);
    // A zero-byte file gives loaded/total = 0/0 = NaN, which would blank the bar.
    report(NaN);
    expect(progress()).toBe(0);
    report(Infinity);
    expect(progress()).toBe(0);
  });

  it('averages the bar across every file, and reads 0 with none', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader, concurrency: 3 });
    expect(fixture.componentInstance.overallProgress()).toBe(0);

    fixture.componentInstance.onDrop(dropEvent([file('a'), file('b')]));
    await flush();
    calls[0].ctx.onProgress(50);
    calls[1].ctx.onProgress(100);
    fixture.detectChanges();

    expect(fixture.componentInstance.overallProgress()).toBe(75);
    const bar = el(fixture).querySelector('[role="progressbar"][aria-label="Overall upload progress"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('75');
  });

  it('announces the state politely, in words', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader, concurrency: 3 });
    const status = () => fixture.componentInstance.statusMessage();
    expect(status()).toBe('');

    fixture.componentInstance.onDrop(dropEvent([file('a')]));
    await flush();
    calls[0].ctx.onProgress(40);
    expect(status()).toBe('Uploading 1 file, 40 percent');

    calls[0].resolve({});
    await until(() => !fixture.componentInstance.isUploading());
    expect(status()).toBe('1 file selected, 1 uploaded');
  });

  it('pluralises, and reports failures alongside successes', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader, concurrency: 3 });
    fixture.componentInstance.onDrop(dropEvent([file('a'), file('b'), file('c')]));
    await flush();
    expect(fixture.componentInstance.statusMessage()).toContain('Uploading 3 files');

    calls[0].resolve({});
    calls[1].reject(new Error('nope'));
    calls[2].resolve({});
    await until(() => !fixture.componentInstance.isUploading());
    expect(fixture.componentInstance.statusMessage())
      .toBe('3 files selected, 2 uploaded, 1 failed');
  });
});

describe('SvFileUploadComponent — finishing', () => {
  it('keeps what the server said about a stored file', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader });
    fixture.componentInstance.onDrop(dropEvent([file('a')]));
    await flush();

    calls[0].resolve({ id: 'remote-9', url: 'https://example.test/f/9' });
    await until(() => fixture.componentInstance.files()[0].status === 'success');
    fixture.detectChanges();
    const entry = fixture.componentInstance.files()[0];
    expect([entry.remoteId, entry.url, entry.progress]).toEqual(['remote-9', 'https://example.test/f/9', 100]);
    expect(el(fixture).textContent).toContain('Uploaded');
  });

  it('copes with an uploader that resolves nothing at all', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader });
    fixture.componentInstance.onDrop(dropEvent([file('a')]));
    await flush();

    calls[0].resolve(undefined);
    await until(() => fixture.componentInstance.files()[0].status === 'success');
    const entry = fixture.componentInstance.files()[0];
    expect(entry.remoteId).toBeUndefined();
    expect(entry.url).toBeUndefined();
  });

  it('announces completion once, after the LAST file settles', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader, concurrency: 1 });
    const complete: UploadFile[][] = [];
    fixture.componentInstance.uploadComplete.subscribe((all) => complete.push(all));

    fixture.componentInstance.onDrop(dropEvent([file('a'), file('b')]));
    await flush();
    calls[0].resolve({});
    await until(() => calls.length === 2, { label: 'the second upload to start' });
    expect(complete).toEqual([]);

    calls[1].resolve({});
    await until(() => complete.length === 1, { label: 'the batch to report completion' });
    expect(complete[0].map((u) => u.name)).toEqual(['a', 'b']);
  });

  it('counts a failure as settled — a batch with one bad file still completes', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader, concurrency: 2 });
    const complete: UploadFile[][] = [];
    fixture.componentInstance.uploadComplete.subscribe((all) => complete.push(all));

    fixture.componentInstance.onDrop(dropEvent([file('a'), file('b')]));
    await flush();
    calls[0].resolve({});
    calls[1].reject(new Error('Storage rejected it'));
    await until(() => complete.length === 1, { label: 'completion despite a failure' });
    expect(byName(fixture.componentInstance)['b'].errorMsg).toBe('Storage rejected it');
  });
});

describe('SvFileUploadComponent — what a rejection is allowed to say', () => {
  const failWith = async (reason: unknown) => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader });
    fixture.componentInstance.onDrop(dropEvent([file('a')]));
    await flush();
    calls[0].reject(reason);
    await until(() => fixture.componentInstance.files()[0].status === 'error');
    fixture.detectChanges();
    return { message: fixture.componentInstance.files()[0].errorMsg, fixture };
  };

  it('shows a thrown Error\'s message', async () => {
    expect((await failWith(new Error('Storage is full'))).message).toBe('Storage is full');
  });

  it('shows a plain string rejection', async () => {
    expect((await failWith('Quota exceeded')).message).toBe('Quota exceeded');
  });

  it('digs a message out of a plain object', async () => {
    expect((await failWith({ message: 'Bad request' })).message).toBe('Bad request');
  });

  it('trims, and falls back rather than showing an empty reason', async () => {
    expect((await failWith('  Trimmed  ')).message).toBe('Trimmed');
    expect((await failWith(new Error('   '))).message).toBe('Upload failed.');
    expect((await failWith('   ')).message).toBe('Upload failed.');
    expect((await failWith({ message: 42 })).message).toBe('Upload failed.');
    expect((await failWith(null)).message).toBe('Upload failed.');
    expect((await failWith(undefined)).message).toBe('Upload failed.');
  });

  it('always puts SOMETHING readable next to the file', async () => {
    const { fixture } = await failWith(null);
    expect(el(fixture).textContent).toContain('Upload failed.');
    expect(el(fixture).querySelector('[aria-label^="Retry"]')).not.toBeNull();
  });
});

describe('SvFileUploadComponent — retrying, removing, clearing', () => {
  it('puts a failed file back in the queue and sends it again', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader });
    fixture.componentInstance.onDrop(dropEvent([file('a')]));
    await flush();
    calls[0].reject(new Error('nope'));
    await until(() => fixture.componentInstance.files()[0].status === 'error');

    fixture.componentInstance.retryFile(fixture.componentInstance.files()[0].id);
    await until(() => calls.length === 2, { label: 'the retry to start a second request' });
    expect(fixture.componentInstance.files()[0].errorMsg).toBeUndefined();
  });

  it('only resets the row when there is nothing to send it with', async () => {
    const { fixture } = await setup({ uploader: null, demoMode: false });
    fixture.componentInstance.onDrop(dropEvent([file('a')]));
    const id = fixture.componentInstance.files()[0].id;

    fixture.componentInstance.retryFile(id);
    await quietFor();
    expect(fixture.componentInstance.files()[0].status).toBe('pending');
  });

  it('does nothing on retry, remove or clear while disabled', async () => {
    const { uploader } = controllable();
    const { fixture } = await setup({ uploader, autoUpload: false });
    fixture.componentInstance.onDrop(dropEvent([file('a')]));
    const id = fixture.componentInstance.files()[0].id;
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    fixture.componentInstance.retryFile(id);
    fixture.componentInstance.removeFile(id);
    fixture.componentInstance.clearAll();
    expect(fixture.componentInstance.files()).toHaveLength(1);
  });

  it('aborts the request when the row is removed, not just the row', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader });
    fixture.componentInstance.onDrop(dropEvent([file('a')]));
    await flush();

    let aborted = false;
    calls[0].ctx.signal.addEventListener('abort', () => { aborted = true; });
    const removed: string[] = [];
    const id = fixture.componentInstance.files()[0].id;
    fixture.componentInstance.fileRemoved.subscribe((r) => removed.push(r));

    fixture.componentInstance.removeFile(id);
    expect(aborted, 'removing the row leaked the request').toBe(true);
    expect(fixture.componentInstance.files()).toEqual([]);
    expect(removed).toEqual([id]);
  });

  it('drops a removed file out of the queue so it never starts', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader, concurrency: 1 });
    fixture.componentInstance.onDrop(dropEvent([file('a'), file('b')]));
    await flush();

    fixture.componentInstance.removeFile(byName(fixture.componentInstance)['b'].id);
    calls[0].resolve({});
    await quietFor();
    expect(calls.map((c) => c.name)).toEqual(['a']);
  });

  it('clears the whole list and reports an empty one', async () => {
    const { uploader } = controllable();
    const { fixture } = await setup({ uploader, autoUpload: false });
    const changes: UploadFile[][] = [];
    fixture.componentInstance.filesChange.subscribe((all) => changes.push(all));
    fixture.componentInstance.onDrop(dropEvent([file('a'), file('b')]));

    fixture.componentInstance.clearAll();
    fixture.detectChanges();
    expect(fixture.componentInstance.files()).toEqual([]);
    expect(changes.at(-1)).toEqual([]);
    expect(fixture.componentInstance.hasFiles()).toBe(false);
  });

  it('aborts every in-flight request when it is destroyed', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader, concurrency: 3 });
    fixture.componentInstance.onDrop(dropEvent([file('a'), file('b')]));
    await flush();

    const aborted: string[] = [];
    for (const c of calls) c.ctx.signal.addEventListener('abort', () => aborted.push(c.name));
    fixture.destroy();
    expect(aborted.sort()).toEqual(['a', 'b']);
  });
});

describe('SvFileUploadComponent — removing a file mid-run', () => {
  // ★ Removing an in-flight upload aborted it and freed its slot, but nothing
  //   started the next queued file and nothing reported the run — so a batch
  //   whose stuck file the user deleted sat at "queued" and never completed.
  it('starts the next queued file when an in-flight one is removed', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader, concurrency: 1 });
    const c = fixture.componentInstance;
    c.onDrop(dropEvent([file('a'), file('b')]));
    await flush();
    expect(calls.map((x) => x.name)).toEqual(['a']);

    c.removeFile(byName(c)['a'].id);
    await until(() => calls.length === 2, { label: 'the queued file to start' });
    expect(calls[1].name).toBe('b');
    expect(calls[0].ctx.signal.aborted).toBe(true);
  });

  it('completes the run when the last unfinished file is removed', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader, concurrency: 2 });
    const c = fixture.componentInstance;
    const complete: UploadFile[][] = [];
    c.uploadComplete.subscribe((all) => complete.push(all));
    c.onDrop(dropEvent([file('a'), file('b')]));
    await flush();
    calls[0].resolve({});
    await until(() => byName(c)['a'].status === 'success', { label: 'a to land' });
    expect(complete).toEqual([]);

    c.removeFile(byName(c)['b'].id);
    await until(() => complete.length === 1, { label: 'the run to report completion' });
    expect(complete[0].map((u) => u.name)).toEqual(['a']);
  });

  it('does not report a finished run again when a file is removed afterwards', async () => {
    const { calls, uploader } = controllable();
    const { fixture } = await setup({ uploader, concurrency: 2 });
    const c = fixture.componentInstance;
    const complete: UploadFile[][] = [];
    c.uploadComplete.subscribe((all) => complete.push(all));
    c.onDrop(dropEvent([file('a'), file('b')]));
    await flush();
    calls[0].resolve({});
    calls[1].resolve({});
    await until(() => complete.length === 1, { label: 'the run to complete' });

    c.removeFile(byName(c)['a'].id);
    await quietFor(20);
    expect(complete.length).toBe(1);
  });
});

