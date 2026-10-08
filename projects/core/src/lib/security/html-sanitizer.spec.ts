import {
  svCleanPastedHtml,
  svCleanStyle,
  svEscapeHtml,
  svIsSafeUrl,
  svPasteSummary,
  svPlainTextFromHtml,
  svPlainTextToHtml,
} from './html-sanitizer';

/**
 * Paste cleaning.
 *
 * The feature gets built because Word paste is ugly. This file is mostly about
 * the other half: the same absent handler is what lets clipboard markup reach
 * the bound value, get persisted, and be rendered to the next reader.
 */

const clean = (html: string, options = {}) => svCleanPastedHtml(html, options).html;

// ── The hole, not the mess ──────────────────────────────────────────────────

describe('markup that must not survive a paste', () => {
  /**
   * ★★★ THE EDITOR READS ITS VALUE BACK OUT OF `innerHTML`. Whatever the
   * clipboard carried is what the host persists and what the next reader
   * renders, so this is stored XSS with the clipboard as the injection point.
   */
  it('drops a script element and its source', () => {
    const r = svCleanPastedHtml('<p>before</p><script>alert(1)</script><p>after</p>');
    expect(r.html).not.toContain('script');
    expect(r.html).not.toContain('alert');
    expect(r.html).toContain('before');
    expect(r.html).toContain('after');
    expect(r.droppedElements).toContain('script');
  });

  /**
   * ★★★ EVERY `on*` ATTRIBUTE, BECAUSE THE ALLOWLIST NEVER NAMED THEM. A
   * denylist has to enumerate `onerror`, `onload`, `onbegin`, `onanimationend`,
   * `ontoggle`, `onpointerrawupdate` and whatever shipped last month. This drops
   * them for the same reason it drops `data-mso-thing`: it was not on the list.
   */
  it('drops every event-handler attribute, named or not', () => {
    for (const attr of ['onerror', 'onload', 'onclick', 'ontoggle', 'onanimationstart', 'onpointerrawupdate']) {
      const r = svCleanPastedHtml(`<img src="https://x.test/a.png" ${attr}="alert(1)">`);
      expect(r.html).not.toContain(attr);
      expect(r.html).not.toContain('alert');
    }
  });

  it('drops an iframe, object and embed with their content', () => {
    for (const tag of ['iframe', 'object', 'embed']) {
      const r = svCleanPastedHtml(`<p>keep</p><${tag} src="https://evil.test/"></${tag}>`);
      expect(r.html).not.toContain(tag);
      expect(r.html).toContain('keep');
    }
  });

  /**
   * ★★ A `<style>` BLOCK'S TEXT IS CSS, NOT PROSE. Unwrapping it — which is the
   * right default for an unknown tag — would paste the stylesheet source into
   * the document as visible text, and Word emits a very large one.
   *
   * ★★★ AND THE ELEMENT HAS TO SIT INSIDE BODY CONTENT FOR THIS TEST TO MEAN
   * ANYTHING, and the first version of it did not. `DOMParser` runs the real
   * HTML insertion algorithm: a `<style>`, `<script>`, `<base>` or comment
   * appearing BEFORE any body content is routed into an implicit `<head>`, which
   * the cleaner discards wholesale. So a fixture that leads with the element
   * under test passes whatever the tag rules say — three mutations survived on
   * exactly that, including removing `<style>` from the drop list entirely.
   * Putting a `<p>` first is the whole difference.
   */
  it('removes a style block rather than unwrapping its source into the text', () => {
    const r = svCleanPastedHtml('<p>hello</p><style>p{color:red}</style>');
    expect(r.html).not.toContain('color:red');
    expect(r.html).toContain('hello');
    expect(r.droppedElements).toContain('style');
  });

  /**
   * ★★★ `<base href>` REPOINTS EVERY RELATIVE URL ON THE HOST'S PAGE, not just
   * in the pasted fragment. It carries no script and reads as harmless markup.
   */
  it('removes a base tag', () => {
    expect(clean('<base href="https://evil.test/"><p>x</p>')).not.toContain('base');
  });

  it('removes form controls, which a document has no use for', () => {
    const r = svCleanPastedHtml('<form action="https://evil.test"><input name="password"><button>Go</button></form><p>text</p>');
    expect(r.html).not.toContain('input');
    expect(r.html).not.toContain('form');
    expect(r.html).toContain('text');
  });

  /**
   * ★★ SVG AND MATHML ARE SEPARATE PARSING CONTEXTS with their own script
   * vectors (`<svg><script>`, `<svg><animate onbegin>`, `<math href>`), and the
   * HTML sanitiser's tag rules do not apply inside them.
   *
   * ★★ SO THEY ARE DROPPED WHOLE, NOT UNWRAPPED AND REASONED ABOUT. Unwrapping an `<svg>`
   * and relying on each child being unknown happens to be safe today, which is
   * why removing svg from the drop list survived the first version of this test:
   * every assertion was about `alert` being absent, and it was absent either
   * way. What actually differs is the graphic's TEXT — an `<svg><text>` is part
   * of a picture that no longer exists, not prose the author pasted — so that is
   * what this asserts.
   */
  it('removes svg and mathml subtrees entirely, text and all', () => {
    expect(clean('<p>x</p><svg><script>alert(1)</script></svg>')).not.toContain('alert');
    expect(clean('<p>x</p><svg><animate onbegin="alert(1)"/></svg>')).not.toContain('alert');
    expect(clean('<p>x</p><math href="javascript:alert(1)"></math>')).not.toContain('javascript');

    const r = svCleanPastedHtml('<p>prose</p><svg><text>part of a picture</text></svg>');
    expect(r.html).toContain('prose');
    expect(r.html).not.toContain('part of a picture');
    expect(r.droppedElements).toContain('svg');
  });

  it('strips comments, including Word conditional ones carrying a second copy of the document', () => {
    // Inside body content, for the reason given above the style test: a leading
    // comment goes to the implicit <head> and never reaches the tag rules.
    const r = svCleanPastedHtml('<p>real</p><!--[if gte mso 9]><xml>second copy</xml><![endif]--><p>more</p>');
    expect(r.html).not.toContain('mso');
    expect(r.html).not.toContain('second copy');
    expect(r.html).toContain('real');
    expect(r.html).toContain('more');
  });

  it('strips a comment nested inside a kept element', () => {
    expect(clean('<p>a<!-- hidden -->b</p>')).toBe('<p>ab</p>');
  });
});

// ── URLs ────────────────────────────────────────────────────────────────────

describe('the URLs that survive', () => {
  /**
   * ★★★ RESOLVED WITH `new URL`, NOT MATCHED WITH `startsWith`. Each of these
   * navigates in a browser and defeats a prefix check: the HTML parser strips
   * the leading whitespace and control characters before resolving.
   */
  it('refuses javascript: however it is disguised', () => {
    for (const href of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      ' javascript:alert(1)',
      '\tjavascript:alert(1)',
      '\njavascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      // Split by the characters the HTML attribute parser strips out of a URL
      // before anything resolves it. Written as escapes rather than literals:
      // the first draft of the comment above this test carried a raw NUL, which
      // made the whole source file read as binary to grep and every other text
      // tool — the same failure the kit has now hit twice.
      'java\u0009script:alert(1)',
      'java\u000ascript:alert(1)',
      'java\u000dscript:alert(1)',
    ]) {
      expect(svIsSafeUrl(href, false)).toBe(false);
      expect(clean(`<a href="${href}">x</a>`)).not.toContain('javascript');
    }
  });

  it('refuses vbscript: and file:', () => {
    expect(svIsSafeUrl('vbscript:msgbox(1)', false)).toBe(false);
    expect(svIsSafeUrl('file:///etc/passwd', false)).toBe(false);
  });

  it('keeps the schemes a document legitimately uses', () => {
    for (const href of ['https://x.test/a', 'http://x.test/a', 'mailto:a@x.test', 'tel:+441234567890']) {
      expect(svIsSafeUrl(href, false)).toBe(true);
    }
  });

  it('keeps a relative URL, which inherits the page scheme', () => {
    expect(svIsSafeUrl('/docs/a', false)).toBe(true);
    expect(svIsSafeUrl('../a.png', false)).toBe(true);
  });

  /**
   * ★★★ `data:text/html` IS A SAME-ORIGIN DOCUMENT IN SOME NAVIGATION PATHS, so
   * the data-URL allowance is for images and only for images — and even then it
   * is off unless the host asked, because a pasted screenshot is megabytes of
   * base64 heading for a database row.
   */
  it('refuses data: URLs by default, and non-image data URLs always', () => {
    expect(svIsSafeUrl('data:image/png;base64,iVBORw0KGgo=', false)).toBe(false);
    expect(svIsSafeUrl('data:image/png;base64,iVBORw0KGgo=', true)).toBe(true);
    expect(svIsSafeUrl('data:text/html;base64,PHNjcmlwdD4=', true)).toBe(false);
    expect(svIsSafeUrl('data:image/svg+xml;base64,PHN2Zz4=', true)).toBe(false);
  });

  it('refuses an empty or unparseable URL rather than keeping it', () => {
    expect(svIsSafeUrl('', false)).toBe(false);
    expect(svIsSafeUrl('   ', false)).toBe(false);
    expect(svIsSafeUrl('http://[', false)).toBe(false);
  });

  /**
   * ★★ REVERSE TABNABBING. `target="_blank"` hands the opened page a
   * `window.opener` it can navigate, so the tab the reader came from can be
   * replaced with a login form while they are looking at the other one.
   */
  it('adds rel=noopener to a link that opens a new tab', () => {
    const html = clean('<a href="https://x.test/" target="_blank">x</a>');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('leaves an ordinary link alone', () => {
    const html = clean('<a href="https://x.test/" title="t">x</a>');
    expect(html).toContain('href="https://x.test/"');
    expect(html).toContain('title="t"');
  });
});

// ── Styles ──────────────────────────────────────────────────────────────────

describe('the styles that survive', () => {
  /**
   * ★★★ `position: fixed` IS A CLICKJACK THAT NEEDS NO SCRIPT. A pasted
   * full-viewport overlay sits over the host's own page and survives every
   * sanitiser that only thinks about tags.
   */
  it('drops positioning, which can cover the host page', () => {
    expect(svCleanStyle('position: fixed; inset: 0; z-index: 9999', true)).toBe('');
    expect(clean('<span style="position:fixed;inset:0">x</span>')).not.toContain('position');
  });

  it('keeps the properties a document means to carry', () => {
    expect(svCleanStyle('color: red; font-weight: bold', true)).toBe('color: red; font-weight: bold');
  });

  /**
   * ★★ THE COSMETIC HALF, WHICH IS WHY THE FEATURE GETS ASKED FOR. Word emits
   * its own language and font metadata on every run, and keeping it is why
   * pasted text looks nothing like the document around it.
   */
  it('drops Word\'s mso- declarations and its imported font stack', () => {
    const style = 'mso-ansi-language: EN-GB; mso-fareast-font-family: Calibri; font-family: Calibri, sans-serif; color: #333';
    expect(svCleanStyle(style, true)).toBe('color: #333');
  });

  it('drops a url() in a kept property, which would leak that the document was opened', () => {
    expect(svCleanStyle('background-color: url(https://evil.test/ping)', true)).toBe('');
  });

  it('drops an expression() and anything with an escape or at-rule in it', () => {
    expect(svCleanStyle('color: expression(alert(1))', true)).toBe('');
    expect(svCleanStyle('color: \\0065xpression(alert(1))', true)).toBe('');
  });

  it('drops every style when the host turned styles off', () => {
    expect(svCleanStyle('color: red', false)).toBe('');
    expect(clean('<p style="color:red">x</p>', { allowStyles: false })).not.toContain('style');
  });

  /**
   * ★★ CSS PROPERTY NAMES ARE CASE-INSENSITIVE, and exported documents do not
   * keep to lower case. Dropping the `.toLowerCase()` before the allowlist
   * lookup survived every test here, because every fixture had been written in
   * the case the code happened to compare against — so the allowlist silently
   * became "lower-case declarations only", and a `COLOR: red` the author meant
   * would vanish.
   */
  it('matches a property whatever case it was written in', () => {
    expect(svCleanStyle('COLOR: red', true)).toBe('color: red');
    expect(svCleanStyle('Font-Weight: bold', true)).toBe('font-weight: bold');
    expect(svCleanStyle('  TEXT-ALIGN  : center', true)).toBe('text-align: center');
  });

  it('refuses a disallowed property whatever case it was written in', () => {
    expect(svCleanStyle('POSITION: fixed', true)).toBe('');
    expect(svCleanStyle('Position: absolute', true)).toBe('');
  });

  it('ignores a malformed declaration rather than keeping it whole', () => {
    expect(svCleanStyle('color red; font-weight: bold', true)).toBe('font-weight: bold');
    expect(svCleanStyle('color:', true)).toBe('');
  });
});

// ── Keeping the document ────────────────────────────────────────────────────

describe('what a paste keeps', () => {
  /**
   * ★★★ AN UNKNOWN TAG IS UNWRAPPED, NOT DELETED. A pasted `<article>` or
   * `<section>` should leave its prose behind; deleting the subtree because the
   * wrapper was unfamiliar is how a sanitiser eats half of what somebody pasted
   * and teaches them to paste through Notepad instead.
   */
  it('unwraps an unknown element and keeps its text', () => {
    const r = svCleanPastedHtml('<article><p>kept</p></article>');
    expect(r.html).toContain('kept');
    expect(r.html).toContain('<p>');
    expect(r.html).not.toContain('article');
  });

  it('unwraps nested unknown elements without losing the innermost text', () => {
    expect(clean('<section><figure><figcaption>deep</figcaption></figure></section>')).toContain('deep');
  });

  it('keeps ordinary formatting untouched', () => {
    const html = '<p><strong>a</strong> <em>b</em> <u>c</u></p><ul><li>one</li></ul>';
    expect(clean(html)).toBe(html);
    expect(svCleanPastedHtml(html).changed).toBe(false);
  });

  it('keeps a table with its spans', () => {
    const html = '<table><tbody><tr><td colspan="2">a</td><td rowspan="3">b</td></tr></tbody></table>';
    expect(clean(html)).toBe(html);
  });

  it('drops tables when the host does not want them, keeping the cell text', () => {
    const r = svCleanPastedHtml('<table><tr><td>cell</td></tr></table>', { allowTables: false });
    expect(r.html).not.toContain('table');
    expect(r.html).toContain('cell');
  });

  it('drops images and links when the host turns them off, keeping the link text', () => {
    expect(clean('<img src="https://x.test/a.png">', { allowImages: false })).not.toContain('img');
    const r = svCleanPastedHtml('<a href="https://x.test/">label</a>', { allowLinks: false });
    expect(r.html).not.toContain('href');
    expect(r.html).toContain('label');
  });

  /**
   * ★★ THE WALK SNAPSHOTS ITS CHILDREN BEFORE RECURSING. `childNodes` is live,
   * so removing or unwrapping one child while iterating it skips the next — and
   * the symptom is that every other unwanted element survives, which reads as
   * the sanitiser working intermittently.
   */
  it('removes ALL of a run of adjacent unwanted elements, not every other one', () => {
    const r = svCleanPastedHtml('<p>a</p><script>1</script><script>2</script><script>3</script><p>b</p>');
    expect(r.html).not.toContain('script');
    const many = '<span></span>'.repeat(20);
    expect(clean(many)).toBe('');
  });

  it('cleans inside an element that is itself about to be unwrapped', () => {
    // The `<script>` is a child of the unknown `<article>`; unwrapping first and
    // cleaning later would lift it into the document unexamined.
    const r = svCleanPastedHtml('<article><script>alert(1)</script><p>keep</p></article>');
    expect(r.html).not.toContain('alert');
    expect(r.html).toContain('keep');
  });

  it('unwraps a span left with nothing but Word packaging on it', () => {
    expect(clean('<p><span style="mso-ansi-language:EN-GB">text</span></p>')).toBe('<p>text</p>');
  });

  it('keeps a span that still carries a real style', () => {
    expect(clean('<p><span style="color: red">text</span></p>')).toContain('<span style="color: red">');
  });

  /**
   * ★★★ THE ASSERTION IS ABOUT EXECUTABILITY, NOT ABOUT A SUBSTRING. My first
   * version of this test checked that the string "alert(1)" was absent, and
   * `<<script>alert(1)</script>` failed it — correctly. The parser reads the
   * stray `<` as text, so what comes out is `ipt&gt;alert(1)` as ESCAPED prose:
   * the characters are there and nothing can run. Asserting on the text would
   * have forced a "fix" that mangled legitimate content — an author writing
   * about `alert(1)` in a code sample is entitled to the words.
   *
   * So the cleaned output is re-parsed and interrogated for the thing that
   * actually matters: no script elements, no event-handler attributes, no
   * scripting URLs. That is the property; the substring was only ever a proxy
   * for it, and a bad one.
   */
  it('survives markup a regex sanitiser would be defeated by', () => {
    const executable = (html: string): string[] => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const found: string[] = [];
      for (const el of Array.from(doc.querySelectorAll('*'))) {
        if (['script', 'iframe', 'object', 'embed'].includes(el.tagName.toLowerCase())) {
          found.push(el.tagName.toLowerCase());
        }
        for (const attr of Array.from(el.attributes)) {
          if (attr.name.toLowerCase().startsWith('on')) found.push(`${el.tagName}[${attr.name}]`);
          if (/^\s*(javascript|vbscript|data)\s*:/i.test(attr.value)) found.push(`${el.tagName}[${attr.name}=url]`);
        }
      }
      return found;
    };

    for (const html of [
      '<scr<script>ipt>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '<a href = "javascript:alert(1)" >x</a>',
      '<p title="a>b"><script>alert(1)</script></p>',
      '<<script>alert(1)</script>',
      '<svg><script>alert(1)</script></svg>',
      '<img src="x" onerror="alert(1)" />',
      '<a href="&#106;avascript:alert(1)">x</a>',
    ]) {
      expect(executable(clean(html))).toEqual([]);
    }
  });

  it('returns an empty string for empty or whitespace-only input rather than throwing', () => {
    expect(clean('')).toBe('');
    expect(() => clean('<')).not.toThrow();
  });
});

// ── Telling the author ──────────────────────────────────────────────────────

describe('reporting what was removed', () => {
  /**
   * ★★ A SANITISER THAT EATS CONTENT SILENTLY IS INDISTINGUISHABLE FROM A BROKEN
   * PASTE. Naming what went makes the difference between "this editor is buggy"
   * and "it removed the tracking pixel Word had embedded".
   */
  it('names the elements and attributes it removed, deduplicated and sorted', () => {
    const r = svCleanPastedHtml('<script>1</script><script>2</script><p onclick="x" data-foo="y">t</p>');
    expect(r.droppedElements).toEqual(['script']);
    expect(r.droppedAttributes).toEqual(['p[data-foo]', 'p[onclick]']);
    expect(r.changed).toBe(true);
  });

  it('reports nothing changed for markup that was already clean', () => {
    const r = svCleanPastedHtml('<p>plain</p>');
    expect(r.changed).toBe(false);
    expect(svPasteSummary(r)).toBe('');
  });

  it('counts elements and attributes separately, in the singular and the plural', () => {
    expect(svPasteSummary({ html: '', droppedElements: ['script'], droppedAttributes: [], changed: true }))
      .toBe('Cleaned on paste: removed 1 unsupported element.');
    expect(svPasteSummary({ html: '', droppedElements: ['script', 'style'], droppedAttributes: ['p[onclick]'], changed: true }))
      .toBe('Cleaned on paste: removed 2 unsupported elements and 1 attribute.');
  });
});

// ── Plain text ──────────────────────────────────────────────────────────────

describe('paste as plain text', () => {
  /**
   * ★★★ `textContent` ALONE RUNS EVERY PARAGRAPH TOGETHER. Pasting three pages
   * and getting one enormous line is why people believe paste-as-plain-text is
   * broken; the block boundaries carried meaning and have to become newlines.
   */
  it('turns block boundaries into newlines instead of running the text together', () => {
    expect(svPlainTextFromHtml('<p>one</p><p>two</p>')).toBe('one\ntwo');
    expect(svPlainTextFromHtml('<h1>Title</h1><p>Body</p>')).toBe('Title\nBody');
    expect(svPlainTextFromHtml('<ul><li>a</li><li>b</li></ul>')).toBe('a\nb');
  });

  it('turns a br into a newline', () => {
    expect(svPlainTextFromHtml('<p>one<br>two</p>')).toBe('one\ntwo');
  });

  it('collapses runs of blank lines and non-breaking spaces', () => {
    expect(svPlainTextFromHtml('<p>a</p><p></p><p></p><p></p><p>b</p>')).toBe('a\n\nb');
    expect(svPlainTextFromHtml('<p>a&nbsp;b</p>')).toBe('a b');
  });

  it('takes the text out of markup without executing or keeping any of it', () => {
    expect(svPlainTextFromHtml('<p>safe</p><script>alert(1)</script>')).not.toContain('alert');
  });

  /**
   * ★★★ "PASTE AS PLAIN TEXT" THAT BUILDS HTML WITHOUT ESCAPING REINTRODUCES THE
   * EXACT HOLE THE SANITISER EXISTS TO CLOSE — and it is the path in the file
   * that reads as obviously safe, which is why it is worth its own test.
   */
  it('escapes text before it becomes html', () => {
    expect(svEscapeHtml('<script>alert("x")</script>'))
      .toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    const html = svPlainTextToHtml('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('escapes the ampersand first, so an entity is not double-escaped into nonsense', () => {
    expect(svEscapeHtml('a & <b>')).toBe('a &amp; &lt;b&gt;');
    expect(svEscapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('makes a paragraph per blank line and a br per single newline', () => {
    expect(svPlainTextToHtml('one\ntwo\n\nthree')).toBe('<p>one<br>two</p><p>three</p>');
  });

  it('keeps an empty paragraph selectable rather than collapsing it away', () => {
    expect(svPlainTextToHtml('')).toBe('<p><br></p>');
  });
});
