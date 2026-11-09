import { Component, forwardRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SvWebMcpDirective } from './webmcp';
import { svCheckWebMcpArgs, svRegisterWebMcpTools } from './webmcp.register';
import { SV_WEBMCP_SOURCE, svIsWebMcpName, type SvWebMcpSchema, type SvWebMcpTool, type SvWebMcpToolSource } from './webmcp.source';

/**
 * `FL-E2` — the WebMCP mechanism: the argument check every call goes through,
 * registration with a fake `modelContext`, and the directive's lifetime
 * (registered with its widget, gone with it, re-registered on a new prefix).
 */

interface Registered {
  readonly tool: { name: string; execute(args: unknown, client?: { signal?: AbortSignal }): Promise<string>; annotations?: object };
  readonly signal?: AbortSignal;
}

function installModelContext(): { tools: Map<string, Registered>; uninstall(): void } {
  const tools = new Map<string, Registered>();
  const nav = navigator as unknown as { modelContext?: unknown };
  const before = nav.modelContext;
  nav.modelContext = {
    registerTool(tool: Registered['tool'], options?: { signal?: AbortSignal }) {
      if (tools.has(tool.name)) throw new Error(`duplicate ${tool.name}`);
      tools.set(tool.name, { tool, signal: options?.signal });
      options?.signal?.addEventListener('abort', () => tools.delete(tool.name), { once: true });
    },
  };
  return { tools, uninstall: () => { nav.modelContext = before; } };
}

const SORT_SCHEMA: SvWebMcpSchema = {
  type: 'object',
  properties: {
    column: { type: 'string', maxLength: 10 },
    direction: { type: 'string', enum: ['asc', 'desc'] },
    limit: { type: 'integer', minimum: 1, maximum: 5 },
    ids: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'number' }] }, maxItems: 2 },
  },
  required: ['direction'],
  additionalProperties: false,
};

describe('svCheckWebMcpArgs', () => {
  it('accepts arguments that fit', () => {
    expect(svCheckWebMcpArgs(SORT_SCHEMA, { column: 'name', direction: 'asc', limit: 3, ids: ['a', 2] })).toBeNull();
  });

  it('names the first problem', () => {
    expect(svCheckWebMcpArgs(SORT_SCHEMA, {})).toBe('arguments.direction is required.');
    expect(svCheckWebMcpArgs(SORT_SCHEMA, { direction: 'up' })).toBe('arguments.direction must be one of "asc", "desc".');
    expect(svCheckWebMcpArgs(SORT_SCHEMA, { direction: 'asc', extra: 1 })).toBe('arguments.extra is not a known argument.');
    expect(svCheckWebMcpArgs(SORT_SCHEMA, { direction: 'asc', column: 'x'.repeat(11) })).toBe('arguments.column must be at most 10 character(s).');
    expect(svCheckWebMcpArgs(SORT_SCHEMA, { direction: 'asc', limit: 2.5 })).toBe('arguments.limit must be a whole number.');
    expect(svCheckWebMcpArgs(SORT_SCHEMA, { direction: 'asc', limit: 9 })).toBe('arguments.limit must be at most 5.');
    expect(svCheckWebMcpArgs(SORT_SCHEMA, { direction: 'asc', limit: Number.NaN })).toBe('arguments.limit must be a finite number.');
    expect(svCheckWebMcpArgs(SORT_SCHEMA, { direction: 'asc', ids: [true] })).toBe('arguments.ids[0] matches none of the allowed shapes.');
    expect(svCheckWebMcpArgs(SORT_SCHEMA, { direction: 'asc', ids: [1, 2, 3] })).toBe('arguments.ids takes at most 2 item(s).');
    expect(svCheckWebMcpArgs(SORT_SCHEMA, ['asc'])).toBe('arguments must be an object, got array.');
  });

  it('never reads an inherited key as a declared property', () => {
    expect(svCheckWebMcpArgs(SORT_SCHEMA, JSON.parse('{"direction":"asc","__proto__":{"x":1}}'))).toBe('arguments.__proto__ is not a known argument.');
    expect(svCheckWebMcpArgs(SORT_SCHEMA, { direction: 'asc', constructor: 'x' })).toBe('arguments.constructor is not a known argument.');
  });
});

describe('svIsWebMcpName', () => {
  it('takes a letter, then letters, digits, _ or -', () => {
    expect(svIsWebMcpName('orders_sort')).toBe(true);
    expect(svIsWebMcpName('board-2')).toBe(true);
    expect(svIsWebMcpName('2orders')).toBe(false);
    expect(svIsWebMcpName('orders sort')).toBe(false);
    expect(svIsWebMcpName('')).toBe(false);
    expect(svIsWebMcpName('a'.repeat(65))).toBe(false);
  });
});

describe('svRegisterWebMcpTools', () => {
  let ctx: ReturnType<typeof installModelContext>;
  beforeEach(() => { ctx = installModelContext(); });
  afterEach(() => ctx.uninstall());

  const tool = (execute: SvWebMcpTool['execute']): SvWebMcpTool => ({
    name: 'sort', description: 'Sort.', inputSchema: SORT_SCHEMA, annotations: { readOnlyHint: false }, execute,
  });

  it('registers prefixed names, checks arguments before running, and unregisters on abort', async () => {
    const execute = vi.fn(() => 'done');
    const controller = new AbortController();
    const names = await svRegisterWebMcpTools(document, [tool(execute)], { signal: controller.signal, prefix: 'orders' });
    expect(names).toEqual(['orders_sort']);
    const registered = ctx.tools.get('orders_sort')!;
    expect(registered.tool.annotations).toEqual({ readOnlyHint: false });

    expect(await registered.tool.execute({ direction: 'sideways' })).toBe('Refused: arguments.direction must be one of "asc", "desc".');
    expect(execute).not.toHaveBeenCalled();
    expect(await registered.tool.execute({ direction: 'asc' })).toBe('done');
    expect(execute).toHaveBeenCalledWith({ direction: 'asc' }, expect.objectContaining({ signal: expect.any(AbortSignal) }));

    controller.abort();
    expect(ctx.tools.has('orders_sort')).toBe(false);
    expect(await registered.tool.execute({ direction: 'asc' })).toBe('Refused: the widget is no longer on the page.');
  });

  it('answers a thrown error as text', async () => {
    await svRegisterWebMcpTools(document, [tool(() => { throw new Error('boom'); })], { signal: new AbortController().signal });
    expect(await ctx.tools.get('sort')!.tool.execute({ direction: 'asc' })).toBe('Failed: boom');
  });

  it('skips a bad name and carries on', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const bad = { ...tool(() => 'x'), name: 'has space' };
    const names = await svRegisterWebMcpTools(document, [bad, tool(() => 'x')], { signal: new AbortController().signal, prefix: 'p' });
    expect(names).toEqual(['p_sort']);
    warn.mockRestore();
  });

  it('does nothing without a modelContext', async () => {
    ctx.uninstall();
    expect(await svRegisterWebMcpTools(document, [tool(() => 'x')], { signal: new AbortController().signal })).toEqual([]);
  });
});

@Component({
  selector: 'sv-fake-widget',
  standalone: true,
  template: '',
  providers: [{ provide: SV_WEBMCP_SOURCE, useExisting: forwardRef(() => FakeWidgetComponent) }],
})
class FakeWidgetComponent implements SvWebMcpToolSource {
  static loads = 0;
  async svWebMcpTools(): Promise<readonly SvWebMcpTool[]> {
    FakeWidgetComponent.loads++;
    return [
      { name: 'describe', description: 'Look.', inputSchema: { type: 'object' }, annotations: { readOnlyHint: true }, execute: () => 'state' },
      { name: 'sort', description: 'Sort.', inputSchema: { type: 'object' }, execute: () => 'sorted' },
    ];
  }
}

@Component({
  standalone: true,
  imports: [FakeWidgetComponent, SvWebMcpDirective],
  template: `
    @if (shown()) {
      <sv-fake-widget [svWebMcp]="prefix()" [svWebMcpReadOnly]="readOnly()" #mcp="svWebMcp" />
    }
  `,
})
class HostComponent {
  readonly shown = signal(true);
  readonly prefix = signal('orders');
  readonly readOnly = signal(false);
}

describe('SvWebMcpDirective', () => {
  let ctx: ReturnType<typeof installModelContext>;
  beforeEach(() => { ctx = installModelContext(); });
  afterEach(() => ctx.uninstall());

  async function settle(fixture: { detectChanges(): void; whenStable(): Promise<unknown> }): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    for (let i = 0; i < 6; i++) await Promise.resolve();
  }

  it('registers the widget\'s tools under its prefix, marks the host, and drops them with the widget', async () => {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(HostComponent);
    await settle(fixture);
    expect([...ctx.tools.keys()].sort()).toEqual(['orders_describe', 'orders_sort']);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-sv-webmcp="orders"]')).not.toBeNull();

    fixture.componentInstance.shown.set(false);
    await settle(fixture);
    expect(ctx.tools.size).toBe(0);
  });

  it('re-registers under a new prefix, and exposes only read-only tools when asked', async () => {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(HostComponent);
    await settle(fixture);
    fixture.componentInstance.prefix.set('invoices');
    fixture.componentInstance.readOnly.set(true);
    await settle(fixture);
    expect([...ctx.tools.keys()]).toEqual(['invoices_describe']);
  });

  it('never loads the widget\'s tools in a browser without WebMCP', async () => {
    ctx.uninstall();
    FakeWidgetComponent.loads = 0;
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(HostComponent);
    await settle(fixture);
    expect(FakeWidgetComponent.loads).toBe(0);
  });

  it('call() runs a tool as an agent would, with or without WebMCP', async () => {
    ctx.uninstall();
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(HostComponent);
    await settle(fixture);
    const mcp = fixture.debugElement.query(By.directive(SvWebMcpDirective)).injector.get(SvWebMcpDirective);
    expect(await mcp.call('sort')).toBe('sorted');
    expect(await mcp.call('sort', { extra: 1 })).toBe('Refused: arguments.extra is not a known argument.');
    expect(await mcp.call('missing')).toBe('Refused: no tool "missing".');
  });

  it('registers nothing for an unusable prefix', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.prefix.set('9 lives');
    await settle(fixture);
    expect(ctx.tools.size).toBe(0);
    warn.mockRestore();
  });
});
