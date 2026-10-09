#!/usr/bin/env node
// Runs the public mirror's suite as SHARDS sequential vitest processes: a single
// process over every spec file leaks memory until random tests time out (the
// main repo measures this in scripts/run-sharded.mjs). Copied into the mirror as
// scripts/test-sharded.mjs by stage-public-mirror.mjs.
import { spawnSync } from 'node:child_process';

const SHARDS = 20;
const extra = process.argv.slice(2);
const failed = [];
for (let i = 1; i <= SHARDS; i++) {
  console.log(`\n── shard ${i}/${SHARDS}`);
  const run = spawnSync('npx', ['vitest', 'run', `--shard=${i}/${SHARDS}`, ...extra], { stdio: 'inherit' });
  if (run.status !== 0) failed.push(i);
}
if (failed.length) {
  console.error(`\n✗ shard(s) ${failed.join(', ')} failed`);
  process.exit(1);
}
console.log(`\n✅ all ${SHARDS} shards passed`);
