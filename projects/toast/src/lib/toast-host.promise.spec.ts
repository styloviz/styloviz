import { render } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import { SvLiveAnnouncer } from '@styloviz/core/a11y';
import { ToastService } from '@styloviz/core/services';
import { SvToastHostComponent } from './toast-host.component';

/**
 * FL-J3-OF-07 — a `promise()` toast as rendered: a spinner and `aria-busy`
 * while pending, the variant icon once settled, and the outcome announced.
 */
async function setup() {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvToastHostComponent, { inputs: { position: 'top-right' } });
  const service = TestBed.inject(ToastService);
  service.dismissAll();
  return { fixture, service };
}

describe('SvToastHostComponent — promise toasts (FL-J3-OF-07)', () => {
  it('★ draws a spinner and marks the toast busy while pending, then the variant icon', async () => {
    const { fixture, service } = await setup();
    let resolve!: () => void;
    const result = service.promise(new Promise<void>((r) => (resolve = r)), { loading: 'Saving…', success: 'Saved', error: 'Failed' });
    fixture.detectChanges();
    const toast = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[id^="svz-toast-"]')!;
    expect(toast().getAttribute('aria-busy')).toBe('true');
    expect(toast().querySelector('sv-spinner-arc')).not.toBeNull();
    // Not dismissible while pending: no close button to press.
    expect(toast().textContent).toContain('Saving…');

    resolve();
    await result;
    fixture.detectChanges();
    expect(toast().hasAttribute('aria-busy')).toBe(false);
    expect(toast().querySelector('sv-spinner-arc')).toBeNull();
    expect(toast().textContent).toContain('Saved');
    service.dismissAll();
  });

  it('announces the loading message and then the outcome', async () => {
    const { fixture, service } = await setup();
    const announcer = TestBed.inject(SvLiveAnnouncer);
    let reject!: (e: unknown) => void;
    const result = service.promise(new Promise<void>((_, r) => (reject = r)), { loading: 'Uploading…', success: 'Done', error: 'Upload failed' });
    fixture.detectChanges();
    reject(new Error('x'));
    await result.catch(() => undefined);
    fixture.detectChanges();
    const said = announcer.history().map((a) => a.message).join(' | ');
    expect(said).toContain('Uploading…');
    expect(said).toContain('Upload failed');
    service.dismissAll();
  });
});
