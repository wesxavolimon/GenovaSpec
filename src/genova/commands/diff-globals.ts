import { Command } from 'commander';
import { homedir } from 'node:os';
import { diffGlobals } from '../core/diff-globals.js';

export function registerDiffGlobalsCommand(program: Command): void {
  program
    .command('diff-globals')
    .description('Compara genovabase mirror com globals reais, reporta drift (UC-06)')
    .action(() => {
      const genovabaseRoot = process.cwd();
      const home = homedir();

      const result = diffGlobals(genovabaseRoot, home);
      console.log(JSON.stringify(result, null, 2));

      if (!result.synced) {
        process.exitCode = 1;
      }
    });
}
