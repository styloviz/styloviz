/**
 * ============================================================
 *  sv-stack-trace — the parser
 * ============================================================
 *  `svParseStackTrace(text)` turns an `Error.stack` (or a pasted log) into a
 *  header and a list of frames. It reads:
 *
 *  - V8 (Chrome, Edge, Node, Deno):  `    at fn (file.js:10:5)`,
 *    `    at file.js:10:5`, `at async fn (…)`, `at new Foo (…)`,
 *    `at eval (eval at g (file.js:3:1), <anonymous>:1:1)`, `at fn (native)`.
 *  - SpiderMonkey (Firefox) and JavaScriptCore (Safari): `fn@file.js:10:5`,
 *    `@file.js:10:5`, `fn/<@…`, `forEach@[native code]`,
 *    `fn@file.js line 2 > eval:1:5`.
 *  - A generic `at file:line:col` or bare `file:line:col` line.
 *
 *  Lines before the first frame are the header (`TypeError: …`, possibly over
 *  several lines). Firefox and Safari put no header in `stack` at all, so the
 *  name and message may be missing — the component then takes them from the
 *  `Error` object when it is given one.
 *
 *  ★★ IT IS TEXT ALL THE WAY DOWN. Nothing is evaluated, fetched or rendered
 *     as markup: a frame is strings and numbers, and a line that matches no
 *     format is kept as a raw frame rather than dropped, so nothing in a
 *     pasted trace silently disappears.
 * ============================================================
 */

/** Which grammar a frame was read with. */
export type SvStackFrameFormat = 'v8' | 'gecko' | 'generic' | 'raw';

/** One frame of a stack trace. */
export interface SvStackFrame {
  /** The line as it appeared, trimmed. */
  readonly raw: string;
  /** `Foo.bar`, `new Foo`, `fn/<` — or `null` for an anonymous frame. */
  readonly functionName: string | null;
  /** Path or URL, or `null` when the frame has none (native, raw). */
  readonly file: string | null;
  readonly line: number | null;
  readonly column: number | null;
  /** Engine code with no source: `(native)`, `[native code]`. */
  readonly native: boolean;
  /** V8's `at async fn (…)` — a frame resumed after an `await`. */
  readonly async: boolean;
  readonly format: SvStackFrameFormat;
}

export interface SvParsedStackTrace {
  /** `TypeError`, `RangeError`, `MyAppError` — or `null` when there is no header. */
  readonly name: string | null;
  /** The message, possibly several lines; `''` when there is none. */
  readonly message: string;
  readonly frames: readonly SvStackFrame[];
}

const LOCATION = /^(.*?):(\d+)(?::(\d+))?$/;
const GECKO_EVAL = /^(.*?) line (\d+) > (?:eval|Function)/;
const HEADER = /^(?:Uncaught\s+)?(?:\(in promise\)\s+)?([A-Za-z_$][\w$.]*):\s?([\s\S]*)$/;
const HEADER_NAME_ONLY = /^(?:Uncaught\s+)?([A-Z][\w$.]*(?:Error|Exception))$/;

interface Location {
  readonly file: string | null;
  readonly line: number | null;
  readonly column: number | null;
  readonly native: boolean;
}

const NO_LOCATION: Location = { file: null, line: null, column: null, native: false };

function readLocation(text: string): Location | null {
  const loc = text.trim();
  // sv-i18n-ignore: engine tokens in a stack trace, matched, never shown
  if (loc === 'native' || loc === '[native code]') return { file: null, line: null, column: null, native: true };
  // V8's `<anonymous>` names no file — a frame in code with no source URL.
  if (loc === '<anonymous>') return { file: null, line: null, column: null, native: false }; // sv-i18n-ignore: V8 token

  // V8 eval: "eval at g (file.js:3:1), <anonymous>:1:1" — the useful place is
  // where eval was CALLED, the innermost "(file:line:col)".
  if (loc.startsWith('eval at ')) { // sv-i18n-ignore: V8 token
    const inner = /\(([^()]+:\d+:\d+)\)/.exec(loc);
    return inner ? readLocation(inner[1]!) : NO_LOCATION;
  }

  const geckoEval = GECKO_EVAL.exec(loc);
  if (geckoEval) return { file: geckoEval[1]!, line: Number(geckoEval[2]), column: null, native: false };

  const m = LOCATION.exec(loc);
  if (!m || !m[1]) return null;
  return {
    file: m[1],
    line: Number(m[2]),
    column: m[3] === undefined ? null : Number(m[3]),
    native: false,
  };
}

/** The index of the `(` that opens the parenthesised group ending the string. */
function openingParen(text: string): number {
  let depth = 0;
  for (let i = text.length - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === ')') depth++;
    else if (ch === '(') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function frame(
  raw: string,
  functionName: string | null,
  loc: Location,
  format: SvStackFrameFormat,
  async = false,
): SvStackFrame {
  const name = functionName?.trim() || null;
  return { raw, functionName: name, file: loc.file, line: loc.line, column: loc.column, native: loc.native, async, format };
}

/** Read one line as a frame, or `null` when it is not one. */
export function svParseStackFrame(line: string): SvStackFrame | null {
  const raw = line.trim();
  if (!raw) return null;

  // ── V8 / generic "at …" ────────────────────────────────────────────────────
  const at = /^at\s+(.*)$/.exec(raw);
  if (at) {
    let body = at[1]!.trim();
    let isAsync = false;
    if (body.startsWith('async ')) {
      isAsync = true;
      body = body.slice(6).trim();
    }
    if (body.endsWith(')')) {
      const open = openingParen(body);
      if (open > 0) {
        const loc = readLocation(body.slice(open + 1, -1));
        // `at async Promise.all (index 0)`: the group is not a place, but what
        // precedes it is still the function.
        return frame(raw, body.slice(0, open), loc ?? NO_LOCATION, 'v8', isAsync);
      }
    }
    const loc = readLocation(body);
    if (loc) return frame(raw, null, loc, 'v8', isAsync);
    // "at fn" with no location at all — still a frame.
    return frame(raw, body, NO_LOCATION, 'v8', isAsync);
  }

  // ── SpiderMonkey / JavaScriptCore "fn@location" ────────────────────────────
  const atSign = raw.indexOf('@');
  if (atSign >= 0) {
    const loc = readLocation(raw.slice(atSign + 1));
    // ★ Only when the right-hand side really is a location: a message line such
    //   as "user@example.com not found" must stay part of the message.
    if (loc && (loc.native || loc.line !== null)) return frame(raw, raw.slice(0, atSign), loc, 'gecko');
  }

  // ── Bare "file:line:col" ───────────────────────────────────────────────────
  if (!/\s/.test(raw)) {
    const m = LOCATION.exec(raw);
    if (m && m[1] && m[3] !== undefined) {
      return frame(raw, null, { file: m[1], line: Number(m[2]), column: Number(m[3]), native: false }, 'generic');
    }
  }
  return null;
}

/**
 * Split a stack trace into its header and its frames.
 *
 * ★ Once the first frame is found, every later line is a frame — a raw one if
 *   it matches no grammar ("Caused by: …", a log prefix). Dropping unreadable
 *   lines would hide exactly the part of a trace a reader most needs.
 */
export function svParseStackTrace(text: string): SvParsedStackTrace {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const header: string[] = [];
  const frames: SvStackFrame[] = [];

  for (const line of lines) {
    const parsed = svParseStackFrame(line);
    if (parsed) {
      frames.push(parsed);
    } else if (frames.length) {
      const raw = line.trim();
      if (raw) frames.push({ raw, functionName: null, file: null, line: null, column: null, native: false, async: false, format: 'raw' });
    } else {
      header.push(line);
    }
  }

  // Trim blank lines around the header, keep the ones inside a multi-line message.
  while (header.length && !header[0]!.trim()) header.shift();
  while (header.length && !header[header.length - 1]!.trim()) header.pop();
  if (!header.length) return { name: null, message: '', frames };

  const first = header[0]!.trim();
  const rest = header.slice(1).join('\n');
  const named = HEADER.exec(first);
  if (named && !/\s/.test(named[1]!)) {
    const message = [named[2]!, rest].filter((p) => p !== '').join('\n');
    return { name: named[1]!, message, frames };
  }
  const nameOnly = HEADER_NAME_ONLY.exec(first);
  if (nameOnly) return { name: nameOnly[1]!, message: rest, frames };
  return { name: null, message: header.join('\n').trim(), frames };
}

/**
 * The default "is this library code?" test: anything under `node_modules`,
 * Node's own internals, bundler runtimes, Vite's pre-bundled deps, zone.js and
 * native frames. A frame with no file (a raw line) is never library code.
 */
export function svIsLibraryFrame(frame: SvStackFrame): boolean {
  if (frame.native) return true;
  const file = frame.file;
  if (!file) return false;
  return /(^|[\\/])node_modules[\\/]|^node:|^internal[\\/]|\(webpack\)|webpack[\\/]bootstrap|webpack[\\/]runtime|[\\/]\.vite[\\/]deps[\\/]|[\\/]zone(\.min)?\.js|[\\/]polyfills[.-]/.test(file);
}

/**
 * The location as one string, the way a reader types it into an editor's
 * "go to file": `src/app.ts:12:5`. `null` when the frame has no file.
 */
export function svStackFrameLocation(frame: SvStackFrame): string | null {
  if (!frame.file) return null;
  if (frame.line === null) return frame.file;
  return frame.column === null ? `${frame.file}:${frame.line}` : `${frame.file}:${frame.line}:${frame.column}`;
}
