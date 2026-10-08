/**
 * ★★★ THE KIT'S ONE HTML SANITISER. Every component that puts markup it did not
 * author into the DOM comes here — the rich editor's paste path, the form
 * builder's remote schema, autocomplete's match highlighting. There is exactly
 * one of these on purpose: a second sanitiser is not twice the safety, it is
 * two allowlists that drift until a tag one of them drops is a tag the other
 * keeps, and nobody finds out which is which until it matters.
 *
 * ── Why it moved (`X-4`, T2 step 1) ─────────────────────────────────────────
 *
 * It was written for, and lived in, `@styloviz-pro/rich-editor`, where it was
 * complete, tested and correct — and **unreachable**. Nothing outside that one
 * package could import it, so the next component needing to sanitise anything
 * had a choice between taking a dependency on a rich text editor and writing
 * its own. That is how kits end up with three. `@styloviz-pro/rich-editor`
 * re-exports every name unchanged, so no caller of that package moved.
 *
 * ★★★ THIS CROSSED A TIER BOUNDARY, AND THAT IS THE DECISION IN THIS COMMIT.
 *     `@styloviz-pro/rich-editor` is Pro; `@styloviz/core` is free, so every
 *     free-tier component and every free-tier user now has this. That is the
 *     point rather than a side effect: `sv-search-bar`, `sv-tag-input` and
 *     `sv-input-field` all ship free twins, all of them render text they did not
 *     author, and a kit whose answer to "how do I not get XSS'd" is "buy the
 *     rich text editor" has taken a position it could not defend. A sanitiser is
 *     infrastructure, not a feature — the editor stays Pro, and what moved is
 *     four hundred lines of allowlist that differentiate nothing.
 *
 * ★★ THE CODE IS UNCHANGED BY THE MOVE, DELIBERATELY. Relocation and
 *    modification in one step means a behaviour change hides inside a diff that
 *    reads as a rename. The specs came with it and are the proof — they were
 *    passing against this exact source in `rich-editor` the commit before.
 *
 * ── What it does not do ─────────────────────────────────────────────────────
 *
 * ⚠️ THIS IS NOT A SUBSTITUTE FOR A CONTENT SECURITY POLICY, AND IT IS NOT A
 *    SERVER-SIDE CHECK. It runs in the browser, on the browser's own parser, and
 *    a value that has been through it is safe *to render here and now*. It is
 *    not attested, not signed, and not safe by the time it has been through a
 *    round trip you do not control. Sanitise again where the value is stored,
 *    and ship a CSP — `FI-19-I1` is the item that says this in the docs where
 *    integrators will read it.
 *
 * ── Cleaning what the clipboard brings in ───────────────────────────────────
 *
 * ★★★ AN EDITOR WITH NO PASTE SANITISER IS A STORED-XSS PIPE FROM ONE USER'S
 * CLIPBOARD TO EVERY OTHER READER OF THE DOCUMENT.
 *
 * This is the half of "paste cleanup" nobody writes the feature for. The
 * complaint that gets it built is cosmetic — pasting from Word drags in forty
 * lines of `mso-` styles and a font stack nobody chose — but the same absent
 * handler is why whatever markup the clipboard carries lands in the
 * contenteditable, is read straight back out of `innerHTML` into the bound
 * value, and is persisted. The next reader renders it. A "sanitiser" that only
 * tidies formatting has fixed the visible half of the hole and left the other.
 *
 * ★★★ ALLOWLIST, NOT DENYLIST. "Strip `<script>` and `on*`" is the shape every
 * hand-rolled cleaner takes, and it is defeated by whatever its author did not
 * think of that morning: `<iframe srcdoc>`, `<object data>`, `<svg><animate
 * onbegin>`, `<math href>`, an `href="javascript:"` on a plain link, a
 * `<base href>` that repoints every relative URL on the page. A denylist has to
 * be right about every attack; an allowlist has to be right about the twenty
 * tags a document actually needs.
 *
 * ★★★ AND IT IS PARSED WITH `DOMParser`, NOT BY ASSIGNING TO `innerHTML` FIRST.
 * That distinction is the entire safety of this module. Assigning untrusted
 * markup to a live element runs `onerror`, fires `<img src>` and `<video
 * poster>` requests to the attacker's host, and evaluates `<svg><script>` —
 * before a single line of cleaning code has run. `DOMParser.parseFromString`
 * builds an inert document: no scripts execute, no subresources load. Cleaning
 * markup by putting it in the page first and tidying afterwards is the mistake
 * this comment exists to prevent someone making in a refactor.
 *
 * ★★ Regex is not used to parse HTML here, for the ordinary reason: `<scr<script
 * >ipt>`, unquoted attributes, stray `>` inside attribute values and a dozen
 * other shapes defeat it, and the failures are silent.
 */

/** Tags a pasted document may keep. Everything else is unwrapped or dropped. */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'div', 'span',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'ins', 'sub', 'sup', 'mark',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a',
  'img',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  'hr',
]);

/**
 * Elements whose CONTENT is dropped along with them.
 *
 * ★★ THE DEFAULT FOR A DISALLOWED TAG IS TO UNWRAP IT AND KEEP THE TEXT — a
 * pasted `<article>` should leave its prose behind, not delete it. These are the
 * exceptions, where the text content is not prose at all: the body of a
 * `<style>` block is CSS, and unwrapping it would paste the stylesheet source
 * into the document as visible text. `<script>` cannot execute here, having been
 * parsed inertly, but its source is not prose either.
 */
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'noscript', 'template', 'title', 'head',
  'iframe', 'object', 'embed', 'applet', 'frame', 'frameset',
  'link', 'meta', 'base',
  'form', 'input', 'button', 'select', 'textarea', 'option',
  'audio', 'video', 'source', 'track', 'canvas', 'map', 'area',
  'svg', 'math',
]);

/** Attributes each tag may keep. `*` applies to every allowed tag. */
const ALLOWED_ATTRS: Readonly<Record<string, readonly string[]>> = {
  '*': ['style'],
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan', 'scope'],
  col: ['span'],
  colgroup: ['span'],
  ol: ['start', 'type'],
};

/**
 * CSS properties worth keeping off a paste.
 *
 * ★★ A NARROW LIST, BECAUSE `style` IS THE OTHER HALF OF THE MESS. Word emits
 * `mso-ansi-language`, `mso-fareast-font-family`, absolute pixel line heights and
 * a font stack from the machine it was written on; keeping all of it is why
 * pasted text looks nothing like the document around it. Keeping none of it
 * loses the bold-red-warning the author meant. These are the properties a
 * document can carry without dictating its own typography.
 *
 * ★★★ `position` IS NOT ON THIS LIST, DELIBERATELY. A pasted
 * `position: fixed; inset: 0; z-index: 9999` is an invisible full-screen overlay
 * over the host's own page — a clickjack that needs no script at all, and one
 * that survives every sanitiser that only thinks about tags.
 */
const ALLOWED_STYLES = new Set([
  'color', 'background-color',
  'font-weight', 'font-style', 'text-decoration', 'text-decoration-line',
  'text-align', 'vertical-align',
]);

/** URL schemes a link or image may use. */
const SAFE_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

export interface SvPasteOptions {
  /** Keep images. @default true */
  readonly allowImages?: boolean;
  /** Keep links. @default true */
  readonly allowLinks?: boolean;
  /** Keep tables. @default true */
  readonly allowTables?: boolean;
  /** Keep the narrow list of inline styles. @default true */
  readonly allowStyles?: boolean;
  /**
   * Allow `data:image/*` in `src`.
   *
   * ★★ OFF BY DEFAULT AND NOT AN OVERSIGHT. Pasting a screenshot inlines a base64
   * payload that can be megabytes; a host that persists the editor's value then
   * stores it in a database row. Turn it on when you have decided that is what
   * you want. `data:` of any other type is refused whatever this says — `data:`
   * plus `text/html` is a same-origin document.
   */
  readonly allowDataImages?: boolean;
}

export interface SvPasteResult {
  /** The cleaned markup. */
  readonly html: string;
  /** Tag names removed entirely, with their content. */
  readonly droppedElements: readonly string[];
  /** Attributes removed, as `tag[attr]`. */
  readonly droppedAttributes: readonly string[];
  /** True when anything was removed at all. */
  readonly changed: boolean;
}

const DEFAULTS: Required<SvPasteOptions> = {
  allowImages: true,
  allowLinks: true,
  allowTables: true,
  allowStyles: true,
  allowDataImages: false,
};

/**
 * Is this URL safe to keep?
 *
 * ★★★ RESOLVED WITH `new URL`, NOT MATCHED WITH A PREFIX CHECK.
 * `href.startsWith('javascript:')` misses ` javascript:` (a leading space, which
 * the HTML parser strips), `JaVaScRiPt:`, and a scheme split by an embedded
 * control character (`java`, U+0009, `script:`) — all of which navigate,
 * because the HTML attribute parser strips tabs, newlines and carriage returns
 * out of a URL before anything resolves it. The URL parser applies the same normalisation the browser will, so
 * the scheme this reads is the scheme that would run.
 */
export function svIsSafeUrl(value: string, allowDataImages: boolean): boolean {
  const raw = value.trim();
  if (raw === '') return false;
  // A relative URL has no scheme of its own and inherits the page's, which is
  // safe by construction — but only once it is genuinely relative, so it is
  // resolved against a base rather than assumed.
  let url: URL;
  try {
    url = new URL(raw, 'https://styloviz.invalid/');
  } catch {
    return false;
  }
  if (url.protocol === 'data:') {
    return allowDataImages && /^data:image\/(png|jpeg|jpg|gif|webp|avif);base64,/i.test(raw);
  }
  return SAFE_SCHEMES.includes(url.protocol);
}

/** Strip Word's `mso-` noise and anything not on the allowlist from a style attribute. */
export function svCleanStyle(style: string, allow: boolean): string {
  return allow ? cleanStyleWith(style, ALLOWED_STYLES) : '';
}

function cleanStyleWith(style: string, allowed: ReadonlySet<string>): string {
  const kept: string[] = [];
  for (const declaration of style.split(';')) {
    const at = declaration.indexOf(':');
    if (at < 0) continue;
    const property = declaration.slice(0, at).trim().toLowerCase();
    const value = declaration.slice(at + 1).trim();
    if (value === '' || !allowed.has(property)) continue;
    // ★ `expression()` is dead in every current browser, and `url()` in a kept
    //   property is not — `background-color: url(...)` is invalid CSS but a
    //   parser may still fetch it, which leaks that the document was opened.
    if (/expression\s*\(|url\s*\(|[\\@]/i.test(value)) continue;
    kept.push(`${property}: ${value}`);
  }
  return kept.join('; ');
}

/**
 * What one sanitising pass may keep. The paste profile and the editor profile
 * are two of these over ONE walker — a second walker would be the second
 * sanitiser the file header warns about.
 */
interface SanitizePolicy {
  readonly tags: ReadonlySet<string>;
  readonly attrs: Readonly<Record<string, readonly string[]>>;
  readonly styles: ReadonlySet<string> | null;
  readonly allowDataImages: boolean;
  /** Class tokens to keep. `null` = the `class` attribute is not allowed at all. */
  readonly keepClass: ((token: string) => boolean) | null;
  /** Extra attribute NAMES to keep on any allowed tag (e.g. `data-sv-mention-*`). */
  readonly keepAttr: ((name: string) => boolean) | null;
  /** `<input type>` values kept as elements rather than dropped with content. */
  readonly inputTypes: ReadonlySet<string>;
}

/**
 * Clean markup arriving from the clipboard.
 *
 * Returns the cleaned HTML plus what was removed, so the editor can tell the
 * author rather than silently eating half of what they pasted — the behaviour
 * that makes people paste into Notepad first and then back in.
 */
export function svCleanPastedHtml(html: string, options: SvPasteOptions = {}): SvPasteResult {
  const opts = { ...DEFAULTS, ...options };
  const tags = new Set(ALLOWED_TAGS);
  if (!opts.allowImages) tags.delete('img');
  if (!opts.allowLinks) tags.delete('a');
  if (!opts.allowTables) {
    for (const t of ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col']) {
      tags.delete(t);
    }
  }
  return sanitizeWith(html, {
    tags,
    attrs: ALLOWED_ATTRS,
    styles: opts.allowStyles ? ALLOWED_STYLES : null,
    allowDataImages: opts.allowDataImages,
    keepClass: null,
    keepAttr: null,
    inputTypes: NO_INPUTS,
  });
}

const NO_INPUTS: ReadonlySet<string> = new Set();

/**
 * The editor profile — what `sv-rich-text-editor` itself writes, and nothing a
 * stored document could use to run code.
 *
 * ★★★ WHY A SECOND PROFILE AND NOT THE PASTE ONE. The paste allowlist is right
 *     for foreign markup and wrong for the editor's OWN: it drops `class`, so
 *     `rte-table` / `rte-image-block` lose their styling; it drops
 *     `data-sv-mention-*`, so every mention chip degrades to plain text; it
 *     keeps 8 style properties, so font family, font size, line height, indent
 *     and image width all vanish on reload. Reusing it would have made the
 *     security fix a data-loss bug on every saved document.
 *
 * ★★ WHAT IS STILL OUT. Everything that executes or loads: `on*`, `srcdoc`,
 *    `<script>`, `<iframe>`, `<svg>`, `<style>`, `javascript:`/`data:text/html`
 *    URLs, `url()` in CSS. And everything that escapes the editor's box:
 *    `position`, `z-index`, `inset`/`top`/`left`, `transform`. `class` keeps
 *    only the kit's own prefixes (`rte-`, `sv-`, `language-`) plus whatever the
 *    host vouches for — an arbitrary class is a host-stylesheet gadget
 *    (`fixed inset-0 z-50` is a clickjack with no script in it).
 */
const EDITOR_TAGS: ReadonlySet<string> = new Set([
  ...ALLOWED_TAGS, 'figure', 'figcaption', 'font', 'input',
]);

const EDITOR_ATTRS: Readonly<Record<string, readonly string[]>> = {
  ...ALLOWED_ATTRS,
  '*': ['style', 'dir', 'contenteditable'],
  img: [...(ALLOWED_ATTRS['img'] ?? []), 'loading', 'decoding'],
  font: ['color', 'face', 'size'],
  input: ['type', 'checked', 'disabled'],
};

const EDITOR_STYLES: ReadonlySet<string> = new Set([
  ...ALLOWED_STYLES,
  'font-family', 'font-size', 'line-height', 'letter-spacing', 'text-indent', 'text-transform',
  'width', 'max-width', 'min-width', 'height', 'max-height',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-color', 'border-style', 'border-width', 'border-collapse', 'border-spacing', 'border-radius',
  'list-style-type', 'white-space', 'float', 'clear',
]);

const KIT_CLASS = /^(rte|sv|language)-[A-Za-z0-9_-]+$/;
const MENTION_ATTR = /^data-sv-mention(-[a-z]+)?$/;
const EDITOR_INPUTS: ReadonlySet<string> = new Set(['checkbox']);

export interface SvEditorHtmlOptions {
  /**
   * Keep `data:image/*` sources. @default true — the editor's own image upload
   * stores the file as a `data:` URL, so refusing them would delete every
   * uploaded image on reload. `data:` of any non-image type is refused anyway.
   */
  readonly allowDataImages?: boolean;
  /**
   * Extra class tokens to keep beyond the kit's own `rte-` / `sv-` /
   * `language-` prefixes — e.g. the classes of a host-configured mention chip.
   */
  readonly keepClass?: (token: string) => boolean;
}

/**
 * Sanitise HTML that is about to become the CONTENT of an editing surface —
 * a stored document loaded through `[value]` / `formControl`, or source-view
 * text being applied. Same walker, same inert parse and same URL rules as
 * {@link svCleanPastedHtml}; a wider allowlist that matches what the editor
 * itself writes. See `EDITOR_TAGS` above for what is kept and why.
 *
 * ⚠️ Same caveat as the paste path: this makes a value safe to render HERE.
 *    Sanitise again where the value is stored, and ship a CSP.
 */
export function svSanitizeEditorHtml(html: string, options: SvEditorHtmlOptions = {}): SvPasteResult {
  const extra = options.keepClass;
  return sanitizeWith(html, {
    tags: EDITOR_TAGS,
    attrs: EDITOR_ATTRS,
    styles: EDITOR_STYLES,
    allowDataImages: options.allowDataImages ?? true,
    keepClass: (t) => KIT_CLASS.test(t) || (extra?.(t) ?? false),
    keepAttr: (name) => MENTION_ATTR.test(name),
    inputTypes: EDITOR_INPUTS,
  });
}

function sanitizeWith(html: string, policy: SanitizePolicy): SvPasteResult {
  const droppedElements: string[] = [];
  const droppedAttributes: string[] = [];

  // ★★★ INERT. See the file header: this is the line that makes the module safe,
  //     and replacing it with an `innerHTML` assignment on a live node undoes
  //     every other line in the file.
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const allowedTags = policy.tags;

  /** Replace a node with its children, keeping the text. */
  const unwrap = (el: Element): void => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  };

  const clean = (node: Node): void => {
    // Snapshot first: the walk removes and unwraps as it goes, and a live
    // childNodes list skips siblings when the one before them disappears.
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 8 /* Comment */) {
        // Word's conditional comments (`<!--[if gte mso 9]>…`) carry a whole
        // second copy of the document.
        child.parentNode?.removeChild(child);
        continue;
      }
      if (child.nodeType !== 1 /* Element */) continue;

      const el = child as Element;
      const tag = el.tagName.toLowerCase();

      // A checkbox is the one form control a document carries (a Markdown task
      // list). Every other `<input>` is a phishing surface, not prose.
      const keptInput = tag === 'input' && policy.inputTypes.has((el.getAttribute('type') ?? '').toLowerCase());
      if (!keptInput && DROP_WITH_CONTENT.has(tag)) {
        droppedElements.push(tag);
        el.parentNode?.removeChild(el);
        continue;
      }

      if (!allowedTags.has(tag)) {
        // Clean the subtree BEFORE unwrapping: once the children are lifted into
        // the parent, this walk has already passed their new position.
        clean(el);
        droppedElements.push(tag);
        unwrap(el);
        continue;
      }

      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const permitted =
          (policy.attrs['*'] ?? []).includes(name) ||
          (policy.attrs[tag] ?? []).includes(name) ||
          (name === 'class' && policy.keepClass !== null) ||
          (policy.keepAttr?.(name) ?? false);
        if (!permitted) {
          droppedAttributes.push(`${tag}[${name}]`);
          el.removeAttribute(attr.name);
          continue;
        }
        if (name === 'href' || name === 'src') {
          if (!svIsSafeUrl(attr.value, policy.allowDataImages)) {
            droppedAttributes.push(`${tag}[${name}]`);
            el.removeAttribute(attr.name);
          }
          continue;
        }
        const keepClass = policy.keepClass;
        if (name === 'class' && keepClass) {
          const kept = attr.value.split(/\s+/).filter((t) => t !== '' && keepClass(t));
          if (kept.length === 0) {
            droppedAttributes.push(`${tag}[class]`);
            el.removeAttribute('class');
          } else {
            el.setAttribute('class', kept.join(' '));
          }
          continue;
        }
        // ★ Only the value that makes an island read-only survives. `true`
        //   would let a stored fragment re-arm editing inside a readonly view.
        if (name === 'contenteditable' && attr.value.toLowerCase() !== 'false') {
          droppedAttributes.push(`${tag}[contenteditable]`);
          el.removeAttribute(attr.name);
          continue;
        }
        if (name === 'style') {
          const cleaned = policy.styles ? cleanStyleWith(attr.value, policy.styles) : '';
          if (cleaned === '') {
            if (attr.value.trim() !== '') droppedAttributes.push(`${tag}[style]`);
            el.removeAttribute('style');
          } else {
            if (cleaned !== attr.value.trim()) droppedAttributes.push(`${tag}[style]`);
            el.setAttribute('style', cleaned);
          }
        }
      }

      // ★★ A LINK THAT SURVIVES GETS `rel="noopener noreferrer"` WHEN IT OPENS A
      //    NEW TAB. `target="_blank"` without it hands the opened page a
      //    `window.opener` handle it can navigate — the reverse-tabnabbing that
      //    every "share this link" feature used to ship.
      if (tag === 'a' && el.getAttribute('target') === '_blank') {
        el.setAttribute('rel', 'noopener noreferrer');
      }

      clean(el);

      // A span or div left with no attributes is Word packaging, not structure.
      if ((tag === 'span' || tag === 'font') && el.attributes.length === 0) {
        unwrap(el);
      }
    }
  };

  // ★★★ `<head>` HAS TO BE COUNTED, AND IT IS NOT OBVIOUS THAT IT EXISTS.
  //     `DOMParser` runs the real HTML insertion algorithm, which routes a
  //     leading `<script>`, `<style>`, `<base>`, `<meta>` or `<link>` into an
  //     implicit `<head>` — before any body content has been seen. Walking only
  //     `body` therefore never encounters them. They are still gone from the
  //     output, because the output is `body.innerHTML`, so the SAFETY was never
  //     in question; what was wrong is that the report came back empty and
  //     `changed` came back false, so the editor would tell an author nothing had
  //     been removed while quietly discarding the first half of their clipboard.
  //     Found by a test that asserted the report, not the markup.
  for (const el of Array.from(doc.head.children)) {
    droppedElements.push(el.tagName.toLowerCase());
  }

  clean(doc.body);

  const cleaned = doc.body.innerHTML;
  return {
    html: cleaned,
    droppedElements: [...new Set(droppedElements)].sort(),
    droppedAttributes: [...new Set(droppedAttributes)].sort(),
    changed: droppedElements.length > 0 || droppedAttributes.length > 0,
  };
}

/**
 * The text of a pasted fragment, with block boundaries preserved as newlines.
 *
 * ★★ `textContent` ALONE RUNS EVERY PARAGRAPH TOGETHER. Pasting a three-page
 * document as plain text and getting one enormous line is the reason people
 * think paste-as-plain-text is broken; block elements have to become newlines
 * because that is what they meant.
 */
export function svPlainTextFromHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // ★★★ `textContent` INCLUDES THE SOURCE OF `<script>` AND `<style>`, which is
  //     not text the author pasted — it is code, and dumping it into the
  //     document as visible prose is exactly the Word-stylesheet-as-paragraphs
  //     failure this function was supposed to avoid. Not a security hole (the
  //     result is escaped downstream), but the "safe" path quietly producing the
  //     ugliest possible output is worth its own line. Found by a test asserting
  //     the script source was absent.
  for (const el of Array.from(doc.body.querySelectorAll('script,style,noscript,template,title'))) {
    el.remove();
  }
  for (const el of Array.from(doc.body.querySelectorAll('br'))) {
    el.replaceWith(doc.createTextNode('\n'));
  }
  const BLOCKS = 'p,div,li,tr,h1,h2,h3,h4,h5,h6,blockquote,pre,section,article,header,footer';
  for (const el of Array.from(doc.body.querySelectorAll(BLOCKS))) {
    el.appendChild(doc.createTextNode('\n'));
  }
  return (doc.body.textContent ?? '')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Escape text for insertion as HTML. */
export function svEscapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Plain text as paragraphs.
 *
 * ★★★ ESCAPED FIRST, ALWAYS. "Paste as plain text" that then builds HTML out of
 * the string without escaping it is a sanitiser that reintroduces the exact hole
 * it was added to close — and it reads as the safest path in the file.
 */
export function svPlainTextToHtml(text: string): string {
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs
    .map((p) => {
      const lines = p.split('\n').map(svEscapeHtml);
      return `<p>${lines.join('<br>') || '<br>'}</p>`;
    })
    .join('');
}

/** `Removed 2 unsupported elements and 5 attributes.` */
export function svPasteSummary(result: SvPasteResult): string {
  if (!result.changed) return '';
  const parts: string[] = [];
  const e = result.droppedElements.length;
  const a = result.droppedAttributes.length;
  if (e > 0) parts.push(`${e} unsupported element${e === 1 ? '' : 's'}`);
  if (a > 0) parts.push(`${a} attribute${a === 1 ? '' : 's'}`);
  return `Cleaned on paste: removed ${parts.join(' and ')}.`;
}
