import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvWatermarkComponent } from './watermark.component';
import { SV_WATERMARK_LABELS } from './watermark.labels';

async function mark(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvWatermarkComponent, {
    inputs: { variant: 'inspect' },
    providers: providers as never[],
  });
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

afterEach(() => TestBed.resetTestingModule());

const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('SvWatermarkComponent — labels (FL-B1d)', () => {
  it('marks with the English default', async () => {
    const host = await mark();
    expect(text(host.querySelector('[data-sv-probe]'))).toBe(SV_WATERMARK_LABELS.mark);
  });

  it('renders the text an app provides', async () => {
    const host = await mark([
      provideSvLabels({ watermark: { mark: 'Vertraulich', inspectMarks: 'Markierungen' } }),
    ]);
    expect(text(host.querySelector('[data-sv-probe]'))).toBe('Vertraulich');
    expect(host.textContent).toContain('Markierungen');
  });

  it('renders the opacity advice built in code from the provided labels (FL-B1e)', async () => {
    const host = await mark([
      provideSvLabels({ watermark: { opacityUsable: 'Sichtbar und gut lesbar.' } }),
    ]);
    expect(text(host.querySelector('[data-sv-inspect-opacity]'))).toContain('Sichtbar und gut lesbar.');
  });
});
