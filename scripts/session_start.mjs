#!/usr/bin/env node
import { execSync } from 'node:child_process';

function run(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd();
  } catch {
    return null;
  }
}

function printSection(title, body) {
  process.stdout.write(`\n=== ${title} ===\n`);
  if (!body) {
    process.stdout.write('(none)\n');
    return;
  }
  process.stdout.write(`${body}\n`);
}

const repoRoot = run('git rev-parse --show-toplevel');
if (!repoRoot) {
  process.stderr.write('Not a git repo (or git not available).\n');
  process.exit(1);
}

const branch = run('git rev-parse --abbrev-ref HEAD') ?? '<unknown>';
const head = run('git rev-parse --short HEAD') ?? '<unknown>';
const status = run('git status --porcelain') ?? '';
const recentCommits = run('git --no-pager log --oneline -n 20') ?? '';

process.stdout.write('Smart Shopper — Session Start\n');
process.stdout.write(`Repo:   ${repoRoot}\n`);
process.stdout.write(`Branch: ${branch}\n`);
process.stdout.write(`HEAD:   ${head}\n`);

printSection('Working Tree', status.length ? status : 'clean');
printSection('Recent Commits', recentCommits);

printSection(
  'Read Next',
  [
    'AGENTS.md',
    'docs/proper-implementation.md',
    'docs/runbooks/proper-implementation-workflow.md',
    '(feature-specific) docs/runbooks/*'
  ].join('\n')
);

printSection(
  'Repo Gates',
  [
    'pnpm verify',
    'pnpm --filter @smart-shopper/mobile typecheck',
    'supabase db reset --workdir supabase',
    'supabase test db --workdir supabase'
  ].join('\n')
);

printSection(
  'Safety Reminder',
  [
    'Never paste passwords, OTPs, JWTs, or keys into logs/issues/PRs.',
    'When sharing errors: include correlationId + error code; redact tokens.'
  ].join('\n')
);

