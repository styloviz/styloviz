/**
 * `sv-affix` — which box a `position: fixed` element is really fixed to.
 *
 * ★★★ `position: fixed` IS ONLY FIXED TO THE VIEWPORT WHILE NO ANCESTOR SAYS
 * OTHERWISE. Any ancestor with a `transform`, `perspective`, `filter`,
 * `backdrop-filter`, a `will-change` naming one of those, `contain: paint |
 * layout | strict | content`, `content-visibility: auto | hidden` (paint
 * containment), `transform-style: preserve-3d`, or a `container-type` becomes the
 * containing block
 * for every fixed descendant. The pinned element is then positioned against that
 * ancestor's box and scrolls away with it — which looks exactly like a CSS bug
 * in the host's own code, because nothing in the affix changed.
 *
 * It is common in dashboards, not exotic: an animated route wrapper
 * (`transform: translateY(0)`), a card with `backdrop-filter`, a `will-change`
 * added for a smooth slide-in, or a `@container` layout all do it.
 *
 * The component cannot fix it — the property belongs to the host — so it
 * detects it, reports it through `containingBlockChange` and the
 * `data-sv-containing-block` hook, and warns once in dev mode.
 */

/** What stole containment from the pinned element, and by how much. */
export interface SvAffixContainingBlock {
  /**
   * The nearest ancestor whose computed style makes it the containing block,
   * or `null` when the offset was measured but no single property explains it
   * (a UA quirk, or a style the walk does not read).
   */
  readonly element: Element | null;
  /** Viewport offset a `top: 0` fixed child of the placeholder is re-based by, in px. */
  readonly top: number;
  /** Viewport offset a `left: 0` fixed child of the placeholder is re-based by, in px. */
  readonly left: number;
}

/** `will-change` values that create a containing block for fixed descendants. */
const WILL_CHANGE_CB = /\b(transform|perspective|filter|backdrop-filter|translate|rotate|scale|contain)\b/;
/** `contain` values that do. */
const CONTAIN_CB = /\b(paint|layout|strict|content)\b/;

const set = (value: string): boolean => value !== '' && value !== 'none';

/**
 * Does this computed style make its element the containing block for a
 * `position: fixed` descendant?
 *
 * Read with `getPropertyValue` throughout, so an engine that lacks one of the
 * newer properties (`translate`, `container-type`) reports `''` and is simply
 * not matched, rather than throwing.
 */
export function svEstablishesFixedContainingBlock(style: CSSStyleDeclaration, isRoot = false): boolean {
  const read = (prop: string): string => style.getPropertyValue(prop).trim();
  if (set(read('transform'))) return true;
  if (set(read('translate')) || set(read('rotate')) || set(read('scale'))) return true;
  if (set(read('perspective'))) return true;
  if (read('transform-style') === 'preserve-3d') return true;
  // ★ Filter Effects: `filter` / `backdrop-filter` on the ROOT element do not
  //   create a containing block — `html { filter: invert(1) }` dark modes are
  //   common and must not be reported as the culprit.
  if (!isRoot && set(read('filter'))) return true;
  if (!isRoot && (set(read('backdrop-filter')) || set(read('-webkit-backdrop-filter')))) return true;
  if (WILL_CHANGE_CB.test(read('will-change'))) return true;
  if (CONTAIN_CB.test(read('contain'))) return true;
  const visibility = read('content-visibility');
  if (visibility === 'auto' || visibility === 'hidden') return true;
  const container = read('container-type');
  return container !== '' && container !== 'normal';
}

/**
 * The nearest element, starting at `from` itself, that is the containing block
 * for a `position: fixed` child — or `null` when the viewport still is.
 *
 * SSR-safe: with no `defaultView` there is no layout, and it returns `null`.
 */
export function svFixedContainingBlock(from: Element | null | undefined): Element | null {
  const view = from?.ownerDocument?.defaultView;
  if (!from || !view) return null;
  for (let el: Element | null = from; el; el = el.parentElement) {
    const isRoot = el === el.ownerDocument.documentElement;
    if (svEstablishesFixedContainingBlock(view.getComputedStyle(el), isRoot)) return el;
  }
  return null;
}

/**
 * Two reports describe the same situation. Used to emit on change only.
 *
 * ★ The offsets are deliberately NOT compared. The culprit ancestor scrolls with
 *   the page, so its offset is different at every pin, and comparing it would
 *   re-emit — and re-warn — every time the element crossed its threshold.
 */
export function svSameContainingBlock(
  a: SvAffixContainingBlock | null,
  b: SvAffixContainingBlock | null,
): boolean {
  if (a === null || b === null) return a === b;
  return a.element === b.element;
}
