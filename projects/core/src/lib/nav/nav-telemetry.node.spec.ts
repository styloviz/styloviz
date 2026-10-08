import {
  svNavRecorderFrom,
  svNoopNavTelemetry,
  type SvNavEvent,
  type SvNavTelemetry,
} from './nav-telemetry';
import { svResetWarnOnce } from '../dev/warn-once';

/**
 * ============================================================================
 *  `X-15` — navigation analytics with source and intent
 * ============================================================================
 *
 * ★★ WHAT IS PINNED HERE IS THE TWO RULES THE ITEM ASKS FOR, because they are
 *    the only parts that can be got quietly wrong. A vocabulary is checked by
 *    the compiler; a consent gate that runs after the payload is built, or a
 *    strip that a component can bypass, compiles perfectly and ships.
 *
 * `svNavRecorderFrom` rather than `svNavRecorder` throughout: the injectable
 * form is four lines around this one, and testing the sink contract does not
 * need a TestBed.
 */

interface Recording {
  readonly sink: SvNavTelemetry;
  readonly seen: SvNavEvent[];
  granted: boolean;
}

function recordingSink(retention: string, granted = true): Recording {
  const seen: SvNavEvent[] = [];
  const state = { granted };
  return {
    seen,
    get granted() { return state.granted; },
    set granted(v: boolean) { state.granted = v; },
    sink: {
      kind: 'test',
      retention,
      consent: () => state.granted,
      record: (e) => seen.push(e),
    },
  };
}

beforeEach(() => svResetWarnOnce());

describe('svNavTelemetry — the default sink', () => {
  it('collects nothing and consents to nothing', () => {
    const sink = svNoopNavTelemetry();
    expect(sink.consent()).toBe(false);
    expect(sink.retention).toBe('none');
  });

  it('is what a component with no provider gets, so recording is a no-op', () => {
    const nav = svNavRecorderFrom(svNoopNavTelemetry(), 'tabs');
    expect(nav.enabled()).toBe(false);
    // Cannot throw, cannot collect.
    nav.record({ intent: 'jump', key: 'billing' });
  });
});

describe('svNavTelemetry — consent (X-15, constraint 1)', () => {
  it('records nothing while consent is withheld', () => {
    const r = recordingSink('30d', false);
    const nav = svNavRecorderFrom(r.sink, 'pagination');

    nav.record({ intent: 'advance', index: 2 });

    expect(r.seen).toEqual([]);
    expect(nav.enabled()).toBe(false);
  });

  /**
   * ★★ THE POINT OF CHECKING PER EVENT RATHER THAN AT CONSTRUCTION. A consent
   *    banner answered halfway through a session has to take effect on the next
   *    click — a recorder that cached the answer would keep collecting until
   *    the component was destroyed, which for a shell sidebar is "until the tab
   *    is closed".
   */
  it('starts and stops with the flag, mid-session, without rebuilding', () => {
    const r = recordingSink('30d', false);
    const nav = svNavRecorderFrom(r.sink, 'sidebar');

    nav.record({ intent: 'jump', key: 'a' });
    r.granted = true;
    nav.record({ intent: 'jump', key: 'b' });
    r.granted = false;
    nav.record({ intent: 'jump', key: 'c' });

    expect(r.seen.map((e) => e.key)).toEqual(['b']);
  });

  /**
   * ★ The gate runs BEFORE the draft is read. Proven by passing a getter that
   *   records being called: with consent withheld, nothing should touch it.
   */
  it('does not read the payload it is not going to record', () => {
    const r = recordingSink('30d', false);
    const nav = svNavRecorderFrom(r.sink, 'stepper');
    let reads = 0;
    const draft = {
      intent: 'blocked' as const,
      get key() { reads += 1; return 'shipping'; },
    };

    nav.record(draft);
    expect(reads).toBe(0);

    r.granted = true;
    nav.record(draft);
    expect(reads).toBe(1);
  });
});

describe('svNavTelemetry — retention (X-15, constraint 2)', () => {
  /**
   * ★★★ THE RULE THE ITEM NAMES, AS A MECHANISM. "Never put a record identifier
   *     in an event payload without a documented retention policy" is a note
   *     until something strips it — and the component is the wrong place to do
   *     the stripping, because it cannot know the sink's terms.
   */
  it('strips key and label for a sink that declares no retention', () => {
    const r = recordingSink('none');
    const nav = svNavRecorderFrom(r.sink, 'tabs');

    nav.record({ intent: 'jump', key: 'orders/8814', label: 'Order 8814', index: 3 });

    expect(r.seen).toHaveLength(1);
    expect(r.seen[0].key).toBeNull();
    expect(r.seen[0].label).toBeNull();
  });

  /** ★ …and keeps everything that is NOT an identifier, which is the useful part. */
  it('still reports surface, intent and position with retention none', () => {
    const r = recordingSink('none');
    const nav = svNavRecorderFrom(r.sink, 'pagination', () => 'orders-table');

    nav.record({ intent: 'advance', key: '4', index: 4 });

    expect(r.seen[0]).toMatchObject({
      surface: 'pagination',
      surfaceId: 'orders-table',
      intent: 'advance',
      index: 4,
      key: null,
    });
  });

  it('passes the identifier through once a window is declared', () => {
    const r = recordingSink('30d');
    const nav = svNavRecorderFrom(r.sink, 'tabs');

    nav.record({ intent: 'jump', key: 'orders/8814', label: 'Order 8814' });

    expect(r.seen[0].key).toBe('orders/8814');
    expect(r.seen[0].label).toBe('Order 8814');
  });

  /** A declared window is a promise to a user; it is worth one dev warning. */
  it('warns once when a sink opts into receiving identifiers', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const r = recordingSink('30d');

    svNavRecorderFrom(r.sink, 'tabs');
    svNavRecorderFrom(r.sink, 'stepper');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('retention "30d"');
    warn.mockRestore();
  });

  it('says nothing for a sink that strips', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    svNavRecorderFrom(recordingSink('none').sink, 'tabs');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('svNavTelemetry — the event', () => {
  it('names the surface the component was built for, not the draft', () => {
    const r = recordingSink('none');
    const nav = svNavRecorderFrom(r.sink, 'anchor');
    nav.record({ intent: 'jump' });
    expect(r.seen[0].surface).toBe('anchor');
  });

  it('reports a null surfaceId when the host did not name the instance', () => {
    const r = recordingSink('none');
    svNavRecorderFrom(r.sink, 'sidebar').record({ intent: 'jump' });
    expect(r.seen[0].surfaceId).toBeNull();
  });

  it('re-reads surfaceId per event, so a renamed surface is reported correctly', () => {
    const r = recordingSink('none');
    let id: string | null = 'first';
    const nav = svNavRecorderFrom(r.sink, 'sidebar', () => id);

    nav.record({ intent: 'jump' });
    id = 'second';
    nav.record({ intent: 'jump' });

    expect(r.seen.map((e) => e.surfaceId)).toEqual(['first', 'second']);
  });

  it('fills every optional field with null rather than leaving it absent', () => {
    const r = recordingSink('none');
    svNavRecorderFrom(r.sink, 'tabs').record({ intent: 'explore' });
    const event = r.seen[0];
    expect(event.index).toBeNull();
    expect(event.reason).toBeNull();
    expect(event.label).toBeNull();
    // A sink switching on `'key' in event` must not see the field come and go.
    expect(Object.keys(event).sort()).toEqual(
      ['at', 'index', 'intent', 'key', 'label', 'reason', 'surface', 'surfaceId'],
    );
  });

  it('timestamps at record time', () => {
    const r = recordingSink('none');
    const before = Date.now();
    svNavRecorderFrom(r.sink, 'tabs').record({ intent: 'jump' });
    expect(r.seen[0].at).toBeGreaterThanOrEqual(before);
  });

  it('carries the refusal reason for a blocked move', () => {
    const r = recordingSink('none');
    svNavRecorderFrom(r.sink, 'stepper').record({ intent: 'blocked', reason: 'linear', index: 3 });
    expect(r.seen[0]).toMatchObject({ intent: 'blocked', reason: 'linear', index: 3 });
  });
});

describe('svNavTelemetry — surfaceId is a surface name, not a record id', () => {
  /**
   * ★ `surfaceId` is never stripped — which surface is the point of the stream —
   * so under retention `'none'` it is the one field that could still carry an
   * identifier. It is sent as given; a dev build says so when it looks like one.
   */
  it.each([
    'order-8814-tabs',
    'orders/42',
    '3f2b8c1e-9a4d-4c7e-8b1a-2d5e6f7a8b9c',
    'panel-507f1f77bcf86cd799439011',
  ])('warns once for the record-shaped id %j, and still sends it', (id) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const r = recordingSink('none');
    const nav = svNavRecorderFrom(r.sink, 'tabs', () => id);

    nav.record({ intent: 'jump' });
    nav.record({ intent: 'jump' });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(id);
    expect(r.seen.map((e) => e.surfaceId)).toEqual([id, id]);
    warn.mockRestore();
  });

  it.each(['primary-nav', 'settings-tabs', 'tabs-2', 'sidebar_1'])(
    'stays quiet for the static name %j',
    (id) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      svNavRecorderFrom(recordingSink('none').sink, 'tabs', () => id).record({ intent: 'jump' });
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    },
  );

  it('does not check without consent — nothing is sent, so nothing leaks', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    svNavRecorderFrom(recordingSink('none', false).sink, 'tabs', () => 'order-8814').record({
      intent: 'jump',
    });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('leaves a sink with a declared retention to its own terms', () => {
    const r = recordingSink('30d');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    svNavRecorderFrom(r.sink, 'tabs', () => 'order-8814').record({ intent: 'jump' });
    // Only the construction-time retention warning, not a surfaceId one.
    expect(warn.mock.calls.every(([m]) => !String(m).includes('surfaceId'))).toBe(true);
    warn.mockRestore();
  });
});
