import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Backup rotativo (design.md D4, specs genova-globals-mirror):
 * cria `.backup/<timestamp>/`, remove oldest se >3 snapshots.
 */

export function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

export function createBackupDir(backupRoot: string): string {
  mkdirSync(backupRoot, { recursive: true });

  const ts = timestamp();
  const backupDir = join(backupRoot, ts);
  mkdirSync(backupDir, { recursive: true });

  // Remove oldest backup se houver >3
  const existing = readdirSync(backupRoot).filter((f) => /^\d{14}$/.test(f)).sort();
  if (existing.length > 3) {
    const toRemove = existing[0];
    rmSync(join(backupRoot, toRemove), { recursive: true, force: true });
  }

  return backupDir;
}

/**
 * Lista todos os timestamps de backup em ordem (mais antigo primeiro).
 */
export function listBackups(backupRoot: string): string[] {
  if (!existsSync(backupRoot)) return [];
  return readdirSync(backupRoot)
    .filter((f) => /^\d{14}$/.test(f))
    .sort();
}

/**
 * Retorna o timestamp mais recente (maior).
 */
export function getMostRecentBackup(backupRoot: string): string | null {
  const backups = listBackups(backupRoot);
  return backups.length > 0 ? backups[backups.length - 1] : null;
}
