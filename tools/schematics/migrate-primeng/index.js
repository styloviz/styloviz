'use strict';
/**
 * `ng g @styloviz/schematics:migrate-primeng` — PrimeNG 21 → Styloviz (FL-B7).
 *
 * Applies the selector map styloviz.dev/primeng-alternative renders (map.json,
 * generated from the same source by scripts/generate-primeng-map.mjs):
 *
 *   • templates      `<p-table …>` → `<sv-data-table …>` and its closing tag, in
 *                    .html files and inline `template:` literals;
 *   • components     a component whose template now uses Styloviz selectors
 *                    imports their classes from their packages, and drops the
 *                    PrimeNG modules and components it imported;
 *   • package.json   the Styloviz packages now used are added.
 *
 * It does NOT translate inputs — `[value]` on p-table is `[rows]` on
 * sv-data-table — and says so: every migrated selector is listed with its docs
 * page, and every PrimeNG selector it could not map (attribute directives, and
 * components with no equivalent) is reported with the reason, so nothing is
 * changed silently and nothing is left unexplained.
 */
const { posix } = require('node:path');
const MAP = require('./map.json');

const KIT_VERSION = require('../package.json').version;
const ELEMENT_ROWS = MAP.rows.filter((r) => r.kind === 'element');
const ATTRIBUTE_ROWS = MAP.rows.filter((r) => r.kind === 'attribute');
const BY_SELECTOR = new Map(ELEMENT_ROWS.map((r) => [r.primeng, r]));
const GAPS = new Map(MAP.gaps.map((g) => [g.primeng, g.note]));

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Rename every mapped PrimeNG element in a template; returns the rows it used. */
function migrateTemplate(text) {
  const used = new Set();
  let out = text.replace(/<(\/?)(p-[a-z][a-z0-9-]*)(?=[\s/>])/g, (whole, close, tag) => {
    const row = BY_SELECTOR.get(tag);
    if (!row) return whole;
    used.add(row);
    return `<${close}${row.selector}`;
  });
  const leftovers = [...new Set([...out.matchAll(/<(p-[a-z][a-z0-9-]*)(?=[\s/>])/g)].map((m) => m[1]))];
  const attributes = ATTRIBUTE_ROWS.filter((r) => new RegExp(`\\s\\[?${esc(r.primeng.slice(1, -1))}\\]?[\\s=>/]`).test(out));
  return { out, used, leftovers, attributes };
}

/** Add `import { X } from 'pkg';` once, merging into an existing import from the same package. */
function addImport(src, className, pkg) {
  if (new RegExp(`\\b${className}\\b`).test(src.split('@Component')[0])) return src;
  const existing = src.match(new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${esc(pkg)}['"];`));
  if (existing) return src.replace(existing[0], `import {${existing[1].replace(/\s*$/, '')}, ${className} } from '${pkg}';`);
  const imports = [...src.matchAll(/^import[\s\S]*?;\s*$/gm)];
  const at = imports.length ? imports[imports.length - 1].index + imports[imports.length - 1][0].length : 0;
  return `${src.slice(0, at)}${at ? '\n' : ''}import { ${className} } from '${pkg}';${at ? '' : '\n'}${src.slice(at)}`;
}

/**
 * Remove the PrimeNG imports of the components this file no longer uses —
 * `primeng/table` once its `p-table` became `sv-data-table` — and their names
 * from `imports: [...]`. A module the template still needs (a directive it could
 * not migrate, like `pTooltip`) stays.
 */
function dropPrimeng(src, removed, migrated) {
  const names = [];
  src = src.replace(/^import\s*\{([^}]*)\}\s*from\s*['"]primeng\/([\w-]+)['"];\s*\n?/gm, (whole, list, mod) => {
    if (!migrated.has(mod)) return whole;
    for (const n of list.split(',').map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean)) names.push(n);
    return '';
  });
  for (const n of names) {
    removed.add(n);
    src = src.replace(new RegExp(`(imports\\s*:\\s*\\[[^\\]]*?)\\b${esc(n)}\\b\\s*,?\\s*`, 'g'), '$1');
  }
  return src.replace(/imports\s*:\s*\[\s*,/g, 'imports: [');
}

/** Add classes to the first `imports: [...]` of the @Component, creating it if absent. */
function addToComponentImports(src, classNames) {
  if (!classNames.length) return src;
  const decorator = src.match(/@Component\(\s*\{/);
  if (!decorator) return src;
  const after = src.slice(decorator.index);
  const list = after.match(/imports\s*:\s*\[([\s\S]*?)\]/);
  const missing = classNames.filter((c) => !(list && new RegExp(`\\b${c}\\b`).test(list[1])));
  if (!missing.length) return src;
  if (list) {
    const at = decorator.index + list.index + list[0].length - 1;
    const body = list[1].trim();
    return `${src.slice(0, at)}${body && !body.endsWith(',') ? ', ' : body ? ' ' : ''}${missing.join(', ')}${src.slice(at)}`;
  }
  const at = decorator.index + decorator[0].length;
  return `${src.slice(0, at)}\n  imports: [${missing.join(', ')}],${src.slice(at)}`;
}

/** @param {{ path?: string, addDependencies?: boolean }} options */
function migratePrimeng(options = {}) {
  return (tree, context) => {
    const root = posix.join('/', options.path ?? '/');
    const report = { files: 0, used: new Map(), leftovers: new Map(), attributes: new Map(), removed: new Set() };
    const templateUse = new Map(); // .html path → rows used
    const note = (map, key, file) => map.set(key, [...(map.get(key) ?? []), file]);

    // Templates in .html files first, so a component can learn what its templateUrl now uses.
    tree.getDir(root).visit((path) => {
      if (/node_modules|\/dist\//.test(path) || !path.endsWith('.html')) return;
      const text = tree.read(path).toString('utf8');
      const { out, used, leftovers, attributes } = migrateTemplate(text);
      for (const l of leftovers) note(report.leftovers, l, path);
      for (const a of attributes) note(report.attributes, a.primeng, path);
      if (!used.size) return;
      tree.overwrite(path, out);
      report.files++;
      templateUse.set(path, used);
      for (const r of used) note(report.used, r.primeng, path);
    });

    tree.getDir(root).visit((path) => {
      if (/node_modules|\/dist\//.test(path) || !path.endsWith('.ts') || path.endsWith('.spec.ts')) return;
      let src = tree.read(path).toString('utf8');
      if (!/@Component\(/.test(src) && !/from\s*['"]primeng\//.test(src)) return;
      const used = new Set();
      // Inline template.
      src = src.replace(/(template\s*:\s*`)([\s\S]*?)(`)/, (whole, open, body, close) => {
        const r = migrateTemplate(body);
        for (const row of r.used) used.add(row);
        for (const l of r.leftovers) note(report.leftovers, l, path);
        for (const a of r.attributes) note(report.attributes, a.primeng, path);
        for (const row of r.used) note(report.used, row.primeng, path);
        return `${open}${r.out}${close}`;
      });
      // External template.
      const url = src.match(/templateUrl\s*:\s*['"]([^'"]+)['"]/)?.[1];
      if (url) for (const row of templateUse.get(posix.join(posix.dirname(path), url)) ?? []) used.add(row);

      const before = src;
      if (used.size) {
        src = dropPrimeng(src, report.removed, new Set([...used].map((r) => r.primeng.slice(2))));
        const rows = [...used];
        for (const r of rows) src = addImport(src, r.className, r.importFrom || r.package);
        src = addToComponentImports(src, [...new Set(rows.map((r) => r.className))]);
      }
      if (src !== before || used.size) {
        tree.overwrite(path, src);
        report.files++;
      }
    });

    // package.json: the Styloviz packages now in use.
    const packages = new Set([...report.used.keys()].map((sel) => BY_SELECTOR.get(sel).package));
    if (options.addDependencies !== false && packages.size && tree.exists('/package.json')) {
      const pkg = JSON.parse(tree.read('/package.json').toString('utf8'));
      pkg.dependencies = pkg.dependencies ?? {};
      for (const p of ['@styloviz/core', ...packages]) if (!pkg.dependencies[p]) pkg.dependencies[p] = `^${KIT_VERSION}`;
      pkg.dependencies = Object.fromEntries(Object.entries(pkg.dependencies).sort(([a], [b]) => a.localeCompare(b)));
      tree.overwrite('/package.json', `${JSON.stringify(pkg, null, 2)}\n`);
    }

    // ── Report ──
    const log = context.logger;
    log.info(`Styloviz migrate-primeng — ${report.used.size} PrimeNG selector(s) migrated in ${report.files} file(s).`);
    for (const [sel, files] of report.used) {
      const r = BY_SELECTOR.get(sel);
      log.info(`  ✔ ${sel} → ${r.selector} (${r.package}${r.tier === 'pro' ? ', Pro' : ''}) in ${new Set(files).size} file(s). Check its inputs: ${r.docsUrl}${r.note ? ` — ${r.note}` : ''}`);
    }
    if (report.removed.size) log.info(`  ✔ Removed PrimeNG imports: ${[...report.removed].sort().join(', ')}`);
    for (const [sel, files] of report.attributes) {
      const r = ATTRIBUTE_ROWS.find((x) => x.primeng === sel);
      log.warn(`  ! ${sel} is a directive; move it to ${r.selector} by hand (${r.docsUrl}) — ${[...new Set(files)].join(', ')}`);
    }
    for (const [sel, files] of report.leftovers) {
      const why = GAPS.get(sel);
      log.warn(`  ! ${sel} was not migrated: ${why ?? 'it is not in the Styloviz map'} — ${[...new Set(files)].join(', ')}`);
    }
    if (packages.size) log.info('  Run your package manager to install the Styloviz packages, then build and fix the inputs the docs links above describe.');
    return tree;
  };
}

module.exports = { migratePrimeng, migrateTemplate };
