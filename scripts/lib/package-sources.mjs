/**
 * package-sources.mjs — where a library project's source lives.
 *
 * ★ NOT ONLY `src/`. A package with secondary entry points keeps each one in a
 *   folder of its own beside `src/` — `@styloviz/core/data` is
 *   `projects/core/data/` (FL-L2-01) — and a scan that walks `src/` alone
 *   silently skips them, passing while it reads a fraction of the package.
 *   Every per-package scan goes through here.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** `projects/<project>/src` (when present) and every secondary entry-point folder. */
export function packageSourceDirs(root, project) {
  const dir = join(root, 'projects', project);
  const out = [];
  if (existsSync(join(dir, 'src'))) out.push(join(dir, 'src'));
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    const sub = join(dir, name);
    if (name !== 'src' && statSync(sub).isDirectory() && existsSync(join(sub, 'ng-package.json'))) out.push(sub);
  }
  return out;
}
