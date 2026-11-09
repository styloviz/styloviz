/**
 * One "create new" flow for every picker that lets the user add an entry the
 * list does not have (`X-13`, `FL-J3-FI-03`).
 *
 * ★★★ FOUR DESCRIPTIONS OF ONE INTERACTION. Autocomplete ("create-new flow"),
 *     Select Dropdown ("create-new") and Tag Input ("creatable") each named the
 *     same thing: type a value that does not exist, get an explicit Create row,
 *     emit a typed event, and show the pending entity while the host persists
 *     it. Only Tag Input had any of it — and only the first half: the tag was
 *     added locally with no event a host could save it from and no way back
 *     when the save failed. This is the contract all three now share.
 *
 * ★★ TWO MODES, ONE EVENT. `awaited: false` (the default every component keeps)
 *    commits the entry at once, as Tag Input always did; `resolve()` can swap
 *    the component's own value for the server's id and `reject()` takes the
 *    entry back out. `awaited: true` shows the entry as PENDING — rendered,
 *    marked busy, not yet in the value — until `resolve()` commits it or
 *    `reject()` drops it. Either way the host gets the same `SvCreateRequest`.
 *
 * ★ EACH HANDLE SETTLES ONCE. A second `resolve()`, a `reject()` after a
 *   `resolve()`, or either after the component is gone is ignored: a retried
 *   network callback must not add the entity twice or remove one that saved.
 */

import { DestroyRef, inject, signal, type Signal } from '@angular/core';
import { SvLiveAnnouncer } from '@styloviz/core/a11y';
import { toSvDataError } from '@styloviz/core/data';
import { svRequestKey } from '@styloviz/core/data';
import type { SvDataError } from '@styloviz/core/data';
import { SV_CORE_LABELS } from '@styloviz/core/i18n';
import { svFormatLabel } from '@styloviz/core/i18n';
import { injectSvLabels } from '@styloviz/core/i18n';

/** What the host's save produced, when it differs from what the user typed. */
export interface SvCreatedEntity {
  /** The persisted id — replaces the component's own value for the entry. */
  readonly value: string;
  /** The persisted label, when the server normalised it. @default the typed label */
  readonly label?: string;
}

/** Emitted when the user activates a picker's "Create ‹query›" row. */
export interface SvCreateRequest {
  /** What the user typed, trimmed. */
  readonly label: string;
  /** The value the component gave the entry (and commits unless `resolve` names another). */
  readonly value: string;
  /** Idempotency key — send it, so a retried save cannot create two entities. */
  readonly requestKey: string;
  /** `true` when the component is showing the entry as pending until you settle. */
  readonly awaited: boolean;
  /** The entity saved. Pass the server's id (and label) to replace the component's own. */
  readonly resolve: (entity?: SvCreatedEntity) => void;
  /** The save failed — the entry is removed and the reason announced and shown. */
  readonly reject: (error?: SvDataError | string) => void;
}

/** The entry on screen while an awaited create is in flight. */
export interface SvPendingCreate {
  readonly label: string;
  readonly value: string;
  readonly requestKey: string;
}

/** How the flow changes the component's value. */
export interface SvCreateFlowOptions {
  /** Add the entry to the value. */
  readonly commit: (entry: { readonly value: string; readonly label: string }) => void;
  /** Swap a committed entry's value/label for the server's (non-awaited `resolve`). */
  readonly replace: (from: string, to: { readonly value: string; readonly label: string }) => void;
  /** Take a committed entry back out (non-awaited `reject`). */
  readonly remove: (value: string) => void;
}

export interface SvCreateFlow {
  /** The awaited entry in flight, or `null`. */
  readonly pending: Signal<SvPendingCreate | null>;
  /** Why the last create failed, or `''`. Cleared by the next create. */
  readonly error: Signal<string>;
  /** Start a create and build the request to emit. */
  begin(label: string, value: string, awaited: boolean): SvCreateRequest;
  /** Forget the last failure (e.g. when the user types again). */
  clearError(): void;
}

/**
 * The shared create-new state machine. Call in an injection context — it
 * speaks through `SvLiveAnnouncer` (the pending entity and a failure are
 * announced, never a component-owned live region) and settles nothing once
 * its owner is destroyed.
 */
export function createCreateFlow(options: SvCreateFlowOptions): SvCreateFlow {
  const labels = injectSvLabels('core', SV_CORE_LABELS);
  const live = inject(SvLiveAnnouncer).scoped();
  let destroyed = false;
  inject(DestroyRef).onDestroy(() => { destroyed = true; });

  const pending = signal<SvPendingCreate | null>(null);
  const error = signal('');

  const fail = (label: string, cause: SvDataError | string | undefined): void => {
    const fallback = svFormatLabel(labels.createFailed, { label });
    const message = cause === undefined ? fallback : toSvDataError(cause, fallback).message;
    error.set(message);
    live.announce(message, { priority: 'assertive' });
  };

  return {
    pending: pending.asReadonly(),
    error: error.asReadonly(),
    clearError: () => error.set(''),
    begin(label, value, awaited) {
      const requestKey = svRequestKey('create');
      let settled = false;
      const settle = (): boolean => {
        if (settled || destroyed) return false;
        settled = true;
        return true;
      };
      error.set('');

      if (awaited) {
        pending.set({ label, value, requestKey });
        live.announce(svFormatLabel(labels.createPending, { label }));
      } else {
        options.commit({ value, label });
      }

      return {
        label,
        value,
        requestKey,
        awaited,
        resolve: (entity) => {
          if (!settle()) return;
          const final = { value: entity?.value ?? value, label: entity?.label ?? label };
          if (awaited) {
            if (pending()?.requestKey === requestKey) pending.set(null);
            options.commit(final);
            live.announce(svFormatLabel(labels.createDone, { label: final.label }));
          } else if (final.value !== value || final.label !== label) {
            options.replace(value, final);
          }
        },
        reject: (cause) => {
          if (!settle()) return;
          if (awaited) {
            if (pending()?.requestKey === requestKey) pending.set(null);
          } else {
            options.remove(value);
          }
          fail(label, cause);
        },
      };
    },
  };
}
