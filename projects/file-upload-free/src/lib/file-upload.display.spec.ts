import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { until, quietFor } from '../../../../src/testing/async';
import { PLATFORM_ID } from '@angular/core';
import { SvFileUploadComponent, type FileUploadSize, type UploadFile } from './file-upload.component';

/**
 * What a row looks like: which glyph, which badge colour, which extension
 * label, and how a byte count is written. All small, all pure — and all
 * branchy, because each has a fallback for the file that fits none of the
 * cases (no extension, unknown type, a name that is nothing but a dot).
 *
 * Plus `demoMode`, the only code path in the component that invents progress of
 * its own, and the validation-error slot that belongs to the FIELD rather than
 * to any one file.
 */

async function setup(inputs: Partial<ComponentInput<SvFileUploadComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvFileUploadComponent, {
    inputs: inputs as ComponentInput<SvFileUploadComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

/** A bare `UploadFile` shape — these helpers only read `name` and `type`. */
const entry = (name: string, type = ''): UploadFile => ({
  id: 'x', file: new File([], name, { type }), name, size: 0, type,
  status: 'pending', progress: 0,
});

function dropEvent(files: File[]): DragEvent {
  return { preventDefault() { /* no-op */ }, dataTransfer: { files } } as unknown as DragEvent;
}

const file = (name: string, type = 'text/plain') =>
  new File([new Uint8Array(4)], name, { type });

describe('SvFileUploadComponent — formatSize', () => {
  it('switches unit at each boundary, and never at the boundary itself', async () => {
    const { fixture } = await setup({});
    const f = fixture.componentInstance.formatSize.bind(fixture.componentInstance);

    expect(f(0)).toBe('0 B');
    expect(f(1023)).toBe('1023 B');
    expect(f(1024)).toBe('1.0 KB');       // exactly 1 KiB is KB, not B
    expect(f(1024 ** 2 - 1)).toBe('1024.0 KB');
    expect(f(1024 ** 2)).toBe('1.0 MB');  // exactly 1 MiB is MB, not KB
    expect(f(3.5 * 1024 ** 2)).toBe('3.5 MB');
    expect(f(5 * 1024 ** 3)).toBe('5120.0 MB'); // no GB unit — it keeps counting
  });
});

describe('SvFileUploadComponent — the glyph and badge for a file', () => {
  const kinds: { name: string; type: string; badge: string; ext: string }[] = [
    { name: 'a.pdf',  type: 'application/pdf', badge: 'red',      ext: 'PDF' },
    { name: 'a.doc',  type: '',                badge: 'blue',     ext: 'DOC' },
    { name: 'a.docx', type: '',                badge: 'blue',     ext: 'DOCX' },
    { name: 'a.xls',  type: '',                badge: 'emerald',  ext: 'XLS' },
    { name: 'a.xlsx', type: '',                badge: 'emerald',  ext: 'XLSX' },
    { name: 'a.zip',  type: '',                badge: 'yellow',   ext: 'ZIP' },
    { name: 'a.rar',  type: '',                badge: 'yellow',   ext: 'RAR' },
    { name: 'a.gz',   type: '',                badge: 'yellow',   ext: 'GZ' },
    { name: 'a.mp4',  type: '',                badge: 'pink',     ext: 'MP4' },
    { name: 'a.mov',  type: '',                badge: 'pink',     ext: 'MOV' },
    { name: 'a.webm', type: '',                badge: 'pink',     ext: 'WEBM' },
    { name: 'a.mp3',  type: '',                badge: 'indigo',   ext: 'MP3' },
    { name: 'a.wav',  type: '',                badge: 'indigo',   ext: 'WAV' },
    { name: 'a.png',  type: '',                badge: 'purple',   ext: 'PNG' },
    { name: 'a.jpeg', type: '',                badge: 'purple',   ext: 'JPEG' },
    { name: 'a.svg',  type: '',                badge: 'purple',   ext: 'SVG' },
  ];

  it('maps every known extension to its own colour and label', async () => {
    const { fixture } = await setup({});
    const c = fixture.componentInstance;
    const paths = new Set<string>();

    for (const { name, type, badge, ext } of kinds) {
      const e = entry(name, type);
      expect(c.getBadgeColor(e), name).toContain(badge);
      expect(c.getExtLabel(e), name).toBe(ext);
      paths.add(c.getIcon(e));
    }
    // Seven distinct glyph families across the sixteen extensions.
    expect(paths.size).toBe(7);
  });

  it('falls back to the image glyph on the MIME type when the extension is unknown', async () => {
    // A camera upload often arrives as `image/heic` with a name the map has
    // never heard of; it is still an image.
    const { fixture } = await setup({});
    const c = fixture.componentInstance;
    const heic = entry('IMG_0001.heic', 'image/heic');

    expect(c.getIcon(heic)).toBe(c.getIcon(entry('a.png')));
    expect(c.getBadgeColor(heic)).toContain('purple');
    expect(c.getExtLabel(heic)).toBe('HEIC');
  });

  it('falls back to the generic file glyph for an unknown extension and type', async () => {
    const { fixture } = await setup({});
    const c = fixture.componentInstance;
    const odd = entry('archive.tar.bz2', 'application/x-bzip2');
    expect(c.getBadgeColor(odd)).toContain('gray');
    expect(c.getExtLabel(odd)).toBe('BZ2');
  });

  it('copes with a name that has no extension at all', async () => {
    const { fixture } = await setup({});
    const c = fixture.componentInstance;
    const bare = entry('README', 'text/plain');
    expect(c.getBadgeColor(bare)).toContain('gray');
    expect(c.getIcon(bare)).toBeTruthy();
    // `split('.').pop()` on a dotless name returns the whole name.
    expect(c.getExtLabel(bare)).toBe('READM');
  });

  it('truncates a long extension rather than stretching the badge', async () => {
    const { fixture } = await setup({});
    expect(fixture.componentInstance.getExtLabel(entry('a.verylongextension'))).toBe('VERYL');
  });

  it('is case-insensitive about the extension', async () => {
    const { fixture } = await setup({});
    const c = fixture.componentInstance;
    expect(c.getBadgeColor(entry('A.PDF'))).toContain('red');
    expect(c.getExtLabel(entry('A.pdf'))).toBe('PDF');
  });
});

describe('SvFileUploadComponent — counting the list', () => {
  it('starts empty and says nothing', async () => {
    const { fixture } = await setup({});
    const c = fixture.componentInstance;
    expect([c.hasFiles(), c.successCount(), c.errorCount(), c.uploadingCount()])
      .toEqual([false, 0, 0, 0]);
    expect(c.statusMessage()).toBe('');
    expect(el(fixture).querySelector('[role="list"]')).toBeNull();
  });

  it('pluralises the footer count and breaks it down by outcome', async () => {
    const { fixture } = await setup({ maxSizeMb: 0 });
    fixture.componentInstance.onDrop(dropEvent([file('a.txt')]));
    fixture.detectChanges();
    expect(el(fixture).textContent).toContain('1 file');
    expect(el(fixture).textContent).toContain('1 failed');

    fixture.componentInstance.onDrop(dropEvent([file('b.txt')]));
    fixture.detectChanges();
    expect(el(fixture).textContent).toContain('2 files');
  });

  it('shows the success breakdown only once something has succeeded', async () => {
    const { fixture } = await setup({});
    fixture.componentInstance.onDrop(dropEvent([file('a.txt')]));
    fixture.detectChanges();
    expect(el(fixture).textContent).not.toContain('uploaded');
    expect(el(fixture).textContent).toContain('Pending');
  });
});

describe('SvFileUploadComponent — the zone chrome', () => {
  const sizes: FileUploadSize[] = ['sm', 'md', 'lg'];

  it('gives every size its own padding, icon and text scale', async () => {
    const seen = new Set<string>();
    for (const size of sizes) {
      const { fixture } = await setup({ size });
      const c = fixture.componentInstance;
      seen.add([c.zoneClasses(), c.iconSize(), c.labelClass(), c.hintClass()].join('|'));
    }
    expect(seen.size).toBe(3);
  });

  it('picks a different border for idle, drag-over and disabled — in that priority', async () => {
    const idle = await setup({});
    expect(idle.fixture.componentInstance.zoneClasses()).toContain('border-gray-300');

    const drag = await setup({});
    drag.fixture.componentInstance.isDragOver.set(true);
    expect(drag.fixture.componentInstance.zoneClasses()).toContain('border-primary-400');

    // Disabled outranks drag-over: a zone that cannot take a file must not
    // light up as though it can.
    const off = await setup({ disabled: true });
    off.fixture.componentInstance.isDragOver.set(true);
    expect(off.fixture.componentInstance.zoneClasses()).toContain('cursor-not-allowed');
    expect(off.fixture.componentInstance.zoneClasses()).not.toContain('border-primary-400');
  });

  it('shows the hint beside the trigger only when there is one', async () => {
    const withHint = await setup({ hint: 'PNG or JPG, up to 5 MB' });
    expect(el(withHint.fixture).textContent).toContain('PNG or JPG, up to 5 MB');

    const without = await setup({});
    expect(el(without.fixture).querySelectorAll('span').length)
      .toBeLessThan(el(withHint.fixture).querySelectorAll('span').length);
  });

  it('appends the host class to the root', async () => {
    const { fixture } = await setup({ customClass: 'mt-6' });
    expect(el(fixture).querySelector('.mt-6')).not.toBeNull();
  });
});

describe('SvFileUploadComponent — the field-level validation error', () => {
  it('points the trigger at a message that is actually on the page', async () => {
    const { fixture } = await setup({ errorMessage: 'A document is required' });
    const trigger = el(fixture).querySelector<HTMLButtonElement>('button')!;
    const id = trigger.getAttribute('aria-describedby')!;

    expect(trigger.getAttribute('aria-invalid')).toBe('true');
    expect(el(fixture).querySelector(`#${id}`)?.textContent).toContain('A document is required');
  });

  it('says nothing, and claims nothing, while the field is fine', async () => {
    const { fixture } = await setup({});
    const trigger = el(fixture).querySelector<HTMLButtonElement>('button')!;
    expect(trigger.getAttribute('aria-invalid')).toBeNull();
    expect(trigger.getAttribute('aria-describedby')).toBeNull();
  });

  it('drops a server rejection once the file list it was about changes', async () => {
    const { fixture } = await setup({ serverError: 'That document was rejected' });
    expect(el(fixture).textContent).toContain('That document was rejected');

    fixture.componentInstance.onDrop(dropEvent([file('a.txt')]));
    fixture.detectChanges();
    expect(el(fixture).textContent).not.toContain('That document was rejected');
  });

  it('keeps the per-file failure separate from the field failure', async () => {
    // Two different errors with two different owners; one must not hide the
    // other.
    const { fixture } = await setup({ maxSizeMb: 0, errorMessage: 'At least two files' });
    fixture.componentInstance.onDrop(dropEvent([file('a.txt')]));
    fixture.detectChanges();

    expect(el(fixture).textContent).toContain('At least two files');
    expect(el(fixture).textContent).toContain('File exceeds 0 MB limit');
  });
});

describe('SvFileUploadComponent — demo mode', () => {
  it('animates a file to success without any uploader', async () => {
    // Deterministic: `Math.random` is stubbed so the 8% failure never fires.
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      const { fixture } = await setup({ demoMode: true, autoUpload: true });
      const complete: UploadFile[][] = [];
      fixture.componentInstance.uploadComplete.subscribe((all) => complete.push(all));

      fixture.componentInstance.onDrop(dropEvent([file('a.txt')]));
      await until(() => fixture.componentInstance.files()[0].status === 'uploading', {
        label: 'the simulated upload to start',
      });

      await until(() => fixture.componentInstance.files()[0].status === 'success', {
        timeoutMs: 8000,
        label: 'the simulated upload to finish',
      });
      expect(fixture.componentInstance.files()[0].progress).toBe(100);
      expect(complete.length).toBe(1);
    } finally {
      random.mockRestore();
    }
  });

  it('fails a file when the demo dice say so, and reports it', async () => {
    // 0.001 < 0.08 fires the failure; it needs progress past 40% first, so the
    // duration is pinned short by the same stub.
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.001);
    try {
      const { fixture } = await setup({ demoMode: true, autoUpload: true });
      const failed: UploadFile[] = [];
      fixture.componentInstance.uploadError.subscribe((u) => failed.push(u));

      fixture.componentInstance.onDrop(dropEvent([file('a.txt')]));
      await until(() => fixture.componentInstance.files()[0].status === 'error', {
        timeoutMs: 8000,
        label: 'the simulated failure',
      });
      expect(fixture.componentInstance.files()[0].errorMsg).toBe('Upload failed — server error');
      expect(failed.map((u) => u.name)).toEqual(['a.txt']);
    } finally {
      random.mockRestore();
    }
  });

  it('animates nothing on the server, where a timer would never be flushed', async () => {
    // Server-side there is no frame to render into and the setTimeout chain
    // would either be dropped or hold the render open; the file stays pending
    // and the client picks it up.
    TestBed.resetTestingModule();
    const { fixture } = await render(SvFileUploadComponent, {
      inputs: { demoMode: true, autoUpload: true } as ComponentInput<SvFileUploadComponent>,
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });
    fixture.componentInstance.onDrop(dropEvent([file('a.txt')]));
    await quietFor(300);
    expect(fixture.componentInstance.files()[0].status).toBe('pending');
    expect(fixture.componentInstance.files()[0].progress).toBe(0);
  });

  it('is ignored the moment a real uploader is supplied', async () => {
    const sent: string[] = [];
    const uploader = ({ file: f }: { file: File }) => {
      sent.push(f.name);
      return Promise.resolve({});
    };
    const { fixture } = await setup({ demoMode: true, autoUpload: true, uploader });
    fixture.componentInstance.onDrop(dropEvent([file('a.txt')]));
    await until(() => sent.length === 1, { label: 'the real uploader to be used' });
    expect(sent).toEqual(['a.txt']);
  });

  it('stops its timers when the component goes away', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      const { fixture } = await setup({ demoMode: true, autoUpload: true });
      fixture.componentInstance.onDrop(dropEvent([file('a.txt')]));
      await until(() => fixture.componentInstance.files()[0].status === 'uploading');

      const at = fixture.componentInstance.files()[0].progress;
      fixture.destroy();
      await quietFor(300);
      // The animation would have advanced several times in 300ms.
      expect(fixture.componentInstance.files()[0].progress).toBe(at);
    } finally {
      random.mockRestore();
    }
  });
});
