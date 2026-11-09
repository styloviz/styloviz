import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvImageCompareComponent } from './image-compare.component';
import { SV_IMAGE_COMPARE_LABELS } from './image-compare.labels';

const SRC_A = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const SRC_B = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

/** FL-B1d: the visible text is the package's English default until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvImageCompareComponent, {
    inputs: { beforeSrc: SRC_A, afterSrc: SRC_B, variant: 'inspect' },
    providers: providers as never[],
  });
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const terms = (el: HTMLElement) => Array.from(el.querySelectorAll('[data-sv-inspect] dt')).map((dt) => dt.textContent?.trim());

describe('SvImageCompareComponent — labels', () => {
  it('reads English by default', async () => {
    const el = await setup();
    expect(terms(el)).toContain(SV_IMAGE_COMPARE_LABELS.inspectDifference);
    expect(el.querySelector('[data-sv-before]')?.getAttribute('alt')).toBe(SV_IMAGE_COMPARE_LABELS.beforeAlt);
  });

  it('renders the text an app provides', async () => {
    const el = await setup([provideSvLabels({ imageCompare: { inspectDifference: 'Unterschied', beforeAlt: 'das Vorher-Bild' } })]);
    expect(terms(el)).toContain('Unterschied');
    expect(terms(el)).not.toContain('difference');
    expect(el.querySelector('[data-sv-before]')?.getAttribute('alt')).toBe('das Vorher-Bild');
  });
});

describe('SvImageCompareComponent — text built in TypeScript (FL-B1e)', () => {
  it('speaks the position with the template an app provides', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvImageCompareComponent, {
      inputs: { beforeSrc: SRC_A, afterSrc: SRC_B, beforeAlt: 'das Original', afterAlt: 'die Retusche', position: 0.25 },
      providers: [provideSvLabels({ imageCompare: { positionMix: '{afterPercent} % {after}, {beforePercent} % {before}.' } })],
    });
    fixture.detectChanges();
    const handle = (fixture.nativeElement as HTMLElement).querySelector('[data-sv-handle]');
    expect(handle?.getAttribute('aria-valuetext')).toBe('25 % die Retusche, 75 % das Original.');
  });
});
