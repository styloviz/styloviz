import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core/dev';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SV_LINK_ADAPTER, type SvLinkAdapter } from '@styloviz/core/nav';
import { SvBackUpComponent } from './back-up.component';

/** A link adapter that records nothing and navigates nowhere — the spec only reads the text. */
const adapter: SvLinkAdapter = {
  kind: 'spec',
  href: (target) => (typeof target === 'string' ? target : target.join('/')),
  navigate: () => true,
};

describe('SvBackUpComponent — one-word UI text (FL-B1e wave 3)', () => {
  it('words the control from the labels an app provides', async () => {
    TestBed.resetTestingModule();
    svResetWarnOnce();
    const { fixture } = await render(SvBackUpComponent, {
      inputs: { mode: 'up', up: '/orders', upLabel: 'Bestellungen' },
      providers: [
        { provide: SV_LINK_ADAPTER, useValue: adapter },
        provideSvLabels({ backUp: { upTo: 'Hoch zu {name}' } }),
      ],
    });
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Hoch zu Bestellungen');
    expect(root.textContent).not.toContain('Up to');
  });
});
