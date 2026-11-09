import { render, fireEvent } from '@testing-library/angular';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { flush } from '@testing/async';
import { SvStackTraceComponent } from './stack-trace.component';
import type { SvStackFrame } from './stack-trace.logic';

/**
 * sv-stack-trace, rendered: the header, one row per frame, library runs folded
 * behind a disclosure, `frameClick`, copy, and an `Error` object as input.
 */

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

const TRACE = `TypeError: Cannot read properties of undefined (reading 'id')
    at OrderService.total (/srv/app/src/orders/order.service.ts:42:17)
    at Array.map (<anonymous>)
    at Object.next (/srv/app/node_modules/rxjs/dist/cjs/internal/Subscriber.js:91:18)
    at SafeSubscriber._next (/srv/app/node_modules/rxjs/dist/cjs/internal/Subscriber.js:60:22)
    at ZoneDelegate.invoke (/srv/app/node_modules/zone.js/fesm2015/zone.js:368:26)
    at OrdersPage.ngOnInit (/srv/app/src/orders/page.ts:12:5)`;

async function setup(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvStackTraceComponent, { inputs });
  return fixture as ComponentFixture<SvStackTraceComponent>;
}

const frames = (f: ComponentFixture<unknown>) => [...el(f).querySelectorAll<HTMLElement>('[data-sv-frame]')];

describe('SvStackTraceComponent', () => {
  it('shows the error name and message, then the frames', async () => {
    const f = await setup({ trace: TRACE });
    expect(el(f).querySelector('[data-sv-error-name]')?.textContent).toBe('TypeError');
    expect(el(f).querySelector('[data-sv-error-message]')?.textContent).toContain("reading 'id'");
    const first = frames(f)[0]!;
    expect(first.querySelector('[data-sv-frame-fn]')?.textContent).toBe('OrderService.total');
    expect(first.querySelector('[data-sv-frame-location]')?.textContent).toBe('/srv/app/src/orders/order.service.ts:42:17');
  });

  it('folds a run of library frames behind one toggle, and opens it', async () => {
    const f = await setup({ trace: TRACE });
    // Visible: the two app frames and the lone Array.map (a run of one does not fold).
    expect(frames(f).map((r) => r.querySelector('[data-sv-frame-fn]')?.textContent)).toEqual([
      'OrderService.total', 'Array.map', 'OrdersPage.ngOnInit',
    ]);
    const toggle = el(f).querySelector<HTMLButtonElement>('[data-sv-library-group] button')!;
    expect(toggle.textContent).toContain('Show 3 library frames');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);
    f.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent).toContain('Hide 3 library frames');
    const list = el(f).querySelector(`#${toggle.getAttribute('aria-controls')}`)!;
    expect(list.querySelectorAll('[data-sv-library="true"]')).toHaveLength(3);
    expect(frames(f)).toHaveLength(6);
  });

  it('shows every frame when collapsing is off', async () => {
    const f = await setup({ trace: TRACE, collapseLibraryFrames: false });
    expect(el(f).querySelector('[data-sv-library-group]')).toBeNull();
    expect(frames(f)).toHaveLength(6);
  });

  it('takes a custom library predicate', async () => {
    const f = await setup({ trace: TRACE, isLibraryFrame: (fr: SvStackFrame) => (fr.file ?? '').includes('/orders/') });
    expect(el(f).querySelector('[data-sv-library-group]')).toBeNull();
    expect(frames(f).filter((r) => r.dataset['svLibrary'] === 'true')).toHaveLength(2);
  });

  it('renders frames as buttons and emits frameClick only while frameClickable', async () => {
    const f = await setup({ trace: TRACE, frameClickable: true });
    const clicked: SvStackFrame[] = [];
    f.componentInstance.frameClick.subscribe((fr) => clicked.push(fr));
    const first = frames(f)[0]!;
    expect(first.tagName).toBe('BUTTON');
    fireEvent.click(first);
    expect(clicked.map((c) => [c.file, c.line, c.column])).toEqual([['/srv/app/src/orders/order.service.ts', 42, 17]]);
    // A frame with no file has nothing to open, so it is not a button.
    expect(frames(f)[1]!.tagName).toBe('DIV');

    const plain = await setup({ trace: TRACE });
    expect(frames(plain)[0]!.tagName).toBe('DIV');
  });

  it('reads an Error object, filling a missing header from its name and message', async () => {
    const error = new RangeError('too deep');
    error.stack = 'f@http://localhost/main.js:1:2\ng@http://localhost/main.js:3:4'; // Firefox: no header
    const f = await setup({ trace: error });
    expect(el(f).querySelector('[data-sv-error-name]')?.textContent).toBe('RangeError');
    expect(el(f).querySelector('[data-sv-error-message]')?.textContent).toBe('too deep');
    expect(frames(f)).toHaveLength(2);
  });

  it('draws markup in a message as characters', async () => {
    const f = await setup({ trace: 'Error: <img src=x onerror=alert(1)>\n    at f (a.js:1:2)' });
    expect(el(f).querySelector('img')).toBeNull();
    expect(el(f).querySelector('[data-sv-error-message]')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('says so when there is nothing to show', async () => {
    const f = await setup({ trace: '' });
    expect(el(f).querySelector('[data-sv-stack-empty]')).not.toBeNull();
  });

  it('names the region and the frame list', async () => {
    const f = await setup({ trace: TRACE });
    expect(el(f).querySelector('section')?.getAttribute('aria-label')).toBe('Stack trace');
    expect(el(f).querySelector('[data-sv-frames]')?.getAttribute('aria-label')).toBe('6 frames');
  });
});

describe('SvStackTraceComponent — copy', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  });

  it('copies the trace text and confirms it', async () => {
    let written = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (t: string) => { written = t; } },
    });
    const f = await setup({ trace: TRACE });
    fireEvent.click(el(f).querySelector('[data-sv-stack-copy]')!);
    await flush();
    f.detectChanges();
    expect(written).toBe(TRACE);
    expect(el(f).querySelector('[role="status"]')?.textContent).toContain('Copied');
  });

  it('shows a failure rather than a false confirmation', async () => {
    const f = await setup({ trace: TRACE });
    fireEvent.click(el(f).querySelector('[data-sv-stack-copy]')!);
    await flush();
    f.detectChanges();
    expect(el(f).querySelector('[data-sv-copy-failed]')).not.toBeNull();
  });
});
