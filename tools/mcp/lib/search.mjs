/**
 * The Styloviz knowledge base: one generated index (data/index.json) and the
 * lookups the MCP tools answer with. Pure functions over plain data, so the
 * server, the CLI and the tests all ask the same questions the same way.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** @returns {any} the generated index. */
export function loadIndex(file = join(HERE, '..', 'data', 'index.json')) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

const STOP = new Set(['a', 'an', 'and', 'the', 'of', 'to', 'in', 'for', 'with', 'on', 'by', 'is', 'how', 'i', 'do', 'use', 'using', 'my', 'component', 'components', 'sv']);

/** A light stem: "tables" → "table", "grouping" → "group", so a question meets the docs' wording. */
function stem(t) {
  if (t.length > 5 && t.endsWith('ing')) return t.slice(0, -3);
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

/** Lower-case word stems; camelCase API names split, so `groupBy` answers "group". */
export function tokens(text) {
  return String(text ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[`'"]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOP.has(t))
    .map(stem);
}

/** Where a word can be found in a component, and what finding it there is worth. */
const FIELDS = [
  ['name', 6, (c) => c.name],
  ['selector', 4, (c) => c.selector],
  ['id', 4, (c) => c.id],
  ['tags', 3, (c) => c.tags.join(' ')],
  ['category', 1, (c) => c.category],
  ['description', 2, (c) => c.description],
  ['whenToUse', 1.5, (c) => c.whenToUse.join(' ')],
  ['variants', 2, (c) => c.variants.join(' ')],
  ['examples', 2, (c) => c.examples.map((e) => `${e.title} ${e.description}`).join(' ')],
  ['customization', 1, (c) => c.customization.join(' ')],
  ['api', 1, (c) => [c.api.free, c.api.pro].filter(Boolean).flatMap((a) => [...a.inputs, ...a.outputs].map((p) => p.name)).join(' ')],
];

const cache = new WeakMap();
function fieldTokens(component) {
  let entry = cache.get(component);
  if (!entry) {
    entry = FIELDS.map(([field, weight, get]) => ({ field, weight, words: new Set(tokens(get(component))) }));
    cache.set(component, entry);
  }
  return entry;
}

/**
 * Rank components for a free-text question. Every query word must appear
 * SOMEWHERE in a component for it to match fully; a component missing a word
 * still ranks, below every component that has them all.
 */
export function rankComponents(index, query) {
  const words = [...new Set(tokens(query))];
  if (!words.length) return [];
  const phrase = String(query).toLowerCase().trim();
  return index.components
    .map((c) => {
      const fields = fieldTokens(c);
      let score = 0;
      let covered = 0;
      for (const w of words) {
        let best = 0;
        for (const f of fields) if (f.words.has(w)) best = Math.max(best, f.weight);
        if (best) covered++;
        score += best;
        // A word that is the component's whole subject counts once more in its name.
        for (const f of fields) if (f.words.has(w) && f.field !== 'name') score += f.weight * 0.15;
      }
      if (c.name.toLowerCase() === phrase || c.id === phrase.replace(/\s+/g, '-')) score += 20;
      const rank = covered === words.length ? score + 100 : score;
      return { c, score: rank, covered };
    })
    .filter((r) => r.covered > 0)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
}

/** The facts a search result carries: enough to pick it, with the snippet to paste. */
/** The worked example that is about what was asked, if the docs have one. */
function bestExample(c, words) {
  const named = new Set(tokens(c.name));
  const aspect = words.filter((w) => !named.has(w));
  if (!aspect.length) return null;
  const hit = c.examples
    .map((e) => ({ e, n: aspect.filter((w) => new Set(tokens(`${e.title} ${e.description} ${e.code}`)).has(w)).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)[0];
  return hit ? { title: hit.e.title, code: hit.e.code } : null;
}

export function summary(c, words = [], index) {
  const api = c.api.free ?? c.api.pro;
  const why = words.length ? matchingLines(c, words, index) : [];
  const example = words.length ? bestExample(c, words) : null;
  return {
    name: c.name,
    selector: c.selector,
    package: api?.importPath ?? null,
    ...(c.api.free && c.api.pro ? { proPackage: c.api.pro.importPath, proSelector: c.proSelector ?? c.selector } : {}),
    tier: c.tier,
    category: c.category,
    description: c.description,
    docsUrl: c.docsUrl,
    demoUrl: c.demoUrl,
    snippet: c.usage,
    ...(example ? { example } : {}),
    ...(why.length ? { matches: why } : {}),
  };
}

/** The demo titles and documented notes that contain the query words — why it matched. */
const rarity = new WeakMap();
/** How rare each word is across the kit (1 / components using it) — "group" says more than "table". */
function rarityOf(index) {
  let map = rarity.get(index);
  if (!map) {
    const df = new Map();
    for (const c of index.components) {
      const seen = new Set(fieldTokens(c).flatMap((f) => [...f.words]));
      for (const w of seen) df.set(w, (df.get(w) ?? 0) + 1);
    }
    map = (w) => 1 / (df.get(w) ?? 1);
    rarity.set(index, map);
  }
  return map;
}

function matchingLines(c, words, index) {
  const weight = index ? rarityOf(index) : () => 1;
  // The words that are not the component's own name are what was asked ABOUT
  // it — "grouping" in "data table grouping". A line with none of them says
  // nothing about why this component answers the question.
  const named = new Set(tokens(c.name));
  const aspect = words.filter((w) => !named.has(w));
  const keys = aspect.length ? aspect : words;
  const score = (s) => {
    const t = new Set(tokens(s));
    return keys.some((k) => t.has(k)) ? words.filter((w) => t.has(w)).reduce((sum, w) => sum + weight(w), 0) : 0;
  };
  const lines = [
    ...c.variants.map((v) => ({ text: `demo: ${v}`, n: score(v), headline: true })),
    ...c.examples.map((e) => ({ text: `example: ${e.title}`, n: score(`${e.title} ${e.description}`), headline: true })),
    ...c.customization.map((s) => ({ text: s.replace(/\*\*/g, '').slice(0, 220), n: score(s), headline: false })),
  ].filter((l) => l.n > 0);
  return lines
    .sort((a, b) => Number(b.headline) - Number(a.headline) || b.n - a.n)
    .slice(0, 4)
    .map((l) => l.text);
}

/** Free-text search over components, templates and blocks. */
export function search(index, query, limit = 5) {
  const words = [...new Set(tokens(query))];
  const components = rankComponents(index, query).slice(0, limit).map((r) => summary(r.c, words, index));
  const templates = index.templates
    .map((t) => ({ t, n: words.filter((w) => new Set(tokens(`${t.id} ${t.title} ${t.description}`)).has(w)).length }))
    .filter((x) => x.n === words.length && words.length > 0)
    .slice(0, 3)
    .map(({ t }) => t);
  const blocks = words.length ? matchBlocks(index, words).slice(0, 3).map(blockSummary) : [];
  return { query, components, templates, blocks };
}

/** Blocks whose id, title, description or category contain every word. */
function matchBlocks(index, words) {
  return (index.blocks ?? []).filter((b) => {
    const have = new Set(tokens(`${b.id} ${b.title} ${b.description} ${b.category} ${b.categoryTitle}`));
    return words.every((w) => have.has(w));
  });
}

/** A block without its code. */
const blockSummary = ({ code, ...rest }) => ({ ...rest, hasCode: code !== null });

/** The blocks catalogue, optionally narrowed by category words and tier. */
export function listBlocks(index, { category, tier } = {}) {
  const cat = category ? tokens(category) : [];
  return (index.blocks ?? [])
    .filter((b) => !tier || b.tier === tier)
    .filter((b) => !cat.length || cat.every((w) => tokens(`${b.category} ${b.categoryTitle}`).includes(w)))
    .map(blockSummary);
}

/**
 * One block by id (or by title words): a free block with its whole component
 * file; a Pro block with where to get it — its source is not in this package.
 */
export function getBlock(index, name) {
  const q = String(name ?? '').toLowerCase().trim();
  const all = index.blocks ?? [];
  const b = all.find((x) => x.id === q || x.selector === q || x.title.toLowerCase() === q) ?? matchBlocks(index, tokens(q))[0];
  if (!b) return null;
  return b.code !== null
    ? { ...b, howToUse: `Save as ${b.file} and render <${b.selector} /> — it imports only @angular/* and @styloviz/* packages.` }
    : { ...b, note: `A Pro block: its source is unlocked with a Styloviz Pro licence at ${b.url}.` };
}

/** One component by name, id or selector — the full documented record. */
export function getComponent(index, name) {
  const q = String(name ?? '').toLowerCase().trim();
  const exact = index.components.find(
    (c) => c.id === q || c.selector === q || c.selector === `sv-${q}` || c.name.toLowerCase() === q || c.id === q.replace(/\s+/g, '-'),
  );
  if (exact) return exact;
  // A loose name ("date range picker") resolves to the best match — but only one
  // that contains every word; a stray word must not pick a random component.
  const best = rankComponents(index, q)[0];
  return best && best.covered === new Set(tokens(q)).size ? best.c : null;
}

/** The catalogue, optionally narrowed to a category word or a tier. */
export function listComponents(index, { category, tier } = {}) {
  const cat = category ? tokens(category) : [];
  return index.components
    .filter((c) => !tier || c.tier === tier)
    .filter((c) => !cat.length || cat.every((w) => tokens(c.category).includes(w)))
    .map((c) => ({ name: c.name, selector: c.selector, tier: c.tier, category: c.category, docsUrl: c.docsUrl }));
}

/** A component's demos, optionally only those matching a query. */
export function findVariants(index, name, query) {
  const c = getComponent(index, name);
  if (!c) return null;
  const words = tokens(query);
  const list = words.length ? c.variants.filter((v) => words.every((w) => tokens(v).includes(w))) : c.variants;
  return { component: c.name, demoUrl: c.demoUrl, variants: list, examples: c.examples.filter((e) => !words.length || words.every((w) => tokens(`${e.title} ${e.description}`).includes(w))) };
}

/** Icon names containing every query word, with how to import and register them. */
export function findIcons(index, query, limit = 30) {
  const words = tokens(query);
  const pick = (names) => names.filter((n) => words.every((w) => n.includes(w))).slice(0, limit);
  const camel = (n) => n.replace(/-(\w)/g, (_, ch) => ch.toUpperCase());
  // The import line comes from the index, so the package paths live in one place.
  const line = (pattern, n) => pattern.replace('<kebab-name>', n).replace('<name>', camel(n));
  return {
    free: pick(index.icons.free.names).map((n) => ({ name: n, import: line(index.icons.free.import, n) })),
    pro: pick(index.icons.pro.names).map((n) => ({ name: n, import: line(index.icons.pro.import, n) })),
    register: index.icons.register,
  };
}

/** Theme tokens whose name contains every query word (all of them, without one). */
export function findTokens(index, query) {
  const words = tokens(query);
  return index.tokens.filter((t) => words.every((w) => t.name.includes(w)));
}
