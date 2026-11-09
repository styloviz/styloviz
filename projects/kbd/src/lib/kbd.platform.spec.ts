import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { afterEach } from 'vitest';
import { SV_KBD_LABELS } from './kbd.labels';
import { svKbdChord, svKbdPlatform, svKbdSequence, svKbdSpokenSequence } from './kbd.keys';
import { SvKbdComponent } from './kbd.component';

/**
 * FL-J3-DD-34 — a platform `mod` token (Command on Apple, Control elsewhere)
 * and sequence composition ("G then I").
 */
const realPlatform = Object.getOwnPropertyDescriptor(Navigator.prototype, 'platform');
function setPlatform(value: string): void {
  Object.defineProperty(navigator, 'platform', { configurable: true, get: () => value });
}
afterEach(() => {
  delete (navigator as { platform?: string }).platform;
  if (realPlatform) Object.defineProperty(Navigator.prototype, 'platform', realPlatform);
});

async function setup(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvKbdComponent, { inputs });
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    el,
    spoken: () => el.querySelector('.sr-only')?.textContent?.trim(),
    caps: () => [...el.querySelectorAll('kbd kbd')].map((k) => k.textContent?.trim()),
  };
}

describe('svKbdPlatform', () => {
  it('reads Apple platforms as apple, everything else as other', () => {
    setPlatform('MacIntel');
    expect(svKbdPlatform()).toBe('apple');
    setPlatform('iPhone');
    expect(svKbdPlatform()).toBe('apple');
    setPlatform('Win32');
    expect(svKbdPlatform()).toBe('other');
    setPlatform('Linux x86_64');
    expect(svKbdPlatform()).toBe('other');
  });
});

describe('the mod token (DD-21-M3)', () => {
  it('resolves to Command on apple and Control elsewhere — one declaration, drawn per OS', () => {
    expect(svKbdChord('mod+K', SV_KBD_LABELS, 'apple').map((k) => k.glyph)).toEqual(['⌘', 'K']);
    expect(svKbdChord('mod+K', SV_KBD_LABELS, 'other').map((k) => k.glyph)).toEqual(['Ctrl', 'K']);
    expect(svKbdChord('mod+K', SV_KBD_LABELS).map((k) => k.spoken)).toEqual(['Control', 'K']);
  });

  it('renders ⌘K on a Mac and Ctrl K on Windows from the same template', async () => {
    setPlatform('MacIntel');
    const mac = await setup({ chord: 'mod+K' });
    expect(mac.caps()).toEqual(['⌘', 'K']);
    expect(mac.spoken()).toBe('Command K');
    setPlatform('Win32');
    const win = await setup({ chord: 'mod+K' });
    expect(win.caps()).toEqual(['Ctrl', 'K']);
    expect(win.spoken()).toBe('Control K');
  });

  it('lets the host pin the platform (the SSR default is other)', async () => {
    setPlatform('Win32');
    const pinned = await setup({ chord: 'mod+K', platform: 'apple' });
    expect(pinned.caps()).toEqual(['⌘', 'K']);
  });

  it('works through the single-key path too', async () => {
    const one = await setup({ key: 'mod', platform: 'other' });
    expect(one.spoken()).toBe('Control');
  });
});

describe('sequences (DD-21-I3)', () => {
  it('splits steps on whitespace and names them "then"', () => {
    const steps = svKbdSequence('g i', SV_KBD_LABELS);
    expect(steps.map((s) => s.map((k) => k.glyph))).toEqual([['g'], ['i']]);
    expect(svKbdSpokenSequence(steps, 'then')).toBe('g then i');
    const combo = svKbdSequence('mod+k mod+s', SV_KBD_LABELS, 'apple');
    expect(svKbdSpokenSequence(combo, 'then')).toBe('Command k then Command s');
  });

  it('draws each step as its own unbreakable chord with "then" between, announced once', async () => {
    const { el, spoken } = await setup({ sequence: 'mod+K mod+S', platform: 'other' });
    const seq = el.querySelector('[data-sv-kbd-sequence]')!;
    expect(spoken()).toBe('Control K then Control S');
    const groups = [...seq.querySelectorAll(':scope > span.whitespace-nowrap')];
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(seq.textContent).toContain('then');
  });

  it('takes the "then" word from the label pack', async () => {
    TestBed.resetTestingModule();
    const { provideSvLabels } = await import('@styloviz/core');
    const { fixture } = await render(SvKbdComponent, {
      inputs: { sequence: 'g i' },
      providers: [provideSvLabels({ kbd: { then: 'dann' } })],
    });
    expect((fixture.nativeElement as HTMLElement).querySelector('.sr-only')?.textContent?.trim()).toBe('g dann i');
  });
});
