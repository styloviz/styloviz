#!/usr/bin/env node
/**
 * The public mirror's npm publish, run by its release.yml on a `v*` tag over
 * trusted publishing (OIDC, no token), with provenance. Copied into the mirror
 * as scripts/publish.mjs by stage-public-mirror.mjs.
 *
 *   • The tag must name the version in package.json, so a stray tag publishes nothing.
 *   • @styloviz/core first, then every other package, then the @styloviz/all
 *     bundle last: the bundle pins every member at this exact version.
 *   • A version already on npm is skipped, so a failed run is re-run as is.
 *
 * `--dry` packs instead of publishing (no auth, no tag needed).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DRY = process.argv.includes('--dry');
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const tag = process.env.GITHUB_REF_NAME;

if (!DRY && tag !== `v${version}`) {
  console.error(`✗ tag ${tag ?? '(none)'} does not match package.json version ${version} (expected v${version}).`);
  process.exit(1);
}

const root = join('dist', '@styloviz');
if (!existsSync(root)) {
  console.error('✗ no dist/@styloviz — run `npm run build` first.');
  process.exit(1);
}
const dirs = readdirSync(root)
  .map((name) => join(root, name))
  .sort((a, b) => Number(b.endsWith('/core')) - Number(a.endsWith('/core')));
dirs.push(join('bundle', 'free'));

const published = (name) => {
  try {
    return execFileSync('npm', ['view', `${name}@${version}`, 'version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() === version;
  } catch {
    return false;
  }
};

const failed = [];
let done = 0;
let skipped = 0;
for (const dir of dirs) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  if (pkg.version !== version) {
    console.error(`✗ ${pkg.name} is ${pkg.version}, not ${version}`);
    failed.push(pkg.name);
    continue;
  }
  if (!DRY && published(pkg.name)) {
    console.log(`= ${pkg.name}@${version} already on npm`);
    skipped++;
    continue;
  }
  const args = [...(DRY ? ['pack', '--dry-run'] : ['publish', '--access', 'public', '--provenance']), '--loglevel=warn'];
  try {
    execFileSync('npm', args, { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'] });
    console.log(`${DRY ? '✓ packs' : '✓ published'} ${pkg.name}@${version}`);
    done++;
  } catch {
    console.error(`✗ ${pkg.name}@${version} failed`);
    failed.push(pkg.name);
  }
}

if (failed.length) {
  console.error(`\n✗ ${failed.length} package(s) failed: ${failed.join(', ')} — fix, then re-run the workflow.`);
  process.exit(1);
}
console.log(`\n✅ ${done} ${DRY ? 'would publish' : 'published'}, ${skipped} already on npm (${dirs.length} packages, v${version}).`);
