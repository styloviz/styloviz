import { svCleanPastedHtml, svSanitizeEditorHtml } from './html-sanitizer';

/**
 * The editor profile — what a STORED document may bring back into an editing
 * surface. Two halves, and both are load-bearing:
 *
 *   1. Nothing that executes or escapes the editor survives (the security fix).
 *   2. Everything `sv-rich-text-editor` itself writes DOES survive, so loading a
 *      saved document is not a quiet data-loss bug (the reason this is not the
 *      paste profile).
 */
const editor = (html: string, options = {}) => svSanitizeEditorHtml(html, options).html;

describe('svSanitizeEditorHtml — what must not survive a load', () => {
  it.each([
    ['img onerror', '<img src="x" onerror="alert(1)">', 'onerror'],
    ['script', '<p>a</p><script>alert(1)</script>', 'script'],
    ['iframe srcdoc', '<iframe srcdoc="<script>alert(1)</script>"></iframe>', 'iframe'],
    ['svg onload', '<svg onload="alert(1)"><circle/></svg>', 'svg'],
    ['javascript: link', '<a href="javascript:alert(1)">x</a>', 'javascript'],
    ['data:text/html image', '<img src="data:text/html,<script>alert(1)</script>">', 'text/html'],
    ['style element', '<style>body{display:none}</style><p>a</p>', 'display:none'],
    ['url() in css', '<p style="background-color: url(https://evil.example/x)">a</p>', 'evil'],
    ['form controls', '<input type="text" value="password"><button>Go</button>', 'password'],
    ['base href', '<base href="https://evil.example/"><p>a</p>', 'evil'],
  ])('%s', (_label, html, needle) => {
    expect(editor(html)).not.toContain(needle);
  });

  /**
   * ★★★ NO SCRIPT NEEDED FOR THIS ONE. A stored `position: fixed` block is a
   * full-screen overlay over the host page; a host utility class does the same.
   */
  it('drops styles and classes that escape the editor box', () => {
    const out = editor(
      '<div style="position: fixed; inset: 0; z-index: 9999; transform: scale(9); top: 0">x</div>' +
      '<p class="fixed inset-0 z-50">y</p>',
    );
    expect(out).not.toMatch(/position|inset|z-index|transform|top:/);
    expect(out).not.toContain('fixed');
    expect(out).toContain('x');
    expect(out).toContain('y');
  });

  it('keeps contenteditable only as "false"', () => {
    expect(editor('<span contenteditable="true">a</span>')).not.toContain('contenteditable');
    expect(editor('<span contenteditable="false" class="rte-chip">a</span>')).toContain('contenteditable="false"');
  });

  it('keeps a checkbox but no other input type', () => {
    const out = editor('<ul><li><input type="checkbox" checked> done</li></ul><input type="password">');
    expect(out).toContain('type="checkbox"');
    expect(out).toContain('checked');
    expect(out).not.toContain('password');
  });
});

describe('svSanitizeEditorHtml — what the editor writes survives', () => {
  it('keeps the editor table markup and its inline styling', () => {
    const table =
      '<table class="rte-table" style="width: 100%; border-collapse: collapse; margin: 8px 0"><tbody>' +
      '<tr><td style="border: 1px solid #d1d5db; padding: 6px 10px; min-width: 40px" colspan="2">a</td></tr>' +
      '</tbody></table>';
    const out = editor(table);
    expect(out).toContain('class="rte-table"');
    expect(out).toContain('border-collapse: collapse');
    expect(out).toContain('border: 1px solid #d1d5db');
    expect(out).toContain('min-width: 40px');
    expect(out).toContain('colspan="2"');
  });

  it('keeps an uploaded image (a data: URL) with its figure and width', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const out = editor(
      `<figure class="rte-image-block"><img src="${png}" alt="chart" class="rte-inserted-image" ` +
      'loading="lazy" style="max-width: 100%; width: 480px"></figure>',
    );
    expect(out).toContain('<figure class="rte-image-block">');
    expect(out).toContain(png);
    expect(out).toContain('width: 480px');
    expect(out).toContain('loading="lazy"');
  });

  it('refuses data: images when the host turns them off', () => {
    expect(editor('<img src="data:image/png;base64,AAAA">', { allowDataImages: false })).not.toContain('data:');
  });

  it('keeps font family, size, line height and indent', () => {
    const out = editor(
      '<p style="line-height: 2; padding-left: 40px"><span style="font-family: Georgia, serif; font-size: 18px">a</span></p>',
    );
    expect(out).toContain('line-height: 2');
    expect(out).toContain('padding-left: 40px');
    expect(out).toContain('font-family: Georgia, serif');
    expect(out).toContain('font-size: 18px');
  });

  it('keeps a mention chip, including host-vouched classes', () => {
    const chip =
      '<span class="mention bg-primary-50 evil-overlay" data-sv-mention="true" data-sv-mention-id="u1" ' +
      'data-sv-mention-label="Ada" data-sv-mention-trigger="@" contenteditable="false">@Ada</span>';
    const host = new Set(['mention', 'bg-primary-50']);
    const out = editor(chip, { keepClass: (t: string) => host.has(t) });
    expect(out).toContain('class="mention bg-primary-50"');
    expect(out).not.toContain('evil-overlay');
    for (const attr of ['data-sv-mention="true"', 'data-sv-mention-id="u1"', 'data-sv-mention-label="Ada"']) {
      expect(out).toContain(attr);
    }
    expect(out).not.toMatch(/data-sv-mentionx|data-other/);
  });

  it('keeps a code block language class and execCommand <font> colour', () => {
    const out = editor('<pre><code class="language-ts">x</code></pre><font color="#ff0000">red</font>');
    expect(out).toContain('class="language-ts"');
    expect(out).toContain('<font color="#ff0000">');
  });

  it('drops unknown data-* attributes', () => {
    expect(editor('<p data-track="1" data-rte-trigger="x">a</p>')).toBe('<p>a</p>');
  });

  it('is idempotent — a second pass changes nothing', () => {
    const once = editor('<p style="font-size: 14px" class="rte-x junk">a<img src="x" onerror="1"></p>');
    expect(editor(once)).toBe(once);
    expect(svSanitizeEditorHtml(once).changed).toBe(false);
  });
});

describe('the paste profile did not move', () => {
  /** The refactor put both profiles on one walker; the paste allowlist must be exactly as narrow as before. */
  it('still drops class, data-sv-mention and editor-only styles', () => {
    const r = svCleanPastedHtml(
      '<span class="rte-x" data-sv-mention="true" style="font-size: 18px; color: red">a</span>' +
      '<figure><input type="checkbox"></figure>',
    );
    expect(r.html).not.toContain('class');
    expect(r.html).not.toContain('data-sv-mention');
    expect(r.html).not.toContain('font-size');
    expect(r.html).toContain('color: red');
    expect(r.html).not.toContain('figure');
    expect(r.html).not.toContain('input');
  });
});
