import {
  Injectable,
  inject,
  provideEnvironmentInitializer,
  signal,
  type EnvironmentProviders,
} from '@angular/core';
import type { IconNode } from './icon.types';

/**
 * Per-icon registration (FL-B4).
 *
 * ★★★ A NAME LOOKUP USED TO SHIP EVERY GLYPH. `<sv-icon name="x">` resolved
 *     against the generated registry, which the component imported statically —
 *     so one icon in one button put all 174 free glyphs (and, through
 *     `<sv-icon-pro>`, all 514 Pro ones) into every buyer's bundle. A string name
 *     is invisible to a bundler; only an import is not.
 *
 * ★★ SO A GLYPH IS AN IMPORT, AND A NAME IS REGISTERED. Each glyph is exported
 *    as a definition (`bellIcon`, `sparkProIcon`), components register the ones
 *    their templates name with {@link registerSvIcons}, and an app adds its own
 *    with {@link provideSvIcons}. The full set is an explicit opt-in:
 *    `provideSvIcons(svAllIcons)`.
 *
 * ★ TWO SETS, ONE REGISTRY. A Pro definition (`pro: true`) is visible only to
 *   `<sv-icon-pro>`, which falls back to the free set; `<sv-icon>` sees only the
 *   free set and the app's own glyphs — so registering a Pro glyph can never
 *   change what a free icon draws.
 */

/** One glyph, as a registrable value: its name, primitives and optional solid silhouette. */
export interface SvIconDef {
  readonly name: string;
  /** Line primitives. A solid-only definition (a Pro silhouette for a free glyph) omits them. */
  readonly nodes?: readonly IconNode[];
  /** Filled silhouette for the `solid` weight. */
  readonly solid?: readonly IconNode[] | null;
  /** A Pro glyph — resolved by `<sv-icon-pro>` only. */
  readonly pro?: boolean;
}

/** A map of icon name → primitives — an app's own glyphs, or the generated `ICON_REGISTRY`. */
export type IconRegistry = Readonly<Record<string, readonly IconNode[]>>;

interface Entry {
  nodes: readonly IconNode[] | null;
  solid: readonly IconNode[] | null;
}

/** Every glyph registered in this application, by name and set. */
@Injectable({ providedIn: 'root' })
export class SvIconRegistry {
  /** The app's own glyphs (`provideSvIcons({ 'my-logo': … })`) — checked first, by both components. */
  private readonly own = new Map<string, readonly IconNode[]>();
  private readonly free = new Map<string, Entry>();
  private readonly pro = new Map<string, Entry>();
  /** Bumped on every registration, so an icon that rendered before its glyph arrived redraws. */
  readonly version = signal(0);

  /** Add glyph definitions (later ones win per field), or an app's own name → primitives map. */
  add(items: readonly SvIconDef[] | IconRegistry): void {
    let changed = false;
    if (!Array.isArray(items)) {
      for (const [name, nodes] of Object.entries(items as IconRegistry)) {
        if (this.own.get(name) === nodes) continue;
        this.own.set(name, nodes);
        changed = true;
      }
    } else {
      for (const def of items as readonly SvIconDef[]) {
        const map = def.pro ? this.pro : this.free;
        const prev = map.get(def.name);
        const next: Entry = {
          nodes: def.nodes ?? prev?.nodes ?? null,
          solid: def.solid !== undefined ? def.solid : (prev?.solid ?? null),
        };
        if (prev && prev.nodes === next.nodes && prev.solid === next.solid) continue;
        map.set(def.name, next);
        changed = true;
      }
    }
    if (changed) this.version.update((v) => v + 1);
  }

  /** The line primitives for `name`: the app's own, then (for `pro`) the Pro set, then the free set. */
  nodes(name: string, tier: 'free' | 'pro' = 'free'): readonly IconNode[] | null {
    this.version();
    return this.own.get(name) ?? (tier === 'pro' ? this.pro.get(name)?.nodes : null) ?? this.free.get(name)?.nodes ?? null;
  }

  /**
   * The solid silhouette for `name`, from the set its line glyph came from. An
   * app's own glyph has none — it must not borrow a built-in silhouette.
   */
  solid(name: string, tier: 'free' | 'pro' = 'free'): readonly IconNode[] | null {
    this.version();
    if (this.own.has(name)) return null;
    const own = tier === 'pro' ? this.pro.get(name) : undefined;
    if (own) return own.solid ?? (own.nodes ? null : (this.free.get(name)?.solid ?? null));
    return this.free.get(name)?.solid ?? null;
  }
}

/**
 * Register the glyphs a component draws by name. Call it in a field initializer
 * (an injection context); it returns the definitions so it can sit in a field:
 *
 * ```ts
 * private readonly icons = registerSvIcons([bellIcon, chevronDownIcon]);
 * ```
 */
export function registerSvIcons(defs: readonly SvIconDef[]): readonly SvIconDef[] {
  inject(SvIconRegistry).add(defs);
  return defs;
}

/**
 * Make glyphs resolvable by `<sv-icon name="…">` app-wide: definitions you
 * import (`bellIcon`), the whole set (`svAllIcons`), or your own marks.
 *
 * ```ts
 * bootstrapApplication(App, {
 *   providers: [provideSvIcons([bellIcon, starIcon], { 'my-logo': [{ tag: 'path', d: '…' }] })],
 * });
 * ```
 *
 * Your own map is registered last, so a name in it overrides the built-in glyph.
 */
export function provideSvIcons(...items: readonly (readonly SvIconDef[] | IconRegistry)[]): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const registry = inject(SvIconRegistry);
    for (const item of items) registry.add(item);
  });
}
