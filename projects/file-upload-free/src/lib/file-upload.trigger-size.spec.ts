import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvFileUploadComponent, type FileUploadSize } from './file-upload.component';

/**
 * `SR-39` — `size` was read only by the drop-zone chrome, which the free tier
 * never renders, so it changed nothing. It now scales the button trigger; `md`
 * is the button as it always was.
 */
async function trigger(size?: FileUploadSize) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvFileUploadComponent, { inputs: size ? { size, hint: 'PNG up to 5 MB' } : { hint: 'PNG up to 5 MB' } });
  const root = fixture.nativeElement as HTMLElement;
  return {
    button: root.querySelector<HTMLButtonElement>('[data-sv-upload-trigger]')!,
    icon: root.querySelector<SVGElement>('[data-sv-upload-trigger] svg')!,
    hint: root.querySelector<HTMLElement>('[data-sv-upload-trigger] + span')!,
  };
}

describe('SvFileUploadComponent (free) — size scales the trigger (SR-39)', () => {
  it('★ the default is the button as it always looked', async () => {
    const { button, icon, hint } = await trigger();
    for (const c of ['px-4', 'py-2', 'text-sm', 'gap-2']) expect(button.classList).toContain(c);
    expect(icon.getAttribute('width')).toBe('16');
    expect(hint.classList).toContain('text-sm');
  });

  it('★ sm and lg are visibly different sizes', async () => {
    const sm = await trigger('sm');
    expect(sm.button.classList).toContain('text-xs');
    expect(sm.icon.getAttribute('width')).toBe('14');
    expect(sm.hint.classList).toContain('text-xs');

    const lg = await trigger('lg');
    expect(lg.button.classList).toContain('text-base');
    expect(lg.button.classList).toContain('px-5');
    expect(lg.icon.getAttribute('width')).toBe('20');
    expect(lg.hint.classList).toContain('text-base');
  });
});
