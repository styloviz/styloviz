import {
  svIsLibraryFrame,
  svParseStackFrame,
  svParseStackTrace,
  svStackFrameLocation,
  type SvStackFrame,
} from './stack-trace.logic';

/**
 * `svParseStackTrace` against real-shaped traces from the three engines, plus
 * the generic `file:line:col` form. What is pinned: the header split, each
 * frame's function / file / line / column, and that nothing is dropped.
 */

const brief = (f: SvStackFrame) => [f.functionName, f.file, f.line, f.column];

const V8 = `TypeError: Cannot read properties of undefined (reading 'id')
    at OrderService.total (http://localhost:4200/src/app/orders/order.service.ts:42:17)
    at new OrdersPage (webpack-internal:///./src/app/orders/page.ts:12:5)
    at async Promise.all (index 0)
    at async loadOrders (/srv/app/dist/server/main.js:880:3)
    at Array.map (<anonymous>)
    at Object.<anonymous> (/srv/app/node_modules/zone.js/fesm2015/zone.js:2:30)
    at eval (eval at compile (/srv/app/src/tpl.js:5:9), <anonymous>:1:1)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at /srv/app/src/main.ts:3:1
    at Generator.next (native)`;

const FIREFOX = `total@http://localhost:4200/main.js:42:17
OrdersPage/<@http://localhost:4200/main.js:12:5
@http://localhost:4200/main.js:3:1
compile@http://localhost:4200/vendor.js line 2 > eval:1:5
forEach@[native code]`;

const SAFARI = `total@http://localhost:4200/main.js:42:17
global code@http://localhost:4200/main.js:3:1
forEach@[native code]
promiseReactionJob@[native code]`;

describe('svParseStackTrace — V8 (Chrome, Edge, Node)', () => {
  const p = svParseStackTrace(V8);

  it('splits the header into name and message', () => {
    expect(p.name).toBe('TypeError');
    expect(p.message).toBe("Cannot read properties of undefined (reading 'id')");
  });

  it('reads every frame, in order', () => {
    expect(p.frames.map(brief)).toEqual([
      ['OrderService.total', 'http://localhost:4200/src/app/orders/order.service.ts', 42, 17],
      ['new OrdersPage', 'webpack-internal:///./src/app/orders/page.ts', 12, 5],
      ['Promise.all', null, null, null],
      ['loadOrders', '/srv/app/dist/server/main.js', 880, 3],
      ['Array.map', null, null, null],
      ['Object.<anonymous>', '/srv/app/node_modules/zone.js/fesm2015/zone.js', 2, 30],
      ['eval', '/srv/app/src/tpl.js', 5, 9],
      ['process.processTicksAndRejections', 'node:internal/process/task_queues', 95, 5],
      [null, '/srv/app/src/main.ts', 3, 1],
      ['Generator.next', null, null, null],
    ]);
    expect(p.frames.every((f) => f.format === 'v8')).toBe(true);
  });

  it('marks async and native frames', () => {
    expect(p.frames.filter((f) => f.async).map((f) => f.functionName)).toEqual(['Promise.all', 'loadOrders']);
    expect(p.frames[9]!.native).toBe(true);
  });

  it('places an eval frame where eval was called', () => {
    expect(svStackFrameLocation(p.frames[6]!)).toBe('/srv/app/src/tpl.js:5:9');
  });

  it('takes the header from an "Uncaught" console line too', () => {
    const q = svParseStackTrace('Uncaught RangeError: Maximum call stack size exceeded\n    at f (a.js:1:1)');
    expect(q.name).toBe('RangeError');
    expect(q.message).toBe('Maximum call stack size exceeded');
  });

  it('keeps a multi-line message whole', () => {
    const q = svParseStackTrace('Error: first line\nsecond line\n    at f (a.js:1:2)');
    expect(q.message).toBe('first line\nsecond line');
    expect(q.frames).toHaveLength(1);
  });
});

describe('svParseStackTrace — SpiderMonkey (Firefox)', () => {
  const p = svParseStackTrace(FIREFOX);

  it('has no header — Firefox does not put one in `stack`', () => {
    expect(p.name).toBeNull();
    expect(p.message).toBe('');
  });

  it('reads fn@location, anonymous @location, eval and native frames', () => {
    expect(p.frames.map(brief)).toEqual([
      ['total', 'http://localhost:4200/main.js', 42, 17],
      ['OrdersPage/<', 'http://localhost:4200/main.js', 12, 5],
      [null, 'http://localhost:4200/main.js', 3, 1],
      ['compile', 'http://localhost:4200/vendor.js', 2, null],
      ['forEach', null, null, null],
    ]);
    expect(p.frames.every((f) => f.format === 'gecko')).toBe(true);
    expect(p.frames[4]!.native).toBe(true);
  });
});

describe('svParseStackTrace — JavaScriptCore (Safari)', () => {
  const p = svParseStackTrace(SAFARI);

  it('reads named, "global code" and [native code] frames', () => {
    expect(p.frames.map(brief)).toEqual([
      ['total', 'http://localhost:4200/main.js', 42, 17],
      ['global code', 'http://localhost:4200/main.js', 3, 1],
      ['forEach', null, null, null],
      ['promiseReactionJob', null, null, null],
    ]);
    expect(p.frames.filter((f) => f.native)).toHaveLength(2);
  });
});

describe('svParseStackTrace — generic and edge cases', () => {
  it('reads bare file:line:col lines', () => {
    const p = svParseStackTrace('src/app.ts:12:5\nsrc/main.ts:3:1');
    expect(p.frames.map(brief)).toEqual([
      [null, 'src/app.ts', 12, 5],
      [null, 'src/main.ts', 3, 1],
    ]);
    expect(p.frames[0]!.format).toBe('generic');
  });

  it('does not mistake an e-mail address in the message for a frame', () => {
    const p = svParseStackTrace('Error: no account for user@example.com\n    at f (a.js:1:2)');
    expect(p.message).toBe('no account for user@example.com');
    expect(p.frames).toHaveLength(1);
  });

  it('keeps an unreadable line after the frames as a raw frame rather than dropping it', () => {
    const p = svParseStackTrace('Error: x\n    at f (a.js:1:2)\nCaused by: Error: y');
    expect(p.frames.map((f) => [f.format, f.raw])).toEqual([
      ['v8', 'at f (a.js:1:2)'],
      ['raw', 'Caused by: Error: y'],
    ]);
  });

  it('reads a name-only header, a header with no frames, and a sentence that is not a header', () => {
    expect(svParseStackTrace('AbortError\n    at f (a.js:1:1)')).toMatchObject({ name: 'AbortError', message: '' });
    expect(svParseStackTrace('RangeError: too deep')).toMatchObject({ name: 'RangeError', message: 'too deep', frames: [] });
    expect(svParseStackTrace('Something went wrong: reason')).toMatchObject({ name: null, message: 'Something went wrong: reason' });
  });

  it('handles an empty trace and CRLF line endings', () => {
    expect(svParseStackTrace('')).toEqual({ name: null, message: '', frames: [] });
    expect(svParseStackTrace('Error: x\r\n    at f (a.js:1:2)\r\n').frames).toHaveLength(1);
  });

  it('svParseStackFrame returns null for a line that is not a frame', () => {
    expect(svParseStackFrame('just words')).toBeNull();
    expect(svParseStackFrame('')).toBeNull();
  });
});

describe('svIsLibraryFrame', () => {
  const at = (file: string | null, native = false): SvStackFrame => ({
    raw: '', functionName: null, file, line: 1, column: 1, native, async: false, format: 'v8',
  });

  it('flags node_modules, Node internals, bundler runtimes, zone.js and native code', () => {
    expect(svIsLibraryFrame(at('/app/node_modules/rxjs/dist/index.js'))).toBe(true);
    expect(svIsLibraryFrame(at('C:\\app\\node_modules\\x\\y.js'))).toBe(true);
    expect(svIsLibraryFrame(at('node:internal/process/task_queues'))).toBe(true);
    expect(svIsLibraryFrame(at('webpack:///webpack/bootstrap'))).toBe(true);
    expect(svIsLibraryFrame(at('http://localhost:5173/node_modules/.vite/deps/chunk.js'))).toBe(true);
    expect(svIsLibraryFrame(at('http://localhost:4200/polyfills.js'))).toBe(true);
    expect(svIsLibraryFrame(at(null, true))).toBe(true);
  });

  it('leaves application code and file-less frames alone', () => {
    expect(svIsLibraryFrame(at('/srv/app/src/main.ts'))).toBe(false);
    expect(svIsLibraryFrame(at('webpack-internal:///./src/app/page.ts'))).toBe(false);
    expect(svIsLibraryFrame(at(null))).toBe(false);
  });
});
