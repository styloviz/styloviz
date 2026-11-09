import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { render, type ComponentInput } from '@testing-library/angular';
import { vi } from 'vitest';
import { SvFileUploadComponent, type SvUploader } from './file-upload.component';
import { svHttpUploader, type SvStoredFile } from './file-upload.extras';

/**
 * `SR-27` — the P0 set: files already on the server, every word translatable,
 * a host's own check, form-level rules, the collect-then-send actions, and a
 * ready XHR uploader. The Pro twin's `file-upload.sr27.spec.ts` runs the same
 * cases, so a Pro upgrade changes no rule.
 */

async function setup(inputs: Partial<ComponentInput<SvFileUploadComponent>> = {}) {
  TestBed.resetTestingModule();
  const view = await render(SvFileUploadComponent, { inputs: inputs as ComponentInput<SvFileUploadComponent> });
  view.fixture.detectChanges();
  return { ...view, c: view.fixture.componentInstance, host: view.fixture.nativeElement as HTMLElement };
}

const file = (name: string, bytes = 4, type = 'text/plain') =>
  new File([new Uint8Array(bytes)], name, { type, lastModified: 1 });
const pick = (c: SvFileUploadComponent, files: File[]) =>
  c.onFileInputChange({ target: { files, value: '' } } as unknown as Event);
const flush = () => new Promise((r) => setTimeout(r, 0));

const STORED: SvStoredFile[] = [
  { id: 'srv-1', name: 'contract.pdf', size: 120_000, type: 'application/pdf', url: '/files/srv-1' },
  { id: 'srv-2', name: 'logo.png', size: 4_000, type: 'image/png', url: '/files/srv-2', preview: '/files/srv-2/thumb' },
];

afterEach(() => vi.restoreAllMocks());

describe('SvFileUploadComponent — files already on the server (SR-27)', () => {
  it('★ render as uploaded rows that open, and are never in the form value', async () => {
    const { c, host, fixture } = await setup({ initialFiles: STORED });
    fixture.detectChanges();
    expect(host.querySelectorAll('[data-sv-file-stored]').length).toBe(2);
    const link = host.querySelector<HTMLAnchorElement>('[data-sv-file-id="srv-1"] [data-sv-file-open]')!;
    expect(link.getAttribute('href')).toBe('/files/srv-1');
    expect(link.getAttribute('aria-label')).toBe('Open contract.pdf');
    expect(host.textContent).toContain('On the server');

    const seen: File[][] = [];
    c.registerOnChange((v) => seen.push(v));
    pick(c, [file('new.txt')]);
    expect(seen.at(-1)!.map((f) => f.name)).toEqual(['new.txt']);
  });

  it('removing one reports its server id', async () => {
    const { c } = await setup({ initialFiles: STORED });
    const removed: string[] = [];
    c.fileRemoved.subscribe((id) => removed.push(id));
    c.removeFile('srv-1');
    expect(removed).toEqual(['srv-1']);
    expect(c.files().map((f) => f.id)).toEqual(['srv-2']);
  });

  it('a new array replaces the stored rows and keeps what the user added', async () => {
    const { c, fixture } = await setup({ initialFiles: STORED });
    pick(c, [file('mine.txt')]);
    fixture.componentRef.setInput('initialFiles', [STORED[0]]);
    fixture.detectChanges();
    expect(c.files().map((f) => f.name)).toEqual(['contract.pdf', 'mine.txt']);
  });

  it('uploadAll never re-sends a stored file', async () => {
    const uploader = vi.fn<SvUploader>(async () => ({}));
    const { c } = await setup({ initialFiles: STORED, uploader, autoUpload: false });
    pick(c, [file('a.txt')]);
    c.uploadAll();
    await flush();
    expect(uploader.mock.calls.map(([ctx]) => ctx.file.name)).toEqual(['a.txt']);
  });
});

describe('SvFileUploadComponent — labels (SR-27)', () => {
  it('★ every row and footer word comes from labels, defaults unchanged', async () => {
    const { c, host, fixture } = await setup({
      labels: {
        removeFile: (n) => `${n} entfernen`,
        fileCount: (n) => `${n} Datei(en)`,
        clearAll: 'Alle löschen',
        pending: 'Wartend',
        fileList: 'Dateien',
      },
    });
    pick(c, [file('a.txt')]);
    fixture.detectChanges();
    expect(host.querySelector('[data-sv-file-remove]')!.getAttribute('aria-label')).toBe('a.txt entfernen');
    expect(host.querySelector('[data-sv-file-list]')!.getAttribute('aria-label')).toBe('Dateien');
    expect(host.textContent).toContain('1 Datei(en)');
    expect(host.textContent).toContain('Alle löschen');
    expect(host.textContent).toContain('Wartend');
    // Not overridden: the default.
    expect(host.querySelector('[data-sv-file-clear]')!.getAttribute('aria-label')).toBe('Remove all files');
  });

  it('intake refusals use the labels too', async () => {
    const { c } = await setup({ maxSizeMb: 1, labels: { tooLarge: (l) => `Zu groß (max. ${l})` } });
    pick(c, [file('big.bin', 2 * 1024 * 1024)]);
    expect(c.files()[0].errorMsg).toBe('Zu groß (max. 1 MB)');
  });
});

describe('SvFileUploadComponent — a host\'s own check (SR-27)', () => {
  it('★ a sync message refuses the file at intake', async () => {
    const { c } = await setup({ validator: (f: File) => (f.name.startsWith('draft') ? 'Drafts are not accepted' : null) });
    pick(c, [file('draft-1.txt'), file('final.txt')]);
    expect(c.files().map((f) => [f.name, f.status, f.errorMsg ?? ''])).toEqual([
      ['draft-1.txt', 'error', 'Drafts are not accepted'],
      ['final.txt', 'pending', ''],
    ]);
  });

  it('★ an async check holds the file at Checking… and uploads only once it clears', async () => {
    let resolve!: (v: string | null) => void;
    const uploader = vi.fn<SvUploader>(async () => ({}));
    const { c, host, fixture } = await setup({ uploader, validator: () => new Promise<string | null>((r) => (resolve = r)) });
    pick(c, [file('a.txt')]);
    fixture.detectChanges();
    expect(c.files()[0].checking).toBe(true);
    expect(host.querySelector('[data-sv-file-checking]')!.textContent).toContain('Checking…');
    expect(uploader).not.toHaveBeenCalled();
    resolve(null);
    await flush();
    await flush();
    expect(uploader).toHaveBeenCalledTimes(1);
  });

  it('a rejected promise refuses with its message', async () => {
    const { c } = await setup({ validator: () => Promise.reject(new Error('Already uploaded on the server')) });
    pick(c, [file('a.txt')]);
    await flush();
    await flush();
    expect(c.files()[0]).toMatchObject({ status: 'error', errorMsg: 'Already uploaded on the server', checking: false });
  });
});

describe('SvFileUploadComponent — form rules (SR-27)', () => {
  @Component({
    standalone: true,
    imports: [SvFileUploadComponent, ReactiveFormsModule],
    template: `<sv-file-upload [formControl]="control" [required]="required()" [minFiles]="minFiles()" [maxTotalSizeMb]="1" [initialFiles]="stored()" />`,
  })
  class Host {
    readonly control = new FormControl<File[]>([]);
    readonly stored = signal<SvStoredFile[]>([]);
    readonly required = signal(false);
    readonly minFiles = signal(2);
  }

  it('★ minFiles reports on the control, and counts files already on the server', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(Host);
    fixture.detectChanges();
    const { control } = fixture.componentInstance;
    control.updateValueAndValidity();
    expect(control.errors).toEqual({ minFiles: { required: 2, actual: 0 } });

    fixture.componentInstance.stored.set([STORED[1]]);
    fixture.detectChanges();
    control.updateValueAndValidity();
    expect(control.errors).toEqual({ minFiles: { required: 2, actual: 1 } });
  });

  it('required reports { required } until a file is added', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(Host);
    fixture.componentInstance.required.set(true);
    fixture.componentInstance.minFiles.set(0);
    fixture.detectChanges();
    const { control } = fixture.componentInstance;
    control.updateValueAndValidity();
    expect(control.errors).toEqual({ required: true });
    control.setValue([file('a.txt')]);
    expect(control.errors).toBeNull();
  });

  it('maxTotalSizeMb refuses the file that would cross the cap', async () => {
    const { c } = await setup({ maxTotalSizeMb: 1 });
    pick(c, [file('a.bin', 600_000), file('b.bin', 600_000)]);
    expect(c.files().map((f) => f.status)).toEqual(['pending', 'error']);
    expect(c.files()[1].errorMsg).toBe('Exceeds the 1 MB total');
  });

  it('minSizeMb refuses a file below it', async () => {
    const { c } = await setup({ minSizeMb: 0.5 });
    pick(c, [file('tiny.bin', 10)]);
    expect(c.files()[0].errorMsg).toBe('File is smaller than 0.5 MB');
  });

  it('marks the trigger aria-required', async () => {
    const { host } = await setup({ required: true });
    expect(host.querySelector('[data-sv-upload-trigger]')!.getAttribute('aria-required')).toBe('true');
  });
});

describe('SvFileUploadComponent — collect, then send (SR-27)', () => {
  it('★ Upload all / Retry failed when autoUpload is off; a refused file is never sent', async () => {
    let fail = true;
    const uploader = vi.fn<SvUploader>(async () => {
      if (fail) throw new Error('Server error');
      return {};
    });
    const { c, host, fixture } = await setup({ uploader, autoUpload: false, maxSizeMb: 1 });
    pick(c, [file('a.txt'), file('big.bin', 2 * 1024 * 1024)]);
    fixture.detectChanges();
    const all = host.querySelector<HTMLButtonElement>('[data-sv-upload-all]')!;
    const retry = host.querySelector<HTMLButtonElement>('[data-sv-retry-failed]')!;
    expect(all.disabled).toBe(false);
    expect(retry.disabled).toBe(true);   // a refused-at-intake file is not a failed upload

    all.click();
    await flush();
    fixture.detectChanges();
    expect(c.files()[0].status).toBe('error');
    expect(retry.disabled).toBe(false);

    fail = false;
    retry.click();
    await flush();
    expect(c.files().map((f) => f.status)).toEqual(['success', 'error']);
    expect(uploader).toHaveBeenCalledTimes(2);   // big.bin never sent
  });

  it('is hidden with autoUpload on, and when there is nothing to send with', async () => {
    const auto = await setup({ uploader: async () => ({}) });
    pick(auto.c, [file('a.txt')]);
    auto.fixture.detectChanges();
    expect(auto.host.querySelector('[data-sv-upload-actions]')).toBeNull();

    const none = await setup({ autoUpload: false });
    pick(none.c, [file('a.txt')]);
    none.fixture.detectChanges();
    expect(none.host.querySelector('[data-sv-upload-actions]')).toBeNull();
  });
});

describe('svHttpUploader (SR-27)', () => {
  class FakeXhr {
    static last: FakeXhr;
    method = '';
    url = '';
    headers: Record<string, string> = {};
    body: unknown;
    status = 0;
    statusText = '';
    responseText = '';
    withCredentials = false;
    upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    aborted = false;
    constructor() { FakeXhr.last = this; }
    open(m: string, u: string) { this.method = m; this.url = u; }
    setRequestHeader(n: string, v: string) { this.headers[n] = v; }
    send(b: unknown) { this.body = b; }
    abort() { this.aborted = true; this.onabort?.(); }
  }
  beforeEach(() => vi.stubGlobal('XMLHttpRequest', FakeXhr));
  afterEach(() => vi.unstubAllGlobals());

  it('★ posts multipart with headers, reports progress, and reads { id, url }', async () => {
    const progress: number[] = [];
    const send = svHttpUploader({ url: '/api/files', headers: () => ({ Authorization: 'Bearer t' }), fields: { folder: 'invoices' } });
    const done = send({ file: file('a.txt'), onProgress: (p) => progress.push(p), signal: new AbortController().signal });
    const xhr = FakeXhr.last;
    expect([xhr.method, xhr.url, xhr.headers['Authorization']]).toEqual(['POST', '/api/files', 'Bearer t']);
    const body = xhr.body as FormData;
    expect((body.get('file') as File).name).toBe('a.txt');
    expect(body.get('folder')).toBe('invoices');
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
    xhr.status = 201;
    xhr.responseText = JSON.stringify({ id: 42, url: '/files/42' });
    xhr.onload?.();
    await expect(done).resolves.toEqual({ id: '42', url: '/files/42' });
    expect(progress).toEqual([50]);
  });

  it('★ sends a file\'s own details as multipart fields (SR-27b)', () => {
    const send = svHttpUploader({ url: '/api/files', fields: { folder: 'inbox', alt: 'shared' } });
    void send({ file: file('a.png'), onProgress: () => undefined, signal: new AbortController().signal, meta: { alt: 'A cat', caption: 'Mat' } });
    const body = FakeXhr.last.body as FormData;
    expect(body.getAll('alt')).toEqual(['shared', 'A cat']);
    expect(body.get('caption')).toBe('Mat');
    expect(body.get('folder')).toBe('inbox');
  });

  it('rejects on a non-2xx with the status, and aborts with the signal', async () => {
    const send = svHttpUploader({ url: '/api/files' });
    const failed = send({ file: file('a.txt'), onProgress: () => undefined, signal: new AbortController().signal });
    FakeXhr.last.status = 413;
    FakeXhr.last.statusText = 'Payload Too Large';
    FakeXhr.last.onload?.();
    await expect(failed).rejects.toThrow('Upload failed (413 Payload Too Large)');

    const ctl = new AbortController();
    const cancelled = send({ file: file('a.txt'), onProgress: () => undefined, signal: ctl.signal });
    ctl.abort();
    expect(FakeXhr.last.aborted).toBe(true);
    await expect(cancelled).rejects.toThrow('Cancelled');
  });

  it('raw mode PUTs the bytes, for a pre-signed URL', () => {
    const send = svHttpUploader({ url: (f) => `/signed/${f.name}`, method: 'PUT', raw: true });
    const f = file('a.png', 4, 'image/png');
    void send({ file: f, onProgress: () => undefined, signal: new AbortController().signal });
    expect([FakeXhr.last.method, FakeXhr.last.url, FakeXhr.last.headers['Content-Type']]).toEqual(['PUT', '/signed/a.png', 'image/png']);
    expect(FakeXhr.last.body).toBe(f);
  });
});
