import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvFileUploadComponent } from './file-upload.component';

/**
 * `X-12` — removing a file with the keyboard must not drop focus to `<body>`.
 * The rule: the Remove button of the file now at that index, else the one
 * before it, else the control that adds files.
 */

const file = (name: string) => new File([new Uint8Array(10)], name, { type: 'text/plain' });
const flush = () => new Promise((r) => setTimeout(r, 0));

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvFileUploadComponent, { inputs });
  const c = fixture.componentInstance;
  c['addFiles']([file('a.txt'), file('b.txt'), file('c.txt')]);
  fixture.detectChanges();
  await flush();
  fixture.detectChanges();
  return fixture;
}
type Fixture = Awaited<ReturnType<typeof setup>>;

const removeBtn = (f: Fixture, name: string) =>
  (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(`[data-sv-file-remove][aria-label="Remove ${name}"]`)!;

async function removeViaKeyboard(f: Fixture, name: string) {
  const btn = removeBtn(f, name);
  btn.focus();
  btn.click();
  f.detectChanges();
  await flush();
}


describe('SvFileUploadComponent — X-12 focus after a file is removed', () => {
  it('moves to the Remove button of the next file', async () => {
    const f = await setup();
    await removeViaKeyboard(f, 'b.txt');
    expect(document.activeElement).toBe(removeBtn(f, 'c.txt'));
  });

  it('moves to the previous file when the last one goes', async () => {
    const f = await setup();
    await removeViaKeyboard(f, 'c.txt');
    expect(document.activeElement).toBe(removeBtn(f, 'b.txt'));
  });

  it('moves to the add-files control when the list empties', async () => {
    const f = await setup();
    await removeViaKeyboard(f, 'a.txt');
    await removeViaKeyboard(f, 'b.txt');
    await removeViaKeyboard(f, 'c.txt');
    expect(document.activeElement).toBe((f.nativeElement as HTMLElement).querySelector('[data-sv-upload-trigger]'));
  });

  it('Clear all hands focus to the add-files control', async () => {
    const f = await setup();
    const clear = (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-sv-file-clear]')!;
    clear.focus();
    clear.click();
    f.detectChanges();
    await flush();
    expect(document.activeElement).toBe((f.nativeElement as HTMLElement).querySelector('[data-sv-upload-trigger]'));
  });

  it('does not steal focus when the host removes a file programmatically', async () => {
    const f = await setup();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    f.componentInstance.removeFile(f.componentInstance.files()[0].id);
    f.detectChanges();
    await flush();
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
});
