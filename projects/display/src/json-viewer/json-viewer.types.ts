/**
 * `sv-json-viewer` — the value model.
 *
 * Split out from the component so the classification helpers can be unit-tested
 * as functions. What a JSON viewer is actually *for* is telling you what you
 * received, and almost every mistake it can make is a mistake about TYPE.
 */

/** What a node is. Drives the colour, the preview and whether it opens. */
export type JsonNodeKind =
  | 'object'
  | 'array'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'undefined'
  | 'date'
  | 'map'
  | 'set'
  | 'bigint'
  | 'function'
  | 'symbol'
  | 'circular'
  | 'getter'
  | 'truncated'
  | 'omitted';

/** Type scale and row density. */
export type JsonViewerSize = 'sm' | 'md';

/** One rendered row of the flattened tree. */
export interface JsonRow {
  /**
   * Dotted/bracketed path from the root, e.g. `user.roles[2]`.
   * Doubles as the `@for` track key and as what "Copy path" yields.
   */
  readonly path: string;
  /** Nesting level; 0 is the root. */
  readonly depth: number;
  /** The property name or array index, as displayed. */
  readonly key: string;
  readonly kind: JsonNodeKind;
  /** Scalar text, or the collapsed summary of a container. */
  readonly preview: string;
  /** Has children worth opening. An empty object or array does not. */
  readonly expandable: boolean;
  readonly expanded: boolean;
  /** Child count for containers. */
  readonly count: number;
  /**
   * The value itself, for "Copy value" and the `nodeClick` payload.
   *
   * ★ On a redacted row this holds the MASK, not the secret. Redaction that only
   * changed the pixels would be redaction the clipboard walks straight past.
   */
  readonly value: unknown;
  /** The host's redaction predicate matched this path. */
  readonly redacted: boolean;
}

/** What `nodeClick` reports. */
export interface JsonNodeClick {
  readonly path: string;
  readonly key: string;
  /**
   * The row's value. On a masked row this is the mask. On a CONTAINER row while
   * a `redact` predicate is set, it is the redacted projection (see
   * `redactedProjection`) rather than the live object, so a masked descendant
   * cannot be read back out of the click payload.
   */
  readonly value: unknown;
}

/**
 * What `copied` reports.
 *
 * ★★ THE PATH AND THE FACT OF THE COPY ARE SEPARATE FROM THE TEXT ON PURPOSE.
 *    A viewer is where an API key ends up in a screenshot, and the second-worst
 *    version of that is a copy nobody can account for afterwards. A host that
 *    wants an audit trail logs `path` / `what` / `redacted` and leaves `text`
 *    alone — so the trail does not become a second copy of the secret.
 */
export interface JsonCopyEvent {
  readonly path: string;
  /** Which button was pressed. */
  readonly what: 'value' | 'path';
  /** Exactly what reached the clipboard. */
  readonly text: string;
  /** True when the row was masked, so `text` is the mask rather than the value. */
  readonly redacted: boolean;
}

/** What a redaction predicate is told about a node. */
export interface JsonRedactContext {
  /** Full path, e.g. `$.headers["authorization"]`. */
  readonly path: string;
  /** This node's own key or index. */
  readonly key: string;
  readonly kind: JsonNodeKind;
  readonly value: unknown;
}

/**
 * Decides whether a node is masked. Return `true` to redact.
 *
 * Redacting a container masks the whole subtree — the walk does not descend, so
 * nothing underneath it is rendered, counted or copyable.
 */
export type JsonRedactor = (context: JsonRedactContext) => boolean;

/**
 * Keys whose values are secrets in practically every payload.
 *
 * Matched case-insensitively as a substring, so `X-Api-Key`, `refreshToken` and
 * `client_secret` all hit. Deliberately a *starting point* passed in by the host
 * rather than a default: a viewer that silently masked fields would be a viewer
 * that hid data the reader needed, and the component cannot know which is which.
 */
const SECRET_KEY_PATTERN =
  /(password|passwd|secret|token|api[-_]?key|apikey|auth|credential|private[-_]?key|session|cookie|ssn|cvv|card[-_]?number)/i;

/**
 * A ready-made {@link JsonRedactor} for the usual suspects.
 *
 * ```html
 * <sv-json-viewer [value]="response()" [redact]="secretKeyRedactor" />
 * ```
 *
 * It matches on the KEY, not on the value: a heuristic over values flags a
 * random-looking order id and misses a password of "hunter2".
 */
export const secretKeyRedactor: JsonRedactor = ({ key }) => SECRET_KEY_PATTERN.test(key);

/**
 * Classify a value.
 *
 * ★★★ THIS IS WHERE A JSON VIEWER EARNS ITS KEEP OR LIES TO YOU.
 *
 * The tempting implementation is `JSON.stringify(value, null, 2)` in a `<pre>`,
 * and it is wrong in ways that matter precisely when you are debugging:
 *
 * - `NaN` and `±Infinity` stringify to **`null`** — the viewer shows you a
 *   missing value where you have a broken calculation
 * - `undefined` stringifies to nothing in an object and to **`null`** in an
 *   array — two different bugs, both rendered as a third thing
 * - a `Date` becomes a string, so you cannot tell it from a string that
 *   happens to look like one
 * - `Map` and `Set` both become **`{}`**, which reads as "empty object"
 * - `BigInt` **throws**
 * - a cycle **throws**, taking the whole panel with it
 *
 * Every one of those is a real value a real API or a real reducer produces, so
 * every one of them is classified here rather than smoothed away.
 */
export function classify(value: unknown): JsonNodeKind {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  if (value instanceof Map) return 'map';
  if (value instanceof Set) return 'set';
  switch (typeof value) {
    case 'string': return 'string';
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'bigint': return 'bigint';
    case 'function': return 'function';
    case 'symbol': return 'symbol';
    default: return 'object';
  }
}

/** Containers whose children the viewer walks into. */
export function isContainer(kind: JsonNodeKind): boolean {
  return kind === 'object' || kind === 'array' || kind === 'map' || kind === 'set';
}

/** One child of a container, in display order. */
export interface JsonChild {
  readonly key: string;
  readonly value: unknown;
  /**
   * This is an accessor property and `value` was NOT read from it.
   *
   * Set only when `evaluateGetters` is off, which is the default.
   */
  readonly unreadGetter?: boolean;
  /** The getter was read and threw; `value` holds the message. */
  readonly threw?: boolean;
}

/** A container's children, plus what was deliberately left out of them. */
export interface JsonChildren {
  readonly items: readonly JsonChild[];
  /** Own properties hidden from `for…in` and `Object.entries`. */
  readonly nonEnumerable: number;
  /** Own `Symbol`-keyed properties, which have no string path to show. */
  readonly symbolKeys: number;
}

const EMPTY_OMISSIONS = { nonEnumerable: 0, symbolKeys: 0 } as const;

/**
 * The children of a container, as display-ordered `[key, value]` pairs, plus a
 * count of what was left out.
 *
 * `Map` keys can be anything, so they are rendered with `String(key)` — losing
 * the distinction between the key `1` and the key `'1'`, which is the one thing
 * a flat list of rows genuinely cannot show. Documented rather than hidden.
 *
 * ★★★ A PLAIN OBJECT IS WALKED BY DESCRIPTOR, NOT BY `Object.entries`.
 *
 * `Object.entries` **calls every getter it finds**. On an ordinary API response
 * that is harmless; on the objects people actually paste into a debug drawer it
 * is not. A getter can hit the network, mutate state, throw, or be the whole
 * point of a lazily-decrypted field — and merely opening a panel to look at an
 * object is not consent to run its code. So accessors are listed and left
 * unevaluated unless the host asks.
 *
 * `Object.entries` is also silently partial: it skips non-enumerable own
 * properties and every `Symbol` key. Those are counted here so the component can
 * say so, because "this object has three fields" is a claim, and a viewer that
 * makes it while hiding two is worse than one that shows nothing.
 *
 * The prototype chain is never walked. An instance's methods belong to its
 * class, not to the value in front of you; the class NAME is surfaced in the
 * container preview instead, which is the fact worth having.
 */
export function childrenOf(
  value: unknown,
  kind: JsonNodeKind,
  sortKeys: boolean,
  evaluateGetters = false,
): JsonChildren {
  if (kind === 'array') {
    return {
      items: (value as unknown[]).map((v, i) => ({ key: String(i), value: v })),
      ...EMPTY_OMISSIONS,
    };
  }
  if (kind === 'set') {
    return {
      items: [...(value as Set<unknown>)].map((v, i) => ({ key: String(i), value: v })),
      ...EMPTY_OMISSIONS,
    };
  }
  if (kind === 'map') {
    return {
      items: [...(value as Map<unknown, unknown>)].map(([k, v]) => ({ key: String(k), value: v })),
      ...EMPTY_OMISSIONS,
    };
  }

  const descriptors = Object.getOwnPropertyDescriptors(value as object);
  const items: JsonChild[] = [];
  let nonEnumerable = 0;

  for (const key of Object.keys(descriptors)) {
    const descriptor = descriptors[key];
    if (!descriptor.enumerable) {
      nonEnumerable++;
      continue;
    }
    if (descriptor.get === undefined) {
      items.push({ key, value: descriptor.value });
      continue;
    }
    if (!evaluateGetters) {
      items.push({ key, value: undefined, unreadGetter: true });
      continue;
    }
    try {
      items.push({ key, value: descriptor.get.call(value) });
    } catch (error) {
      items.push({ key, value: messageOf(error), threw: true });
    }
  }

  if (sortKeys) items.sort((a, b) => a.key.localeCompare(b.key));

  return {
    items,
    nonEnumerable,
    symbolKeys: Object.getOwnPropertySymbols(value as object).length,
  };
}

/** One sentence out of a thrown anything, without assuming it is an `Error`. */
function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

/**
 * The one-line text for a value.
 *
 * ★ `-0` is spelled out. `Object.is(-0, 0)` is false and the difference has
 * caused real production bugs (a sort that reverses, a division that flips
 * sign), but `String(-0)` is `"0"` — so the plain conversion hides exactly the
 * case worth seeing.
 */
export function scalarText(value: unknown, kind: JsonNodeKind, quoteStrings: boolean): string {
  switch (kind) {
    case 'string': return quoteStrings ? JSON.stringify(value) : (value as string);
    case 'number': {
      const n = value as number;
      if (Object.is(n, -0)) return '-0';
      return String(n); // NaN and ±Infinity print themselves, which is the point
    }
    case 'bigint': return `${String(value)}n`;
    case 'null': return 'null';
    case 'undefined': return 'undefined';
    case 'boolean': return String(value);
    case 'date': {
      const d = value as Date;
      return Number.isNaN(d.getTime()) ? 'Invalid Date' : d.toISOString();
    }
    case 'function': return `ƒ ${(value as { name?: string }).name || '(anonymous)'}()`;
    case 'symbol': return String(value);
    case 'circular': return '[Circular]';
    default: return String(value);
  }
}

/**
 * Collapsed summary of a container: `{3}`, `[12]`, `Map(2)`, `Set(0)`.
 *
 * A class instance is prefixed with its constructor name — `User {4}` — because
 * that is the one thing the unwalked prototype chain is still worth saying. It
 * is read off the prototype rather than by calling anything on the value.
 */
export function containerPreview(kind: JsonNodeKind, count: number, className = ''): string {
  if (kind === 'array') return count === 0 ? '[]' : `[${count}]`;
  if (kind === 'map') return `Map(${count})`;
  if (kind === 'set') return `Set(${count})`;
  const body = count === 0 ? '{}' : `{${count}}`;
  return className ? `${className} ${body}` : body;
}

/**
 * The constructor name of a plain-ish object, or '' when there is nothing worth
 * saying — `{}` literals, `Object.create(null)`, and anything whose prototype
 * does not name itself.
 */
export function classNameOf(value: unknown): string {
  const proto = Object.getPrototypeOf(value as object) as object | null;
  if (proto === null || proto === Object.prototype) return '';
  const name = (proto as { constructor?: { name?: string } }).constructor?.name;
  return name && name !== 'Object' ? name : '';
}

/** How a container's hidden own properties are described, or '' when there are none. */
export function omissionNote(children: JsonChildren): string {
  const total = children.nonEnumerable + children.symbolKeys;
  if (total === 0) return '';
  const parts: string[] = [];
  if (children.nonEnumerable > 0) parts.push(`${children.nonEnumerable} non-enumerable`);
  if (children.symbolKeys > 0) parts.push(`${children.symbolKeys} symbol-keyed`);
  return `+ ${parts.join(', ')} own ${total === 1 ? 'property' : 'properties'} not shown`;
}

/** Append a segment to a path, bracketing array indices. */
export function joinPath(parent: string, key: string, parentKind: JsonNodeKind): string {
  if (parentKind === 'array' || parentKind === 'set') return `${parent}[${key}]`;
  if (!parent) return key;
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
}

/** How {@link redactedProjection} walks a value. */
export interface JsonProjectionOptions {
  readonly redact: JsonRedactor | null;
  readonly redactedLabel: string;
  readonly evaluateGetters: boolean;
  readonly sortKeys: boolean;
  /** Called once per node the predicate masked, so a caller can tell the copy contained masks. */
  readonly onRedact?: () => void;
}

/**
 * The value as the viewer is willing to hand it out: a plain, JSON-safe copy
 * that says what the rows say.
 *
 * ★★★ "COPY VALUE" ON A CONTAINER USED TO STRINGIFY THE RAW OBJECT, AND THAT
 *     WALKED STRAIGHT PAST THE REDACTION. A row whose descendant was masked
 *     still carried the real container as its value, so copying `$` put the
 *     bearer token on the clipboard that the tree had just hidden — and
 *     `JSON.stringify` called every getter on the way, which is the other thing
 *     the viewer promises not to do.
 *
 *     So the copy re-walks exactly like `rows`:
 *     - a node the predicate matches becomes `redactedLabel`, subtree and all;
 *     - an accessor is not read unless `evaluateGetters` is on — it becomes the
 *       same `(getter — not read)` placeholder its row shows;
 *     - a node on its own ancestor chain becomes `'[Circular]'` (the chain, not a
 *       global seen-set: a DAG is data, not a cycle);
 *     - values JSON cannot spell (`BigInt`, `NaN`, `undefined`, functions,
 *       symbols) become the row's own text rather than vanishing or throwing.
 *
 *     `Map` becomes an object keyed by `String(key)` and `Set` an array, the same
 *     flattening the rows already make.
 */
export function redactedProjection(
  value: unknown,
  key: string,
  path: string,
  options: JsonProjectionOptions,
): unknown {
  const chain = new Set<object>();
  const { redact, redactedLabel, evaluateGetters, sortKeys, onRedact } = options;

  const project = (v: unknown, k: string, p: string): unknown => {
    const kind = classify(v);
    if (redact !== null && redact({ path: p, key: k, kind, value: v })) {
      onRedact?.();
      return redactedLabel;
    }
    if (!isContainer(kind)) {
      if (kind === 'string' || kind === 'boolean' || kind === 'null') return v;
      if (kind === 'number' && Number.isFinite(v as number) && !Object.is(v, -0)) return v;
      return scalarText(v, kind, false);
    }
    const obj = v as object;
    if (chain.has(obj)) return '[Circular]';
    chain.add(obj);
    const children = childrenOf(v, kind, sortKeys, evaluateGetters);
    let out: unknown;
    if (kind === 'array' || kind === 'set') {
      out = children.items.map((child) => projectChild(child, p, kind));
    } else {
      const record: Record<string, unknown> = {};
      for (const child of children.items) record[child.key] = projectChild(child, p, kind);
      out = record;
    }
    chain.delete(obj);
    return out;
  };

  const projectChild = (child: JsonChild, parentPath: string, parentKind: JsonNodeKind): unknown => {
    if (child.unreadGetter === true) return '(getter — not read)';
    if (child.threw === true) return `(getter threw: ${String(child.value)})`;
    return project(child.value, child.key, joinPath(parentPath, child.key, parentKind));
  };

  return project(value, key, path);
}
