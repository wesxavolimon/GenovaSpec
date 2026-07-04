import { Command } from 'commander';

export function registerSyncGlobalsCommand(program: Command): void {
  program
    .command('sync-globals')
    .description('Sincroniza o genovabase pros globals reais do usuário (com backup rotativo)')
    .option('--force', 'ignora drift detectado por diff-globals e força a sincronização')
    .action(() => {
      throw new Error('genova sync-globals: implementado no grupo 6 desta change');
    });
}
