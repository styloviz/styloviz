import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvAffixComponent } from './affix.component';

/** FL-B1e: the state read-out `svAffixLabel` builds comes from the labels. */
describe('SvAffixComponent — labels', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('announces the state in the language an app provides', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvAffixComponent, {
      inputs: { offsetTop: 16 },
      providers: [provideSvLabels({ affix: { stateStatic: 'Im Textfluss.' } })],
    });
    fixture.detectChanges();
    const label = (fixture.nativeElement as HTMLElement).querySelector('[data-sv-state-label]');
    expect(label?.textContent?.trim()).toBe('Im Textfluss.');
  });
});
