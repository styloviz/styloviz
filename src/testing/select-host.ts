import { reflectComponentType, signal, type DebugElement, type Type, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { svSelectSource, type SvSelectSourceSearch } from '@styloviz/core/data';

/**
 * Renders `sv-select-dropdown` / `sv-select-dropdown-pro` the 2.0 way from a
 * flat settings object, so a spec can still say `{ searchable: true,
 * minChars: 2 }` and get the composed shape.
 *
 * Each setting goes where 2.0 puts it:
 *
 * | Setting | Rendered as |
 * | --- | --- |
 * | `searchable`, `searchPlaceholder`, `noResultsText`, `loadingText`, `minChars`, `debounceMs`, `serverSide`, `(searchChange)` | `<ng-container svSelectSearch …>` |
 * | `virtualThreshold`, `optionHeight`, `virtualViewportHeight` | `<ng-container svSelectVirtual …>` (Pro) |
 * | `showSelectAll`, `selectAllLabel` | `<ng-container svSelectBulk …>` (Pro) |
 * | `sourceSearch` (a `(term, signal, page) => Promise<options>`) | `[source]="svSelectSource({ search: sourceSearch })"` |
 * | anything else | an input on the select itself |
 *
 * ★ The handle it returns is shaped like a `ComponentFixture` of the SELECT —
 *   `componentInstance`, `componentRef.setInput`, `nativeElement`,
 *   `detectChanges` — so the select's own specs read the same as before. Only
 *   the settings present at render are bound; `setInput` on any other one
 *   throws instead of silently doing nothing.
 *
 * Host-owned async state (`error`, `hasMore`, `loadingMore`, `stale`) was
 * removed in 2.0 — a spec for it drives a `source` instead — so naming one
 * here throws too.
 */

const SEARCH = ['searchable', 'searchPlaceholder', 'noResultsText', 'loadingText', 'minChars', 'debounceMs', 'serverSide'] as const;
const VIRTUAL = ['virtualThreshold', 'optionHeight', 'virtualViewportHeight'] as const;
const BULK = ['showSelectAll', 'selectAllLabel'] as const;
const REMOVED = ['error', 'hasMore', 'loadingMore', 'stale', 'retry', 'loadMore'] as const;

export interface SelectHostFeatures {
  readonly search: Type<unknown>;
  readonly virtual?: Type<unknown>;
  readonly bulk?: Type<unknown>;
}

export interface SelectHandle<C> {
  readonly componentInstance: C;
  readonly componentRef: { readonly instance: C; setInput(name: string, value: unknown): void };
  readonly nativeElement: HTMLElement;
  readonly debugElement: DebugElement;
  readonly host: ComponentFixture<unknown>;
  detectChanges(): void;
  whenStable(): Promise<unknown>;
  destroy(): void;
}

// `never` so a typed handler — `(term: string) => …` — is accepted; the template calls it.
type Handler = (event: never) => unknown;

export async function renderSelect<C>(
  component: Type<C>,
  features: SelectHostFeatures,
  settings: Record<string, unknown> = {},
  on: Record<string, Handler> = {},
): Promise<SelectHandle<C>> {
  const selector = reflectComponentType(component)?.selector;
  if (!selector) throw new Error('renderSelect: not a component');

  for (const key of REMOVED) {
    if (key in settings || key in on) {
      throw new Error(`renderSelect: \`${key}\` was removed in 2.0 — drive the panel through a \`source\``);
    }
  }

  const v: Record<string, WritableSignal<unknown>> = {};
  const bind = (key: string) => {
    v[key] = signal(settings[key]);
    return `[${key}]="v['${key}']()"`;
  };
  const listen = (name: string) => `(${name})="o['${name}']($event)"`;

  const present = (keys: readonly string[]) => keys.filter((k) => k in settings);
  const search = present(SEARCH);
  const virtual = present(VIRTUAL);
  const bulk = present(BULK);
  if ((virtual.length && !features.virtual) || (bulk.length && !features.bulk)) {
    throw new Error('renderSelect: this tier has no windowing / bulk feature');
  }

  const children: string[] = [];
  if (search.length || 'searchChange' in on) {
    const outs = 'searchChange' in on ? [listen('searchChange')] : [];
    children.push(`<ng-container svSelectSearch ${[...search.map(bind), ...outs].join(' ')} />`);
  }
  if (virtual.length) children.push(`<ng-container svSelectVirtual ${virtual.map(bind).join(' ')} />`);
  if (bulk.length) children.push(`<ng-container svSelectBulk ${bulk.map(bind).join(' ')} />`);

  // `source` is always bound, so a spec may hand one over after render — a
  // source needs the test injector, which exists only once TestBed is set up.
  const own: string[] = [];
  v['source'] = signal(settings['source'] ?? null);
  own.push(`[source]="v['source']()"`);
  const featureKeys = new Set<string>([...SEARCH, ...VIRTUAL, ...BULK, 'source', 'sourceSearch']);
  for (const key of Object.keys(settings)) {
    if (!featureKeys.has(key)) own.push(bind(key));
  }
  for (const name of Object.keys(on)) if (name !== 'searchChange') own.push(listen(name));

  const template = `<${selector} ${own.join(' ')}>${children.join('')}</${selector}>`;
  const imports = [component, features.search, features.virtual, features.bulk].filter(Boolean) as Type<unknown>[];
  const { fixture } = await render(template, { imports, componentProperties: { v, o: on } });

  const debugElement = fixture.debugElement.query((d) => d.componentInstance instanceof component);
  const instance = debugElement.componentInstance as C;

  const toSource = (load: SvSelectSourceSearch<unknown> | null) =>
    load ? TestBed.runInInjectionContext(() => svSelectSource({ search: load })) : null;
  if (settings['sourceSearch']) {
    v['source'].set(toSource(settings['sourceSearch'] as SvSelectSourceSearch<unknown>));
    fixture.detectChanges();
  }

  return {
    componentInstance: instance,
    componentRef: {
      instance,
      setInput(name, value) {
        const key = name === 'sourceSearch' ? 'source' : name;
        const slot = v[key];
        if (!slot) throw new Error(`renderSelect: \`${name}\` was not set at render, so it is not bound`);
        slot.set(name === 'sourceSearch' ? toSource(value as SvSelectSourceSearch<unknown> | null) : value);
        fixture.detectChanges();
      },
    },
    nativeElement: debugElement.nativeElement as HTMLElement,
    debugElement,
    host: fixture,
    detectChanges: () => fixture.detectChanges(),
    whenStable: () => fixture.whenStable(),
    destroy: () => fixture.destroy(),
  };
}
