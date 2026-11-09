/**
 * Accessible names with slots (FL-B1c).
 *
 * ★★★ `'Remove ' + chip.label` CANNOT BE TRANSLATED BY SWAPPING A STRING.
 *     German says "{name} entfernen", Japanese puts the particle after the
 *     noun, and "3 more items" needs a plural rule English barely has — Polish
 *     has four forms, Arabic six. So a composed name is one template with named
 *     slots, owned by the package's `*.labels.ts` like every other label:
 *
 *       removeItem: 'Remove {name}'                      → 'Entferne {name}' / '{name} entfernen'
 *       moreItems:  '{count, plural, one {# more item} other {# more items}}'
 *
 *     The plural form is the ICU MessageFormat subset translators already know:
 *     `=N` exact matches, then the locale's CLDR category (`zero`, `one`, `two`,
 *     `few`, `many`, `other`) from `Intl.PluralRules`, with `#` for the count
 *     formatted in the locale. Nothing here is HTML — the result is a plain
 *     string bound to an attribute, so a slot value cannot inject markup.
 */
import { Pipe, inject, type PipeTransform } from '@angular/core';
import { SV_LOCALE, SV_MACHINE_LOCALE } from './locale';

/** The values a label template's slots are filled with. */
export type SvLabelParams = Readonly<Record<string, string | number | null | undefined>>;

const formatNumber = (n: number, locale: string): string => {
  try {
    return new Intl.NumberFormat(locale || SV_MACHINE_LOCALE).format(n);
  } catch {
    return String(n);
  }
};

const value = (v: string | number | null | undefined, locale: string): string =>
  v === null || v === undefined ? '' : typeof v === 'number' ? formatNumber(v, locale) : v;

/** The index of the `}` that closes the `{` at `open`, or -1. */
function closing(template: string, open: number): number {
  let depth = 0;
  for (let i = open; i < template.length; i++) {
    if (template[i] === '{') depth++;
    else if (template[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

function plural(arg: string, body: string, params: SvLabelParams, locale: string): string {
  const raw = params[arg];
  // ★ A count may arrive already formatted ("1,234", "1.234") — callers keep
  //   English output ungrouped that way, and a translation may pluralise a slot
  //   the English only printed. Its digits pick the form, and `#` prints it as
  //   given rather than reformatting (`Number("1,234")` is NaN).
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/[^\d-]/g, ''));
  const shown = typeof raw === 'number' ? formatNumber(n, locale) : String(raw ?? '');
  const branches = new Map<string, string>();
  let i = 0;
  while (i < body.length) {
    const key = /^\s*(=\d+|zero|one|two|few|many|other)\s*\{/.exec(body.slice(i));
    if (!key) break;
    const open = i + key[0].length - 1;
    const close = closing(body, open);
    if (close < 0) break;
    branches.set(key[1], body.slice(open + 1, close));
    i = close + 1;
  }
  let category = 'other';
  try {
    category = new Intl.PluralRules(locale || SV_MACHINE_LOCALE).select(n);
  } catch {
    // an invalid tag keeps `other`
  }
  const chosen = branches.get(`=${n}`) ?? branches.get(category) ?? branches.get('other') ?? '';
  return fill(chosen.replace(/#/g, shown), params, locale);
}

function fill(template: string, params: SvLabelParams, locale: string): string {
  let out = '';
  let i = 0;
  while (i < template.length) {
    const open = template.indexOf('{', i);
    if (open < 0) break;
    const close = closing(template, open);
    if (close < 0) break;
    out += template.slice(i, open);
    const inner = template.slice(open + 1, close);
    const forms = /^\s*(\w+)\s*,\s*plural\s*,([\s\S]*)$/.exec(inner);
    if (forms) out += plural(forms[1], forms[2], params, locale);
    else if (/^\s*\w+\s*$/.test(inner)) {
      const name = inner.trim();
      // An unfilled slot stays visible, so a missing parameter is a visible bug, not a silent gap.
      out += name in params ? value(params[name], locale) : `{${name}}`;
    } else out += template.slice(open, close + 1);
    i = close + 1;
  }
  return out + template.slice(i);
}

/**
 * Fill a label template's `{slots}` (and `{n, plural, …}` forms) from `params`.
 * Numbers are formatted in `locale`; `''` falls back to the machine locale.
 */
export function svFormatLabel(template: string, params: SvLabelParams = {}, locale = ''): string {
  return fill(template, params, locale);
}

/**
 * `labels.removeItem | svLabel: { name: chip.label }` — {@link svFormatLabel}
 * in the kit's locale. Pure: re-runs only when the template or the params
 * object changes, so it is safe inside an `@for`.
 */
@Pipe({ name: 'svLabel', standalone: true })
export class SvLabelPipe implements PipeTransform {
  private readonly locale = inject(SV_LOCALE);

  transform(template: string, params?: SvLabelParams): string {
    return svFormatLabel(template, params ?? {}, this.locale);
  }
}
