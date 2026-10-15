import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// A suite at UTC cannot catch a local-vs-UTC date bug, and a positive offset
// hides the commonest one; the date specs assert against this zone. Set here,
// before any worker starts, or Date never sees it — forced, so a TZ the shell
// already exports cannot quietly switch it off. `SV_TEST_TZ=UTC npm test` overrides.
process.env.TZ = process.env.SV_TEST_TZ?.trim() || 'Pacific/Marquesas';

const root = dirname(fileURLToPath(import.meta.url));
const tsconfig = JSON.parse(readFileSync(resolve(root, 'tsconfig.json'), 'utf8'));
const alias = Object.entries(tsconfig.compilerOptions.paths as Record<string, string[]>).map(([key, targets]) => ({
  find: key.replace(/\/\*$/, ''),
  replacement: resolve(root, targets[0].replace(/\/\*$/, '')),
}));

export default defineConfig({
  plugins: [angular()],
  resolve: { alias },
  optimizeDeps: { noDiscovery: true, include: [] },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['projects/**/*.spec.ts'],
    exclude: ['**/node_modules/**', 'projects/**/*.node.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    server: { deps: { inline: ['@analogjs/vite-plugin-angular'] } },
  },
});
