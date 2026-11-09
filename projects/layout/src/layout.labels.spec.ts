import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvCopyToClipboardComponent } from './copy-to-clipboard/copy-to-clipboard.component';
import { SvSiteFooterComponent } from './site-footer/site-footer.component';
import { SvClipboardError, SV_CLIPBOARD } from './copy-to-clipboard/clipboard.adapter';
import { SV_LAYOUT_LABELS } from './layout.labels';

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvCopyToClipboardComponent, {
    inputs: { variant: 'block', label: 'sk_live_123456', text: 'sk_live_123456', sensitive: true, sensitiveReveal: 'revealable', requireAuthorization: false } as never,
    providers: providers as never[],
  });
}

describe('@styloviz/layout — accessible names', () => {
  it('names the reveal toggle in English by default', async () => {
    await setup();
    expect(screen.getByRole('button', { name: SV_LAYOUT_LABELS.showValue })).toBeTruthy();
  });

  it('renders the names an app provides', async () => {
    await setup([provideSvLabels({ layout: { showValue: 'Wert anzeigen' } })]);
    expect(screen.getByRole('button', { name: 'Wert anzeigen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show value' })).toBeNull();
  });
});

describe('@styloviz/layout — visible text (FL-B1d)', () => {
  it('renders the copyright line an app provides', async () => {
    TestBed.resetTestingModule();
    await render(SvSiteFooterComponent, {
      inputs: { brandName: 'Acme' },
      providers: [provideSvLabels({ layout: { footerCopyrightBrand: '© {year} {brand}. Alle Rechte vorbehalten.' } })],
    });
    const year = new Date().getFullYear();
    expect(screen.getByText(`© ${year} Acme. Alle Rechte vorbehalten.`)).toBeTruthy();
    expect(screen.queryByText(`© ${year} Acme. All rights reserved.`)).toBeNull();
  });
});

describe('@styloviz/layout — text built in TypeScript (FL-B1e)', () => {
  it('announces a failed copy in the language an app provides', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvCopyToClipboardComponent, {
      inputs: { text: 'demo' } as never,
      providers: [
        { provide: SV_CLIPBOARD, useValue: { writeText: () => Promise.reject(new SvClipboardError('denied')) } },
        provideSvLabels({ layout: { copyDenied: 'Kopieren vom Browser blockiert.' } }),
      ],
    });
    await fixture.componentInstance.copy();
    fixture.detectChanges();
    const live = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]')?.textContent?.trim() ?? '';
    expect(live).toContain('Kopieren vom Browser blockiert.');
    expect(live).not.toContain('Copy blocked by the browser');
  });
});
