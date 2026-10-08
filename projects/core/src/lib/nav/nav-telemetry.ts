import {
  InjectionToken,
  inject,
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from '@angular/core';
import { svWarnOnce } from '../dev/warn-once';

declare const ngDevMode: boolean | undefined;

/**
 * ============================================================================
 *  Navigation analytics with source and intent — `X-15`
 * ============================================================================
 *
 * The seven navigation families between them emit eleven differently-shaped
 * "the user moved" events, and **not one of them says where the move came from
 * or what kind of move it was.** A host that wants to answer "are people
 * reaching settings through the sidebar or through search?" has to correlate
 * `(tabChange)`, `(pageChange)`, `(stepChange)`, `(itemToggled)` and four more
 * by hand, in its own vocabulary, and re-do it for every component it adds.
 *
 * `sv-stepper` is the exception and the model: it already emits a dedicated
 * `telemetry` stream with a `type`, a step id and a branch. `X-15` is that
 * stream generalized so the other six can share it.
 *
 * ── ★★★ "INTENT" IS INFERRED FROM THE GESTURE, AND THIS FILE SAYS SO OUT LOUD ─
 * The backlog asks for "what the user appeared to be looking for". A component
 * cannot know that. What it knows exactly is **what kind of move the gesture
 * was** — stepping forward one, jumping past the middle, opening a panel to
 * look — and that is what {@link SvNavIntent} names. The distinction matters
 * because the alternative is a field called `intent` that a host reads as a
 * statement about a person's goal when it is a statement about a click.
 * `explore` means a panel was opened, not that somebody was browsing.
 *
 * ── ★★ TWO CONSTRAINTS, AND BOTH ARE MECHANISMS RATHER THAN NOTES ────────────
 * The item names two, and a note in a README enforces neither:
 *
 *   1. **Consent gates every event, checked at emit time.** Not at construction
 *      — a user who withdraws consent mid-session must stop being recorded on
 *      the next click, not on the next page load. And the gate lives HERE, so a
 *      component cannot forget it; {@link svNavRecorder} is the only way in.
 *
 *   2. **A key is stripped unless a retention policy was declared.** `key` is
 *      whatever the family navigates by — a tab id, a step id, a page number —
 *      and in a real app those are record identifiers: `orders/8814` is a tab
 *      id and a customer's order. So a sink that does not state a retention
 *      window never receives one. See {@link SvNavRetention}.
 *
 * ── ⚠️ There is no tour telemetry to share a flag with ───────────────────────
 * The item says to "gate it behind the same consent flag as the tour
 * telemetry". **There is no such flag in this tree** — `projects/product-tour`
 * emits no telemetry and nothing in `core` holds a consent state; the only
 * privacy contract that exists is `SvAiPrivacyPolicy`, which governs masking
 * rendered content and answers a different question. So the flag is defined
 * here, as part of the sink, rather than imported from somewhere it does not
 * exist — and a tour that later wants telemetry has one to adopt.
 */

// ─── Vocabulary ──────────────────────────────────────────────────────────────

/**
 * Which navigation surface the move came from.
 *
 * The seven shipped families plus the two surfaces that are not components —
 * `link` for a plain anchor a host instruments itself, and `address` for a move
 * that arrived from the URL rather than from anything on screen.
 *
 * ★ Open to a host's own strings on purpose. A dashboard's command palette and
 *   its global search are navigation surfaces too, and the point of the stream
 *   is to compare them against the kit's; a closed union would make the
 *   comparison impossible in exactly the app that most wants it.
 */
export type SvNavSurface =
  | 'tabs'
  | 'stepper'
  | 'pagination'
  | 'breadcrumb'
  | 'anchor'
  | 'mega-menu'
  | 'accordion'
  | 'jump-menu'
  | 'sidebar'
  | 'link'
  | 'address'
  | (string & {});

/**
 * What KIND of move the gesture was. Eight values, closed, and each one is
 * something a component can observe rather than guess.
 *
 * - `advance` — one forward through an ordered set. Next, arrow-right, the
 *   Continue button.
 * - `retreat` — one backward through the same set.
 * - `jump` — straight to a named destination, skipping whatever is between. A
 *   page number, a step click, a breadcrumb crumb, an anchor link.
 * - `explore` — a surface was opened to see what is in it, with nothing yet
 *   chosen. A mega-menu panel, an overflow menu, an accordion header.
 * - `resume` — the position came from the address or from restored state, not
 *   from a gesture. A deep link, a back button, a restored wizard.
 * - `refine` — the same set, presented differently. A page-size change.
 * - `escape` — the surface was left without a destination. Escape, a backdrop
 *   click, a dismissal.
 * - `blocked` — the move was asked for and refused. A linear gate, a guard
 *   rule, a disabled step.
 *
 * ★★ `blocked` IS THE ONE THAT PAYS FOR THE REST. Every other value has a
 *    rough equivalent somewhere in a host's existing analytics, because a
 *    successful navigation leaves a trail. A refusal leaves nothing at all: the
 *    user pressed something, nothing happened, and no page view was recorded.
 *    A wizard whose linear gate is misconfigured is invisible to conventional
 *    analytics and obvious in this stream.
 */
export type SvNavIntent =
  | 'advance'
  | 'retreat'
  | 'jump'
  | 'explore'
  | 'resume'
  | 'refine'
  | 'escape'
  | 'blocked';

/**
 * How long the sink keeps what it is sent — a **documented** window, or `none`.
 *
 * ★★★ `'none'` IS THE DEFAULT AND IT IS LOAD-BEARING, NOT A PLACEHOLDER. A sink
 *     that declares `'none'` still receives every event; what it does not
 *     receive is {@link SvNavEvent.key} or {@link SvNavEvent.label}, because
 *     those are the two fields that can carry a record identifier. Counting how
 *     often people use the sidebar needs no identifier at all, so the default
 *     is the useful analytics with none of the liability.
 *
 * ⚠️ `surfaceId` and `reason` are NOT stripped — "which surface" is the point
 *    of the stream. That makes them static by contract: a surface name and a
 *    fixed reason word, never a record id. A dev build warns when a
 *    `surfaceId` sent to a `'none'` sink looks like one.
 *
 * Anything else is a string the host writes and is accountable for — `'30d'`,
 * `'session'`, `'per privacy policy §4'`. It is never parsed and never
 * enforced: this package cannot delete rows in somebody's warehouse. What it
 * can do is make the field impossible to omit, so "we never decided" stops
 * being expressible.
 */
export type SvNavRetention = 'none' | (string & {});

/**
 * One navigation, as recorded.
 *
 * ⚠️ `key` and `label` are `null` whenever the sink's retention is `'none'`,
 *    whatever the component passed. See {@link SvNavRetention}.
 */
export interface SvNavEvent {
  /** Which family or host surface the move came from. */
  readonly surface: SvNavSurface;
  /**
   * Which instance, when a page has more than one. `null` when the host did
   * not name it — two sidebars are still both `'sidebar'`.
   *
   * ★ **A static surface name — `'primary-nav'`, `'settings-tabs'` — never a
   *   record id.** It is sent under every retention, `'none'` included, so an
   *   id built from data (`'order-8814-tabs'`, a UUID) would carry exactly what
   *   the retention strip exists to keep out. A dev build warns when one looks
   *   like that.
   */
  readonly surfaceId: string | null;
  /** What kind of move it was. See {@link SvNavIntent}. */
  readonly intent: SvNavIntent;
  /** What the family navigates by — a tab id, a step id, a page number. */
  readonly key: string | null;
  /** The human-readable label of the destination, when the surface has one. */
  readonly label: string | null;
  /** Position within the set, when the set is ordered. */
  readonly index: number | null;
  /**
   * Why, for the intents that have a why. `blocked` carries the gate that
   * refused (`'linear'`, `'guard'`, `'disabled'`); `escape` carries how the
   * surface was left.
   *
   * A fixed vocabulary word, like `surfaceId` never stripped — so never
   * user or record data.
   */
  readonly reason: string | null;
  /** `Date.now()` at the moment the event was recorded. */
  readonly at: number;
}

/**
 * What a component passes. The surface and the timestamp are the recorder's, so
 * the only required field is the one thing a component alone can know.
 */
export interface SvNavEventDraft {
  readonly intent: SvNavIntent;
  readonly key?: string | null;
  readonly label?: string | null;
  readonly index?: number | null;
  readonly reason?: string | null;
}

// ─── The sink ────────────────────────────────────────────────────────────────

/** Where navigation events go, and under what terms. */
export interface SvNavTelemetry {
  /** Names the implementation, for diagnostics only. */
  readonly kind: string;
  /**
   * How long this sink keeps an identifier. `'none'` strips `key` and `label`
   * before the sink sees them. See {@link SvNavRetention}.
   */
  readonly retention: SvNavRetention;
  /**
   * May anything be recorded right now?
   *
   * ★ A function, not a boolean, and consulted per event — a consent banner
   *   answered halfway through a session has to take effect on the next click.
   */
  consent(): boolean;
  /** Receive one event. Never called when {@link consent} returns `false`. */
  record(event: SvNavEvent): void;
}

/**
 * The default: nothing is collected.
 *
 * ★ And unlike the default link adapter it does **not** warn. A missing link
 *   adapter is a regression the host cannot see; a missing telemetry sink is
 *   the correct state for every app that did not ask for analytics, which is
 *   most of them. Nagging about not collecting data has the ethics backwards.
 */
export function svNoopNavTelemetry(): SvNavTelemetry {
  return {
    kind: 'noop',
    retention: 'none',
    consent: () => false,
    record: () => undefined,
  };
}

export const SV_NAV_TELEMETRY = new InjectionToken<SvNavTelemetry>('SV_NAV_TELEMETRY', {
  providedIn: 'root',
  factory: svNoopNavTelemetry,
});

/**
 * Provide a sink for the whole app.
 *
 * ```ts
 * provideSvNavTelemetry(() => {
 *   const consent = inject(ConsentService);
 *   return {
 *     kind: 'segment',
 *     retention: '30d',
 *     consent: () => consent.analytics(),
 *     record: (e) => analytics.track('navigation', e),
 *   };
 * })
 * ```
 */
export function provideSvNavTelemetry(factory: () => SvNavTelemetry): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: SV_NAV_TELEMETRY, useFactory: factory }]);
}

// ─── What a component holds ──────────────────────────────────────────────────

/** A component's handle on the stream. One per component instance. */
export interface SvNavRecorder {
  /** True when a sink is present AND consent is currently granted. */
  enabled(): boolean;
  /** Record one move. A no-op when {@link enabled} is false. */
  record(draft: SvNavEventDraft): void;
}

/**
 * Get a recorder for one surface. Call in an injection context.
 *
 * ```ts
 * private readonly nav = svNavRecorder('stepper', () => this.surfaceId());
 * …
 * this.nav.record({ intent: 'blocked', key: step.item.id, index: step.index, reason });
 * ```
 *
 * ★★ THE CONSENT CHECK HAPPENS BEFORE THE PAYLOAD IS BUILT, and that ordering
 *    is the difference between a rule and a mechanism. Building the object and
 *    then dropping it would mean the identifier had already been read out of
 *    the host's data — harmless in-process, but it leaves the retention rule
 *    with nowhere to be enforced and makes the cheap path (no consent) do all
 *    the work of the expensive one. Here a withheld consent costs one call.
 */
export function svNavRecorder(
  surface: SvNavSurface,
  surfaceId?: () => string | null | undefined,
): SvNavRecorder {
  const sink = inject(SV_NAV_TELEMETRY);
  return svNavRecorderFrom(sink, surface, surfaceId);
}

/**
 * Does `surfaceId` look like it was built from a record rather than named?
 *
 * A heuristic for a dev warning, not a filter: a UUID, a long hex run (an
 * ObjectId, a hash), four or more digits in a row (`order-8814`), or a
 * digits-only path segment (`orders/42`). Short ordinals like `'tabs-2'` pass —
 * numbering two instances on a page is what the field is for.
 */
const RECORD_ID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{16,}|\d{4,}|(?:^|[/:])\d+(?:[/:]|$)/i;

/**
 * The same thing without the injection context — for tests, and for a host
 * composing a recorder around a sink it already holds.
 */
export function svNavRecorderFrom(
  sink: SvNavTelemetry,
  surface: SvNavSurface,
  surfaceId?: () => string | null | undefined,
): SvNavRecorder {
  const keepsIdentifiers = sink.retention !== 'none';

  if (keepsIdentifiers && sink.kind !== 'noop') {
    // Not an error — a stated window is exactly what the contract asks for.
    // The warning exists because `retention` is a promise made to a user by a
    // host that may have typed a string to get past a required field.
    svWarnOnce(
      `sv-nav-telemetry/${sink.kind}`,
      `Navigation telemetry sink "${sink.kind}" declares retention "${sink.retention}", so ` +
        'navigation keys and labels are sent to it. Those can be record identifiers ' +
        '(a tab id is often a route segment). Confirm the window is one your privacy ' +
        'policy states, or set retention: "none" to have them stripped.',
    );
  }

  return {
    enabled: () => sink.consent(),

    record(draft: SvNavEventDraft): void {
      // ★ Consent first, before anything is read or allocated.
      if (!sink.consent()) return;

      const id = surfaceId?.() ?? null;
      if (
        !keepsIdentifiers &&
        id !== null &&
        typeof ngDevMode !== 'undefined' &&
        ngDevMode &&
        RECORD_ID_PATTERN.test(id)
      ) {
        svWarnOnce(
          `sv-nav-telemetry/surface-id/${surface}`,
          `Navigation telemetry surfaceId "${id}" (surface "${surface}") looks like a record ` +
            'identifier. surfaceId is sent even under retention "none", so it must be a static ' +
            'surface name ("settings-tabs"), never an id built from data.',
        );
      }

      sink.record({
        surface,
        surfaceId: id,
        intent: draft.intent,
        // ★★ The strip. A component passes the key unconditionally — it cannot
        //    be expected to know the sink's terms — and the terms are applied
        //    in exactly one place.
        key: keepsIdentifiers ? (draft.key ?? null) : null,
        label: keepsIdentifiers ? (draft.label ?? null) : null,
        index: draft.index ?? null,
        reason: draft.reason ?? null,
        at: Date.now(),
      });
    },
  };
}
