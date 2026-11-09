'use strict';
/**
 * ng update → 2.0: icons are registered per glyph (FL-B4).
 *
 * In 1.x `<sv-icon name="bell">` resolved against the whole bundled registry;
 * in 2.0 a name nobody registered renders nothing. The kit's own components
 * register what they draw, but names an APP passes in (a button's `icon`, nav
 * items, its own `<sv-icon>`s) are the app's to register. So an upgraded app is
 * opted into the full set — exactly the 1.x behaviour, nothing disappears — and
 * told how to trim it to the glyphs it uses:
 *
 *   providers: [provideSvIcons(svAllIcons /*, svAllProIcons *\/), …]
 *
 * Idempotent; an app that already calls provideSvIcons is left alone.
 */
const { posix } = require('node:path');
const IMPORTS = require('./imports.json');

function registerIcons() {
  return (tree, context) => {
    const workspace = tree.exists('/angular.json') ? JSON.parse(tree.read('/angular.json').toString('utf8')) : { projects: {} };
    const pkg = tree.exists('/package.json') ? JSON.parse(tree.read('/package.json').toString('utf8')) : {};
    const hasPro = !!(pkg.dependencies?.[IMPORTS.pro.package] || pkg.devDependencies?.[IMPORTS.pro.package]);
    let touched = 0;
    for (const project of Object.values(workspace.projects ?? {})) {
      if (project.projectType !== 'application') continue;
      const config = posix.join('/', project.sourceRoot || posix.join(project.root || '', 'src'), 'app/app.config.ts');
      if (!tree.exists(config)) continue;
      let src = tree.read(config).toString('utf8');
      if (src.includes('provideSvIcons(')) continue;
      const providers = src.match(/providers\s*:\s*\[/);
      if (!providers) {
        context.logger.warn(`! ${config}: add provideSvIcons(svAllIcons) from '@styloviz/icons' to your providers (2.0 registers icons per glyph).`);
        continue;
      }
      const sets = [...IMPORTS.free.names, ...(hasPro ? IMPORTS.pro.names : [])].join(', ');
      const at = providers.index + providers[0].length;
      src = `${src.slice(0, at)}\n    // Styloviz 2.0: the full glyph set, as 1.x had. Trim to the glyphs you use: provideSvIcons([bellIcon, …]).\n    provideSvIcons(${sets}),${src.slice(at)}`;
      src = `${IMPORTS.free.import}\n${hasPro ? `${IMPORTS.pro.import}\n` : ''}${src}`;
      tree.overwrite(config, src);
      touched++;
    }
    context.logger.info(
      touched
        ? `✔ Styloviz 2.0: registered the full glyph set in ${touched} app config(s). Every icon keeps rendering; see https://styloviz.dev/docs/icon-library to register only what you use.`
        : 'Styloviz 2.0: no app config needed the icon registration.',
    );
    return tree;
  };
}

module.exports = { registerIcons };
