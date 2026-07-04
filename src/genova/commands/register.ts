import { Command } from 'commander';

export function registerRegisterCommand(program: Command): void {
  program
    .command('register <path>')
    .description('Adota um projeto legado no registry sem modificar seus arquivos')
    .action(() => {
      throw new Error('genova register: implementado no grupo 5 desta change');
    });
}
