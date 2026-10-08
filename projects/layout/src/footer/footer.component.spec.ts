import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { SvFooterComponent } from './footer.component';

/**
 * A fixed bar with no inputs. The only thing in it that can go stale is the
 * year, which is read once at construction — correct for a page, wrong only for
 * a tab left open across New Year, which is not worth a timer.
 */

describe('SvFooterComponent', () => {
  it('is the page footer landmark', async () => {
    TestBed.resetTestingModule();
    await render(SvFooterComponent);
    expect(screen.getByRole('contentinfo')).toBeTruthy();
  });

  it('shows the current year, not a year someone typed once', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvFooterComponent);
    const year = new Date().getFullYear();
    expect(fixture.componentInstance.currentYear).toBe(year);
    expect(screen.getByRole('contentinfo').textContent).toContain(String(year));
  });

  it('names the product and the stack', async () => {
    TestBed.resetTestingModule();
    await render(SvFooterComponent);
    const text = screen.getByRole('contentinfo').textContent ?? '';
    expect(text).toContain('styloviz');
    expect(text).toContain('Angular 21');
  });
});
