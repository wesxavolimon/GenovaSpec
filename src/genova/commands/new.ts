import { Command } from 'commander';
import {
  InvalidNameError,
  InvalidStackError,
  MissingRemoteError,
  scaffoldProject,
} from '../core/scaffold-project.js';
import { PendingChoicesError } from '../core/plan-contract.js';

interface NewCommandOptions {
  type?: 'projeto' | 'mcp' | 'poc';
  stack: string;
  remote?: string;
  plan?: boolean;
  choices?: string;
  choicesFile?: string;
}

export function registerNewCommand(program: Command): void {
  program
    .command('new <name>')
    .description('Cria um novo projeto com scaffold completo (single-source rules.md)')
    .requiredOption('--stack <stack>', 'stack do projeto: dotnet, node, java ou python')
    .option('--type <type>', 'tipo do projeto: projeto, mcp ou poc', 'projeto')
    .option('--remote <url>', 'URL do remoto git (obrigatório)')
    .option('--plan', 'reporta pendências em JSON, sem aplicar')
    .option('--choices <json>', 'JSON com as escolhas pra resolver pendências')
    .option('--choices-file <path>', 'arquivo JSON com as escolhas')
    .action((name: string, options: NewCommandOptions, command: Command) => {
      const cliVersion = command.parent?.version() ?? '0.0.0';
      const choices = options.choices ? (JSON.parse(options.choices) as Record<string, string>) : undefined;

      try {
        const result = scaffoldProject({
          name,
          type: options.type,
          stack: options.stack,
          remote: options.remote,
          cliVersion,
          plan: options.plan,
          choices,
          choicesFile: options.choicesFile,
        });

        if (result.mode === 'plan') {
          console.log(JSON.stringify({ pendencies: result.pendencies }, null, 2));
          return;
        }

        console.log(
          JSON.stringify(
            { projectDir: result.projectDir, bootstrapChangeDir: result.bootstrapChangeDir },
            null,
            2
          )
        );
      } catch (error) {
        if (error instanceof PendingChoicesError) {
          console.error(JSON.stringify(error.plan, null, 2));
          process.exitCode = 1;
          return;
        }
        if (
          error instanceof MissingRemoteError ||
          error instanceof InvalidStackError ||
          error instanceof InvalidNameError
        ) {
          console.error(error.message);
          process.exitCode = 1;
          return;
        }
        throw error;
      }
    });
}
