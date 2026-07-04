import { Command } from 'commander';
import { registerProject, AlreadyRegisteredError } from '../core/register-project.js';

export function registerRegisterCommand(program: Command): void {
  program
    .command('register <path>')
    .description('Adota projeto legado sem modificar arquivos (só escreve .genova-version)')
    .action((path: string, command: Command) => {
      const cliVersion = command.parent?.version() ?? '0.0.0';

      try {
        const result = registerProject({
          projectDir: path,
          workspaceRoot: process.cwd(),
          cliVersion,
        });
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        if (error instanceof AlreadyRegisteredError) {
          console.error(error.message);
          process.exitCode = 1;
          return;
        }
        throw error;
      }
    });
}
