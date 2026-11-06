import { copyFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { getMostRecentBackup, listBackups } from './backup.js';
import { walkDir } from './walk-dir.js';

/**
 * Revert globals (UC-08, specs genova-globals-mirror):
 * restaura snapshot mais recente ou --from <timestamp>.
 */

export interface RevertGlobalsOptions {
  backupRoot: string;
  homeDir: string;
  fromTimestamp?: string;
}

export interface RevertGlobalsResult {
  restored: boolean;
  fromTimestamp: string;
  filesRestored: number;
  message: string;
}

/**
 * Restaura arquivos de um backup timestamp pra home.
 */
function restoreBackup(backupDir: string, homeDir: string): number {
  const agents = ['.claude', '.codex', '.gemini', '.opencode', '.ia', '.ia_history'];
  let restored = 0;

  for (const agent of agents) {
    const backupAgentDir = join(backupDir, agent);
    if (!existsSync(backupAgentDir)) continue;

    const files = walkDir(backupAgentDir);
    for (const file of files) {
      const relPath = file.replace(backupAgentDir, '').replace(/^[\\\/]/, '');
      const destFile = join(homeDir, agent, relPath);

      mkdirSync(dirname(destFile), { recursive: true });
      copyFileSync(file, destFile);
      restored++;
    }
  }

  return restored;
}

/**
 * Reverte os globals pro snapshot especificado (ou mais recente).
 */
export function revertGlobals(options: RevertGlobalsOptions): RevertGlobalsResult {
  const backups = listBackups(options.backupRoot);

  if (backups.length === 0) {
    throw new Error('Nenhum backup disponível em .backup/');
  }

  const timestamp = options.fromTimestamp || getMostRecentBackup(options.backupRoot);
  if (!timestamp || !backups.includes(timestamp)) {
    throw new Error(`Timestamp ${timestamp} não encontrado em backups.`);
  }

  const backupDir = join(options.backupRoot, timestamp);
  const filesRestored = restoreBackup(backupDir, options.homeDir);

  return {
    restored: true,
    fromTimestamp: timestamp,
    filesRestored,
    message: `Restaurado backup ${timestamp}. Reinicie o agente de IA pra aplicar.`,
  };
}
