#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.resolve(__dirname, 'jsx_sanity_check.py');

const candidates = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];

let lastExitCode = null;

for (const cmd of candidates) {
  const result = spawnSync(cmd, [scriptPath], { stdio: 'inherit' });
  if (result.status === 0) {
    process.exit(0);
  }
lastExitCode = result.status ?? (typeof result.error?.code === 'number' ? result.error.code : 1);
}

console.error(
  `Failed to run JSX sanity check. Tried ${candidates.join(', ')} but none were available in PATH.`
);
process.exit(lastExitCode ?? 1);
