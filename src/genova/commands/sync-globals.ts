import { Command } from 'commander';
import { homedir } from 'node:os';
import { syncGlobals } from '../core/sync-globals-impl.js';

interface SyncGlobalsOptions {
  force?: boolean;
}

export function registerSyncGlobalsCommand(program: Command): void {
  program
    .command('sync-globals')
    .description('Sincroniza genovabase → globals com backup rotativo (UC-07)')
    .option('--force', 'ignora drift e força sync')
    .action((options: SyncGlobalsOptions) => {
      const genovabaseRoot = process.cwd();
      const home = homedir();

      const result = syncGlobals({
        genovabaseRoot,
        homeDir: home,
        force: options.force,
      });

      console.log(JSON.stringify(result, null, 2));

      if (result.mode === 'blocked') {
        process.exitCode = 1;
      }
    });
}
