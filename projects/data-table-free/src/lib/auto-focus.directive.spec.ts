import { render } from '@testing-library/angular';
import { DtAutoFocusDirective } from './auto-focus.directive';

/** `svDtAutoFocus` — the inline editor's input takes focus once it has rendered. */

describe('DtAutoFocusDirective', () => {
  it('focuses its host after the first render, a bare attribute counting as on', async () => {
    const { fixture } = await render('<input aria-label="Edit" svDtAutoFocus />', { imports: [DtAutoFocusDirective] });
    await fixture.whenStable();
    expect(document.activeElement).toBe((fixture.nativeElement as HTMLElement).querySelector('input'));
  });

  it('leaves focus alone when switched off', async () => {
    const { fixture } = await render('<input aria-label="Edit" [svDtAutoFocus]="false" />', { imports: [DtAutoFocusDirective] });
    await fixture.whenStable();
    expect(document.activeElement).not.toBe((fixture.nativeElement as HTMLElement).querySelector('input'));
  });
});
