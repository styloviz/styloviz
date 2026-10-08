/**
 * Mentions: finding the trigger, and keeping the token honest.
 *
 * Two separate problems live here, and only the first one is the one people
 * build.
 *
 * ── 1. Which trigger is active, and what has been typed after it ───────────
 *
 * A string-level scan of the text before the caret. It is extracted rather than
 * inlined because two components need exactly this rule — `sv-mention` (a
 * single-line contenteditable) and `sv-rich-text-editor` — and the second copy
 * of a rule like this always drifts from the first.
 *
 * ── 2. ★★★ THE INSERTED MENTION IS AN EDITABLE STRING, AND THAT IS THE DEFECT
 *      EVERY RICH-TEXT MENTION SHIPS ───────────────────────────────────────
 *
 * Insert `@Priya Sharma` as a styled span and the document now contains twelve
 * characters the user can edit one at a time. One backspace leaves
 * `@Priya Sharm` — which still looks like a mention, still carries the data
 * attribute naming Priya's user id, and now displays a name that is not hers.
 * The host persists it. A notification is addressed to a person whose name the
 * document renders incorrectly, or a permission check reads an id whose label
 * nobody would recognise.
 *
 * `contenteditable="false"` is necessary and NOT sufficient. Browsers still
 * allow the inside of such a node to change: a drag-and-drop into it, an IME
 * composition that spans its boundary, several mobile keyboards' autocorrect,
 * and a paste over a selection that partially covers it. So the token carries
 * its label as data, and `svTokenIntegrity` re-derives the answer from what is
 * actually in the DOM — because the only trustworthy statement about a mention
 * is one that compares the rendered text against what it claims to be.
 */

import { svEscapeHtml } from '../security/html-sanitizer';

/** A person, topic or command a mention can refer to. */
export interface SvMentionToken {
  readonly id: string;
  readonly label: string;
  /** The character that opened it, e.g. `'@'`. */
  readonly trigger: string;
}

/** An open trigger and the query typed after it. */
export interface SvTriggerMatch {
  /** The trigger character that opened the panel. */
  readonly trigger: string;
  /** Text typed after the trigger. `''` immediately after it. */
  readonly query: string;
  /** Index of the trigger character in the scanned string. */
  readonly at: number;
}

export interface SvTriggerOptions {
  /**
   * Longest query worth searching for.
   *
   * ★★ A CAP, BECAUSE AN UNCLOSED TRIGGER OTHERWISE SEARCHES A PARAGRAPH. Type
   * an `@` and then keep writing a sentence with no spaces after it — a URL, a
   * path, a long identifier — and without this the panel stays open issuing a
   * query per keystroke against text nobody meant as a search.
   * @default 60
   */
  readonly maxQuery?: number;
  /**
   * Require the trigger not to sit inside a word.
   *
   * ★★★ ON BY DEFAULT, AND IT IS WHAT STOPS EVERY EMAIL ADDRESS OPENING THE
   * PANEL. Typing `priya@example.com` has an `@` with no space after it, so a
   * naive scan opens a people-search on `example.com` in the middle of an
   * address the user is simply writing.
   *
   * ★★★ THE TEST IS "NOT PRECEDED BY A LETTER OR DIGIT", NOT "PRECEDED BY
   * WHITESPACE" — and the difference is not pedantry. The first version of this
   * demanded whitespace, which broke three existing fixtures the moment
   * `sv-mention` was refactored onto it: `(@alice`, `—@alice` and a trigger
   * typed straight after a full stop are all things people write and all things
   * that should open the panel. Whitespace-only is a stricter rule than the
   * intent, and the intent is "not in the middle of a word".
   *
   * ★★ Unicode-aware, so `José@example.com` is caught too. `\w` is ASCII-only,
   * which would have made the rule work for English names and quietly fail for
   * everyone else's.
   * @default true
   */
  readonly wordBoundary?: boolean;
}

const DEFAULTS: Required<SvTriggerOptions> = { maxQuery: 60, wordBoundary: true };

/**
 * Find the active trigger in the text before the caret.
 *
 * Returns `null` when no panel should be open, which is the common case and the
 * one worth being cheap.
 */
export function svScanTrigger(
  before: string,
  triggers: readonly string[],
  options: SvTriggerOptions = {},
): SvTriggerMatch | null {
  const { maxQuery, wordBoundary } = { ...DEFAULTS, ...options };
  if (before === '' || triggers.length === 0) return null;

  // ★★ THE TRIGGER NEAREST THE CARET WINS. With several configured — `@` people,
  //    `#` topics, `/` commands — `@alice #des|` must resolve against the `#`,
  //    or typing a topic after a mention searches for people.
  let at = -1;
  let trigger = '';
  for (const char of triggers) {
    if (char === '') continue;
    const i = before.lastIndexOf(char);
    if (i > at) { at = i; trigger = char; }
  }
  if (at === -1) return null;

  if (wordBoundary && at > 0 && /[\p{L}\p{N}_]/u.test(before[at - 1])) return null;

  const query = before.slice(at + trigger.length);
  // ★ A SPACE CLOSES IT. Without this the panel stays open for the rest of the
  //   paragraph, because the trigger character is still somewhere behind.
  if (/\s/.test(query)) return null;
  if (query.length > maxQuery) return null;

  return { trigger, query, at };
}

/**
 * Attribute names carried by a mention token.
 *
 * Exported because both the writer and the reader need them to agree, and a
 * string literal repeated in two files is a rename waiting to go half-done.
 */
export const SV_MENTION_ATTRS = {
  marker: 'data-sv-mention',
  id: 'data-sv-mention-id',
  label: 'data-sv-mention-label',
  trigger: 'data-sv-mention-trigger',
} as const;

/**
 * Escape text for insertion into an attribute or element body.
 *
 * 🔺 THIS WAS A BYTE-IDENTICAL COPY OF `svEscapeHtml`, inside `core`, four
 * directories from the original — which is the duplication T2 exists to stop,
 * already happened, in the package that is supposed to be the single source.
 * It is now an alias, kept only so the call sites below keep reading as
 * `esc(...)`.
 *
 * ⚠️ It escapes `&<>"` and NOT `'`. That is sufficient here and only here:
 * every attribute this module writes is double-quoted. Single-quote an
 * attribute anywhere and this stops being enough.
 */
const esc = svEscapeHtml;

/**
 * The markup for one mention.
 *
 * ★★★ `contenteditable="false"` MAKES IT ATOMIC TO THE CARET — arrow keys step
 * over it and backspace removes the whole thing — and the label is ALSO stored
 * as data, because that attribute is not a guarantee. See the file header: the
 * inside of such a node can still change, and when it does, the only way to know
 * is to compare what is rendered against what the token says it is.
 *
 * ★★ A trailing zero-width space is NOT used here, deliberately, though it is
 * the usual trick for "somewhere to put the caret after the chip". It is
 * invisible, it survives into the persisted value, it breaks string equality for
 * anyone comparing the document, and it arrives in exports and search indexes as
 * mojibake. The caret is placed after the node programmatically instead.
 */
export function svMentionHtml(token: SvMentionToken, className = ''): string {
  const cls = className === '' ? '' : ` class="${esc(className)}"`;
  return (
    `<span${cls} ${SV_MENTION_ATTRS.marker}="true"` +
    ` ${SV_MENTION_ATTRS.id}="${esc(token.id)}"` +
    ` ${SV_MENTION_ATTRS.label}="${esc(token.label)}"` +
    ` ${SV_MENTION_ATTRS.trigger}="${esc(token.trigger)}"` +
    ` contenteditable="false">${esc(token.trigger)}${esc(token.label)}</span>`
  );
}

export type SvTokenIntegrity =
  /** The rendered text still matches what the token claims to be. */
  | 'intact'
  /** It has been edited: the text and the stored label disagree. */
  | 'edited'
  /** Not a mention token at all. */
  | 'not-a-token';

/**
 * Does this element still say what it claims to say?
 *
 * ★★★ THE ONE CHECK THAT MAKES A MENTION TRUSTWORTHY. An `edited` token is not
 * a mention of anybody: it carries a user id and displays a name that is not
 * that user's, which is worse than having no mention at all, because everything
 * downstream — the notification, the permission check, the audit line — reads
 * the id and believes the label.
 */
export function svTokenIntegrity(el: Element): SvTokenIntegrity {
  if (el.getAttribute(SV_MENTION_ATTRS.marker) !== 'true') return 'not-a-token';
  const label = el.getAttribute(SV_MENTION_ATTRS.label);
  const trigger = el.getAttribute(SV_MENTION_ATTRS.trigger) ?? '';
  const id = el.getAttribute(SV_MENTION_ATTRS.id);
  if (label === null || id === null) return 'not-a-token';
  return el.textContent === `${trigger}${label}` ? 'intact' : 'edited';
}

/**
 * Every intact mention in a document, in document order.
 *
 * ★★ EDITED TOKENS ARE EXCLUDED RATHER THAN REPAIRED. Repairing means choosing
 * between two things the document says — the id and the text — and there is no
 * basis for that choice: the user may have been deleting the mention or fixing a
 * name. Reporting them separately lets the host decide, and `svMentionRepairs`
 * is what tells it there is a decision to make.
 */
export function svParseMentions(html: string): readonly SvMentionToken[] {
  return readTokens(html).intact;
}

/**
 * A token whose rendered text no longer matches the id it carries.
 *
 * Named rather than inlined because it crosses a public boundary in two
 * components and a host cannot write a handler for an anonymous shape without
 * retyping it — and a retyped shape is one that stops matching.
 */
export interface SvMentionRepair {
  /** The id the token still carries — the thing downstream will act on. */
  readonly id: string;
  /** What the token says it is. */
  readonly label: string;
  /** What it actually renders now. */
  readonly text: string;
}

/** Tokens whose rendered text no longer matches the id they carry. */
export function svMentionRepairs(html: string): readonly SvMentionRepair[] {
  return readTokens(html).edited;
}

function readTokens(html: string): {
  intact: SvMentionToken[];
  edited: SvMentionRepair[];
} {
  // Parsed inertly, for the same reason the paste sanitiser is: this may be
  // reading a value that came from a document somebody else wrote.
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const intact: SvMentionToken[] = [];
  const edited: SvMentionRepair[] = [];
  for (const el of Array.from(doc.querySelectorAll(`[${SV_MENTION_ATTRS.marker}="true"]`))) {
    const id = el.getAttribute(SV_MENTION_ATTRS.id);
    const label = el.getAttribute(SV_MENTION_ATTRS.label);
    const trigger = el.getAttribute(SV_MENTION_ATTRS.trigger) ?? '';
    if (id === null || label === null) continue;
    if (svTokenIntegrity(el) === 'intact') intact.push({ id, label, trigger });
    else edited.push({ id, label, text: el.textContent ?? '' });
  }
  return { intact, edited };
}

/**
 * The document as plain text, with each mention rendered as its trigger + label.
 *
 * ★★ FROM THE STORED LABEL, NOT FROM THE ELEMENT'S TEXT. If the two disagree the
 * element's text is the thing that is wrong — the id is what the mention MEANS —
 * so a plain-text rendering that trusted the DOM would propagate the corruption
 * into the notification email.
 */
export function svMentionPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // ★★★ `textContent` INCLUDES THE SOURCE OF `<script>` AND `<style>`, which is
  //     not text anybody wrote — it is code, and a plain-text rendering that
  //     carries it puts a stylesheet into the notification email.
  //
  // ★★ THE SECOND TIME THIS EXACT MISTAKE HAS APPEARED IN THIS CODEBASE (the
  //    rich editor's `svPlainTextFromHtml` had it too, and its own spec caught
  //    it). `textContent` reads as "just the words" and is not; the lesson is
  //    that any function turning a document into text needs this line, and the
  //    reason it keeps getting missed is that the omission is invisible on every
  //    document that happens not to contain a script.
  for (const el of Array.from(doc.querySelectorAll('script,style,noscript,template,title'))) {
    el.remove();
  }
  for (const el of Array.from(doc.querySelectorAll(`[${SV_MENTION_ATTRS.marker}="true"]`))) {
    const label = el.getAttribute(SV_MENTION_ATTRS.label);
    const trigger = el.getAttribute(SV_MENTION_ATTRS.trigger) ?? '';
    if (label !== null) el.replaceWith(doc.createTextNode(`${trigger}${label}`));
  }
  return doc.body.textContent ?? '';
}

/** `@Priya Sharma` */
export function svMentionLabel(token: SvMentionToken): string {
  return `${token.trigger}${token.label}`;
}
