import { Injectable, computed, inject, signal, DOCUMENT } from '@angular/core';
import { svWarnOnce } from '@styloviz/core/dev';
import {
  svIsTextEntryTarget,
  svMatchesShortcut,
  svParseShortcutSequence,
  svShortcutId,
  type SvShortcut,
} from './shortcut';

/**
 * Which context a shortcut belongs to — a PRECEDENCE BAND, not a lifecycle.
 *
 * ★★ THE REGISTRY CANNOT KNOW ABOUT ROUTES, and does not try to. A binding is
 *    live from `register()` to `release()`, which for a route-scoped one means
 *    "while the page component exists" and for an overlay-scoped one means
 *    "while the overlay is open" — the owner's own lifetime does the work. The
 *    scope says who WINS when two bindings want the same keystroke.
 *
 * `overlay` > `route` > `global`, because the innermost context owns the
 * keystroke. That is the same rule the overlay stack already applies to
 * Escape, and having two different answers to "who owns this key" in one kit
 * is how a dialog ends up unable to close.
 */
export type SvShortcutScope = 'global' | 'route' | 'overlay';

/** What a caller registers. */
export interface SvShortcutBinding {
  /** `'mod+k'`, `'mod+shift+p'`, `'?'`. See `svParseShortcut`. */
  readonly keys: string;
  /** Precedence band. @default 'global' */
  readonly scope?: SvShortcutScope;
  /** What it does, for a shortcut list or a palette row. */
  readonly label?: string;
  /** Run it. `preventDefault()` is called for you when this returns. */
  readonly run: (event: KeyboardEvent) => void;
  /** Consulted on every keystroke, so a binding can go quiet without releasing. */
  readonly enabled?: () => boolean;
  /**
   * Fire even while the user is typing in a field. @default false
   *
   * ★ `?` and `/` are the commonest app shortcuts there are, and both are
   *   characters people type. A bare-key binding that fires inside a comment
   *   box swallows the character and opens a dialog over what was being
   *   written.
   */
  readonly whileTyping?: boolean;
}

/** A live registration. */
export interface SvShortcutHandle {
  /**
   * False when another binding in the same scope already owns these keys.
   *
   * ★ A refused registration is INERT, not an exception: a palette that
   *   cannot bind ⌘K still has to open from its button.
   */
  readonly active: boolean;
  /** Stop listening. Idempotent. */
  release(): void;
}

/** A duplicate registration, for a host that wants to show or log it. */
export interface SvShortcutConflict {
  /** Canonical binding, e.g. `'mod+shift+p'`. */
  readonly id: string;
  readonly scope: SvShortcutScope;
  /** The label that holds the binding. */
  readonly heldBy: string;
  /** The label that asked for it and was refused. */
  readonly refused: string;
}

interface Entry {
  readonly seq: number;
  readonly binding: SvShortcutBinding;
  /** The first step — the whole binding, unless it is a sequence. */
  readonly parsed: SvShortcut;
  /** Every step. Length 1 for an ordinary binding. */
  readonly steps: readonly SvShortcut[];
  readonly id: string;
  readonly scope: SvShortcutScope;
}

const SCOPE_RANK: Record<SvShortcutScope, number> = { global: 0, route: 1, overlay: 2 };

/**
 * How long a sequence waits for its next key, in ms. Gmail and Linear use
 * about a second: long enough for a deliberate second key, short enough that a
 * stray `g` does not hijack the next key pressed a minute later.
 */
export const SV_SHORTCUT_SEQUENCE_TIMEOUT_MS = 1000;

let _seq = 0;

/**
 * SvShortcutRegistryService — one owner for every app keystroke (`X-15`).
 *
 * ── The finding ─────────────────────────────────────────────────────────────
 *
 * ★★★ **NOTHING OWNED THEM.** Command Palette bound its own global key with a
 *     hand-written matcher on `document`; Menubar and Dropdown Menu DISPLAYED
 *     shortcuts they never registered, so what was drawn and what was bound
 *     could not be checked against each other. Two components binding ⌘K both
 *     fired. A shortcut colliding with the browser, the OS, an embedding
 *     editor or a screen reader was nobody's business to notice.
 *
 * ── Why one listener ────────────────────────────────────────────────────────
 *
 * ★★ ONE `keydown` LISTENER, NOT ONE PER BINDING. Fifty bindings mean fifty
 *    handlers on `document`, fifty chances for one of them to
 *    `preventDefault()` a key another was waiting for, and no way to say which
 *    won. With one listener the arbitration is a sort, and it is visible.
 */
@Injectable({ providedIn: 'root' })
export class SvShortcutRegistryService {
  private readonly _document = inject(DOCUMENT, { optional: true });
  private readonly _entries = signal<readonly Entry[]>([]);
  private readonly _conflicts = signal<readonly SvShortcutConflict[]>([]);
  private _listening = false;
  private readonly _handler = (event: KeyboardEvent) => this._dispatch(event);

  /**
   * ★ Platform read once, from the same `navigator.platform` test the palette
   *   used, so `mod` means the same key everywhere in the kit.
   */
  private readonly _isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

  /** Duplicate registrations, in the order they were refused. */
  readonly conflicts = computed(() => this._conflicts());

  /** Every live binding, for a "keyboard shortcuts" panel to render. */
  readonly bindings = computed<readonly { id: string; scope: SvShortcutScope; label: string }[]>(
    () =>
      this._entries().map((e) => ({
        id: e.id,
        scope: e.scope,
        label: e.binding.label ?? '',
      })),
  );

  register(binding: SvShortcutBinding): SvShortcutHandle {
    const steps = svParseShortcutSequence(binding.keys);
    const parsed = steps?.[0] ?? null;
    const id = svShortcutId(binding.keys);
    if (!steps || !parsed || !id) {
      // ★ A binding nobody can press is a bug to report, not state to hold:
      //   holding it would make it show up in a shortcuts panel as though it
      //   worked.
      svWarnOnce(
        `shortcut-unparseable:${binding.keys}`,
        `<sv-*> could not parse the shortcut "${binding.keys}". Use modifiers ` +
          `mod, ctrl, meta, alt, shift and one key, e.g. "mod+shift+p" — or ` +
          `space-separated steps for a sequence, e.g. "g d".`,
      );
      // ★ A null-object handle, not a forgotten body: registration was
      //   REFUSED, so there is nothing to release. Returning one anyway means a
      //   caller can `release()` unconditionally without first asking whether
      //   its own registration worked.
      return { active: false, release: () => { /* nothing was held */ } };
    }

    const scope = binding.scope ?? 'global';
    const held = this._entries().find((e) => e.id === id && e.scope === scope);

    // ★★★ WITHIN A SCOPE, THE FIRST REGISTRATION KEEPS THE KEYSTROKE, and this
    //     is the arbitration the audit asked for. "Last wins" reads as
    //     tempting — the newest thing is usually the innermost — but between
    //     two `global` bindings there IS no inner and outer, so last-wins
    //     makes the behaviour depend on component construction order, which
    //     changes when a lazy route loads. Deterministic and reported beats
    //     plausible and silent.
    //
    // ★★ The nesting case is handled by SCOPE instead: an overlay-scoped
    //    binding outranks a route-scoped one, which outranks a global one, so
    //    a dialog's ⌘K takes precedence over the app's while it is open and
    //    hands it back when it closes. That is the overlay stack's rule, and
    //    the kit should not have two answers to "who owns this key".
    if (held) {
      const conflict: SvShortcutConflict = {
        id,
        scope,
        heldBy: held.binding.label ?? '(unlabelled)',
        refused: binding.label ?? '(unlabelled)',
      };
      this._conflicts.update((list) => [...list, conflict]);
      svWarnOnce(
        `shortcut-conflict:${scope}:${id}`,
        `Two ${scope} shortcuts want "${id}": "${conflict.heldBy}" holds it and ` +
          `"${conflict.refused}" was refused. Give one of them a different binding, ` +
          `or a narrower scope.`,
      );
      // Same null-object as the unparseable case above: the conflict means
      // this binding never entered the registry, so releasing it is a no-op.
      return { active: false, release: () => { /* nothing was held */ } };
    }

    const entry: Entry = { seq: ++_seq, binding, parsed, steps, id, scope };
    this._entries.update((list) => [...list, entry]);
    this._listen();

    return {
      active: true,
      release: () => {
        this._entries.update((list) => list.filter((e) => e.seq !== entry.seq));
        this._conflicts.update((list) => list.filter((c) => !(c.id === id && c.scope === scope)));
        if (this._entries().length === 0) this._unlisten();
      },
    };
  }

  /**
   * Test seam and diagnostic: what would run for this event.
   *
   * Exposed because the arbitration is the whole point of this service, and a
   * test that has to synthesise a real `keydown` to see it is a test of jsdom.
   */
  resolve(
    event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'> & {
      readonly target?: EventTarget | null;
      readonly isComposing?: boolean;
      readonly keyCode?: number;
    },
  ): { id: string; scope: SvShortcutScope; label: string } | null {
    const entry = this._match(event);
    return entry ? { id: entry.id, scope: entry.scope, label: entry.binding.label ?? '' } : null;
  }

  private _match(
    event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'> & {
      readonly target?: EventTarget | null;
      readonly isComposing?: boolean;
      readonly keyCode?: number;
    },
  ): Entry | null {
    // ★★★ AN IME OWNS THE KEYBOARD WHILE IT IS COMPOSING. A Japanese, Chinese
    //     or Korean user confirming a candidate with a modifier chord, or a
    //     dead-key sequence on a European layout, produces keydowns that are
    //     part of TEXT, not commands — and `whileTyping` bindings (the
    //     palette's ⌘K) would otherwise fire in the middle of a word and steal
    //     the composition. `isComposing` is the standard signal; `keyCode`
    //     229 is what Safari and older Chromium report for the same keydowns
    //     instead. Neither ever triggers a binding, whatever its scope.
    if (event.isComposing === true || event.keyCode === 229) return null;
    const typing = svIsTextEntryTarget(event.target ?? null);
    const candidates = this._entries().filter((entry) => {
      // A sequence is never ONE keystroke; `_dispatch` walks it step by step.
      if (entry.steps.length > 1) return false;
      if (!this._eligible(entry, typing)) return false;
      return svMatchesShortcut(event, entry.parsed, this._isMac);
    });
    if (candidates.length === 0) return null;
    // ★ Highest scope wins; within a scope there is at most one, so the
    //   `seq` tiebreak only ever settles cross-scope ties that cannot happen
    //   — it is there so the sort is total rather than accidentally stable.
    return [...candidates].sort(
      (a, b) => SCOPE_RANK[b.scope] - SCOPE_RANK[a.scope] || b.seq - a.seq,
    )[0];
  }

  private _eligible(entry: Entry, typing: boolean): boolean {
    if (entry.binding.enabled && !entry.binding.enabled()) return false;
    return !(typing && entry.binding.whileTyping !== true);
  }

  /** A sequence part-way through: who is still in the running, at which step, since when. */
  private _pending: { readonly entries: readonly Entry[]; readonly step: number; readonly at: number } | null = null;

  /**
   * Feed one keydown to the sequences. Returns the entry to run when this key
   * completes one, `'pending'` when it advanced one, or `null` when no
   * sequence wants it (the pending state is then forgotten).
   *
   * ★★ A COMPLETED SEQUENCE BEATS A SINGLE KEY. `g d` and `d` can both exist;
   *    after `g`, the `d` belongs to the sequence the user is in the middle of.
   *    Outside a sequence, a single-key binding keeps its key — a sequence only
   *    STARTS on a key nothing else claims.
   */
  private _advance(event: KeyboardEvent, now: number): Entry | 'pending' | null {
    const typing = svIsTextEntryTarget(event.target ?? null);
    const pending = this._pending;
    if (pending !== null && now - pending.at <= SV_SHORTCUT_SEQUENCE_TIMEOUT_MS) {
      const live = this._entries();
      const still = pending.entries.filter(
        (e) => live.includes(e) && this._eligible(e, typing) && svMatchesShortcut(event, e.steps[pending.step], this._isMac),
      );
      const done = still.filter((e) => e.steps.length === pending.step + 1);
      if (done.length > 0) {
        this._pending = null;
        return [...done].sort((a, b) => SCOPE_RANK[b.scope] - SCOPE_RANK[a.scope] || b.seq - a.seq)[0];
      }
      if (still.length > 0) {
        this._pending = { entries: still, step: pending.step + 1, at: now };
        return 'pending';
      }
    }
    this._pending = null;
    return null;
  }

  /** Start a sequence on a key no single binding claimed. */
  private _start(event: KeyboardEvent, now: number): boolean {
    const typing = svIsTextEntryTarget(event.target ?? null);
    const starting = this._entries().filter(
      (e) => e.steps.length > 1 && this._eligible(e, typing) && svMatchesShortcut(event, e.steps[0], this._isMac),
    );
    if (starting.length === 0) return false;
    this._pending = { entries: starting, step: 1, at: now };
    return true;
  }

  private _dispatch(event: KeyboardEvent): void {
    // Composition owns the keyboard — same rule as `_match`.
    if (event.isComposing === true || event.keyCode === 229) return;
    const now = Date.now();
    const sequence = this._advance(event, now);
    if (sequence === 'pending') {
      event.preventDefault();
      return;
    }
    if (sequence !== null) {
      event.preventDefault();
      sequence.binding.run(event);
      return;
    }
    const entry = this._match(event);
    if (!entry) {
      if (this._start(event, now)) event.preventDefault();
      return;
    }
    // ★ `preventDefault()` only when something actually ran. Calling it for a
    //   keystroke nothing claimed is how a registry breaks the browser's own
    //   shortcuts, which is one of the things it exists to prevent.
    event.preventDefault();
    entry.binding.run(event);
  }

  private _listen(): void {
    // ★ SSR: no document, no keyboard. The registry still holds bindings so a
    //   prerendered shortcuts panel renders, and starts listening when a
    //   browser picks it up.
    if (this._listening || !this._document) return;
    this._document.addEventListener('keydown', this._handler);
    this._listening = true;
  }

  private _unlisten(): void {
    if (!this._listening || !this._document) return;
    this._document.removeEventListener('keydown', this._handler);
    this._listening = false;
  }
}
