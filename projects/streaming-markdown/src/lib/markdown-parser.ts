import type {
  MdAlign,
  MdBlock,
  MdInline,
  MdListItem,
  MdTableRow,
} from './streaming-markdown.types';

/**
 * Zero-dependency Markdown parser producing a **token model**, never an HTML
 * string. The template renders that model through Angular bindings, so there is
 * no `innerHTML` and no `bypassSecurityTrust*` anywhere in the pipeline —
 * untrusted content can never become markup.
 *
 * Streaming-safe by construction:
 * - `parseMarkdown` is pure, so re-running it on a growing buffer is correct and
 *   cheap; no incremental parser state to keep in sync.
 * - An unterminated fence yields a `code` block with `complete: false` rather
 *   than swallowing the rest of the document.
 * - Unmatched inline delimiters (`**bo`) degrade to literal text, so a
 *   half-received emphasis marker never blanks the output.
 *
 * Supported: ATX headings, paragraphs, fenced code, blockquotes, ordered and
 * unordered lists (with `- [x]` tasks and indent-based depth), tables with
 * alignment, thematic breaks; inline `**strong**`, `*em*`, `` `code` ``,
 * `~~strike~~` and `[text](url)`, nested arbitrarily.
 */

// ─── URL safety ───────────────────────────────────────────────────────────────

const SAFE_SCHEME = /^(?:https?:|mailto:|tel:)/i;

/**
 * Returns a URL only when it is safe to place in `href`.
 *
 * Rejects `javascript:`, `data:`, `vbscript:` and anything else unrecognised —
 * the link then renders as plain text rather than a clickable trap.
 */
export function safeHref(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  // Strip an optional "title" the way CommonMark allows: [t](/u "Title")
  // ★ A linear scan, not `/\s+["'(].*$/` (1.0 audit, M5): that pattern retries
  //   the `\s+` run from every space, so a URL of 50,000 spaces took ~2.6 s —
  //   and the parser re-runs on every streamed chunk.
  const titleAt = url.search(/\s["'(]/);
  const bare = titleAt === -1 ? url : url.slice(0, titleAt).trimEnd();
  if (SAFE_SCHEME.test(bare)) return bare;
  if (bare.startsWith('/') || bare.startsWith('#') || bare.startsWith('./') || bare.startsWith('../')) return bare;
  // A bare relative path such as `docs/getting-started`
  if (/^[\w.-]+(?:\/[\w.\-~%]*)*$/.test(bare) && !bare.includes(':')) return bare;
  return null;
}

/**
 * ★★★ `data:` IS REJECTED FOR `href` AND ACCEPTED FOR `<img src>`, AND THAT IS
 * NOT AN INCONSISTENCY. The two attributes have different threat models:
 *
 * - A `data:text/html` URL in an `href` is a NAVIGATION. Following it lands the
 *   reader on a document whose scripts run — historically with the origin of the
 *   linking page. That is why `safeHref` refuses the whole `data:` scheme.
 * - The same URL in `<img src>` is a FETCH, and the result is decoded by the
 *   image decoder or discarded. Nothing is navigated to and nothing executes.
 *
 * `image/svg+xml` is the case worth stating explicitly, because most allowlists
 * copied from link-sanitising guidance drop it. An SVG loaded through `<img>` is
 * in the spec's *secure static mode*: no scripting, no external references, no
 * interactivity. The document is rendered, not run. Blocking it here would break
 * every diagram an editor round-trips through Markdown while buying no safety.
 *
 * What this still refuses is anything that is not an image media type — a
 * `data:text/html` or bare `data:,` in an `<img src>` renders as a broken image
 * at best, and there is no reason to carry it through.
 */
const DATA_IMAGE = /^data:image\/[\w.+-]+[;,]/i;

/** Returns a URL only when it is safe to place in `<img src>`. */
export function safeImageSrc(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  const bare = url.replace(/\s+["'(].*$/, '');
  if (DATA_IMAGE.test(bare)) return bare;
  // Everything else goes through the link rules, minus the schemes that are not
  // fetchable as images at all.
  const href = safeHref(bare);
  if (href === null) return null;
  return /^(?:mailto:|tel:)/i.test(href) ? null : href;
}

// ─── Inline ───────────────────────────────────────────────────────────────────

interface Delim {
  readonly marker: string;
  readonly kind: 'strong' | 'em' | 'strike';
}

const DELIMS: readonly Delim[] = [
  { marker: '***', kind: 'strong' },
  { marker: '**', kind: 'strong' },
  { marker: '__', kind: 'strong' },
  { marker: '~~', kind: 'strike' },
  { marker: '*', kind: 'em' },
  { marker: '_', kind: 'em' },
];

/** Parse inline markup into a nestable span tree. */
export function parseInline(src: string): readonly MdInline[] {
  const out: MdInline[] = [];
  let text = '';
  let i = 0;

  const flush = (): void => {
    if (text) {
      out.push({ kind: 'text', text });
      text = '';
    }
  };

  while (i < src.length) {
    const ch = src[i];

    // Escapes: \* \_ \` etc.
    //
    // ★ `|` IS IN THIS SET FOR TABLES. A cell holding `a | b` has to write the
    //   pipe as `\|` or the row splitter sees three cells; the splitter honours
    //   the backslash, and this is the half that turns it back into a pipe.
    if (ch === '\\' && i + 1 < src.length && /[\\`*_~[\]()#+\-.!>|]/.test(src[i + 1])) {
      text += src[i + 1];
      i += 2;
      continue;
    }

    // Inline code — highest precedence, contents are literal.
    //
    // ★★★ THE RUN LENGTH HAS TO MATCH, and `indexOf('`')` was the bug: a span
    //     opened with two backticks so that it could CONTAIN one — `` `a` `` is
    //     how you write a backtick in Markdown, and it is all over technical
    //     prose — closed at the first single backtick inside itself. The result
    //     was an empty code span followed by the content leaking out as text.
    //     CommonMark's rule is that a run of N backticks closes only on another
    //     run of exactly N.
    if (ch === '`') {
      const run = /^`+/.exec(src.slice(i))![0].length;
      const close = findRun(src, i + run, run);
      if (close !== -1) {
        flush();
        // CommonMark strips one space from each end when both are present, so
        // that `` ` `` yields a lone backtick rather than a padded one.
        let body = src.slice(i + run, close);
        if (body.length > 2 && body.startsWith(' ') && body.endsWith(' ') && body.trim()) {
          body = body.slice(1, -1);
        }
        out.push({ kind: 'code', text: body });
        i = close + run;
        continue;
      }
      // Unclosed run mid-stream — treat as literal.
      //
      // ★★ THE WHOLE RUN IS CONSUMED, not one character. Advancing by one left
      //    the remaining backticks of an unmatched ``` `` ``` sitting in the
      //    input, where the next pass read them as a fresh single-backtick opener
      //    and found a closer further along — turning literal text into a code
      //    span that starts in the middle of the marker the author typed.
      text += src.slice(i, i + run);
      i += run;
      continue;
    }

    // Image: ![alt](src)
    //
    // ★★★ THIS HAS TO COME BEFORE THE LINK BRANCH, and before `!` can be folded
    //     into a run of literal text. Without it `![chart](/a.png)` parsed as a
    //     stray `!` followed by a link — a visibly wrong render that reached the
    //     page as a bang and a clickable filename. Models emit image syntax
    //     constantly, so this was the single most common malformed output.
    if (ch === '!' && src[i + 1] === '[') {
      const close = matchBracket(src, i + 1);
      if (close !== -1 && src[close + 1] === '(') {
        const paren = matchParen(src, close + 1);
        if (paren !== -1) {
          const alt = src.slice(i + 2, close);
          const url = safeImageSrc(src.slice(close + 2, paren));
          flush();
          // A rejected URL degrades to the alt text, which is exactly what alt
          // text is for. Emitting a broken <img> instead would show the reader a
          // torn-page glyph and hide the words the author wrote for this case.
          out.push(url ? { kind: 'image', text: alt, href: url } : { kind: 'text', text: alt });
          i = paren + 1;
          continue;
        }
      }
      text += ch;
      i += 1;
      continue;
    }

    // Link: [label](url)
    if (ch === '[') {
      const close = matchBracket(src, i);
      if (close !== -1 && src[close + 1] === '(') {
        const paren = matchParen(src, close + 1);
        if (paren !== -1) {
          const label = src.slice(i + 1, close);
          const href = safeHref(src.slice(close + 2, paren));
          flush();
          const children = parseInline(label);
          out.push(
            href
              ? { kind: 'link', text: label, href, children }
              : { kind: 'text', text: label },
          );
          i = paren + 1;
          continue;
        }
      }
      text += ch;
      i += 1;
      continue;
    }

    // Emphasis / strong / strike
    const delim = DELIMS.find((d) => src.startsWith(d.marker, i));
    // An underscore inside a word opens nothing — see `intraWord`.
    if (delim && !(delim.marker[0] === '_' && intraWord(src, i, delim.marker.length))) {
      const close = closingDelim(src, delim.marker, i + delim.marker.length);
      // Reject empty spans (`****`) and unterminated ones (still streaming).
      if (close !== -1 && close > i + delim.marker.length) {
        const inner = src.slice(i + delim.marker.length, close);
        flush();
        const children = parseInline(inner);
        if (delim.marker === '***') {
          out.push({ kind: 'strong', text: inner, children: [{ kind: 'em', text: inner, children }] });
        } else {
          out.push({ kind: delim.kind, text: inner, children });
        }
        i = close + delim.marker.length;
        continue;
      }
      text += ch;
      i += 1;
      continue;
    }

    text += ch;
    i += 1;
  }

  flush();
  return out;
}

/**
 * Index of the next run of backticks that is exactly `length` long.
 *
 * "Exactly" matters in both directions: a longer run is not a closer (it is a
 * nested span's fence), and a shorter one is content.
 */
function findRun(src: string, from: number, length: number): number {
  for (let i = from; i < src.length; i++) {
    if (src[i] !== '`') continue;
    let n = 0;
    while (src[i + n] === '`') n++;
    if (n === length) return i;
    i += n - 1;
  }
  return -1;
}

/**
 * True when an emphasis marker at `at` sits between two word characters.
 *
 * ★★★ THIS IS WHY `snake_case_name` IS NOT ITALIC. CommonMark's flanking rules
 *     exist almost entirely for this case: `_` is the one delimiter that appears
 *     inside ordinary identifiers, and a parser without the rule renders every
 *     `snake_case_name`, `__init__` and `my_var_name` in a technical document
 *     with a stray italic run through the middle. `*` needs no such exception —
 *     nobody puts an asterisk inside a word.
 */
function intraWord(src: string, at: number, markerLength: number): boolean {
  const before = src[at - 1];
  const after = src[at + markerLength];
  return before !== undefined && after !== undefined && /\w/.test(before) && /\w/.test(after);
}

/**
 * Index of the marker that closes an emphasis run, or -1.
 *
 * For `*` and `~~` this is a plain search. For `_` it must skip any occurrence
 * that is itself inside a word, so that the OPENING `_` of `a _b_ c_d_e` pairs
 * with the one after `b` and not with the one inside `c_d`.
 */
function closingDelim(src: string, marker: string, from: number): number {
  if (marker[0] !== '_') return src.indexOf(marker, from);
  for (let at = src.indexOf(marker, from); at !== -1; at = src.indexOf(marker, at + 1)) {
    if (!intraWord(src, at, marker.length)) return at;
  }
  return -1;
}

/**
 * Index of the `)` matching the `(` at `from`, honouring nesting.
 *
 * ★★★ `indexOf(')')` WAS WRONG AND BROKE REAL LINKS. Parentheses are legal and
 *     common in URLs — every Wikipedia disambiguation page has a pair, and so
 *     does every generated anchor of the form `#method(arg)`. Stopping at the
 *     first `)` truncated the URL to `…/Foo_(bar`, which then failed the path
 *     check and silently demoted the link to plain text. It also matters for
 *     safety in the other direction: `(javascript:alert(1))` truncated to
 *     `javascript:alert(1` and left a stray `)` in the visible prose.
 */
function matchParen(src: string, from: number): number {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    if (src[i] === '\\') { i++; continue; }
    if (src[i] === '(') depth++;
    else if (src[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Index of the `]` matching the `[` at `from`, honouring nesting. */
function matchBracket(src: string, from: number): number {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    if (src[i] === '\\') { i++; continue; }
    if (src[i] === '[') depth++;
    else if (src[i] === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// ─── Blocks ───────────────────────────────────────────────────────────────────

const RE_FENCE   = /^\s{0,3}(```+|~~~+)\s*([\w+-]*)\s*$/;
const RE_HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RE_HR      = /^\s{0,3}(?:-\s*-\s*-[-\s]*|\*\s*\*\s*\*[*\s]*|_\s*_\s*_[_\s]*)$/;
const RE_QUOTE   = /^\s{0,3}>\s?(.*)$/;
const RE_ITEM    = /^(\s*)(?:([-*+])|(\d+)[.)])\s+(.*)$/;
const RE_TASK    = /^\[([ xX])\]\s+(.*)$/;

/** Parse a Markdown document into top-level blocks. */
export function parseMarkdown(src: string): readonly MdBlock[] {
  const lines = (src ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks: MdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // ── Fenced code ──
    const fence = RE_FENCE.exec(line);
    if (fence) {
      /**
       * ★★★ THE OPENING FENCE'S LENGTH IS KEPT, and truncating it to three was
       *     the bug. A code block that CONTAINS a fence — a Markdown snippet
       *     inside a document, which is what any documentation about Markdown
       *     looks like — is written with four backticks so the inner three are
       *     content. Reducing the marker to three made the first inner fence
       *     close the block, and the rest of the snippet spilled out as prose.
       *     CommonMark: the closer must be at least as long as the opener, which
       *     `startsWith` on the full marker gives for free.
       */
      const marker = fence[1];
      const language = fence[2] || '';
      const body: string[] = [];
      i++;
      let complete = false;
      while (i < lines.length) {
        if (lines[i].trimStart().startsWith(marker)) { complete = true; i++; break; }
        body.push(lines[i]);
        i++;
      }
      blocks.push({ kind: 'code', code: body.join('\n'), language, complete });
      continue;
    }

    // ── Thematic break ──
    if (RE_HR.test(line)) { blocks.push({ kind: 'hr' }); i++; continue; }

    // ── Heading ──
    const heading = RE_HEADING.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, inlines: parseInline(heading[2]) });
      i++;
      continue;
    }

    // ── Blockquote ──
    if (RE_QUOTE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && RE_QUOTE.test(lines[i])) {
        buf.push(RE_QUOTE.exec(lines[i])![1]);
        i++;
      }
      blocks.push({ kind: 'quote', inlines: parseInline(buf.join(' ').trim()) });
      continue;
    }

    // ── Table ──
    if (line.includes('|') && i + 1 < lines.length && isDivider(lines[i + 1])) {
      const head = splitRow(lines[i]);
      const align = parseAlign(lines[i + 1]);
      i += 2;
      const rows: MdTableRow[] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ kind: 'table', head, rows, align });
      continue;
    }

    // ── List ──
    const item = RE_ITEM.exec(line);
    if (item) {
      const ordered = item[3] !== undefined;
      const start = ordered ? Number(item[3]) : undefined;
      const items: MdListItem[] = [];
      while (i < lines.length) {
        const m = RE_ITEM.exec(lines[i]);
        if (!m) break;
        if ((m[3] !== undefined) !== ordered) break;
        const depth = Math.floor(m[1].replace(/\t/g, '  ').length / 2);
        const task = RE_TASK.exec(m[4]);
        items.push({
          depth,
          checked: task ? task[1].toLowerCase() === 'x' : null,
          inlines: parseInline(task ? task[2] : m[4]),
        });
        i++;
      }
      blocks.push({ kind: 'list', ordered, start, items });
      continue;
    }

    // ── Paragraph ──
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !RE_FENCE.test(lines[i]) &&
      !RE_HEADING.test(lines[i]) &&
      !RE_HR.test(lines[i]) &&
      !RE_QUOTE.test(lines[i]) &&
      !RE_ITEM.test(lines[i])
    ) {
      buf.push(lines[i].trim());
      i++;
    }
    if (buf.length) blocks.push({ kind: 'paragraph', inlines: parseInline(buf.join(' ')) });
  }

  return blocks;
}

/**
 * A GFM table delimiter row: `| --- | :-: |`, outer pipes optional.
 *
 * ★ Cell by cell, not one regex (1.0 audit, M5). The previous pattern —
 *   `^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$` — backtracks
 *   quadratically on whitespace: a 50,000-space line after a `|` row took ~2 s,
 *   once per streamed chunk, which is a frozen tab for prompt-injected output.
 *   Same language, linear time.
 */
function isDivider(line: string): boolean {
  let body = line.trim();
  if (body.startsWith('|')) body = body.slice(1);
  if (body.endsWith('|')) body = body.slice(0, -1);
  return body.split('|').every((cell) => /^:?-{2,}:?$/.test(cell.trim()));
}

/**
 * Split a table row on its cell separators.
 *
 * ★★ `String.split('|')` IS WRONG HERE and was the bug: a cell holding a pipe —
 *    `a \| b`, or any prose containing one — turned one cell into two and shifted
 *    every column after it. Rows then had more cells than the header and the
 *    table rendered ragged. GFM's answer is `\|`, so the splitter has to know
 *    about the backslash; `parseInline` turns the escape back into a pipe.
 *
 * The trailing `|` is stripped only when the line ends with an UNESCAPED one —
 * otherwise `| a \|` loses the pipe that was the cell's last character.
 */
function splitCells(line: string): string[] {
  const trimmed = line.trim();
  const from = trimmed.startsWith('|') ? 1 : 0;
  let to = trimmed.length;
  if (to > from && trimmed[to - 1] === '|' && !isEscaped(trimmed, to - 1)) to -= 1;

  const cells: string[] = [];
  let cur = '';
  for (let i = from; i < to; i++) {
    if (trimmed[i] === '\\' && i + 1 < to) {
      cur += trimmed[i] + trimmed[i + 1];
      i++;
      continue;
    }
    if (trimmed[i] === '|') {
      cells.push(cur);
      cur = '';
      continue;
    }
    cur += trimmed[i];
  }
  cells.push(cur);
  return cells;
}

/** True when the character at `at` is preceded by an odd number of backslashes. */
function isEscaped(s: string, at: number): boolean {
  let n = 0;
  for (let i = at - 1; i >= 0 && s[i] === '\\'; i--) n++;
  return n % 2 === 1;
}

function splitRow(line: string): MdTableRow {
  return splitCells(line).map((cell) => parseInline(cell.trim()));
}

function parseAlign(line: string): readonly MdAlign[] {
  return splitCells(line)
    .map((c): MdAlign => {
      const s = c.trim();
      if (s.startsWith(':') && s.endsWith(':')) return 'center';
      if (s.endsWith(':')) return 'right';
      return 'left';
    });
}
