import { render } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvKbdComponent } from './kbd.component';
import { SV_KBD_LABELS } from './kbd.labels';

describe('SvKbdComponent — labels (FL-B1e)', () => {
  it('announces a key in English by default', async () => {
    const { fixture } = await render('<sv-kbd key="up" />', { imports: [SvKbdComponent] });
    expect((fixture.nativeElement as HTMLElement).querySelector('.sr-only')?.textContent)
      .toBe(SV_KBD_LABELS.upArrow);
  });

  it('announces a chord in the language an app provides', async () => {
    const { fixture } = await render('<sv-kbd chord="ctrl+shift+K" />', {
      imports: [SvKbdComponent],
      providers: [provideSvLabels({ kbd: { control: 'Steuerung', shift: 'Umschalt' } })],
    });
    expect((fixture.nativeElement as HTMLElement).querySelector('.sr-only')?.textContent)
      .toBe('Steuerung Umschalt K');
  });

  it('draws the words on a key cap in the language an app provides', async () => {
    const { fixture } = await render('<sv-kbd chord="ctrl+pageup" />', {
      imports: [SvKbdComponent],
      providers: [provideSvLabels({ kbd: { glyphCtrl: 'Strg', glyphPageUp: 'Bild↑' } })],
    });
    const caps = [...(fixture.nativeElement as HTMLElement).querySelectorAll('kbd kbd')].map((k) => k.textContent?.trim());
    expect(caps).toEqual(['Strg', 'Bild↑']);
  });
});
