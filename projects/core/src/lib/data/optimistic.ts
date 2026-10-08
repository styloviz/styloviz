declare const ngDevMode: boolean | undefined;

/** Fallback counter for `svRequestKey`, used only when `randomUUID` is missing. */
// module-id-counter: data id — never rendered as a DOM id during a server render.
let _svRequestUid = 0;

/**
 * A key identifying one write, unique across clients and page loads — the third
 * thing an optimistic action owes its host, alongside `rollback()` and a pending
 * input.
 *
 * Put it in the event payload, send it with the request, and have the server
 * ignore a key it has already applied. Without one, a flaky connection retried
 * by an HTTP interceptor turns one "like" into two, and a double-tap becomes
 * like-unlike-like against a server free to apply them in any order.
 *
 * ★ Not `crypto.randomUUID()` on its own. That is only defined in a **secure
 *   context**, so it is `undefined` on a demo served over plain http from a
 *   staging box — which is exactly where a buyer first tries the kit, and a
 *   `TypeError` thrown from a click handler is not the impression to make. The
 *   fallback is not cryptographically random and does not need to be: it only
 *   has to be distinct per write.
 *
 * Deliberately NOT the module counter used for DOM ids elsewhere in the kit.
 * Those only have to be unique within one document; this has to be unique
 * against every other client writing to the same server.
 *
 * @param prefix Short component tag for readability in a server log (`'like'`).
 */
export function svRequestKey(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `${prefix}-${Date.now().toString(36)}-${++_svRequestUid}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * A rollback handle for one optimistically-applied edit.
 *
 * @see createOptimisticEdit
 */
export interface SvOptimisticEdit {
  /**
   * Take a handle for the edit about to be applied. `undo` runs when the host
   * calls the returned function — unless a later edit has superseded this one,
   * in which case the call is refused with a dev-mode warning.
   */
  begin(undo: () => void): () => void;
}

/** How the warning names what happened, and how the host can prevent it. */
export interface SvOptimisticEditOptions {
  /**
   * The revision of the state this edit is against. Any change to the number
   * means a later edit has landed and this handle is stale.
   *
   * A monotonic counter the component bumps per action is the usual answer; a
   * component with a command history (the Gantt chart) passes that revision,
   * because undoing there means popping a command rather than restoring a
   * snapshot, and the history is what makes it exact.
   */
  readonly revision: () => number;
  /** Element selector, for the warning prefix. */
  readonly selector: string;
  /**
   * What has changed, what undoing would now lose, and the input to bind so it
   * cannot arise. Written per component because only the component knows which
   * input locks the action out — `[saving]` for one list, `[pendingCardIds]`
   * for a board.
   */
  readonly superseded: string;
}

/**
 * Let a host undo an optimistically-applied edit, and refuse when undoing would
 * silently destroy a newer one.
 *
 * The bug this prevents: a card is dragged, the write fails, the host calls
 * `rollback()` — but the user has already dragged a second card, and the
 * snapshot the first handle is holding predates both. Restoring it puts the
 * first card back AND throws away the second move, which no one asked for and
 * nothing reports. So a stale handle does nothing and says why.
 *
 * The kit's optimistic contract in three parts, of which this is the second:
 *
 *   1. **Apply immediately.** A row that snaps back while a request is in flight
 *      feels broken, so the component moves first and tells the host after.
 *   2. **Hand back a way out.** The event payload carries `rollback()`. Not a
 *      method reached through a `ViewChild` — the host that needs it is the one
 *      handling the event, and it should not have to query the view to answer.
 *   3. **Lock the action while it is in flight.** A `saving` / `pending…` input
 *      the host binds. That is what keeps rule 2 unambiguous, and the warning
 *      below names the input to bind.
 *
 * Deliberately NOT here: an undo *window*. A component that starts a timer and
 * commits a deletion when it expires is claiming a write it never makes — the
 * defect class of a progress bar that completes on its own. The undo window is
 * the host's, built on the handle this returns and whatever toast it already
 * has.
 *
 * ```ts
 * private _moveSeq = 0;
 * private readonly edit = createOptimisticEdit({
 *   revision: () => this._moveSeq,
 *   selector: 'sv-kanban-board',
 *   superseded:
 *     'another card has moved since. Restoring the old board would discard that ' +
 *     'move. Bind [pendingCardIds] so a card cannot be moved again while its ' +
 *     'write is in flight.',
 * });
 *
 * private emitMove(): void {
 *   const snapshot = this._cols();
 *   this._moveSeq++;
 *   this.cardMoved.emit({ …, rollback: this.edit.begin(() => this._cols.set(snapshot)) });
 * }
 * ```
 *
 * A plain factory, not a service: it closes over one function and needs no
 * injection context, so it can be called straight from a field initializer.
 */
export function createOptimisticEdit(options: SvOptimisticEditOptions): SvOptimisticEdit {
  const { revision, selector, superseded } = options;

  return {
    begin(undo: () => void): () => void {
      // Read AFTER the caller has bumped its counter, so the handle is against
      // the state its own edit produced — not the one before it.
      const taken = revision();

      return () => {
        if (revision() !== taken) {
          if (typeof ngDevMode !== 'undefined' && ngDevMode) {
            console.warn(`[styloviz] ${selector}: rollback() ignored — ${superseded}`);
          }
          return;
        }
        undo();
      };
    },
  };
}
