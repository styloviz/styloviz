import { TestBed } from '@angular/core/testing';
import { svResetWarnOnce } from '../dev/warn-once';
import { SvShortcutRegistryService } from './shortcut-registry';

/**
 * `X-15` — arbitration, which is the part that had no owner.
 *
 * ★★ The dispatch path is tested through real `keydown` events, because
 * swallowing a keystroke nothing claimed is one of the defects this exists to
 * prevent and `preventDefault()` is only observable on a real event. The
 * precedence table is tested through `resolve()`, which is the same matcher
 * without the DOM — a test that synthesises fifty events to prove a sort is a
 * test of jsdom.
 */

function svc(): SvShortcutRegistryService {
  TestBed.resetTestingModule();
  return TestBed.inject(SvShortcutRegistryService);
}

const press = (
  key: string,
  mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {},
  target: EventTarget | null = null,
) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods, target });

/** A real keydown, so `preventDefault()` is observable. */
function fire(
  key: string,
  mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {},
  target: EventTarget = document.body,
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true, ...mods });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => svResetWarnOnce());

describe('SvShortcutRegistryService — dispatch', () => {
  it('runs a binding and prevents the default', () => {
    const s = svc();
    const ran: string[] = [];
    // jsdom reports a Linux platform, so `mod` is Ctrl here.
    s.register({ keys: 'mod+k', label: 'Palette', run: () => ran.push('k') });

    const event = fire('k', { ctrlKey: true });
    expect(ran).toEqual(['k']);
    expect(event.defaultPrevented).toBe(true);
  });

  it('★ leaves a keystroke nothing claimed alone', () => {
    // Calling preventDefault() for an unclaimed key is how a registry breaks
    // the browser's own shortcuts, which is one of the things it is for.
    const s = svc();
    s.register({ keys: 'mod+k', run: () => {} });
    const event = fire('p', { ctrlKey: true });
    expect(event.defaultPrevented).toBe(false);
  });

  it('stops running after release', () => {
    const s = svc();
    const ran: string[] = [];
    const handle = s.register({ keys: 'mod+k', run: () => ran.push('k') });
    fire('k', { ctrlKey: true });
    handle.release();
    fire('k', { ctrlKey: true });
    expect(ran).toEqual(['k']);
  });

  it('release is idempotent', () => {
    const s = svc();
    const handle = s.register({ keys: 'mod+k', run: () => {} });
    handle.release();
    expect(() => handle.release()).not.toThrow();
    expect(s.bindings()).toEqual([]);
  });

  it('honours `enabled` without needing a release', () => {
    const s = svc();
    let on = false;
    const ran: string[] = [];
    s.register({ keys: 'mod+k', run: () => ran.push('k'), enabled: () => on });

    fire('k', { ctrlKey: true });
    expect(ran).toEqual([]);
    on = true;
    fire('k', { ctrlKey: true });
    expect(ran).toEqual(['k']);
  });
});

describe('SvShortcutRegistryService — typing', () => {
  it('★ does not fire a bare-key binding while the user types', () => {
    // `?` and `/` are the commonest app shortcuts there are, and both are
    // characters people type.
    const s = svc();
    const ran: string[] = [];
    s.register({ keys: '/', label: 'Search', run: () => ran.push('/') });

    const input = document.createElement('input');
    document.body.appendChild(input);
    try {
      fire('/', {}, input);
      expect(ran).toEqual([]);
      fire('/', {}, document.body);
      expect(ran).toEqual(['/']);
    } finally {
      input.remove();
    }
  });

  it('fires inside a field when the binding asks to', () => {
    const s = svc();
    const ran: string[] = [];
    s.register({ keys: 'mod+enter', run: () => ran.push('submit'), whileTyping: true });

    const input = document.createElement('input');
    document.body.appendChild(input);
    try {
      fire('Enter', { ctrlKey: true }, input);
      expect(ran).toEqual(['submit']);
    } finally {
      input.remove();
    }
  });
});

describe('SvShortcutRegistryService — conflicts', () => {
  it('★ the first registration keeps the keystroke; the second is refused', () => {
    // "Last wins" would make the behaviour depend on component construction
    // order, which changes when a lazy route loads.
    const s = svc();
    const ran: string[] = [];
    const first = s.register({ keys: 'mod+k', label: 'Palette', run: () => ran.push('first') });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let second: ReturnType<typeof s.register>;
    try {
      second = s.register({ keys: 'mod+k', label: 'Other', run: () => ran.push('second') });
    } finally {
      warn.mockRestore();
    }

    expect(first.active).toBe(true);
    expect(second.active).toBe(false);
    fire('k', { ctrlKey: true });
    expect(ran).toEqual(['first']);
  });

  it('reports the conflict with both labels', () => {
    const s = svc();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      s.register({ keys: 'mod+k', label: 'Palette', run: () => {} });
      s.register({ keys: 'mod+k', label: 'Other', run: () => {} });
    } finally {
      warn.mockRestore();
    }
    expect(s.conflicts()).toEqual([
      { id: 'mod+k', scope: 'global', heldBy: 'Palette', refused: 'Other' },
    ]);
  });

  it('★ detects a conflict between two spellings of one shortcut', () => {
    const s = svc();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      s.register({ keys: 'mod+shift+p', label: 'A', run: () => {} });
      const second = s.register({ keys: 'shift+mod+p', label: 'B', run: () => {} });
      expect(second.active).toBe(false);
    } finally {
      warn.mockRestore();
    }
  });

  it('is not a conflict across scopes', () => {
    const s = svc();
    const a = s.register({ keys: 'mod+k', scope: 'global', run: () => {} });
    const b = s.register({ keys: 'mod+k', scope: 'overlay', run: () => {} });
    expect([a.active, b.active]).toEqual([true, true]);
    expect(s.conflicts()).toEqual([]);
  });

  it('frees the keystroke again when the holder releases', () => {
    const s = svc();
    const ran: string[] = [];
    const first = s.register({ keys: 'mod+k', run: () => ran.push('first') });
    first.release();
    const second = s.register({ keys: 'mod+k', run: () => ran.push('second') });
    expect(second.active).toBe(true);
    fire('k', { ctrlKey: true });
    expect(ran).toEqual(['second']);
  });

  it('★ forgets a conflict once the holder is gone', () => {
    // Otherwise a shortcuts panel goes on reporting a clash between two things
    // of which only one still exists.
    const s = svc();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const first = s.register({ keys: 'mod+k', label: 'A', run: () => {} });
      s.register({ keys: 'mod+k', label: 'B', run: () => {} });
      expect(s.conflicts()).toHaveLength(1);
      first.release();
      expect(s.conflicts()).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });

  it('refuses an unparseable binding without holding it', () => {
    const s = svc();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const handle = s.register({ keys: 'mod+shift', label: 'Broken', run: () => {} });
      expect(handle.active).toBe(false);
      // ★ And it is not in the list: holding it would show it in a shortcuts
      //   panel as though it worked.
      expect(s.bindings()).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('SvShortcutRegistryService — scope precedence', () => {
  it('★ an overlay binding outranks a route one, which outranks a global one', () => {
    const s = svc();
    s.register({ keys: 'mod+k', scope: 'global', label: 'app', run: () => {} });
    s.register({ keys: 'mod+k', scope: 'route', label: 'page', run: () => {} });
    const overlay = s.register({ keys: 'mod+k', scope: 'overlay', label: 'dialog', run: () => {} });

    expect(s.resolve(press('k', { ctrlKey: true }))?.label).toBe('dialog');
    overlay.release();
    expect(s.resolve(press('k', { ctrlKey: true }))?.label).toBe('page');
  });

  it('hands the keystroke back when the inner scope goes', () => {
    const s = svc();
    s.register({ keys: 'mod+k', scope: 'global', label: 'app', run: () => {} });
    const dialog = s.register({ keys: 'mod+k', scope: 'overlay', label: 'dialog', run: () => {} });
    dialog.release();
    expect(s.resolve(press('k', { ctrlKey: true }))?.label).toBe('app');
  });

  it('skips a disabled higher scope rather than swallowing the key', () => {
    const s = svc();
    s.register({ keys: 'mod+k', scope: 'global', label: 'app', run: () => {} });
    s.register({
      keys: 'mod+k', scope: 'overlay', label: 'dialog', run: () => {}, enabled: () => false,
    });
    expect(s.resolve(press('k', { ctrlKey: true }))?.label).toBe('app');
  });

  it('resolves to nothing when no binding matches', () => {
    const s = svc();
    s.register({ keys: 'mod+k', run: () => {} });
    expect(s.resolve(press('j', { ctrlKey: true }))).toBeNull();
  });
});

describe('SvShortcutRegistryService — the shortcuts list', () => {
  it('lists live bindings with their scope and label', () => {
    const s = svc();
    s.register({ keys: 'mod+k', label: 'Open palette', run: () => {} });
    s.register({ keys: '?', scope: 'route', label: 'Help', run: () => {} });
    expect(s.bindings()).toEqual([
      { id: 'mod+k', scope: 'global', label: 'Open palette' },
      { id: '?', scope: 'route', label: 'Help' },
    ]);
  });

  it('drops a released binding from the list', () => {
    const s = svc();
    const handle = s.register({ keys: 'mod+k', label: 'Open palette', run: () => {} });
    handle.release();
    expect(s.bindings()).toEqual([]);
  });
});
