import { render, type ComponentInput } from '@testing-library/angular';
import { SvCopyToClipboardComponent } from './copy-to-clipboard.component';

/**
 * The block variant fills the width it is given and never sets it. jsdom has no
 * layout, so this pins the CSS contract; the real-engine proof is
 * `e2e/layout-reflow-matrix.spec.ts` (copy-to-clipboard at 320 px).
 */
describe('SvCopyToClipboardComponent — block width contract', () => {
  const VALUE = 'demo_key_51HxAbCdEfGhIjKlMnOpQrStUvWxYz0123456789';

  it('the block host is a shrinkable block, never wider than its parent', async () => {
    const { fixture } = await render(SvCopyToClipboardComponent, { inputs: { variant: 'block', text: VALUE, label: VALUE } as ComponentInput<SvCopyToClipboardComponent> });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList).toContain('block');
    expect(host.classList).toContain('min-w-0');
    expect(host.classList).toContain('max-w-full');
    expect(host.classList).toContain('grow');
  });

  it('the value cannot size the box: inline-size containment, a readable floor, truncation', async () => {
    const { fixture } = await render(SvCopyToClipboardComponent, { inputs: { variant: 'block', text: VALUE, label: VALUE } as ComponentInput<SvCopyToClipboardComponent> });
    const label = (fixture.nativeElement as HTMLElement).querySelector('.font-mono') as HTMLElement;
    expect(label.className).toContain('[contain:inline-size]');
    expect(label.className).toContain('min-w-[12ch]');
    expect(label.classList).toContain('truncate');
    expect(label.classList).toContain('flex-1');
  });

  for (const variant of ['inline', 'icon-only'] as const) {
    it(`${variant} keeps its natural inline sizing`, async () => {
      const { fixture } = await render(SvCopyToClipboardComponent, { inputs: { variant, text: VALUE } as ComponentInput<SvCopyToClipboardComponent> });
      const host = fixture.nativeElement as HTMLElement;
      expect(host.classList).not.toContain('block');
      expect(host.classList).not.toContain('min-w-0');
    });
  }
});
