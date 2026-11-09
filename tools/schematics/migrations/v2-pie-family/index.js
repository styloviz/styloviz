'use strict';
/**
 * ng update → 2.0: one pie family (FL-C2).
 *
 * 2.0 renames the pie chart and folds the donut into it:
 *
 *   <sv-default-pie-chart>       → <sv-pie-chart>                     (SvPieChartComponent)
 *   <sv-default-pie-chart-pro>   → <sv-pie-chart-pro>                 (SvPieChartProComponent)
 *   <sv-donut-chart>             → <sv-pie-chart-pro variant="donut"> (SvPieChartProComponent)
 *   DefaultPieChartOptions, DonutChartOptions → PieChartOptions
 *   DonutSlice                               → PieSlice
 *
 * Every one of those is a rename, so it is done for you, in templates (`.html`
 * and inline `template:`) and in TypeScript. A migrated donut also gets
 * `[size]="220"` when it set no size, because the pie's default is 260 and the
 * 1.x donut's was 220. `sv-gradient-donut-chart` is unchanged.
 *
 * Idempotent: nothing it writes matches what it looks for.
 */

const SKIP = /node_modules|\/dist\/|\/\.angular\//;

/** Templates: element names, plus the donut's `variant` and its old default size. */
function migrateTemplate(text) {
  let changed = 0;
  let out = text.replace(/<(\/?)sv-default-pie-chart-pro(?=[\s/>])/g, (_m, slash) => {
    changed++;
    return `<${slash}sv-pie-chart-pro`;
  });
  out = out.replace(/<(\/?)sv-default-pie-chart(?=[\s/>])/g, (_m, slash) => {
    changed++;
    return `<${slash}sv-pie-chart`;
  });
  out = out.replace(/<\/sv-donut-chart\s*>/g, () => {
    changed++;
    return '</sv-pie-chart-pro>';
  });
  // The opening tag up to its end. Attribute values with a bare `>` in them
  // (rare in a chart's bindings) end the match early, which only means the
  // size check below looks at fewer attributes.
  out = out.replace(/<sv-donut-chart(?=[\s/>])([^>]*)>/g, (_m, attrs) => {
    changed++;
    const hasSize = /(^|\s)(\[size\]|size)\s*=/.test(attrs);
    return `<sv-pie-chart-pro variant="donut"${hasSize ? '' : ' [size]="220"'}${attrs}>`;
  });
  return { out, changed };
}

const IDENTIFIERS = [
  [/\bSvDefaultPieChartProComponent\b/g, 'SvPieChartProComponent'],
  [/\bSvDefaultPieChartComponent\b/g, 'SvPieChartComponent'],
  [/\bSvDonutChartComponent\b/g, 'SvPieChartProComponent'],
  [/\bDefaultPieChartOptions\b/g, 'PieChartOptions'],
  [/\bDonutChartOptions\b/g, 'PieChartOptions'],
  [/\bDonutSlice\b/g, 'PieSlice'],
];

/** `import { A, B, A } from '…'` → `import { A, B } from '…'` — two renames can land on one name. */
function dedupeImports(src) {
  return src.replace(/import\s*(type\s*)?\{([^}]*)\}\s*from\s*(['"][^'"]+['"])/g, (whole, typeKw, list, from) => {
    const seen = new Set();
    const kept = [];
    for (const raw of list.split(',')) {
      const spec = raw.trim();
      if (!spec) continue;
      const name = spec.replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim();
      if (seen.has(name)) continue;
      seen.add(name);
      kept.push(spec);
    }
    const rebuilt = `import ${typeKw ?? ''}{ ${kept.join(', ')} } from ${from}`;
    return kept.length === list.split(',').map((s) => s.trim()).filter(Boolean).length ? whole : rebuilt;
  });
}

/** `imports: [A, B, A]` → `imports: [A, B]`, for a standalone component's metadata. */
function dedupeImportsArray(src) {
  return src.replace(/(\bimports\s*:\s*\[)([^\]]*)(\])/g, (whole, open, list, close) => {
    const items = list.split(',');
    const seen = new Set();
    const kept = items.filter((item) => {
      const name = item.trim();
      if (!name) return true;
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
    return kept.length === items.length ? whole : `${open}${kept.join(',')}${close}`;
  });
}

function pieFamily() {
  return (tree, context) => {
    let files = 0;
    let edits = 0;
    tree.getDir('/').visit((path) => {
      if (SKIP.test(path)) return;
      const isHtml = path.endsWith('.html');
      const isTs = path.endsWith('.ts');
      if (!isHtml && !isTs) return;
      const before = tree.read(path).toString('utf8');
      let src = before;
      if (isHtml) {
        const r = migrateTemplate(src);
        src = r.out;
        edits += r.changed;
      } else {
        src = src.replace(/(template\s*:\s*`)([\s\S]*?)(`)/g, (_w, open, body, close) => {
          const r = migrateTemplate(body);
          edits += r.changed;
          return `${open}${r.out}${close}`;
        });
        for (const [re, to] of IDENTIFIERS) {
          src = src.replace(re, () => {
            edits++;
            return to;
          });
        }
        src = dedupeImportsArray(dedupeImports(src));
      }
      if (src !== before) {
        tree.overwrite(path, src);
        files++;
      }
    });
    context.logger.info(
      files
        ? `✔ Styloviz 2.0: moved ${files} file(s) to the pie family (${edits} edit(s)): sv-default-pie-chart → sv-pie-chart, sv-donut-chart → sv-pie-chart-pro variant="donut". The donut now uses the pie's palette and 10px margin; see the CHANGELOG.`
        : 'Styloviz 2.0: no pie or donut chart to rename.',
    );
    return tree;
  };
}

module.exports = { pieFamily, migrateTemplate };
