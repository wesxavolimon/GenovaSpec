import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { updateProject, ProjectNotAdoptedError, ProjectNotRegisteredError } from '../core/update-project.js';
import { updateAll } from '../core/update-all.js';
import { PendingChoicesError } from '../core/plan-contract.js';

interface UpdateOptions {
  plan?: boolean;
  choices?: string;
  choicesFile?: string;
}

interface UpdateAllOptions {
  plan?: boolean;
  choicesFile?: string;
}

function loadJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
}

export function registerUpdateCommand(program: Command): void {
  const update = program
    .command('update')
    .description('Atualiza `.genova/rules.md` de um projeto pra versão atual do genovabase')
    .option('--plan', 'reporta pendências em JSON, sem aplicar')
    .option('--choices <json>', 'JSON com as escolhas pra resolver pendências')
    .option('--choices-file <path>', 'arquivo JSON com as escolhas')
    .action((options: UpdateOptions, command: Command) => {
      const cliVersion = command.parent?.version() ?? '0.0.0';
      const choices = options.choices ? (JSON.parse(options.choices) as Record<string, string>) : undefined;

      try {
        const result = updateProject({
          cliVersion,
          projectDir: process.cwd(),
          workspaceRoot: process.cwd(),
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
        if (error instanceof ProjectNotAdoptedError || error instanceof ProjectNotRegisteredError) {
          console.error(error.message);
          process.exitCode = 1;
          return;
        }
        throw error;
      }
    });

  update
    .command('all')
    .description('Agrega pendências de todos os projetos registrados numa única rodada')
    .option('--plan', 'reporta pendências agregadas em JSON, sem aplicar')
    .option('--choices-file <path>', 'arquivo JSON com as escolhas agregadas (por projeto)')
    .action((options: UpdateAllOptions, command: Command) => {
      const cliVersion = command.parent?.parent?.version() ?? '0.0.0';
      const choicesByProject = options.choicesFile
        ? (loadJson(options.choicesFile) as Record<string, Record<string, string>>)
        : undefined;

      const result = updateAll({
        workspaceRoot: process.cwd(),
        cliVersion,
        plan: options.plan,
        choicesByProject,
      });
      console.log(JSON.stringify(result, null, 2));

      if (result.mode === 'apply' && result.reports.some((r) => r.status === 'failed')) {
        process.exitCode = 1;
      }
    });
}
