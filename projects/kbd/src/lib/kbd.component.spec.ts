import { render, screen } from '@testing-library/angular';
import { SvKbdComponent } from './kbd.component';

describe('SvKbdComponent', () => {
  it('renders projected content inside a native <kbd>', async () => {
    await render('<sv-kbd>⌘K</sv-kbd>', { imports: [SvKbdComponent] });
    const el = screen.getByText('⌘K');
    expect(el.tagName).toBe('KBD');
  });

  it('defaults to the solid variant with sm sizing', async () => {
    await render('<sv-kbd>Esc</sv-kbd>', { imports: [SvKbdComponent] });
    const el = screen.getByText('Esc');
    expect(el.className).toContain('border-gray-200');
    expect(el.className).toContain('bg-white');
    expect(el.className).toContain('text-[10px]');
  });

  it('drops the border and background for the ghost variant', async () => {
    await render('<sv-kbd variant="ghost">Tab</sv-kbd>', { imports: [SvKbdComponent] });
    const el = screen.getByText('Tab');
    expect(el.className).toContain('bg-transparent');
    expect(el.className).toContain('border-gray-200');
  });

  it('strips its own padding for the plain variant, leaving sizing to the caller', async () => {
    await render('<sv-kbd variant="plain">↵</sv-kbd>', { imports: [SvKbdComponent] });
    const el = screen.getByText('↵');
    expect(el.className).not.toContain('px-1.5');
    expect(el.className).not.toContain('px-2');
    expect(el.className).toContain('border-transparent');
  });

  it('scales up padding and text for the md size', async () => {
    await render('<sv-kbd size="md">↑</sv-kbd>', { imports: [SvKbdComponent] });
    const el = screen.getByText('↑');
    expect(el.className).toContain('px-2');
    expect(el.className).toContain('text-xs');
  });

  it('sets aria-label when explicitly given one', async () => {
    const { fixture } = await render('<sv-kbd ariaLabel="Enter">↵</sv-kbd>', {
      imports: [SvKbdComponent],
    });
    expect(fixture.nativeElement.querySelector('kbd')?.getAttribute('aria-label')).toBe('Enter');
  });

  it('leaves aria-label unset otherwise', async () => {
    await render('<sv-kbd>Esc</sv-kbd>', { imports: [SvKbdComponent] });
    expect(screen.getByText('Esc').getAttribute('aria-label')).toBeNull();
  });

  it('appends customClass after the resolved variant/size classes', async () => {
    await render('<sv-kbd customClass="ml-2">↓</sv-kbd>', { imports: [SvKbdComponent] });
    expect(screen.getByText('↓').className).toContain('ml-2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('SvKbdComponent — a shortcut you can hear', () => {
  it('hides the symbol behind its name when it drew the symbol itself', async () => {
    const { fixture } = await render('<sv-kbd key="cmd" />', { imports: [SvKbdComponent] });
    const el = fixture.nativeElement as HTMLElement;

    // ★★★ `⌘` is U+2318 PLACE OF INTEREST SIGN — a screen reader says "place of
    //     interest sign", or nothing. The glyph is drawn and hidden; the word
    //     is what gets announced.
    expect(el.querySelector('.sr-only')?.textContent).toBe('Command');
    expect(el.querySelector('[aria-hidden="true"]')?.textContent).toBe('⌘');
  });

  it('accepts the glyph a host already hard-coded', async () => {
    const { fixture } = await render('<sv-kbd key="⌘" />', { imports: [SvKbdComponent] });
    expect((fixture.nativeElement as HTMLElement).querySelector('.sr-only')?.textContent)
      .toBe('Command');
  });

  it('renders a chord as one unbreakable group', async () => {
    const { fixture } = await render('<sv-kbd chord="cmd+shift+K" />', {
      imports: [SvKbdComponent],
    });
    const el = fixture.nativeElement as HTMLElement;
    const outer = el.querySelector('kbd')!;

    // ★ "Ctrl +" at the end of a line and "C" at the start of the next is not a
    // shortcut, it is two.
    expect(outer.className).toContain('whitespace-nowrap');
    // Nested <kbd> is the HTML spec's own idiom for a chord.
    expect(outer.querySelectorAll('kbd')).toHaveLength(3);
  });

  it('says the chord once, in order, rather than three unnamed symbols', async () => {
    const { fixture } = await render('<sv-kbd chord="cmd+shift+K" />', {
      imports: [SvKbdComponent],
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.sr-only')?.textContent).toBe('Command Shift K');
    // Every glyph, and every separator, hidden — they are drawn, not read.
    for (const node of Array.from(el.querySelectorAll('kbd kbd, kbd span:not(.sr-only)'))) {
      expect(node.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('lets the host override the spoken name', async () => {
    const { fixture } = await render('<sv-kbd chord="cmd+K" ariaLabel="Open the palette" />', {
      imports: [SvKbdComponent],
    });
    expect((fixture.nativeElement as HTMLElement).querySelector('.sr-only')?.textContent)
      .toBe('Open the palette');
  });

  it('still projects content, and still labels it by attribute, when told nothing', async () => {
    // The component cannot read projected content, so `aria-label` on the
    // element is the only thing it can offer for that case — which is exactly
    // why `key` exists.
    const { fixture } = await render('<sv-kbd ariaLabel="Enter">↵</sv-kbd>', {
      imports: [SvKbdComponent],
    });
    const kbd = (fixture.nativeElement as HTMLElement).querySelector('kbd')!;
    expect(kbd.getAttribute('aria-label')).toBe('Enter');
    expect(kbd.textContent?.trim()).toBe('↵');
  });

  it('keeps the chip styling on every key of a chord', async () => {
    const { fixture } = await render('<sv-kbd chord="ctrl+C" variant="ghost" />', {
      imports: [SvKbdComponent],
    });
    const inner = (fixture.nativeElement as HTMLElement).querySelectorAll('kbd kbd');
    expect(inner).toHaveLength(2);
    for (const node of Array.from(inner)) {
      expect(node.className).toContain('bg-transparent');
    }
  });
});
