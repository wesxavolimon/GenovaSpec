import { Command } from 'commander';

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('Lista os projetos registrados e o status de cada um')
    .action(() => {
      throw new Error('genova list: implementado no grupo 7 desta change');
    });
}
