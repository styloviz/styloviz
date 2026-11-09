import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { render } from '@testing-library/angular';
import { describePortalContext } from '@testing/portal-context';
import { SvAutocompleteComponent } from './autocomplete/autocomplete.component';
import { SvColorPickerComponent } from './color-picker/color-picker.component';
import { SvTimePickerComponent } from './time-picker/time-picker.component';

/**
 * `FL-J3-FI-01` — the three `@styloviz/forms` overlays portal through core
 * `createPortalHost`, so dir, lang and a locally scoped theme reach the panel.
 */
describePortalContext({
  name: 'sv-autocomplete',
  component: SvAutocompleteComponent,
  selector: 'sv-autocomplete',
  bindings: '[options]="options"',
  props: { options: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }] },
  label: 'autocomplete',
  open: (c) => c.onFocus(),
});

describePortalContext({
  name: 'sv-color-picker',
  component: SvColorPickerComponent,
  selector: 'sv-color-picker',
  label: 'color-picker',
  open: (c) => c.toggle(),
});

describePortalContext({
  name: 'sv-time-picker',
  component: SvTimePickerComponent,
  selector: 'sv-time-picker',
  label: 'time-picker',
  open: (c) => c.toggle(),
});

/** Give an element a rect jsdom never computed. */
function stubRect(node: HTMLElement, r: Partial<DOMRect>): void {
  const rect = { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, x: 0, y: 0, ...r };
  node.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect }) as DOMRect;
}

describe('form overlays under dir="rtl" — start edge is the trigger’s right edge (X-7)', () => {
  afterEach(() => document.querySelectorAll('[data-sv-portal]').forEach((n) => n.remove()));

  for (const [name, component] of [
    ['sv-time-picker', SvTimePickerComponent],
    ['sv-color-picker', SvColorPickerComponent],
  ] as const) {
    it(`${name}: pins the panel to the trigger's right edge`, async () => {
      TestBed.resetTestingModule();
      const { fixture } = await render(`<div dir="rtl"><${name}></${name}></div>`, { imports: [component] });
      const debug = fixture.debugElement.query(By.directive(component));
      const trigger = (debug.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-trigger]')!;
      stubRect(trigger, { top: 100, bottom: 130, left: 600, right: 900, width: 300, height: 30 });
      const c = debug.componentInstance as SvTimePickerComponent | SvColorPickerComponent;
      c.toggle();
      const style = c.panelStyle();
      expect(style['right']).toBe(`${window.innerWidth - 900}px`);
      expect(style['left']).toBeUndefined();
    });
  }
});
