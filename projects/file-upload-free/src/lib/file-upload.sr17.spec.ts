import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { vi } from 'vitest';
import { SvFileUploadComponent, type SvIntakeSkipped } from './file-upload.component';

/**
 * `SR-17` — the demo upload ignored cancel and `concurrency`, single mode
 * appended, files past `maxFiles` vanished without a word, and sizes stopped
 * at MB.
 */

async function setup(inputs: Partial<ComponentInput<SvFileUploadComponent>> = {}) {
  TestBed.resetTestingModule();
  const view = await render(SvFileUploadComponent, {
    inputs: { autoUpload: true, ...inputs } as ComponentInput<SvFileUploadComponent>,
  });
  return { ...view, c: view.fixture.componentInstance };
}

const file = (name: string, lastModified = 1) =>
  new File([new Uint8Array(4)], name, { type: 'text/plain', lastModified });

/** Through the picker — the intake every variant of both twins has. */
const pick = (c: SvFileUploadComponent, files: File[]) =>
  c.onFileInputChange({ target: { files, value: '' } } as unknown as Event);

const statuses = (c: SvFileUploadComponent) => c.files().map((f) => `${f.name}:${f.status}`);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SvFileUploadComponent — the demo upload is a real upload (SR-17 FU-1, FU-2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Never the 8 % random failure; a 2.1 s run.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  it('★ a cancel mid-upload stays cancelled', async () => {
    const { c } = await setup({ demoMode: true });
    pick(c, [file('a')]);
    vi.advanceTimersByTime(500);
    expect(c.files()[0].status).toBe('uploading');
    expect(c.files()[0].progress).toBeGreaterThan(0);

    c.cancelUpload(c.files()[0].id);
    vi.advanceTimersByTime(10_000);
    expect(c.files()[0]).toMatchObject({ status: 'pending', progress: 0 });
  });

  it('a removed row is not finished in the background', async () => {
    const { c } = await setup({ demoMode: true });
    const done: unknown[] = [];
    c.uploadComplete.subscribe((x) => done.push(x));
    pick(c, [file('a'), file('b')]);
    vi.advanceTimersByTime(300);
    c.removeFile(c.files()[0].id);
    vi.advanceTimersByTime(10_000);
    expect(statuses(c)).toEqual(['b:success']);
    expect(done).toHaveLength(1);
  });

  it('★ concurrency=1 queues the rest, and the next starts when a slot frees', async () => {
    const { c } = await setup({ demoMode: true, concurrency: 1 });
    pick(c, [file('a'), file('b'), file('c')]);
    expect(statuses(c)).toEqual(['a:uploading', 'b:pending', 'c:pending']);

    vi.advanceTimersByTime(2_200);
    expect(statuses(c)).toEqual(['a:success', 'b:uploading', 'c:pending']);

    vi.advanceTimersByTime(5_000);
    expect(statuses(c)).toEqual(['a:success', 'b:success', 'c:success']);
  });

  it('reports a demo failure through uploadError and frees its slot', async () => {
    // SR-27b: failures are chosen by hashing the file; a rate of 1 fails each.
    const { c } = await setup({ demoMode: true, concurrency: 1, demoFailureRate: 1 });
    const errors: string[] = [];
    c.uploadError.subscribe((f) => errors.push(f.name));
    pick(c, [file('a'), file('b')]);
    vi.advanceTimersByTime(10_000);
    expect(errors).toEqual(['a', 'b']);
    expect(c.files().map((f) => f.status)).toEqual(['error', 'error']);
  });
});

describe('SvFileUploadComponent — single mode replaces (SR-17 FU-3)', () => {
  it('★ a second pick swaps the file out rather than adding a second', async () => {
    const { c } = await setup({ multiple: false, autoUpload: false });
    const removed: string[] = [];
    c.fileRemoved.subscribe((id) => removed.push(id));

    pick(c, [file('a')]);
    const first = c.files()[0].id;
    expect(c.canAddMore()).toBe(true);

    pick(c, [file('b')]);
    expect(c.files().map((f) => f.name)).toEqual(['b']);
    expect(removed).toEqual([first]);
    expect(c.canAddMore()).toBe(true);
  });

  it('keeps the first of several, and says the rest were left out', async () => {
    const { c } = await setup({ multiple: false, autoUpload: false });
    const skipped: SvIntakeSkipped[] = [];
    c.intakeSkipped.subscribe((e) => skipped.push(e));
    pick(c, [file('a'), file('b'), file('c')]);
    expect(c.files().map((f) => f.name)).toEqual(['a']);
    expect(skipped).toEqual([{ skipped: 2, truncated: false, reason: 'max-files' }]);
  });
});

describe('SvFileUploadComponent — nothing past maxFiles is dropped silently (SR-17 FU-4)', () => {
  it('★ reports the overflow through intakeSkipped', async () => {
    const { c } = await setup({ maxFiles: 2, autoUpload: false });
    const skipped: SvIntakeSkipped[] = [];
    c.intakeSkipped.subscribe((e) => skipped.push(e));

    pick(c, [file('a'), file('b'), file('c')]);
    expect(c.files().map((f) => f.name)).toEqual(['a', 'b']);
    expect(skipped).toEqual([{ skipped: 1, truncated: false, reason: 'max-files' }]);
  });

  it('says nothing when everything fits', async () => {
    const { c } = await setup({ maxFiles: 3, autoUpload: false });
    const skipped: SvIntakeSkipped[] = [];
    c.intakeSkipped.subscribe((e) => skipped.push(e));
    pick(c, [file('a'), file('b'), file('c')]);
    expect(skipped).toEqual([]);
  });
});

describe('SvFileUploadComponent — duplicates (SR-17 FU-6)', () => {
  it('allows them by default, as before', async () => {
    const { c } = await setup({ autoUpload: false });
    pick(c, [file('a')]);
    pick(c, [file('a')]);
    expect(c.files()).toHaveLength(2);
  });

  it('"skip" leaves out a file already queued, and reports it', async () => {
    const { c } = await setup({ autoUpload: false, duplicates: 'skip' });
    const skipped: SvIntakeSkipped[] = [];
    c.intakeSkipped.subscribe((e) => skipped.push(e));
    pick(c, [file('a')]);
    pick(c, [file('a'), file('a', 2), file('b')]);
    // Same name, different modification time: a different file.
    expect(c.files().map((f) => `${f.name}@${f.file.lastModified}`)).toEqual(['a@1', 'a@2', 'b@1']);
    expect(skipped).toEqual([{ skipped: 1, truncated: false, reason: 'duplicate' }]);
  });

  it('"replace" swaps the queued copy for the new one', async () => {
    const { c } = await setup({ autoUpload: false, duplicates: 'replace' });
    pick(c, [file('a'), file('b')]);
    const fresh = file('a');
    pick(c, [fresh]);
    expect(c.files().map((f) => f.name)).toEqual(['b', 'a']);
    expect(c.files()[1].file).toBe(fresh);
  });
});

describe('SvFileUploadComponent — sizes past a gigabyte (SR-17 FU-11)', () => {
  it('labels a large limit in GB', async () => {
    const { c } = await setup({ maxSizeMb: 5000 });
    expect(c.maxSizeLabel()).toBe('4.9 GB');
  });

  it('keeps small limits exactly as written', async () => {
    const { c } = await setup({ maxSizeMb: 10 });
    expect(c.maxSizeLabel()).toBe('10 MB');
  });
});
