import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { render } from '@testing-library/angular';
import { describePortalContext } from '@testing/portal-context';
import { SvDatePickerComponent } from './date-picker.component';

/** `FL-J3-FI-01` — the free date picker carries dir, lang and a scoped theme into its calendar. */
describePortalContext({
  name: 'sv-date-picker',
  component: SvDatePickerComponent,
  selector: 'sv-date-picker',
  label: 'date-picker',
  open: (c) => c.toggle(),
});

describe('sv-date-picker under dir="rtl" (X-7)', () => {
  afterEach(() => document.querySelectorAll('[data-sv-portal]').forEach((n) => n.remove()));

  it('start-aligns the calendar to the trigger’s right edge', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render('<div dir="rtl"><sv-date-picker></sv-date-picker></div>', {
      imports: [SvDatePickerComponent],
    });
    const debug = fixture.debugElement.query(By.directive(SvDatePickerComponent));
    const host = debug.nativeElement as HTMLElement;
    const rect = { top: 100, bottom: 140, left: 500, right: 900, width: 400, height: 40, x: 500, y: 100 };
    host.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect }) as DOMRect;
    const c = debug.componentInstance as SvDatePickerComponent;
    c.toggle();
    expect(c.panelStyle()['left']).toBe(`${900 - 280}px`);
  });
});
