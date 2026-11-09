import { svDownloadBlob, svDownloadText, svToCsv } from './csv';

/**
 * `svToCsv` is the one serialiser every tier shares — the free data-table, the
 * Pro grid and the gantt all route through it, after three hand-rolled copies
 * drifted apart. RFC 4180 is short but every clause in it is a real bug someone
 * hit: an unquoted comma shifts every later column, an unescaped quote ends the
 * field early, and a bare LF splits one row into two.
 */
describe('svToCsv', () => {
  it('writes a header row followed by the data rows', () => {
    const csv = svToCsv(['a', 'b'], [[1, 2], [3, 4]]);
    expect(csv.split('\r\n')).toEqual(['a,b', '1,2', '3,4']);
  });

  it('uses CRLF, not bare LF', () => {
    // RFC 4180 says CRLF, and Excel on Windows reads a bare LF as one long row
    // in some locales — which is how the gantt's hand-rolled copy shipped a
    // file that opened as a single line.
    const csv = svToCsv(['a'], [[1]]);
    expect(csv).toContain('\r\n');
    expect(csv.replace(/\r\n/g, '')).not.toContain('\n');
  });

  describe('quoting', () => {
    it('quotes a field containing a comma', () => {
      expect(svToCsv(['a'], [['x,y']])).toContain('"x,y"');
    });

    it('quotes a field containing a double quote, and doubles the quote', () => {
      // The escape for " is "" — not a backslash.
      expect(svToCsv(['a'], [['say "hi"']])).toContain('"say ""hi"""');
    });

    it('quotes a field containing a newline', () => {
      const csv = svToCsv(['a'], [['line1\nline2']]);
      expect(csv).toContain('"line1\nline2"');
    });

    it('quotes a header that needs it, not just a cell', () => {
      expect(svToCsv(['first,last'], [['x']])).toContain('"first,last"');
    });

    it('leaves an ordinary field unquoted', () => {
      expect(svToCsv(['a'], [['plain']])).toBe('a\r\nplain');
    });
  });

  describe('null and undefined', () => {
    it('renders null as an empty field, not the text "null"', () => {
      const csv = svToCsv(['a', 'b'], [[null, 1]]);
      expect(csv).toBe('a,b\r\n,1');
    });

    it('renders undefined as an empty field', () => {
      const csv = svToCsv(['a', 'b'], [[undefined, 1]]);
      expect(csv).toBe('a,b\r\n,1');
    });
  });

  describe('types', () => {
    it('writes numbers without quoting', () => {
      expect(svToCsv(['n'], [[42]])).toBe('n\r\n42');
    });

    it('writes zero, not an empty field', () => {
      expect(svToCsv(['n'], [[0]])).toBe('n\r\n0');
    });

    it('does not accept booleans — the cell type is string | number | null | undefined', () => {
      // Booleans stringify fine at runtime, but the signature excludes them on
      // purpose: `false` and `0` and `''` all need deliberate decisions in a
      // spreadsheet, and a caller who reaches for a boolean should render it to
      // the label the column actually wants ('Yes'/'No', 'Active'/'Archived')
      // rather than letting the serialiser pick. Asserted through the type
      // system, so this test is a compile-time claim with a runtime witness.
      // @ts-expect-error boolean is not an accepted cell value
      expect(() => svToCsv(['b'], [[true]])).not.toThrow();
    });
  });

  describe('degenerate input', () => {
    it('emits just the header when there are no rows', () => {
      expect(svToCsv(['a', 'b'], [])).toBe('a,b');
    });

    it('does not throw on a row shorter than the header', () => {
      expect(() => svToCsv(['a', 'b', 'c'], [[1]])).not.toThrow();
    });
  });
});

describe('svDownloadBlob', () => {
  it('creates an object URL, clicks a download anchor, and cleans up after itself', () => {
    const created: string[] = [];
    const revoked: string[] = [];
    const view = window as unknown as { URL: typeof URL };
    const origCreate = view.URL.createObjectURL;
    const origRevoke = view.URL.revokeObjectURL;
    view.URL.createObjectURL = () => {
      created.push('blob:fake');
      return 'blob:fake';
    };
    view.URL.revokeObjectURL = (u: string) => void revoked.push(u);

    let clickedName: string | null = null;
    let inDomAtClick = false;
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clickedName = this.download;
      // A detached anchor does not navigate in every browser, so the helper
      // must still be holding it in the document at the moment it clicks.
      inDomAtClick = this.isConnected;
    };

    try {
      svDownloadBlob(document, 'orders.csv', new Blob(['a,b'], { type: 'text/csv' }));
    } finally {
      HTMLAnchorElement.prototype.click = origClick;
      view.URL.createObjectURL = origCreate;
      view.URL.revokeObjectURL = origRevoke;
    }

    expect(clickedName).toBe('orders.csv');
    expect(inDomAtClick).toBe(true);
    expect(created).toHaveLength(1);
    expect(revoked).toEqual(['blob:fake']); // leaking the URL pins the Blob in memory
    expect(document.querySelector('a[download]')).toBeNull(); // anchor removed again
  });

  it('does nothing on a document with no window — the SSR case', () => {
    // `createHTMLDocument` yields a real Document whose `defaultView` is null,
    // which is exactly the shape a server render hands in. It must not throw,
    // and it must not touch the DOM it was given.
    const detached = document.implementation.createHTMLDocument('ssr');
    expect(detached.defaultView).toBeNull();
    expect(() => svDownloadBlob(detached, 'x.csv', new Blob(['x']))).not.toThrow();
    expect(detached.body.children).toHaveLength(0);
  });
});

describe('svDownloadText', () => {
  it('defaults to a UTF-8 CSV mime type when none is given', async () => {
    let seen: Blob | null = null;
    const view = window as unknown as { URL: typeof URL };
    const origCreate = view.URL.createObjectURL;
    const origClick = HTMLAnchorElement.prototype.click;
    view.URL.createObjectURL = (b: Blob | MediaSource) => {
      seen = b as Blob;
      return 'blob:fake';
    };
    HTMLAnchorElement.prototype.click = () => undefined;
    try {
      svDownloadText(document, 'a.csv', 'a,b');
    } finally {
      HTMLAnchorElement.prototype.click = origClick;
      view.URL.createObjectURL = origCreate;
    }

    const blob = seen as unknown as Blob;
    expect(blob.type).toBe('text/csv;charset=utf-8');
    // jsdom has no Blob.text(); FileReader is the supported route.
    expect(await readBlob(blob)).toBe('a,b');
  });

  it('honours an explicit mime type', () => {
    let seen: Blob | null = null;
    const view = window as unknown as { URL: typeof URL };
    const origCreate = view.URL.createObjectURL;
    const origClick = HTMLAnchorElement.prototype.click;
    view.URL.createObjectURL = (b: Blob | MediaSource) => {
      seen = b as Blob;
      return 'blob:fake';
    };
    HTMLAnchorElement.prototype.click = () => undefined;
    try {
      svDownloadText(document, 'a.json', '{}', 'application/json');
    } finally {
      HTMLAnchorElement.prototype.click = origClick;
      view.URL.createObjectURL = origCreate;
    }
    expect((seen as unknown as Blob).type).toBe('application/json');
  });
});

/** jsdom implements no `Blob.text()`, so read through FileReader instead. */
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}
