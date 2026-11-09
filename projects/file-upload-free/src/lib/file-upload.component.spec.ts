import { render } from '@testing-library/angular';
import { SvFileUploadComponent } from './file-upload.component';

/** Build a synthetic drop event carrying the given files. */
/** A change on the hidden file input — what picking files in the dialog produces. */
function pickEvent(files: File[]): Event {
  return { target: { files, value: '' } } as unknown as Event;
}

const pdf = (name = 'doc.pdf') =>
  new File(['hello'], name, { type: 'application/pdf' });

async function setup(extra: Record<string, unknown> = {}) {
  const { fixture } = await render(SvFileUploadComponent, { inputs: { ...extra } });
  return fixture.componentInstance;
}

describe('SvFileUploadComponent — formatSize', () => {
  it('formats bytes, kilobytes, and megabytes', async () => {
    const c = await setup();
    expect(c.formatSize(512)).toBe('512 B');
    expect(c.formatSize(2048)).toBe('2.0 KB');
    expect(c.formatSize(3 * 1024 ** 2)).toBe('3.0 MB');
  });
});

describe('SvFileUploadComponent — adding files', () => {
  it('adds valid files and emits fileAdded + filesChange', async () => {
    const added = vi.fn();
    const changed = vi.fn();
    const c = await setup();
    c.fileAdded.subscribe(added);
    c.filesChange.subscribe(changed);

    c.onFileInputChange(pickEvent([pdf('a.pdf')]));

    expect(c.files()).toHaveLength(1);
    expect(c.files()[0].status).toBe('pending');
    expect(added).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalled();
  });

  it('caps the number of files at maxFiles', async () => {
    const c = await setup({ maxFiles: 2 });
    c.onFileInputChange(pickEvent([pdf('a.pdf'), pdf('b.pdf'), pdf('c.pdf')]));
    expect(c.files()).toHaveLength(2);
    expect(c.canAddMore()).toBe(false);
  });
});

describe('SvFileUploadComponent — validation', () => {
  it('marks oversized files as errored and emits uploadError', async () => {
    const err = vi.fn();
    const c = await setup({ maxSizeMb: 0 }); // any non-empty file exceeds 0 MB
    c.uploadError.subscribe(err);

    c.onFileInputChange(pickEvent([pdf('big.pdf')]));

    expect(c.files()[0].status).toBe('error');
    expect(c.files()[0].errorMsg).toMatch(/exceeds/i);
    expect(err).toHaveBeenCalledTimes(1);
  });

  it('rejects files that do not match the accept filter', async () => {
    const c = await setup({ accept: 'image/*' });
    c.onFileInputChange(pickEvent([new File(['x'], 'note.txt', { type: 'text/plain' })]));

    expect(c.files()[0].status).toBe('error');
    expect(c.files()[0].errorMsg).toMatch(/not allowed/i);
  });
});

describe('SvFileUploadComponent — removing files', () => {
  it('removes a file by id and emits fileRemoved', async () => {
    const removed = vi.fn();
    const c = await setup();
    c.fileRemoved.subscribe(removed);

    c.onFileInputChange(pickEvent([pdf('a.pdf')]));
    const id = c.files()[0].id;
    c.removeFile(id);

    expect(c.files()).toHaveLength(0);
    expect(removed).toHaveBeenCalledWith(id);
  });
});
