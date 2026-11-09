'use strict';
/**
 * ng update → 2.0: one name for "what the table does on a phone" (FL-C13).
 *
 *   <sv-data-table [cardOnMobile]="true">   → <sv-data-table responsive="cards">
 *   <sv-data-table cardOnMobile>            → <sv-data-table responsive="cards">
 *   <sv-data-table [cardOnMobile]="false">  → <sv-data-table>
 *   <sv-data-table [cardOnMobile]="expr">   → <sv-data-table [responsive]="(expr) ? 'cards' : 'none'">
 *
 * (and the same on `sv-data-table-pro`) — those are renames, so they are done
 * for you, in `.html` files and inline templates.
 *
 * `sv-record-grid` / `sv-record-grid-pro` became `responsive="records"` on the
 * table itself. That is NOT a rename: the grid wrapped a table you configured
 * inside an `ng-template`, and the two elements have to become one, with
 * `[(sort)]` (one sort) turning into the table's own sort (`sortChange`, a
 * list). Folding two configured elements together by regex would guess, so
 * this migration lists every file that uses one and leaves it to you — the
 * CHANGELOG has the mapping.
 *
 * Idempotent.
 */

const SKIP = /node_modules|\/dist\/|\/\.angular\//;
const TABLE_TAG = /<sv-data-table(?:-pro)?(?=[\s/>])[^>]*>/g;

function migrateTag(tag) {
  let out = tag.replace(/\s\[cardOnMobile\]\s*=\s*"\s*true\s*"/, ' responsive="cards"');
  out = out.replace(/\s\[cardOnMobile\]\s*=\s*"\s*false\s*"/, '');
  out = out.replace(/\s\[cardOnMobile\]\s*=\s*"([^"]*)"/, (_m, expr) => ` [responsive]="(${expr.trim()}) ? 'cards' : 'none'"`);
  out = out.replace(/\scardOnMobile(?=[\s/>])(?!\s*=)/, ' responsive="cards"');
  out = out.replace(/\scardOnMobile\s*=\s*"(?:true)?"/, ' responsive="cards"');
  return out;
}

function migrateTemplate(text) {
  let changed = 0;
  const out = text.replace(TABLE_TAG, (tag) => {
    const next = migrateTag(tag);
    if (next !== tag) changed++;
    return next;
  });
  return { out, changed, recordGrid: /<sv-record-grid(?:-pro)?(?=[\s/>])/.test(text) };
}

function dataTableResponsive() {
  return (tree, context) => {
    let files = 0;
    const recordGrid = [];
    tree.getDir('/').visit((path) => {
      if (SKIP.test(path)) return;
      const isHtml = path.endsWith('.html');
      const isTs = path.endsWith('.ts');
      if (!isHtml && !isTs) return;
      const before = tree.read(path).toString('utf8');
      let src = before;
      let usesGrid = false;
      if (isHtml) {
        const r = migrateTemplate(src);
        src = r.out;
        usesGrid = r.recordGrid;
      } else {
        src = src.replace(/(template\s*:\s*`)([\s\S]*?)(`)/g, (_w, open, body, close) => {
          const r = migrateTemplate(body);
          usesGrid = usesGrid || r.recordGrid;
          return `${open}${r.out}${close}`;
        });
        usesGrid = usesGrid || /\bSvRecordGrid(?:Pro)?Component\b/.test(src);
      }
      if (usesGrid) recordGrid.push(path);
      if (src !== before) {
        tree.overwrite(path, src);
        files++;
      }
    });
    context.logger.info(
      files
        ? `✔ Styloviz 2.0: cardOnMobile → responsive="cards" in ${files} file(s).`
        : 'Styloviz 2.0: no cardOnMobile to rename.',
    );
    for (const path of recordGrid) {
      context.logger.warn(
        `! ${path}: sv-record-grid is now responsive="records" on sv-data-table / sv-data-table-pro. ` +
          'Move the grid\'s inputs onto the table it wrapped (titleKey → recordTitleKey, breakpoint → recordBreakpoint, ' +
          'mode="cards" → recordView="always", [(expandedIds)] → [(recordExpandedIds)], [(selected)] → [(selectedIds)], ' +
          'rowActions → actions) and drop the wrapper — see the 2.0 CHANGELOG.',
      );
    }
    return tree;
  };
}

module.exports = { dataTableResponsive, migrateTemplate };
