import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { registerNewCommand } from './commands/new.js';
import { registerUpdateCommand } from './commands/update.js';
import { registerRegisterCommand } from './commands/register.js';
import { registerListCommand } from './commands/list.js';
import { registerSyncGlobalsCommand } from './commands/sync-globals.js';
import { registerRevertGlobalsCommand } from './commands/revert-globals.js';
import { registerAdjustStandardCommand } from './commands/adjust-standard.js';
import { registerDiffGlobalsCommand } from './commands/diff-globals.js';

function readVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const packageJsonPath = join(here, '../../package.json');
  const raw = readFileSync(packageJsonPath, 'utf-8');
  return (JSON.parse(raw) as { version: string }).version;
}

/**
 * CLI agent-only (design.md D1): nenhum comando espera stdin. Conflitos são
 * resolvidos via --plan/--choices/--choices-file, nunca por prompt interativo.
 */
export function createGenovaProgram(): Command {
  const program = new Command();

  program
    .name('genova')
    .description('CLI agent-only pra gerar e sincronizar projetos do ecossistema Genova')
    .version(readVersion());

  registerNewCommand(program);
  registerUpdateCommand(program);
  registerRegisterCommand(program);
  registerListCommand(program);
  registerSyncGlobalsCommand(program);
  registerRevertGlobalsCommand(program);
  registerAdjustStandardCommand(program);
  registerDiffGlobalsCommand(program);

  return program;
}

export function runGenovaCli(argv: string[] = process.argv): void {
  createGenovaProgram().parse(argv);
}
