import { Command } from 'commander';

export function registerNewCommand(program: Command): void {
  program
    .command('new <name>')
    .description('Cria um novo projeto com scaffold completo (single-source rules.md)')
    .option('--stack <stack>', 'stack do projeto: dotnet, node, java ou python')
    .option('--remote <url>', 'URL do remoto git (obrigatório)')
    .option('--plan', 'reporta pendências em JSON, sem aplicar')
    .option('--choices <json>', 'JSON com as escolhas pra resolver pendências')
    .option('--choices-file <path>', 'arquivo JSON com as escolhas')
    .option('--force', 'ignora pendências e força a operação')
    .action(() => {
      throw new Error('genova new: implementado no grupo 3 desta change');
    });
}
