/**
 * Input transforms for the names Signal Forms writes to (FL-B3).
 *
 * ★★★ `[formField]` PUSHES FIELD STATE INTO INPUTS BY NAME. On a control that
 *     has an input called `min`, `max`, `minLength`, `maxLength` or `pattern`,
 *     Signal Forms binds the field's metadata there — and the template compiler
 *     checks the type. It sends `number | undefined` for `min`/`max` on Angular
 *     21, the field's own value type on 22, and `readonly RegExp[]` for
 *     `pattern`; with no validator it sends `undefined`. An input typed plainly
 *     `number` or `string` therefore stops `[formField]` compiling on the
 *     control at all.
 *
 * ★★ SO THESE INPUTS ACCEPT `unknown` AND NORMALISE IT. Writing anything stays
 *    legal (a host's `[min]="0"` is unchanged), and what the component reads is
 *    its own type, falling back to the default it always had. This is the
 *    shape `FormUiControl` itself allows (`InputSignalWithTransform<T, unknown>`),
 *    and it holds on both majors.
 */

/** A finite number, else `fallback` (an absent validator sends `undefined`). */
export function svNumberOr(fallback: number): (value: unknown) => number {
  return (value) => (typeof value === 'number' && !Number.isNaN(value) ? value : fallback);
}

/** A string, else `fallback` — for a `min`/`max` the control keeps as text (a time, a date). */
export function svStringOr(fallback: string): (value: unknown) => string {
  return (value) => (typeof value === 'string' ? value : fallback);
}

/** A bound value the control can use as a native `min`/`max` (string or number), else `null`. */
export function svBoundOrNull(value: unknown): string | number | null {
  return typeof value === 'string' || (typeof value === 'number' && !Number.isNaN(value)) ? value : null;
}

/**
 * An HTML `pattern` attribute: a string as given, or the one regular expression
 * Signal Forms sends from a `pattern()` validator. Several expressions cannot be
 * one attribute, so they leave it empty — the form still validates them.
 */
export function svPatternAttr(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length === 1 && value[0] instanceof RegExp) return value[0].source;
  return '';
}
