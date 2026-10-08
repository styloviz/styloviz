import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { render, type ComponentInput } from '@testing-library/angular';
import { until, quietFor } from '../../../../src/testing/async';
import { SvFileUploadComponent } from './file-upload.component';

/**
 * The free upload as a form control (1.0 release). The docs and the gallery
 * bound `sv-file-upload` with `[formControl]` / `formControlName` /
 * `[(ngModel)]`, but only the Pro twin implemented ControlValueAccessor, so the
 * documented binding threw NG01203. Same contract as the Pro twin — these are
 * its tests, run against this tier — plus the one scan rule both tiers share:
 * a flagged file is never in the form value.
 */

async function setup(inputs: Partial<ComponentInput<SvFileUploadComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvFileUploadComponent, {
    inputs: inputs as ComponentInput<SvFileUploadComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const file = (name: string, type = 'text/plain') =>
  new File([new Uint8Array(4)], name, { type });

function dropEvent(files: File[]): DragEvent {
  return { preventDefault() { /* no-op */ }, dataTransfer: { files } } as unknown as DragEvent;
}

@Component({
  standalone: true,
  imports: [SvFileUploadComponent, ReactiveFormsModule],
  template: `<sv-file-upload [formControl]="control" variant="button" />`,
})
class Host {
  readonly control = new FormControl<File[]>([]);
}

async function hosted() {
  TestBed.resetTestingModule();
  return render(Host);
}

const uploader = () => Promise.resolve({});

describe('SvFileUploadComponent — as a form control', () => {
  it('renders the files the form already holds, as already-stored entries', async () => {
    const { fixture } = await hosted();
    fixture.componentInstance.control.setValue([file('a.txt'), file('b.txt')]);
    fixture.detectChanges();

    expect(el(fixture).textContent).toContain('a.txt');
    expect(el(fixture).textContent).toContain('b.txt');
    expect(el(fixture).textContent).toContain('Uploaded');
  });

  it('coerces the null a reset() sends rather than throwing on it', async () => {
    const { fixture } = await hosted();
    fixture.componentInstance.control.setValue([file('a.txt')]);
    fixture.detectChanges();
    fixture.componentInstance.control.reset();
    fixture.detectChanges();

    expect(el(fixture).textContent).not.toContain('a.txt');
  });

  it('reports the native Files back to the form, not its own wrapper type', async () => {
    // A form that receives `UploadFile` objects cannot post them; the control
    // value has to be the browser `File`s.
    const { fixture } = await setup({ variant: 'button' });
    const seen: File[][] = [];
    fixture.componentInstance.registerOnChange((v: File[]) => seen.push(v));

    const picked = file('a.txt');
    fixture.componentInstance.onDrop(dropEvent([picked]));
    expect(seen.at(-1)?.map((f) => f.name)).toEqual(['a.txt']);
    expect(seen.at(-1)?.[0]).toBeInstanceOf(File);
  });

  it('marks the control touched the first time files change', async () => {
    const { fixture } = await hosted();
    expect(fixture.componentInstance.control.touched).toBe(false);

    const picker = el(fixture).querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(picker, 'files', { value: [file('a.txt')], configurable: true });
    picker.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.control.touched).toBe(true);
    expect(fixture.componentInstance.control.value?.map((f) => f.name)).toEqual(['a.txt']);
  });

  it('keeps the event API working alongside the form binding', async () => {
    const { fixture } = await setup({ variant: 'button' });
    const changes: string[][] = [];
    fixture.componentInstance.filesChange.subscribe((all) => changes.push(all.map((u) => u.name)));

    fixture.componentInstance.onDrop(dropEvent([file('a.txt')]));
    expect(changes).toEqual([['a.txt']]);
  });

  it('reports removals and clears to the form as well as to the events', async () => {
    const { fixture } = await setup({ variant: 'button' });
    const seen: string[][] = [];
    fixture.componentInstance.registerOnChange((v: File[]) => seen.push(v.map((f) => f.name)));

    fixture.componentInstance.onDrop(dropEvent([file('a.txt'), file('b.txt')]));
    fixture.componentInstance.removeFile(fixture.componentInstance.files()[0].id);
    fixture.componentInstance.clearAll();

    expect(seen).toEqual([['a.txt', 'b.txt'], ['b.txt'], []]);
  });

  it('reports a completed upload to the form, with the file still attached', async () => {
    const { fixture } = await setup({ variant: 'button', uploader, autoUpload: true });
    const seen: string[][] = [];
    fixture.componentInstance.registerOnChange((v: File[]) => seen.push(v.map((f) => f.name)));

    fixture.componentInstance.onDrop(dropEvent([file('a.txt')]));
    await until(() => fixture.componentInstance.files()[0].status === 'success', {
      label: 'the upload to finish',
    });
    // Once on add, once on success.
    expect(seen).toEqual([['a.txt'], ['a.txt']]);
  });

  it('merges a disabled FormControl with the disabled input', async () => {
    const { fixture } = await setup({ variant: 'button' });
    expect(fixture.componentInstance.resolvedDisabled()).toBe(false);

    fixture.componentInstance.setDisabledState(true);
    fixture.detectChanges();
    expect(fixture.componentInstance.resolvedDisabled()).toBe(true);
    expect(el(fixture).querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);

    fixture.componentInstance.setDisabledState(false);
    fixture.detectChanges();
    expect(fixture.componentInstance.resolvedDisabled()).toBe(false);

    // The input alone still disables it, with the form saying nothing.
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(fixture.componentInstance.resolvedDisabled()).toBe(true);
  });

  it('refuses drops and removals while the FORM has disabled it', async () => {
    const { fixture } = await setup({ variant: 'button' });
    fixture.componentInstance.onDrop(dropEvent([file('a.txt')]));
    const id = fixture.componentInstance.files()[0].id;

    fixture.componentInstance.setDisabledState(true);
    fixture.detectChanges();

    fixture.componentInstance.onDrop(dropEvent([file('b.txt')]));
    fixture.componentInstance.removeFile(id);
    fixture.componentInstance.clearAll();
    expect(fixture.componentInstance.files().map((u) => u.name)).toEqual(['a.txt']);
  });

  it('reads a thumbnail for an image written in by the form', async () => {
    const { fixture } = await setup({ variant: 'button' });
    fixture.componentInstance.writeValue([file('photo.png', 'image/png')]);

    await until(() => !!fixture.componentInstance.files()[0].preview, {
      label: 'the FileReader thumbnail for a form-supplied image',
    });
    fixture.detectChanges();
    expect(fixture.componentInstance.files()[0].preview).toMatch(/^data:image\/png/);
    expect(el(fixture).querySelector('img')).not.toBeNull();
  });

  it('reads no thumbnail for a non-image written in by the form', async () => {
    const { fixture } = await setup({ variant: 'button' });
    fixture.componentInstance.writeValue([file('notes.pdf', 'application/pdf')]);
    await quietFor();
    expect(fixture.componentInstance.files()[0].preview).toBeUndefined();
    expect(fixture.componentInstance.files()[0].status).toBe('success');
  });

  it('keeps a file the scanner flagged out of the form value', async () => {
    const { fixture } = await setup({ variant: 'button' });
    const seen: string[][] = [];
    fixture.componentInstance.registerOnChange((v: File[]) => seen.push(v.map((f) => f.name)));

    fixture.componentInstance.onDrop(dropEvent([file('a.txt'), file('b.txt')]));
    const [a] = fixture.componentInstance.files();
    fixture.componentInstance.markScanned(a.id, 'flagged', 'EICAR test signature');

    expect(seen.at(-1)).toEqual(['b.txt']);
  });
});
