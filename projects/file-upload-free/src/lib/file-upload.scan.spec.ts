import { render, type ComponentInput } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import { until } from '../../../../src/testing/async';
import { SvFileUploadComponent } from './file-upload.component';

/**
 * The free twin of `file-upload`'s `file-upload.scan.spec.ts` (`FI-10-M1`).
 *
 * ★★★ IT IS HERE BECAUSE THE TWINS DRIFTED WHILE THIS WAS BEING WRITTEN. The
 *     Pro `isCleared` originally read "under `scanPolicy='none'`, success is
 *     success" and counted a flagged file as uploaded; the free twin had it
 *     right from the first line. A pair of components implementing the same
 *     safety rule twice is how one of them ends up not implementing it, and the
 *     only thing that catches it is asserting the rule in both places.
 *
 * ⚠️ `scanPolicy` is not here — `'required'` is the Pro twin's stricter mode.
 *    This tier behaves as Pro does under the default `'none'`: a flagged file
 *    never reaches the form value (see `file-upload.form.spec.ts`). Recorded in
 *    `scripts/variant-parity.allow.json`, not left as an omission.
 */
const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const file = (name: string) => new File([new Uint8Array(4)], name, { type: 'text/plain' });
const dropEvent = (files: File[]): DragEvent =>
  ({ preventDefault() { /* no-op */ }, dataTransfer: { files } }) as unknown as DragEvent;

async function setup() {
  TestBed.resetTestingModule();
  return render(SvFileUploadComponent, {
    inputs: {
      uploader: () => Promise.resolve({}),
      autoUpload: true,
    } as unknown as ComponentInput<SvFileUploadComponent>,
  });
}

async function uploaded(c: SvFileUploadComponent, fixture: { detectChanges(): void }) {
  c.onDrop(dropEvent([file('a.txt')]));
  fixture.detectChanges();
  await until(() => c.files()[0]?.status === 'success');
  fixture.detectChanges();
  return c.files()[0];
}

it('keeps a flagged file at status "success" — the upload is not what failed', async () => {
  const { fixture } = await setup();
  const c = fixture.componentInstance;
  const entry = await uploaded(c, fixture);

  c.markScanned(entry.id, 'flagged', 'Matched EICAR test signature');
  fixture.detectChanges();

  expect(c.files()[0].status).toBe('success');
  expect(c.errorCount()).toBe(0);
  expect(c.flaggedCount()).toBe(1);
});

it('does not count a flagged file as a success', async () => {
  // The exact claim the Pro twin failed on its first run.
  const { fixture } = await setup();
  const c = fixture.componentInstance;
  const entry = await uploaded(c, fixture);
  expect(c.successCount()).toBe(1);

  c.markScanned(entry.id, 'flagged');
  fixture.detectChanges();
  expect(c.successCount()).toBe(0);
});

it('shows the scanner’s sentence instead of the green tick', async () => {
  const { fixture } = await setup();
  const c = fixture.componentInstance;
  const entry = await uploaded(c, fixture);
  expect(el(fixture).textContent).toContain('Uploaded');

  c.markScanned(entry.id, 'flagged', 'Matched EICAR test signature');
  fixture.detectChanges();

  expect(el(fixture).textContent).toContain('Matched EICAR test signature');
  expect(el(fixture).textContent).not.toContain('Uploaded');
});

it('announces it separately from a failure', async () => {
  const { fixture } = await setup();
  const c = fixture.componentInstance;
  const entry = await uploaded(c, fixture);
  c.markScanned(entry.id, 'flagged');
  fixture.detectChanges();

  expect(c.statusMessage()).toContain('blocked by a security scan');
  expect(c.statusMessage()).not.toContain('failed');
});

it('clears a stale reason when the file is re-scanned clean', async () => {
  const { fixture } = await setup();
  const c = fixture.componentInstance;
  const entry = await uploaded(c, fixture);
  c.markScanned(entry.id, 'flagged', 'Matched EICAR test signature');
  c.markScanned(entry.id, 'clean');
  fixture.detectChanges();

  expect(c.files()[0].scanReason).toBeUndefined();
  expect(el(fixture).textContent).not.toContain('EICAR');
});

it('does nothing for an id that is no longer in the queue', async () => {
  const { fixture } = await setup();
  const c = fixture.componentInstance;
  await uploaded(c, fixture);
  expect(() => c.markScanned('no-such-id', 'flagged', 'x')).not.toThrow();
  expect(c.files()[0].scan).toBeUndefined();
});

/**
 * Re-verified 2026-09-26. `'pending'` rendered as "Scanning…" but still counted
 * as "1 uploaded" in the footer and the live region, and `'unscanned'` — a
 * verdict meaning "the host scans and nobody has looked" — rendered as a green
 * "Uploaded" row. Brought in line with the Pro twin.
 */
it('does not count a file that is still being scanned as uploaded', async () => {
  const { fixture } = await setup();
  const c = fixture.componentInstance;
  const entry = await uploaded(c, fixture);

  c.markScanning(entry.id);
  fixture.detectChanges();

  expect(el(fixture).textContent).toContain('Scanning for malware');
  expect(c.successCount()).toBe(0);
  expect(c.statusMessage()).toContain('1 awaiting a security scan');
  expect(c.statusMessage()).not.toContain('uploaded');
  expect(el(fixture).querySelector('[data-sv-scan-summary="pending"]')?.textContent).toContain('1 awaiting scan');
});

it('shows "Awaiting a security scan" for "unscanned", not the green tick', async () => {
  const { fixture } = await setup();
  const c = fixture.componentInstance;
  const entry = await uploaded(c, fixture);

  c.markScanned(entry.id, 'unscanned');
  fixture.detectChanges();

  expect(el(fixture).textContent).toContain('Awaiting a security scan');
  expect(el(fixture).textContent).not.toContain('Uploaded');
  expect(c.successCount()).toBe(0);
});

it('counts it once clean, and shows a flagged file in the visible footer', async () => {
  const { fixture } = await setup();
  const c = fixture.componentInstance;
  const entry = await uploaded(c, fixture);

  c.markScanning(entry.id);
  c.markScanned(entry.id, 'clean');
  fixture.detectChanges();
  expect(c.successCount()).toBe(1);
  expect(el(fixture).textContent).toContain('Uploaded');

  c.markScanned(entry.id, 'flagged');
  fixture.detectChanges();
  expect(el(fixture).querySelector('[data-sv-scan-summary="flagged"]')?.textContent).toContain('1 blocked');
});
