import { Command } from 'commander';

export function registerUpdateCommand(program: Command): void {
  const update = program
    .command('update [name]')
    .description('Atualiza `.genova/rules.md` de um projeto pra versão atual do genovabase')
    .option('--plan', 'reporta pendências em JSON, sem aplicar')
    .option('--choices <json>', 'JSON com as escolhas pra resolver pendências')
    .option('--choices-file <path>', 'arquivo JSON com as escolhas')
    .option('--force', 'ignora pendências e força a operação')
    .action(() => {
      throw new Error('genova update: implementado no grupo 4 desta change');
    });

  update
    .command('all')
    .description('Agrega pendências de todos os projetos registrados numa única rodada')
    .option('--plan', 'reporta pendências agregadas em JSON, sem aplicar')
    .option('--choices-file <path>', 'arquivo JSON com as escolhas agregadas')
    .option('--force', 'ignora pendências e força a operação')
    .action(() => {
      throw new Error('genova update all: implementado no grupo 4 desta change');
    });
}
