import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvFileUploadComponent } from './file-upload.component';
import { SV_FILE_UPLOAD_TRIGGER_LABELS } from './file-upload.labels';

/** FL-B1d: the trigger text is the package's English until an app says otherwise. */
async function setup(providers: unknown[] = [], inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  return render(SvFileUploadComponent, { inputs, providers: providers as never[] });
}

afterEach(() => TestBed.resetTestingModule());

describe('SvFileUploadComponent — visible text (FL-B1d)', () => {
  it('labels the trigger in English by default', async () => {
    const { container } = await setup();
    expect(container.querySelector('[data-sv-upload-trigger]')?.textContent).toContain(SV_FILE_UPLOAD_TRIGGER_LABELS.uploadFiles);
  });

  it('renders the text an app provides', async () => {
    const { container } = await setup([provideSvLabels({ fileUpload: { uploadFiles: 'Dateien hochladen' } })]);
    expect(container.querySelector('[data-sv-upload-trigger]')?.textContent).toContain('Dateien hochladen');
    expect(screen.queryByText(SV_FILE_UPLOAD_TRIGGER_LABELS.uploadFiles)).toBeNull();
  });

  it('lets one instance name its trigger over the registry', async () => {
    const { container } = await setup([provideSvLabels({ fileUpload: { uploadFiles: 'Dateien hochladen' } })], { label: 'Belege anhängen' });
    expect(container.querySelector('[data-sv-upload-trigger]')?.textContent).toContain('Belege anhängen');
  });
});

describe('SvFileUploadComponent — text built in TypeScript (FL-B1e)', () => {
  it('names a stored file’s open link with the template an app provides', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvFileUploadComponent, {
      inputs: { initialFiles: [{ id: 'srv-1', name: 'vertrag.pdf', size: 120_000, type: 'application/pdf', url: '/files/srv-1' }] } as never,
      providers: [provideSvLabels({ fileUpload: { openFile: '{name} öffnen', stored: 'Auf dem Server' } })],
    });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-sv-file-id="srv-1"] [data-sv-file-open]')?.getAttribute('aria-label')).toBe('vertrag.pdf öffnen');
    expect(host.textContent).toContain('Auf dem Server');
  });
});
