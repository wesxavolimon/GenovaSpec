import { Command } from 'commander';

export function registerRevertGlobalsCommand(program: Command): void {
  program
    .command('revert-globals')
    .description('Restaura os globals reais a partir do snapshot mais recente de `.backup/`')
    .option('--from <timestamp>', 'restaura um snapshot específico em vez do mais recente')
    .action(() => {
      throw new Error('genova revert-globals: implementado no grupo 6 desta change');
    });
}
