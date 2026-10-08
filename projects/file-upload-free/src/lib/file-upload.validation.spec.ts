import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { until } from '../../../../src/testing/async';
import { SvFileUploadComponent, type UploadFile } from './file-upload.component';

/**
 * Which files get in, and what the user is told about the ones that do not.
 *
 * A rejected file is not simply dropped: it stays in the list carrying a
 * readable reason, so "nothing happened when I picked my file" cannot occur.
 * Every assertion here therefore has two halves — the file is not uploaded,
 * AND the reason is on screen.
 */

async function setup(inputs: Partial<ComponentInput<SvFileUploadComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvFileUploadComponent, {
    inputs: inputs as ComponentInput<SvFileUploadComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

type Fixture = {
  nativeElement: unknown;
  detectChanges(): void;
  componentInstance: SvFileUploadComponent;
};

/** A file of a given size in bytes — `new File` takes the content, not a size. */
const sized = (bytes: number, name = 'big.bin', type = 'application/octet-stream') =>
  new File([new Uint8Array(bytes)], name, { type });

const file = (name: string, type: string, bytes = 4) =>
  new File([new Uint8Array(bytes)], name, { type });

/** Synthetic drop — jsdom has `DataTransfer` but its `files` list is read-only. */
function dropEvent(files: File[]): DragEvent {
  return {
    preventDefault() { /* the component calls it; the stub only has to not throw */ },
    dataTransfer: { files },
  } as unknown as DragEvent;
}

/** A real `change` on the hidden <input type=file>, files assigned by descriptor. */
function pick(f: Fixture, files: File[]) {
  const native = el(f).querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(native, 'files', { value: files, configurable: true });
  native.dispatchEvent(new Event('change', { bubbles: true }));
  f.detectChanges();
  return native;
}

describe('SvFileUploadComponent — the size limit', () => {
  it('accepts a file exactly at the limit and rejects the one past it', async () => {
    // 1 MB limit, then 1 MB exactly and 1 MB + 1 byte. The boundary is `>`,
    // so the file that is precisely at the limit must get through.
    const at = await setup({ maxSizeMb: 1 });
    at.fixture.componentInstance.onDrop(dropEvent([sized(1024 * 1024, 'exact.bin')]));
    at.fixture.detectChanges();
    expect(at.fixture.componentInstance.files()[0].status).toBe('pending');

    const over = await setup({ maxSizeMb: 1 });
    const rejected: UploadFile[] = [];
    over.fixture.componentInstance.uploadError.subscribe((u) => rejected.push(u));
    over.fixture.componentInstance.onDrop(dropEvent([sized(1024 * 1024 + 1, 'over.bin')]));
    over.fixture.detectChanges();

    const entry = over.fixture.componentInstance.files()[0];
    expect(entry.status).toBe('error');
    expect(entry.progress).toBe(0);
    expect(entry.errorMsg).toBe('File exceeds 1 MB limit');
    expect(rejected.map((u) => u.name)).toEqual(['over.bin']);
    // The user can read why, next to the file that failed.
    expect(el(over.fixture).textContent).toContain('File exceeds 1 MB limit');
  });

  it('lets a zero-byte file through — empty is not oversized', async () => {
    const { fixture } = await setup({ maxSizeMb: 1 });
    fixture.componentInstance.onDrop(dropEvent([sized(0, 'empty.txt', 'text/plain')]));
    fixture.detectChanges();

    const entry = fixture.componentInstance.files()[0];
    expect(entry.status).toBe('pending');
    expect(entry.size).toBe(0);
    expect(fixture.componentInstance.formatSize(0)).toBe('0 B');
    expect(el(fixture).textContent).toContain('0 B');
  });

  it('rejects everything against a limit of zero, except an empty file', async () => {
    const { fixture } = await setup({ maxSizeMb: 0 });
    fixture.componentInstance.onDrop(dropEvent([sized(1, 'a.bin'), sized(0, 'b.bin')]));
    fixture.detectChanges();

    expect(fixture.componentInstance.files().map((u) => u.status)).toEqual(['error', 'pending']);
  });

  it('never sends a file it rejected on size', async () => {
    const sent: string[] = [];
    const uploader = ({ file: f }: { file: File }) => {
      sent.push(f.name);
      return Promise.resolve({});
    };
    const { fixture } = await setup({ maxSizeMb: 0, uploader, autoUpload: true });
    fixture.componentInstance.onDrop(dropEvent([sized(10, 'too-big.bin')]));
    await new Promise((r) => setTimeout(r, 0));
    expect(sent).toEqual([]);
  });
});

describe('SvFileUploadComponent — the accept filter', () => {
  const accepts = async (accept: string, f: File) => {
    const { fixture } = await setup({ accept });
    fixture.componentInstance.onDrop(dropEvent([f]));
    fixture.detectChanges();
    return fixture.componentInstance.files()[0];
  };

  it('accepts anything when no filter is set', async () => {
    expect((await accepts('', file('a.exe', 'application/x-msdownload'))).status).toBe('pending');
  });

  it('treats a whitespace-only filter as no filter', async () => {
    // `'   '.split(',')` yields one blank token; filtering it out has to leave
    // "no constraint", not "nothing matches anything".
    expect((await accepts('   ', file('a.exe', 'application/x-msdownload'))).status).toBe('pending');
    expect((await accepts(' , , ', file('a.exe', 'application/x-msdownload'))).status).toBe('pending');
  });

  it('matches an exact MIME type, and rejects a near miss', async () => {
    expect((await accepts('application/pdf', file('a.pdf', 'application/pdf'))).status).toBe('pending');
    const miss = await accepts('application/pdf', file('a.png', 'image/png'));
    expect(miss.status).toBe('error');
    expect(miss.errorMsg).toBe('File type not allowed');
  });

  it('matches a MIME wildcard on its prefix only', async () => {
    expect((await accepts('image/*', file('a.png', 'image/png'))).status).toBe('pending');
    expect((await accepts('image/*', file('a.svg', 'image/svg+xml'))).status).toBe('pending');
    expect((await accepts('image/*', file('a.txt', 'text/plain'))).status).toBe('error');
  });

  it('matches an extension against the NAME, whatever the browser said the type was', async () => {
    // A `.csv` often arrives as `application/vnd.ms-excel` or as an empty type;
    // an extension token has to work off the filename.
    expect((await accepts('.csv', file('report.csv', ''))).status).toBe('pending');
    expect((await accepts('.csv', file('report.csv.txt', 'text/plain'))).status).toBe('error');
  });

  it('is case-insensitive on both the token and the file', async () => {
    expect((await accepts('.PDF', file('a.pdf', 'application/pdf'))).status).toBe('pending');
    expect((await accepts('.pdf', file('A.PDF', 'application/pdf'))).status).toBe('pending');
    expect((await accepts('IMAGE/*', file('a.png', 'IMAGE/PNG'))).status).toBe('pending');
  });

  it('accepts a file matching ANY token in a list', async () => {
    const list = 'image/*,.pdf,text/csv';
    expect((await accepts(list, file('a.png', 'image/png'))).status).toBe('pending');
    expect((await accepts(list, file('a.pdf', 'application/pdf'))).status).toBe('pending');
    expect((await accepts(list, file('a.csv', 'text/csv'))).status).toBe('pending');
    expect((await accepts(list, file('a.zip', 'application/zip'))).status).toBe('error');
  });

  it('checks size before type, so the message names the first problem found', async () => {
    const { fixture } = await setup({ maxSizeMb: 0, accept: 'image/*' });
    fixture.componentInstance.onDrop(dropEvent([file('a.txt', 'text/plain', 10)]));
    fixture.detectChanges();
    expect(fixture.componentInstance.files()[0].errorMsg).toMatch(/exceeds/);
  });

  it('forwards the filter to the native picker so the OS dialog agrees', async () => {
    const withAccept = await setup({ accept: 'image/*' });
    expect(el(withAccept.fixture).querySelector('input[type="file"]')!.getAttribute('accept'))
      .toBe('image/*');

    const without = await setup({});
    expect(el(without.fixture).querySelector('input[type="file"]')!.hasAttribute('accept'))
      .toBe(false);
  });
});

describe('SvFileUploadComponent — how many files', () => {
  it('takes only the first file when multiple is off, however many were dropped', async () => {
    const { fixture } = await setup({ multiple: false });
    fixture.componentInstance.onDrop(dropEvent([
      file('a.txt', 'text/plain'), file('b.txt', 'text/plain'), file('c.txt', 'text/plain'),
    ]));
    fixture.detectChanges();

    expect(fixture.componentInstance.files().map((u) => u.name)).toEqual(['a.txt']);
    expect(el(fixture).querySelector('input[type="file"]')!.hasAttribute('multiple')).toBe(false);
  });

  it('fills the remaining slots and drops the overflow', async () => {
    const { fixture } = await setup({ maxFiles: 3 });
    fixture.componentInstance.onDrop(dropEvent([file('a.txt', 'text/plain'), file('b.txt', 'text/plain')]));
    fixture.componentInstance.onDrop(dropEvent([
      file('c.txt', 'text/plain'), file('d.txt', 'text/plain'), file('e.txt', 'text/plain'),
    ]));
    fixture.detectChanges();

    expect(fixture.componentInstance.files().map((u) => u.name)).toEqual(['a.txt', 'b.txt', 'c.txt']);
    expect(fixture.componentInstance.canAddMore()).toBe(false);
  });

  it('adds nothing once the cap is reached, and says so on the trigger', async () => {
    const { fixture } = await setup({ maxFiles: 1 });
    fixture.componentInstance.onDrop(dropEvent([file('a.txt', 'text/plain')]));
    fixture.detectChanges();

    const trigger = el(fixture).querySelector<HTMLButtonElement>('button')!;
    expect(trigger.disabled).toBe(true);

    fixture.componentInstance.onDrop(dropEvent([file('b.txt', 'text/plain')]));
    fixture.detectChanges();
    expect(fixture.componentInstance.files().map((u) => u.name)).toEqual(['a.txt']);
  });

  it('does not open the picker once full, or while disabled', async () => {
    const full = await setup({ maxFiles: 1 });
    full.fixture.componentInstance.onDrop(dropEvent([file('a.txt', 'text/plain')]));
    let clicks = 0;
    const nativeFull = el(full.fixture).querySelector<HTMLInputElement>('input[type="file"]')!;
    nativeFull.click = () => { clicks++; };
    full.fixture.componentInstance.openFilePicker();
    expect(clicks).toBe(0);

    const off = await setup({ disabled: true });
    const nativeOff = el(off.fixture).querySelector<HTMLInputElement>('input[type="file"]')!;
    nativeOff.click = () => { clicks++; };
    off.fixture.componentInstance.openFilePicker();
    expect(clicks).toBe(0);

    const ok = await setup({});
    const nativeOk = el(ok.fixture).querySelector<HTMLInputElement>('input[type="file"]')!;
    nativeOk.click = () => { clicks++; };
    ok.fixture.componentInstance.openFilePicker();
    expect(clicks).toBe(1);
  });
});

describe('SvFileUploadComponent — how the files arrive', () => {
  it('reads them off the native input and then empties it', async () => {
    // Without the reset, re-picking the same file fires no `change` event and
    // the second attempt silently does nothing.
    const { fixture } = await setup({});
    const native = pick(fixture, [file('a.txt', 'text/plain')]);
    expect(fixture.componentInstance.files().map((u) => u.name)).toEqual(['a.txt']);
    expect(native.value).toBe('');
  });

  it('copes with a change event carrying no files at all', async () => {
    const { fixture } = await setup({});
    const native = el(fixture).querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(native, 'files', { value: null, configurable: true });
    expect(() => native.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow();
    expect(fixture.componentInstance.files()).toEqual([]);
  });

  it('copes with a drop carrying no dataTransfer', async () => {
    const { fixture } = await setup({});
    fixture.componentInstance.onDrop({
      preventDefault() { /* no-op */ },
    } as unknown as DragEvent);
    expect(fixture.componentInstance.files()).toEqual([]);
    expect(fixture.componentInstance.isDragOver()).toBe(false);
  });

  it('lights the zone on drag-over and puts it out on the way past', async () => {
    const { fixture } = await setup({});
    const c = fixture.componentInstance;
    const zone = document.createElement('div');
    const outside = document.createElement('div');

    c.onDragOver({ preventDefault() { /* no-op */ } } as DragEvent);
    expect(c.isDragOver()).toBe(true);

    // Leaving for a child of the zone is not leaving.
    const child = document.createElement('span');
    zone.appendChild(child);
    c.onDragLeave({ currentTarget: zone, relatedTarget: child } as unknown as DragEvent);
    expect(c.isDragOver()).toBe(true);

    c.onDragLeave({ currentTarget: zone, relatedTarget: outside } as unknown as DragEvent);
    expect(c.isDragOver()).toBe(false);
  });

  it('refuses drag and drop entirely while disabled', async () => {
    const { fixture } = await setup({ disabled: true });
    const c = fixture.componentInstance;

    c.onDragOver({ preventDefault() { /* no-op */ } } as DragEvent);
    expect(c.isDragOver()).toBe(false);

    c.onDrop(dropEvent([file('a.txt', 'text/plain')]));
    expect(c.files()).toEqual([]);
  });

  it('opens the picker from Enter and Space on the zone, and from nothing else', async () => {
    const { fixture } = await setup({});
    let opened = 0;
    const native = el(fixture).querySelector<HTMLInputElement>('input[type="file"]')!;
    native.click = () => { opened++; };

    for (const key of ['Enter', ' ']) {
      const event = new KeyboardEvent('keydown', { key, cancelable: true });
      fixture.componentInstance.onZoneKeydown(event);
      expect(event.defaultPrevented, `${key} did not preventDefault`).toBe(true);
    }
    expect(opened).toBe(2);

    const other = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    fixture.componentInstance.onZoneKeydown(other);
    expect(other.defaultPrevented).toBe(false);
    expect(opened).toBe(2);
  });
});

describe('SvFileUploadComponent — image previews', () => {
  it('reads a thumbnail for an image and renders it', async () => {
    // `Blob.text()` does not exist in jsdom; the component uses FileReader,
    // which does — so the preview really does resolve here.
    const { fixture } = await setup({});
    fixture.componentInstance.onDrop(dropEvent([file('photo.png', 'image/png')]));

    await until(() => !!fixture.componentInstance.files()[0].preview, {
      label: 'the FileReader thumbnail to resolve',
    });
    fixture.detectChanges();

    const entry = fixture.componentInstance.files()[0];
    expect(entry.preview).toMatch(/^data:image\/png/);
    expect(fixture.componentInstance.isImage(entry)).toBe(true);
    const img = el(fixture).querySelector<HTMLImageElement>('img');
    expect(img?.getAttribute('alt')).toBe('photo.png');
  });

  it('reads nothing for a non-image, and falls back to the type badge', async () => {
    const { fixture } = await setup({});
    fixture.componentInstance.onDrop(dropEvent([file('notes.pdf', 'application/pdf')]));
    fixture.detectChanges();

    const entry = fixture.componentInstance.files()[0];
    expect(entry.preview).toBeUndefined();
    expect(fixture.componentInstance.isImage(entry)).toBe(false);
    expect(el(fixture).querySelector('img')).toBeNull();
    expect(el(fixture).textContent).toContain('PDF');
  });

  it('reads nothing for an image that was already rejected', async () => {
    // Decoding a 40MB file the user cannot upload anyway is pure waste.
    const { fixture } = await setup({ maxSizeMb: 0 });
    fixture.componentInstance.onDrop(dropEvent([file('photo.png', 'image/png', 10)]));
    fixture.detectChanges();

    const entry = fixture.componentInstance.files()[0];
    expect(entry.status).toBe('error');
    expect(entry.preview).toBeUndefined();
    expect(fixture.componentInstance.isImage(entry)).toBe(false);
  });

  it('does not call an image an image until the thumbnail has actually arrived', async () => {
    const { fixture } = await setup({});
    fixture.componentInstance.onDrop(dropEvent([file('photo.png', 'image/png')]));
    // Synchronously after the drop the FileReader has not resolved yet.
    expect(fixture.componentInstance.isImage(fixture.componentInstance.files()[0])).toBe(false);
  });
});
