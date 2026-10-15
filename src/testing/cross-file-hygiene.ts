/**
 * Give every spec file the environment the first one got.
 *
 * ── The defect ───────────────────────────────────────────────────────────────
 *
 * ★★ THE `unit` PROJECT SHARES ONE jsdom BETWEEN THE SPEC FILES A WORKER RUNS.
 *    Analog's plugin defaults the pool to `vmThreads`, under which Vitest's
 *    `isolate` has no effect, so a node a spec left in `<body>`, a
 *    `window.matchMedia` it replaced, or fake timers it never put back are still
 *    there when the next FILE starts. Run one directory in one process
 *    (`vitest run --project unit projects/forms`) and 97 tests failed that pass
 *    on their own: six `<sv-mention>` editors a mention spec had moved into
 *    `<body>` made every input-mask query find two textboxes, and a
 *    reduced-motion `matchMedia` stub from an earlier file switched the
 *    carousel's auto-play off. History leaks the same way: a real
 *    `history.back()` in one file left the next one mid-stack, where a push
 *    replaces the forward entries instead of adding one, so "push grows the
 *    history" failed in `projects/core` only when run whole. The sharded runner hid it — ten files per process
 *    rarely put a leaker in front of a victim — so which tests failed depended
 *    on which files a shard happened to hold.
 *
 * ── The fix ──────────────────────────────────────────────────────────────────
 *
 * The first file a worker runs records the pristine state: the URL, `<html>`'s
 * and `<body>`'s attributes, and every global a spec in this repo is known to
 * replace. Every file, when it ends, puts all of it back — pushes the pristine
 * URL (which drops forward entries and cancels a queued `back()`, so the next
 * file starts at the END of the history), empties `<body>`,
 * restores the globals and their property descriptors, returns to real timers,
 * undoes `vi.stubGlobal`/`vi.spyOn`, clears web storage, and drops focus. A
 * file can still leak into its OWN later tests; that is that file's to fix, and
 * it shows when the file runs alone. What it can no longer do is decide another
 * file's result.
 *
 * `<head>` is left alone on purpose: Angular's shared style host remembers the
 * component styles it inserted there, and removing them would leave later
 * files rendering unstyled with no way to know.
 */

/** Where each overwritten global lives, by the name specs replace it under. */
const OWNERS: readonly (readonly [owner: () => object, keys: readonly string[]])[] = [
  [
    () => window,
    [
      'matchMedia', 'innerWidth', 'innerHeight', 'open', 'requestAnimationFrame', 'cancelAnimationFrame',
      'localStorage', 'sessionStorage', 'getComputedStyle', 'getSelection', 'visualViewport', 'devicePixelRatio',
      'scrollTo', 'scroll', 'print', 'IntersectionObserver', 'ResizeObserver', 'MutationObserver', 'fetch',
      'ngDevMode',
    ],
  ],
  [() => navigator, ['clipboard', 'platform', 'credentials', 'userAgent', 'language', 'languages', 'onLine', 'share']],
  [() => document, ['visibilityState', 'hidden', 'elementFromPoint', 'referrer', 'hasFocus']],
  [() => HTMLElement.prototype, ['offsetParent', 'offsetWidth', 'offsetHeight', 'offsetTop', 'offsetLeft', 'scrollIntoView', 'focus']],
  [() => Element.prototype, ['scrollIntoView', 'getBoundingClientRect', 'scrollTo', 'animate']],
];

interface Snapshot {
  readonly href: string;
  /** Own property descriptors as the first file found them; `undefined` = absent. */
  readonly props: readonly { owner: object; key: string; descriptor: PropertyDescriptor | undefined }[];
  readonly htmlAttrs: readonly (readonly [string, string])[];
  readonly bodyAttrs: readonly (readonly [string, string])[];
}

const KEY = Symbol.for('styloviz.test.pristineEnvironment');

const attrs = (el: Element): readonly (readonly [string, string])[] => [...el.attributes].map((a) => [a.name, a.value] as const);

/** Record the environment — once per worker, so it is the state before ANY spec ran. */
export function recordPristineEnvironment(): Snapshot {
  const store = globalThis as unknown as Record<symbol, Snapshot | undefined>;
  const existing = store[KEY];
  if (existing) return existing;
  const props: { owner: object; key: string; descriptor: PropertyDescriptor | undefined }[] = [];
  for (const [ownerOf, keys] of OWNERS) {
    const owner = ownerOf();
    for (const key of keys) props.push({ owner, key, descriptor: Object.getOwnPropertyDescriptor(owner, key) });
  }
  const snapshot: Snapshot = { href: window.location.href, props, htmlAttrs: attrs(document.documentElement), bodyAttrs: attrs(document.body) };
  store[KEY] = snapshot;
  return snapshot;
}

function restoreAttrs(el: Element, pristine: readonly (readonly [string, string])[]): void {
  for (const name of [...el.getAttributeNames()]) {
    if (!pristine.some(([n]) => n === name)) el.removeAttribute(name);
  }
  for (const [name, value] of pristine) if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

/** Put the environment back the way {@link recordPristineEnvironment} found it. */
export function restorePristineEnvironment(snapshot: Snapshot): void {
  for (const { owner, key, descriptor } of snapshot.props) {
    const now = Object.getOwnPropertyDescriptor(owner, key);
    if (descriptor) {
      if (!sameDescriptor(now, descriptor)) {
        try {
          Object.defineProperty(owner, key, descriptor);
        } catch {
          // A non-configurable property a spec could not have replaced either.
        }
      }
    } else if (now) {
      try {
        delete (owner as Record<string, unknown>)[key];
      } catch {
        /* non-configurable: nothing a spec could have added */
      }
    }
  }
  window.history.pushState(null, '', snapshot.href);
  for (const node of [...document.body.childNodes]) node.remove();
  restoreAttrs(document.documentElement, snapshot.htmlAttrs);
  restoreAttrs(document.body, snapshot.bodyAttrs);
  try {
    window.localStorage?.clear();
    window.sessionStorage?.clear();
  } catch {
    /* storage blocked by a spec's stub — restored above for the next file */
  }
  (document.activeElement as HTMLElement | null)?.blur?.();
}

function sameDescriptor(a: PropertyDescriptor | undefined, b: PropertyDescriptor): boolean {
  return !!a && a.value === b.value && a.get === b.get && a.set === b.set && a.writable === b.writable;
}

/**
 * Wire it into the setup file: record before the first spec, restore after
 * every file. Vitest's own state — fake timers, stubbed globals and envs,
 * `vi.spyOn` spies — is put back too, since it lives in the same shared world.
 */
export function installCrossFileHygiene(): void {
  const snapshot = recordPristineEnvironment();
  afterAll(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    restorePristineEnvironment(snapshot);
  });
}
