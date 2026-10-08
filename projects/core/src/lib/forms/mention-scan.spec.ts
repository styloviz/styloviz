import {
  SV_MENTION_ATTRS,
  svMentionHtml,
  svMentionLabel,
  svMentionPlainText,
  svMentionRepairs,
  svParseMentions,
  svScanTrigger,
  svTokenIntegrity,
} from './mention-scan';

/**
 * Mentions: the trigger scan, and the token that has to stay honest.
 */

const el = (html: string): Element => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.firstElementChild!;
};

// ── Finding the trigger ─────────────────────────────────────────────────────

describe('scanning for an open trigger', () => {
  it('opens on a trigger at the start of the text', () => {
    expect(svScanTrigger('@pri', ['@'])).toEqual({ trigger: '@', query: 'pri', at: 0 });
  });

  it('opens with an empty query immediately after the trigger', () => {
    expect(svScanTrigger('hello @', ['@'])).toEqual({ trigger: '@', query: '', at: 6 });
  });

  it('closes when there is no trigger at all', () => {
    expect(svScanTrigger('just typing', ['@'])).toBeNull();
    expect(svScanTrigger('', ['@'])).toBeNull();
  });

  /**
   * ★★ A SPACE CLOSES IT. Without this the panel stays open for the rest of the
   * paragraph, because the trigger character is still somewhere behind the
   * caret — and every keystroke issues another lookup.
   */
  it('closes once a space follows the trigger', () => {
    expect(svScanTrigger('@priya said', ['@'])).toBeNull();
    expect(svScanTrigger('@priya ', ['@'])).toBeNull();
  });

  /**
   * ★★★ THE RULE THAT STOPS EVERY EMAIL ADDRESS OPENING A PEOPLE-SEARCH.
   * `priya@example.com` contains an `@` with no space after it, so a scan that
   * only looks backwards for the character opens a lookup on `example.com` in
   * the middle of an address somebody is simply typing. The trigger has to begin
   * a word.
   */
  it('ignores a trigger in the middle of a word, so an email address does not open it', () => {
    expect(svScanTrigger('priya@example.com', ['@'])).toBeNull();
    expect(svScanTrigger('write to priya@exa', ['@'])).toBeNull();
    expect(svScanTrigger('a/b/c', ['/'])).toBeNull();
  });

  /**
   * ★★ THE RULE IS "NOT AFTER A LETTER OR DIGIT", NOT "AFTER WHITESPACE". The
   * first version demanded whitespace and broke three existing `sv-mention`
   * fixtures the moment that component was refactored onto this function —
   * because a trigger after an opening bracket, a dash or a full stop is
   * something people write and something that should open the panel.
   * Whitespace-only is a stricter rule than the intent it was standing in for.
   */
  it('opens for a trigger that follows punctuation, not only whitespace', () => {
    expect(svScanTrigger('cc @pri', ['@'])?.query).toBe('pri');
    expect(svScanTrigger('line\n@pri', ['@'])?.query).toBe('pri');
    expect(svScanTrigger('(@pri', ['@'])?.query).toBe('pri');
    expect(svScanTrigger('teammate.@', ['@'])?.query).toBe('');
    expect(svScanTrigger('em—@pri', ['@'])?.query).toBe('pri');
  });

  /**
   * ★★ AND IT IS UNICODE-AWARE. `\w` is ASCII-only, so a rule built on it works
   * for English names and quietly fails for everyone else's — `José@example.com`
   * would open a people-search on `example.com`.
   */
  it('treats a non-ASCII letter as part of a word', () => {
    expect(svScanTrigger('José@example', ['@'])).toBeNull();
    expect(svScanTrigger('佐藤@example', ['@'])).toBeNull();
    expect(svScanTrigger('Müller@exa', ['@'])).toBeNull();
  });

  it('opens after a digit boundary only when the digit is not adjacent', () => {
    expect(svScanTrigger('room101@x', ['@'])).toBeNull();
    expect(svScanTrigger('room101 @x', ['@'])?.query).toBe('x');
  });

  it('can be told to ignore word boundaries', () => {
    expect(svScanTrigger('priya@exa', ['@'], { wordBoundary: false })?.query).toBe('exa');
  });

  /**
   * ★★ THE NEAREST TRIGGER WINS. With `@` people, `#` topics and `/` commands
   * all configured, typing a topic after a mention must search topics — a scan
   * that took the first configured trigger would search people for `des`.
   */
  it('resolves against the trigger nearest the caret', () => {
    const r = svScanTrigger('@alice #des', ['@', '#']);
    expect(r).toEqual({ trigger: '#', query: 'des', at: 7 });
  });

  it('handles a trigger set in any order', () => {
    expect(svScanTrigger('@alice #des', ['#', '@'])?.trigger).toBe('#');
    expect(svScanTrigger('#topic @ali', ['@', '#'])?.trigger).toBe('@');
  });

  /**
   * ★★ `''.lastIndexOf` RETURNS THE STRING LENGTH, NOT -1, so an empty trigger
   * matches at the caret every single time and shadows every real trigger. The
   * first version of this test used `'hello'`, where the character before the
   * match is a letter — so the word-boundary rule refused it and the test passed
   * with the guard deleted. The fixture has to end in something that IS a valid
   * boundary for the mutation to be visible at all.
   */
  it('ignores an empty trigger string rather than matching everywhere', () => {
    expect(svScanTrigger('hello', ['', '@'])).toBeNull();
    expect(svScanTrigger('hi ', ['', '@'])).toBeNull();
    expect(svScanTrigger('(', ['', '#'])).toBeNull();
    expect(svScanTrigger('', [])).toBeNull();
  });

  /**
   * ★★ A CAP ON THE QUERY. An unclosed trigger followed by a long unbroken
   * string — a URL, a path, an identifier — otherwise searches on text nobody
   * meant as a search, once per keystroke.
   */
  it('gives up on a query longer than the cap', () => {
    const long = 'x'.repeat(61);
    expect(svScanTrigger(`@${long}`, ['@'])).toBeNull();
    expect(svScanTrigger(`@${'x'.repeat(60)}`, ['@'])).not.toBeNull();
    expect(svScanTrigger(`@${long}`, ['@'], { maxQuery: 200 })).not.toBeNull();
  });

  it('supports a multi-character trigger', () => {
    expect(svScanTrigger('say ::sm', ['::'])).toEqual({ trigger: '::', query: 'sm', at: 4 });
  });
});

// ── The token ───────────────────────────────────────────────────────────────

describe('the inserted token', () => {
  const TOKEN = { id: 'u-1', label: 'Priya Sharma', trigger: '@' };

  /**
   * ★★★ ATOMIC TO THE CARET. Without `contenteditable="false"` the mention is
   * twelve characters the user edits one at a time: one backspace leaves
   * `@Priya Sharm`, which still looks like a mention, still carries Priya's user
   * id, and displays a name that is not hers.
   */
  it('is not editable', () => {
    expect(svMentionHtml(TOKEN)).toContain('contenteditable="false"');
  });

  it('carries the id, the label and the trigger as data', () => {
    const html = svMentionHtml(TOKEN);
    expect(html).toContain(`${SV_MENTION_ATTRS.id}="u-1"`);
    expect(html).toContain(`${SV_MENTION_ATTRS.label}="Priya Sharma"`);
    expect(html).toContain(`${SV_MENTION_ATTRS.trigger}="@"`);
  });

  it('renders the trigger and the label as its text', () => {
    expect(el(svMentionHtml(TOKEN)).textContent).toBe('@Priya Sharma');
  });

  /**
   * ★★★ A NAME IS ARBITRARY TEXT AND GOES STRAIGHT INTO MARKUP. A directory that
   * lets somebody set their display name is an injection point, and it reaches
   * every document that mentions them.
   */
  it('escapes a label and an id that contain markup', () => {
    const html = svMentionHtml({ id: 'u"1', label: '<img src=x onerror=alert(1)>', trigger: '@' });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    // The attribute is closed by the escape, not broken out of.
    expect(el(html).getAttribute(SV_MENTION_ATTRS.id)).toBe('u"1');
  });

  it('takes an optional class without letting it break out of the attribute', () => {
    expect(svMentionHtml(TOKEN, 'chip')).toContain('class="chip"');
    expect(svMentionHtml(TOKEN, 'a"b')).toContain('class="a&quot;b"');
  });

  /**
   * ★★ NO ZERO-WIDTH SPACE, THOUGH IT IS THE USUAL TRICK for giving the caret
   * somewhere to land after a chip. It is invisible, survives into the persisted
   * value, breaks string equality for anyone comparing documents, and turns up
   * in exports and search indexes as mojibake.
   */
  it('contains no invisible padding characters', () => {
    expect(svMentionHtml(TOKEN)).not.toMatch(/\u200B|\u200C|\u200D|\uFEFF/);
  });
});

// ── Integrity ───────────────────────────────────────────────────────────────

describe('whether a token still says what it claims', () => {
  const intact = svMentionHtml({ id: 'u-1', label: 'Priya Sharma', trigger: '@' });

  it('accepts a token whose text matches its label', () => {
    expect(svTokenIntegrity(el(intact))).toBe('intact');
  });

  /**
   * ★★★ `contenteditable="false"` IS NECESSARY AND NOT SUFFICIENT. A drag-and-
   * drop into the node, an IME composition spanning its boundary, several mobile
   * keyboards' autocorrect and a paste over a partial selection all still change
   * the inside of it. The document then carries a user id next to a name that is
   * not that user's — and everything downstream reads the id and believes the
   * label.
   */
  it('rejects a token that has been edited', () => {
    const edited = intact.replace('>@Priya Sharma<', '>@Priya Sharm<');
    expect(svTokenIntegrity(el(edited))).toBe('edited');
  });

  it('rejects a token whose trigger was edited away', () => {
    const edited = intact.replace('>@Priya Sharma<', '>Priya Sharma<');
    expect(svTokenIntegrity(el(edited))).toBe('edited');
  });

  it('is not confused by an ordinary span', () => {
    expect(svTokenIntegrity(el('<span>@Priya Sharma</span>'))).toBe('not-a-token');
  });

  /**
   * ★★★ THE MARKER'S VALUE IS CHECKED, NOT MERELY ITS PRESENCE — and this
   * section could not see the difference before, because its only negative
   * fixture was a bare `<span>` that also had no id or label, so the NEXT guard
   * caught it. Markup arriving from a paste or an import can carry the data
   * attributes with the marker stripped or set to something else, and treating
   * that as a live mention invents a reference to a real user id.
   */
  it('rejects a token whose marker says anything other than true', () => {
    for (const marker of ['false', '', 'TRUE', '1']) {
      const html =
        `<span ${SV_MENTION_ATTRS.marker}="${marker}"` +
        ` ${SV_MENTION_ATTRS.id}="u-1"` +
        ` ${SV_MENTION_ATTRS.label}="Priya Sharma"` +
        ` ${SV_MENTION_ATTRS.trigger}="@">@Priya Sharma</span>`;
      expect(svTokenIntegrity(el(html))).toBe('not-a-token');
    }
  });

  it('leaves a marker-less element out of the parsed mentions', () => {
    const html =
      `<p><span ${SV_MENTION_ATTRS.id}="u-1" ${SV_MENTION_ATTRS.label}="Priya Sharma"` +
      ` ${SV_MENTION_ATTRS.trigger}="@">@Priya Sharma</span></p>`;
    expect(svParseMentions(html)).toEqual([]);
  });

  /**
   * ★★ A MARKER WITHOUT THE DATA IS NOT A TOKEN. Markup arriving from a paste or
   * an import can carry the marker attribute and nothing else; treating it as a
   * mention would invent an id.
   */
  it('rejects a marker carrying no id or label', () => {
    expect(svTokenIntegrity(el(`<span ${SV_MENTION_ATTRS.marker}="true">@x</span>`))).toBe('not-a-token');
    expect(svTokenIntegrity(el(
      `<span ${SV_MENTION_ATTRS.marker}="true" ${SV_MENTION_ATTRS.label}="x">@x</span>`,
    ))).toBe('not-a-token');
  });
});

// ── Reading a document ──────────────────────────────────────────────────────

describe('reading the mentions out of a document', () => {
  const a = svMentionHtml({ id: 'u-1', label: 'Priya Sharma', trigger: '@' });
  const b = svMentionHtml({ id: 't-9', label: 'platform', trigger: '#' });

  it('returns every intact mention in document order', () => {
    expect(svParseMentions(`<p>cc ${a} about ${b}</p>`)).toEqual([
      { id: 'u-1', label: 'Priya Sharma', trigger: '@' },
      { id: 't-9', label: 'platform', trigger: '#' },
    ]);
  });

  it('finds nothing in a document with no mentions', () => {
    expect(svParseMentions('<p>plain</p>')).toEqual([]);
  });

  /**
   * ★★★ AN EDITED TOKEN IS NOT REPORTED AS A MENTION, and it is not silently
   * repaired either. Repairing means choosing between the id and the text, and
   * there is no basis for that choice — the user may have been deleting the
   * mention or correcting a name. The host is told there is a decision to make.
   */
  it('leaves an edited token out of the mentions and reports it separately', () => {
    const edited = a.replace('>@Priya Sharma<', '>@Priya Sharm<');
    const html = `<p>${edited} and ${b}</p>`;
    expect(svParseMentions(html)).toEqual([{ id: 't-9', label: 'platform', trigger: '#' }]);
    expect(svMentionRepairs(html)).toEqual([
      { id: 'u-1', label: 'Priya Sharma', text: '@Priya Sharm' },
    ]);
  });

  it('reports nothing to repair in a clean document', () => {
    expect(svMentionRepairs(`<p>${a}</p>`)).toEqual([]);
  });

  /**
   * ★★ THE PLAIN-TEXT RENDERING USES THE STORED LABEL, NOT THE ELEMENT'S TEXT.
   * When the two disagree the text is the thing that is wrong, so trusting the
   * DOM would carry the corruption into the notification email.
   */
  it('renders a document as text using what the mention means', () => {
    expect(svMentionPlainText(`<p>cc ${a} please</p>`)).toBe('cc @Priya Sharma please');
    const edited = a.replace('>@Priya Sharma<', '>@Priya Sharm<');
    expect(svMentionPlainText(`<p>cc ${edited}</p>`)).toBe('cc @Priya Sharma');
  });

  it('does not execute or keep markup while reading a document', () => {
    expect(svParseMentions('<script>alert(1)</script><p>x</p>')).toEqual([]);
    expect(svMentionPlainText('<p>a</p><script>alert(1)</script>')).not.toContain('alert');
  });

  it('names a mention for display', () => {
    expect(svMentionLabel({ id: 'u-1', label: 'Priya Sharma', trigger: '@' })).toBe('@Priya Sharma');
  });
});
