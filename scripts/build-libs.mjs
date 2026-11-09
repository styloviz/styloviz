#!/usr/bin/env node
// ============================================================================
//  build-libs.mjs — build every @styloviz library in dependency order.
//  ----------------------------------------------------------------------------
//  Library builds (ng-packagr) resolve cross-library imports from `dist/`, so
//  a dependency must be built BEFORE any library that imports it. This script
//  infers the dependency graph from the `@styloviz/*` imports in each project's
//  source, topologically sorts it (deps first), and builds in that order.
//
//  Usage:
//    node scripts/build-libs.mjs         # build all libraries in order
//    node scripts/build-libs.mjs --dry   # print the order only, don't build
//    node scripts/build-libs.mjs <name>  # build <name> and its deps, in order
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { emitGlyphModules } from './lib/glyph-modules.mjs';
import { stripTicketIdsInDir } from './lib/ticket-ids.mjs';
import { packageSourceDirs } from './lib/package-sources.mjs';

const ROOT = process.cwd();

/**
 * `ng update` / `ng add` support in each built package (FL-B7). Every manifest
 * declares `ng-update.migrations: ./schematics/migration.json`; the file is
 * written here rather than kept 107 times in the repo. @styloviz/core carries
 * the real collection — the 2.0 migrations and `ng add` — copied from
 * tools/schematics (the @styloviz/schematics source); the others ship an empty
 * one, so a migration runs once however many kit packages `ng update` moves.
 * The nested package.json makes the folder CommonJS: a library's dist is ESM.
 */
function writeSchematics(dir) {
  const ngPackage = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, dir, 'ng-package.json'), 'utf8'));
  const dist = path.resolve(PROJECTS_DIR, dir, ngPackage.dest);
  const pkg = JSON.parse(fs.readFileSync(path.join(dist, 'package.json'), 'utf8'));
  if (!pkg['ng-update']) return;
  const out = path.join(dist, 'schematics');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'package.json'), `${JSON.stringify({ type: 'commonjs', version: pkg.version }, null, 2)}\n`);
  if (pkg.name !== '@styloviz/core') {
    fs.writeFileSync(path.join(out, 'migration.json'), `${JSON.stringify({ schematics: {} }, null, 2)}\n`);
    return;
  }
  const src = path.join(ROOT, 'tools', 'schematics');
  for (const entry of ['migration.json', 'migrations', 'ng-add']) {
    fs.cpSync(path.join(src, entry), path.join(out, entry), { recursive: true });
  }
  const collection = JSON.parse(fs.readFileSync(path.join(src, 'collection.json'), 'utf8'));
  fs.writeFileSync(
    path.join(out, 'collection.json'),
    `${JSON.stringify({ schematics: { 'ng-add': collection.schematics['ng-add'] } }, null, 2)}\n`,
  );
}
const PROJECTS_DIR = path.join(ROOT, 'projects');
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const only = args.find((a) => !a.startsWith('--'));

// Only build directories that are actually registered as Angular projects
// (some project folders exist on disk but have no angular.json build target).
const ngProjects = new Set(
  Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'angular.json'), 'utf8')).projects || {}),
);

const dirs = fs
  .readdirSync(PROJECTS_DIR)
  .filter((d) => fs.existsSync(path.join(PROJECTS_DIR, d, 'package.json')))
  .filter((d) => ngProjects.has(d));

// package name -> project directory
const nameToDir = {};
for (const d of dirs) {
  const pkg = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, d, 'package.json'), 'utf8'));
  nameToDir[pkg.name] = d;
}

// project directory -> set of @styloviz specifiers it imports
const importsByDir = {};
for (const d of dirs) {
  const set = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.ts$/.test(e.name) && !/\.spec\./.test(e.name)) {
        const t = fs.readFileSync(p, 'utf8');
        // Match both scopes: free `@styloviz/x` and Pro `@styloviz-pro/x`.
        // Missing the `-pro` scope here means `@styloviz/pro` (which imports
        // `@styloviz-pro/*`) gets no detected deps and builds before them,
        // failing with TS2307 on the not-yet-built dist type declarations.
        // A secondary entry point (`@styloviz/core/data`) is a dependency on its package (FL-L2-01).
        for (const m of t.matchAll(/from ['"](@styloviz(?:-pro)?\/[a-z0-9-]+)(?:\/[a-z0-9-]+)?['"]/g)) set.add(m[1]);
      }
    }
  };
  for (const src of packageSourceDirs(path.join(PROJECTS_DIR, '..'), d)) walk(src);
  importsByDir[d] = set;
}

// dependency edges: dir -> set of dependency dirs (ignore self-references)
const deps = {};
for (const d of dirs) {
  deps[d] = new Set();
  for (const imp of importsByDir[d]) {
    const dep = nameToDir[imp];
    if (dep && dep !== d) deps[d].add(dep);
  }
}

// topological sort (deps first) with cycle guard
const order = [];
const state = {}; // undefined = unseen, 1 = visiting, 2 = done
const visit = (d, stack = []) => {
  if (state[d] === 2) return;
  if (state[d] === 1) {
    console.warn(`⚠ dependency cycle: ${[...stack, d].join(' → ')} (edge skipped)`);
    return;
  }
  state[d] = 1;
  for (const dep of deps[d]) visit(dep, [...stack, d]);
  state[d] = 2;
  order.push(d);
};

if (only) {
  if (!dirs.includes(only)) {
    console.error(`Unknown project "${only}". Known: ${dirs.join(', ')}`);
    process.exit(1);
  }
  visit(only);
} else {
  for (const d of dirs) visit(d);
}

console.log(`Build order (${order.length} librar${order.length === 1 ? 'y' : 'ies'}):`);
console.log(order.map((d, i) => `  ${String(i + 1).padStart(2)}. ${d}`).join('\n'));

if (dry) process.exit(0);

for (const d of order) {
  console.log(`\n▶ ng build ${d}`);
  execSync(`node_modules/.bin/ng build ${d}`, { stdio: 'inherit' });
  writeSchematics(d);
  // The icon packages get one real module per glyph (scripts/lib/glyph-modules.mjs).
  const glyphs = emitGlyphModules(ROOT, d);
  if (glyphs) console.log(`  ✓ ${glyphs} per-glyph modules`);
  // ★ FL-L1-07: the JSDoc cites tracker rows (`FL-B4`, `SR-27b`) a buyer sees in
  //   every IDE hover and cannot look up. The source keeps them; the build
  //   does not ship them, and an id it cannot strip (one in a string) fails it.
  const ngPackage = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, d, 'ng-package.json'), 'utf8'));
  const { changed, leftovers } = stripTicketIdsInDir(path.resolve(PROJECTS_DIR, d, ngPackage.dest));
  if (leftovers.length) {
    console.error(`\n✖ ${d}: tracker ids left in the built package — move them out of the string:`);
    for (const l of leftovers) console.error(`  ${path.relative(ROOT, l.file)}: ${l.ids.join(', ')}`);
    process.exit(1);
  }
  if (changed.length) console.log(`  ✓ tracker ids stripped from ${changed.length} file(s)`);
}
console.log(`\n✔ Built ${order.length} librar${order.length === 1 ? 'y' : 'ies'} successfully.`);
