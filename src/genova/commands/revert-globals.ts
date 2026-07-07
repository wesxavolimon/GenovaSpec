import { Command } from 'commander';
import { homedir } from 'node:os';
import { revertGlobals } from '../core/revert-globals-impl.js';

interface RevertGlobalsOptions {
  from?: string;
}

export function registerRevertGlobalsCommand(program: Command): void {
  program
    .command('revert-globals')
    .description('Restaura globals do snapshot mais recente em .backup/ (UC-08)')
    .option('--from <timestamp>', 'restaura snapshot específico em vez do mais recente')
    .action((options: RevertGlobalsOptions) => {
      const genovabaseRoot = process.cwd();
      const backupRoot = `${genovabaseRoot}/.backup`;
      const home = homedir();

      try {
        const result = revertGlobals({
          backupRoot,
          homeDir: home,
          fromTimestamp: options.from,
        });
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error((error as Error).message);
        process.exitCode = 1;
      }
    });
}
