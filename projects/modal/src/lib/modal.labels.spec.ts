import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvModalComponent } from './modal.component';
import { SV_MODAL_LABELS } from './modal.labels';
import { until } from '../../../../src/testing/async';

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const r = await render(SvModalComponent, {
    inputs: { isOpen: true, title: 'Settings' },
    providers: providers as never[],
  });
  await until(() => document.querySelector('[role="dialog"]') !== null, { label: 'the dialog to mount' });
  r.fixture.detectChanges();
  return r;
}

afterEach(() => {
  document.querySelectorAll('[data-sv-modal-portal]').forEach((n) => n.remove());
  document.body.style.overflow = '';
  document.body.style.paddingInlineEnd = '';
});

describe('SvModalComponent — accessible names', () => {
  it('names the close button in English by default', async () => {
    await setup();
    expect(screen.getByRole('button', { name: SV_MODAL_LABELS.closeDialog })).toBeTruthy();
  });

  it('renders the names an app provides', async () => {
    await setup([provideSvLabels({ modal: { closeDialog: 'Dialog schließen' } })]);
    expect(screen.getByRole('button', { name: 'Dialog schließen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Close dialog' })).toBeNull();
  });
});

describe('SvModalComponent — visible text (FL-B1d)', () => {
  it('shows the loading text an app provides', async () => {
    TestBed.resetTestingModule();
    const r = await render(SvModalComponent, {
      inputs: { isOpen: true, title: 'Settings', loading: true },
      providers: [provideSvLabels({ modal: { loading: 'Wird geladen…' } })],
    });
    await until(() => document.querySelector('[role="dialog"]') !== null, { label: 'the dialog to mount' });
    r.fixture.detectChanges();
    const status = document.querySelector('[role="dialog"] [role="status"]');
    expect(status?.textContent).toContain('Wird geladen…');
    expect(status?.textContent).not.toContain('Loading…');
  });
});
