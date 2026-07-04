import { Command } from 'commander';

export function registerAdjustStandardCommand(program: Command): void {
  program
    .command('adjust-standard <path>')
    .description('Adota o padrão genova num projeto já registrado (mexe em arquivos)')
    .option('--plan', 'reporta pendências em JSON, sem aplicar')
    .option('--choices <json>', 'JSON com as escolhas pra resolver pendências')
    .option('--choices-file <path>', 'arquivo JSON com as escolhas')
    .option('--force', 'ignora pendências e força a operação')
    .action(() => {
      throw new Error('genova adjust-standard: implementado no grupo 5 desta change');
    });
}
