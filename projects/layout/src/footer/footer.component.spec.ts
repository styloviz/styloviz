import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { SvFooterComponent } from './footer.component';

/** A bar with two slots; the only promise is the landmark and the placement. */

@Component({
  standalone: true,
  imports: [SvFooterComponent],
  template: `<sv-footer><span>© Acme</span><span svFooterEnd>v3.1</span></sv-footer>`,
})
class HostComponent {}

describe('SvFooterComponent', () => {
  it('is the page footer landmark', async () => {
    TestBed.resetTestingModule();
    await render(HostComponent);
    expect(screen.getByRole('contentinfo')).toBeTruthy();
  });

  it('puts the default slot at the start and [svFooterEnd] at the end', async () => {
    TestBed.resetTestingModule();
    await render(HostComponent);
    const [start, end] = [...screen.getByRole('contentinfo').firstElementChild!.children];
    expect(start.textContent).toBe('© Acme');
    expect(end.textContent).toBe('v3.1');
  });

  it('says nothing of its own — no product name a buyer would have to remove', async () => {
    TestBed.resetTestingModule();
    await render(SvFooterComponent);
    expect(screen.getByRole('contentinfo').textContent?.trim()).toBe('');
  });
});
