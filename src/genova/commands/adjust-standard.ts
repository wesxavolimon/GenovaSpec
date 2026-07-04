import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import {
  adjustStandard,
  ProjectAlreadyAdoptedError,
} from '../core/adjust-standard.js';
import { PendingChoicesError } from '../core/plan-contract.js';

interface AdjustStandardOptions {
  plan?: boolean;
  choices?: string;
  choicesFile?: string;
}

function loadJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
}

export function registerAdjustStandardCommand(program: Command): void {
  program
    .command('adjust-standard <path>')
    .description('Adopta padrão genova em projeto legado (escreve .genova/rules.md, CLAUDE.md, etc)')
    .option('--plan', 'reporta pendências em JSON, sem aplicar')
    .option('--choices <json>', 'JSON com as escolhas pra resolver pendências')
    .option('--choices-file <path>', 'arquivo JSON com as escolhas')
    .action((path: string, options: AdjustStandardOptions, command: Command) => {
      const cliVersion = command.parent?.version() ?? '0.0.0';
      const choices = options.choices ? (JSON.parse(options.choices) as Record<string, string>) : undefined;

      try {
        const result = adjustStandard({
          projectDir: path,
          workspaceRoot: process.cwd(),
          cliVersion,
          plan: options.plan,
          choices,
          choicesFile: options.choicesFile,
        });
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        if (error instanceof PendingChoicesError) {
          console.error(JSON.stringify(error.plan, null, 2));
          process.exitCode = 1;
          return;
        }
        if (error instanceof ProjectAlreadyAdoptedError) {
          console.error(error.message);
          process.exitCode = 1;
          return;
        }
        throw error;
      }
    });
}
