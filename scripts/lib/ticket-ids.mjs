/**
 * ticket-ids.mjs — the repo's internal tracker ids, and how to take them out
 * of anything a buyer reads (FL-L1-07).
 *
 * The JSDoc is written for maintainers and cites the row that changed it:
 * `FL-B4`, `FL-J3-NV-04`, `SR-27b`, `X-10`, `(audit item CH-11-M2)`. That text
 * ships — in the `.d.ts` an IDE shows on hover (1,285 ids in 98 files when the
 * L1 auditor counted), the generated docs pages, the READMEs and the ACR — and
 * a buyer cannot look any of them up. The source keeps them; every published
 * copy goes through `stripTicketIds`.
 *
 * Only the prefixes the trackers actually use are ids. A standard's name
 * (`BCP-47`, `EAN-13`, `UTF-8`, `ISO-8601`, `SHA-256`) never matches.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** One tracker id: a launch row (`FL-J3-NV-01…09`) or an audit item (`OF-09-I1`, `SR-27b`, `X-4`). */
export const TICKET_ID =
  String.raw`(?:FL-[A-Z]\d*[a-z]?(?:-(?:[A-Z]{2}|\d{2}[a-z]?))*(?:[ \t]*(?:…|\.\.\.|–)[ \t]*\d{2})?` +
  String.raw`|(?:SR|X|DA|DD|SF|FU|AI|CH|FI|LU|NV|OF)-\d{1,2}[a-z]?(?:-[A-Z]{1,2}\d{1,3})?)`;

/** A tracker file named in prose: `STYLOVIZ_RELEASE_TODO.md`, `STYLOVIZ_SCROLL_FLICKER_TODO`. */
const TRACKER_FILE = String.raw`\`?STYLOVIZ_[A-Z0-9_]*TODO(?:\.md)?\`?`;

const ID = String.raw`\`?\b${TICKET_ID}(?![\w-])\`?`;
const SEP = String.raw`(?:[ \t]*[,/][ \t]*|[ \t]+and[ \t]+|[ \t]*[–…][ \t]*|[ \t]+)`;
const RUN = `${ID}(?:${SEP}${ID})*`;
const LEAD = String.raw`(?:(?:audit item|audit|see|cf\.|per|from|was)[ \t]+)?`;

// ★ An id or a tracker file is required: `foo()` is code, not an emptied parenthesis.
const ONLY_IDS = new RegExp(String.raw`[ \t]*\(${LEAD}(?:${TRACKER_FILE}(?:[ \t]*${RUN})?|${RUN})\)`, 'g');
const INTRODUCED = new RegExp(String.raw`[ \t]*(?:[—–]|\b(?:by|in|under|per|see|from|audit item))[ \t]+${RUN}`, 'g');
const LABEL = new RegExp(String.raw`${RUN}(?:[ \t]*[:—–](?=[ \t]))?[ \t]*`, 'g');
const FILE = new RegExp(String.raw`[ \t]*(?:(?:in|see)[ \t]+)?${TRACKER_FILE}`, 'g');

const HAS_ID = new RegExp(String.raw`\b${TICKET_ID}(?![\w-])|${TRACKER_FILE}`);
const ALL_IDS = new RegExp(String.raw`\b${TICKET_ID}(?![\w-])|${TRACKER_FILE}`, 'g');

/** Whether the text names a tracker id or tracker file. */
export const hasTicketId = (text) => HAS_ID.test(text);

/** Every tracker id or tracker file the text names. */
export const ticketIds = (text) => text.match(ALL_IDS) ?? [];

/** Tidy what a removed id leaves behind on one line, keeping its indentation. */
const tidy = (line) => {
  const indent = /^[ \t]*(?:\*[ \t]?|\/\/[ \t]?)?/.exec(line)[0];
  const body = line
    .slice(indent.length)
    .replace(/\(\s*[,;]\s*/g, '(')
    .replace(/\s*[,;]\s*\)/g, ')')
    .replace(/\s*\(\s+\)/g, '')
    .replace(/[ \t]+([.,;:])(?=\s|$)/g, '$1')
    .replace(/,(?:\s*,)+/g, ',')
    // "typed. (X-4)." → "typed.." — but a `...spread` keeps its three dots.
    .replace(/(?<!\.)\.\.(?!\.)/g, '.')
    .replace(/([?!])\.(?=\s|$)/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/, '')
    // A line that held only the id keeps no stray full stop.
    .replace(/^[.,;:]$/, '');
  return indent + body;
};

/**
 * The text with every tracker id taken out — a parenthesis holding only ids,
 * an id introduced by "— / by / in / per / see", an `X-4:` label, a bare id —
 * and the punctuation it leaves tidied, line by line (indentation kept, so it
 * is safe inside a `/** … *\/` block).
 */
export function stripTicketIds(text) {
  if (!hasTicketId(text)) return text;
  return text
    .split('\n')
    .map((line) => {
      if (!hasTicketId(line)) return line;
      return tidy(line.replace(ONLY_IDS, '').replace(INTRODUCED, '').replace(LABEL, '').replace(FILE, ''));
    })
    .join('\n');
}

/**
 * The same for compiled output: only comments are touched — `/** … *\/` and
 * `/* … *\/` blocks and `//` line comments that start a line, and the
 * `<!-- -->` notes inside a template string — so code and every other string
 * is left exactly as built.
 */
export function stripTicketIdsFromComments(source) {
  if (!hasTicketId(source)) return source;
  return source
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, (block) => stripTicketIds(block))
    .replace(/^[ \t]*\/\/.*$/gm, (line) => stripTicketIds(line))
    // Partial compilation ships each template as a string, its `<!-- -->` notes included.
    .replace(/<!--[\s\S]*?-->/g, (note) => stripTicketIds(note));
}

/**
 * Strip ids from the comments of every `.d.ts`, `.mjs` and `.css` under a built
 * package, in place. Returns the files changed and any id still left — in a
 * `.d.ts` that is a build failure (`build-libs.mjs`).
 */
export function stripTicketIdsInDir(dir) {
  const changed = [];
  const leftovers = [];
  const visit = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) visit(p);
      else if (/\.(d\.ts|mjs|css)$/.test(e.name)) {
        const before = readFileSync(p, 'utf8');
        const after = stripTicketIdsFromComments(before);
        if (after !== before) writeFileSync(p, after), changed.push(p);
        const ids = ticketIds(after);
        if (ids.length) leftovers.push({ file: p, ids: [...new Set(ids)] });
      }
    }
  };
  if (existsSync(dir)) visit(dir);
  return { changed, leftovers };
}

// ── Published API text: the wide form ───────────────────────────────────────
//
// `TICKET_ID` is a closed list of the trackers' own prefixes, which is what the
// `.d.ts` pass needs. Component JSDoc also cites ids from per-feature trackers
// (`GANTT-090`) that no list names, so the API descriptions — prose, never code —
// take the wide form: two to six capitals, a hyphen, two to four digits. A
// standard keeps its name, and anything quoted (`"Invoice INV-2041"`, a code
// span) is an example value, not a citation.

/** Names that look like an id and are a standard, a registry or a format. */
const STANDARD = /^(?:BCP|EAN|ECMA|CVE|ISO|IEC|IEEE|RFC|SHA|MD|UTF|UCS|ES|WCAG|ARIA|EN|ANSI|ISBN|ISSN|UPC|GTIN|HTTP|TLS|AES|CRC|TC|SC|WG)$/;
const WIDE_ID = /(\s*\((?:see |per )?)?\b([A-Z]{2,6})-\d{2,4}(?![\w-])(\))?/g;
/** Quoted and code spans, kept as they are. */
const QUOTED = /(`[^`]*`|"[^"]*"|“[^”]*”|'[^'\s][^']*')/;

/** `text` without bare tracker ids of any prefix (`GANTT-090`), standards and quoted text untouched. */
export function stripWideTicketIds(text) {
  let removed = false;
  const out = text
    .split(QUOTED)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(WIDE_ID, (match, open = '', prefix, close = '') => {
            if (STANDARD.test(prefix)) return match;
            removed = true;
            // `(GANTT-090)` goes whole; a bare id keeps the parenthesis it did not open.
            return open && close ? '' : `${open}${close}`;
          }),
    )
    .join('');
  // Tidy only what a removal left: a doubled space, a space before closing punctuation.
  return removed ? out.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+([.,;:])(?=\s|$)/g, '$1') : out;
}
