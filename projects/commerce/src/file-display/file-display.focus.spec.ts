import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvFileDisplayComponent, type FileVariant } from './file-display.component';

/**
 * X-12 — Remove hands the decision to the host. When the host drops the file,
 * the × that held focus goes with it; focus must move to the next file, else
 * the previous one, else the list — never <body>. And a confirm strip that
 * closes gives focus back to the control that opened it.
 */

@Component({
  standalone: true,
  imports: [SvFileDisplayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-testid="list">
      @for (name of files(); track name) {
        <sv-file-display [fileName]="name" mimeType="application/pdf" [variant]="variant()" (remove)="drop(name)" />
      }
    </div>
  `,
})
class FileListHost {
  readonly variant = input<FileVariant>('card');
  readonly files = signal<string[]>(['a.pdf', 'b.pdf', 'c.pdf']);
  drop(name: string): void {
    this.files.update((all) => all.filter((f) => f !== name));
  }
}

const VARIANTS: FileVariant[] = ['card', 'row', 'compact'];

async function setup(variant: FileVariant, files?: string[]) {
  TestBed.resetTestingModule();
  const r = await render(FileListHost, { inputs: { variant } });
  if (files) {
    r.fixture.componentInstance.files.set(files);
    r.fixture.detectChanges();
  }
  return r.fixture;
}

type Fixture = Awaited<ReturnType<typeof setup>>;

const removeButton = (f: Fixture, name: string) =>
  f.nativeElement.querySelector(`[aria-label="Remove ${name}"], [aria-label="Cancel removing ${name}"]`) as HTMLButtonElement;

const stripButton = (f: Fixture, label: 'Remove' | 'Keep') =>
  Array.from(
    f.nativeElement.querySelectorAll('[data-sv-state="confirm-remove"] button') as NodeListOf<HTMLButtonElement>,
  ).find((b) => b.textContent?.trim() === label)!;

async function settle(f: Fixture): Promise<void> {
  f.detectChanges();
  await f.whenStable();
  await Promise.resolve();
}

/** Press × then the strip's Remove, with focus following the keyboard path. */
async function removeViaKeyboard(f: Fixture, name: string): Promise<void> {
  const x = removeButton(f, name);
  x.focus();
  x.click();
  await settle(f);
  const confirm = stripButton(f, 'Remove');
  confirm.focus();
  confirm.click();
  await settle(f);
}

describe('SvFileDisplayComponent — focus after remove (X-12)', () => {
  it.each(VARIANTS)('%s: moves focus to the next file when the host drops this one', async (variant) => {
    const f = await setup(variant);
    await removeViaKeyboard(f, 'b.pdf');
    expect(removeButton(f, 'b.pdf')).toBeNull();
    expect(document.activeElement).not.toBe(document.body);
    expect(f.nativeElement.querySelector('sv-file-display:nth-of-type(2)')?.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.closest('[role="group"]')?.getAttribute('aria-label')).toBe('c.pdf');
  });

  it.each(VARIANTS)('%s: moves focus to the previous file when the last one goes', async (variant) => {
    const f = await setup(variant);
    await removeViaKeyboard(f, 'c.pdf');
    expect(document.activeElement?.closest('[role="group"]')?.getAttribute('aria-label')).toBe('b.pdf');
  });

  it.each(VARIANTS)('%s: falls back to the list when the only file goes — never <body>', async (variant) => {
    const f = await setup(variant, ['a.pdf']);
    await removeViaKeyboard(f, 'a.pdf');
    expect(document.activeElement).toBe(f.nativeElement.querySelector('[data-testid="list"]'));
  });

  it.each(VARIANTS)('%s: "Keep" gives focus back to the ×', async (variant) => {
    const f = await setup(variant);
    removeButton(f, 'a.pdf').focus();
    removeButton(f, 'a.pdf').click();
    await settle(f);
    const keep = stripButton(f, 'Keep');
    keep.focus();
    keep.click();
    await settle(f);
    expect(document.activeElement).toBe(removeButton(f, 'a.pdf'));
  });
});

describe('SvFileDisplayComponent — focus after a failed remove (X-12)', () => {
  it('lands on the × when the host keeps the file', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvFileDisplayComponent, { inputs: { fileName: 'a.pdf' } });
    const x = fixture.nativeElement.querySelector('[aria-label="Remove a.pdf"]') as HTMLButtonElement;
    x.focus();
    x.click();
    fixture.detectChanges();
    const confirm = Array.from(
      fixture.nativeElement.querySelectorAll('[data-sv-state="confirm-remove"] button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.trim() === 'Remove')!;
    confirm.focus();
    confirm.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(x);
  });

  it('gives focus back to Download when the unsafe-download strip closes', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvFileDisplayComponent, {
      inputs: { fileName: 'a.pdf', scan: 'flagged', allowUnsafeDownload: true },
    });
    const download = fixture.nativeElement.querySelector('[aria-label^="Download a.pdf"]') as HTMLButtonElement;
    download.focus();
    download.click();
    fixture.detectChanges();
    const cancel = Array.from(
      fixture.nativeElement.querySelectorAll('[data-sv-state="confirm-unsafe-download"] button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.trim() === 'Cancel')!;
    cancel.focus();
    cancel.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(download);
  });
});
