'use strict';
/**
 * `ng add @styloviz/core` — make a fresh Angular app render Styloviz (FL-B7).
 *
 *   1. dependencies   @styloviz/core, @styloviz/icons, @styloviz/button (the demo)
 *                     and Tailwind 4 (tailwindcss, @tailwindcss/postcss, postcss).
 *                     Only what is MISSING is added: a version the app already
 *                     pins — or a local tarball it installed from — is kept.
 *   2. .postcssrc.json  the Tailwind 4 PostCSS plugin, when the app has no PostCSS config.
 *   3. global styles  `@import "tailwindcss"`, the kit stylesheet (tokens, the
 *                     class-based dark variant, component CSS) and an `@source`
 *                     for the kit's templates, prepended once.
 *   4. app.config.ts  `provideStyloviz()` in the providers.
 *   5. demo page      /styloviz, a standalone page with a few buttons, routed
 *                     lazily — the proof the setup works, and a thing to delete.
 *   6. angular.json   `allowedCommonJsDependencies` gains the CommonJS modules
 *                     jspdf pulls in (the kit's PDF/PNG export loads it lazily).
 *                     Without them the first production build after adding an
 *                     export feature prints ~18 warnings the app cannot act on
 *                     (FL-L2). The templates ship the same list.
 *
 * Every step is idempotent: running it twice changes nothing the second time.
 */
const { SchematicsException } = require('@angular-devkit/schematics');
const { NodePackageInstallTask } = require('@angular-devkit/schematics/tasks');
const { posix } = require('node:path');

const KIT_VERSION = require('../package.json').version;

const DEPENDENCIES = {
  '@styloviz/core': `^${KIT_VERSION}`,
  '@styloviz/icons': `^${KIT_VERSION}`,
  '@styloviz/button': `^${KIT_VERSION}`,
};
const DEV_DEPENDENCIES = {
  tailwindcss: '^4.1.0',
  '@tailwindcss/postcss': '^4.1.0',
  postcss: '^8.5.0',
};

/** jspdf's CommonJS modules — the same list scripts/lib/template-project.mjs gives the templates. */
const EXPORT_COMMONJS = ['html2canvas', 'canvg', 'raf', 'rgbcolor', 'core-js'];

function readJson(tree, path) {
  const buf = tree.read(path);
  if (!buf) return null;
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw new SchematicsException(`${path} is not valid JSON.`);
  }
}

function addDependencies(tree, context) {
  const pkg = readJson(tree, '/package.json');
  if (!pkg) throw new SchematicsException('No package.json at the workspace root.');
  const added = [];
  for (const [section, wanted] of [['dependencies', DEPENDENCIES], ['devDependencies', DEV_DEPENDENCIES]]) {
    pkg[section] = pkg[section] ?? {};
    for (const [name, range] of Object.entries(wanted)) {
      if (pkg.dependencies?.[name] || pkg.devDependencies?.[name]) continue;
      pkg[section][name] = range;
      added.push(name);
    }
    pkg[section] = Object.fromEntries(Object.entries(pkg[section]).sort(([a], [b]) => a.localeCompare(b)));
  }
  tree.overwrite('/package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  if (added.length) context.logger.info(`✔ Added ${added.join(', ')}`);
  return added.length > 0;
}

/** The app to set up, and where its files are. */
function resolveProject(tree, options) {
  const workspace = readJson(tree, '/angular.json');
  if (!workspace) throw new SchematicsException('No angular.json — run this inside an Angular workspace.');
  const name =
    options.project ||
    Object.keys(workspace.projects).find((p) => workspace.projects[p].projectType === 'application');
  const project = name && workspace.projects[name];
  if (!project) throw new SchematicsException(`No application project ${options.project ? `"${options.project}" ` : ''}in angular.json.`);
  const root = project.root || '';
  const sourceRoot = project.sourceRoot || posix.join(root, 'src');
  const build = project.architect?.build ?? project.targets?.build;
  const styles = (build?.options?.styles ?? [])
    .map((s) => (typeof s === 'string' ? s : s.input))
    .find((s) => /\.css$/.test(s));
  return { name, root, sourceRoot, styles: styles ?? posix.join(sourceRoot, 'styles.css') };
}

function addPostcssConfig(tree, context, root) {
  const has = ['.postcssrc.json', 'postcss.config.js', 'postcss.config.mjs', 'postcss.config.cjs'].some((f) => tree.exists(posix.join('/', root, f)) || tree.exists(`/${f}`));
  if (has) return;
  tree.create(posix.join('/', root, '.postcssrc.json'), `${JSON.stringify({ plugins: { '@tailwindcss/postcss': {} } }, null, 2)}\n`);
  context.logger.info('✔ Created .postcssrc.json (Tailwind 4 PostCSS plugin)');
}

function addStyles(tree, context, stylesPath) {
  const path = `/${stylesPath.replace(/^\/+/, '')}`;
  const current = tree.exists(path) ? tree.read(path).toString('utf8') : '';
  const toNodeModules = posix.relative(posix.dirname(path), '/node_modules') || 'node_modules';
  // Quote-agnostic: the CLI may reformat what this wrote with single quotes.
  const lines = [
    [/@import\s+['"]tailwindcss['"]/, `@import "tailwindcss";`],
    [/@styloviz\/core\/styles\/styloviz\.css/, `@import "@styloviz/core/styles/styloviz.css";`],
    [/@source\s+['"][^'"]*node_modules\/@styloviz['"]/, `@source "${toNodeModules}/@styloviz";`],
  ].filter(([marker]) => !marker.test(current)).map(([, line]) => line);
  if (!lines.length) return;
  const next = `${lines.join('\n')}\n${current ? `\n${current}` : ''}`;
  if (tree.exists(path)) tree.overwrite(path, next);
  else tree.create(path, next);
  context.logger.info(`✔ ${posix.basename(path)}: Tailwind 4, the Styloviz stylesheet and @source`);
}

function addProvider(tree, context, sourceRoot) {
  const path = posix.join('/', sourceRoot, 'app/app.config.ts');
  if (!tree.exists(path)) {
    context.logger.warn(`! No ${path}: add provideStyloviz() from '@styloviz/core' to your application providers.`);
    return;
  }
  let src = tree.read(path).toString('utf8');
  if (src.includes('provideStyloviz(')) return;
  const providers = src.match(/providers\s*:\s*\[/);
  if (!providers) {
    context.logger.warn(`! ${path} has no providers array: add provideStyloviz() from '@styloviz/core' yourself.`);
    return;
  }
  const at = providers.index + providers[0].length;
  src = `${src.slice(0, at)}\n    provideStyloviz(),${src.slice(at)}`;
  src = `import { provideStyloviz } from '@styloviz/core';\n${src}`;
  tree.overwrite(path, src);
  context.logger.info('✔ app.config.ts: provideStyloviz()');
}

const DEMO = `import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { SvButtonComponent } from '@styloviz/button';

/**
 * Added by \`ng add @styloviz/core\` to prove the setup renders. Delete it — and
 * its route in app.routes.ts — once you have your own pages.
 */
@Component({
  selector: 'app-styloviz-demo',
  imports: [SvButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    <main class="mx-auto max-w-2xl space-y-6 p-8">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Styloviz is set up</h1>
      <p class="text-gray-600 dark:text-gray-300">
        Tailwind 4, the Styloviz tokens and the kit stylesheet are loaded. Browse the components at
        <a class="font-semibold text-primary-600 underline" href="https://styloviz.dev/components">styloviz.dev</a>.
      </p>
      <div class="flex flex-wrap gap-3">
        <sv-button label="Primary" (clicked)="clicks.set(clicks() + 1)" />
        <sv-button label="Secondary" variant="secondary" />
        <sv-button label="Outline" btnStyle="outline" />
      </div>
      <p class="text-sm text-gray-500" aria-live="polite">Clicked {{ clicks() }} time(s).</p>
    </main>
  \`,
})
export class StylovizDemoComponent {
  protected readonly clicks = signal(0);
}
`;

function addDemo(tree, context, sourceRoot) {
  const file = posix.join('/', sourceRoot, 'app/styloviz-demo/styloviz-demo.component.ts');
  if (!tree.exists(file)) tree.create(file, DEMO);
  const routes = posix.join('/', sourceRoot, 'app/app.routes.ts');
  if (!tree.exists(routes)) {
    context.logger.warn(`! No ${routes}: route StylovizDemoComponent yourself to see the demo page.`);
    return;
  }
  let src = tree.read(routes).toString('utf8');
  if (src.includes('styloviz-demo')) return;
  const list = src.match(/:\s*Routes\s*=\s*\[/);
  if (!list) {
    context.logger.warn(`! ${routes} has no Routes array: route StylovizDemoComponent yourself.`);
    return;
  }
  const at = list.index + list[0].length;
  src = `${src.slice(0, at)}\n  {\n    path: 'styloviz',\n    loadComponent: () => import('./styloviz-demo/styloviz-demo.component').then((m) => m.StylovizDemoComponent),\n  },${src.slice(at)}`;
  tree.overwrite(routes, src);
  context.logger.info('✔ Demo page at /styloviz');
}

function allowExportCommonJs(tree, context, projectName) {
  const workspace = readJson(tree, '/angular.json');
  const project = workspace?.projects?.[projectName];
  const build = project?.architect?.build ?? project?.targets?.build;
  if (!build) return;
  build.options = build.options ?? {};
  const allowed = build.options.allowedCommonJsDependencies ?? [];
  const missing = EXPORT_COMMONJS.filter((m) => !allowed.includes(m));
  if (!missing.length) return;
  build.options.allowedCommonJsDependencies = [...allowed, ...missing];
  tree.overwrite('/angular.json', `${JSON.stringify(workspace, null, 2)}\n`);
  context.logger.info(`✔ angular.json: allowed jspdf's CommonJS modules (${missing.join(', ')})`);
}

/** @param {{ project?: string, demo?: boolean, skipInstall?: boolean }} options */
function ngAdd(options = {}) {
  return (tree, context) => {
    const project = resolveProject(tree, options);
    const changed = addDependencies(tree, context);
    addPostcssConfig(tree, context, project.root);
    addStyles(tree, context, project.styles);
    addProvider(tree, context, project.sourceRoot);
    if (options.demo !== false) addDemo(tree, context, project.sourceRoot);
    allowExportCommonJs(tree, context, project.name);
    if (changed && !options.skipInstall) context.addTask(new NodePackageInstallTask());
    context.logger.info('Styloviz is set up. Docs: https://styloviz.dev/docs — or connect the MCP server: npx -y @styloviz/mcp');
    return tree;
  };
}

module.exports = { ngAdd };
