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

const ROOT = process.cwd();
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
  const src = path.join(PROJECTS_DIR, d, 'src');
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
        for (const m of t.matchAll(/from ['"](@styloviz(?:-pro)?\/[a-z0-9-]+)['"]/g)) set.add(m[1]);
      }
    }
  };
  if (fs.existsSync(src)) walk(src);
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
}
console.log(`\n✔ Built ${order.length} librar${order.length === 1 ? 'y' : 'ies'} successfully.`);
