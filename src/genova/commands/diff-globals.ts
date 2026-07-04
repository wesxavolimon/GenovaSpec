import { Command } from 'commander';

export function registerDiffGlobalsCommand(program: Command): void {
  program
    .command('diff-globals')
    .description('Compara o genovabase com os globals reais do usuário e reporta drift')
    .action(() => {
      throw new Error('genova diff-globals: implementado no grupo 6 desta change');
    });
}
