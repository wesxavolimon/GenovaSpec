import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { diffGlobals } from './diff-globals.js';
import { dualWriteSkills } from './skills-dual-write.js';
import { shouldExclude } from './sync-exclusions.js';
import { createBackupDir } from './backup.js';
import { walkDir } from './walk-dir.js';

/**
 * Sync globals (UC-07, design.md D3/D4/D5/D6, specs genova-globals-mirror):
 * backup → diff-globals → bloqueia se drift sem --force → copia com exclusões e dual-write
 */

export interface SyncGlobalsOptions {
  genovabaseRoot: string;
  homeDir: string;
  force?: boolean;
}

export interface SyncGlobalsResult {
  mode: 'blocked' | 'applied';
  backupDir?: string;
  drifts?: Array<{ file: string; direction: string }>;
  summary?: string;
}

/**
 * Copia arquivo, criando diretórios pais conforme necessário.
 */
function copyFileSafely(src: string, dest: string): void {
  const dir = dirname(dest);
  mkdirSync(dir, { recursive: true });
  copyFileSync(src, dest);
}

/**
 * Sincroniza genovabase para globals.
 */
export function syncGlobals(options: SyncGlobalsOptions): SyncGlobalsResult {
  const { genovabaseRoot, homeDir, force } = options;

  // 1. Cria backup
  const backupRoot = join(genovabaseRoot, '.backup');
  const backupDir = createBackupDir(backupRoot);

  // 2. Roda diff-globals
  const diffResult = diffGlobals(genovabaseRoot, homeDir);

  // 3. Bloqueia se drift sem --force
  if (!diffResult.synced && !force) {
    return {
      mode: 'blocked',
      drifts: diffResult.drifts,
      summary: `Drift detectado. Use --force pra ignorar ou resolva manualmente.`,
    };
  }

  // 4. Copia com exclusões
  const globalsToSync = [
    { name: '.claude', src: join(genovabaseRoot, '.claude'), dest: join(homeDir, '.claude') },
    { name: '.codex', src: join(genovabaseRoot, '.codex'), dest: join(homeDir, '.codex') },
    { name: '.gemini', src: join(genovabaseRoot, '.gemini'), dest: join(homeDir, '.gemini') },
    {
      name: '.config/opencode',
      src: join(genovabaseRoot, '.opencode'),
      dest: join(homeDir, '.config/opencode'),
    },
    { name: '.ia', src: join(genovabaseRoot, '.ia'), dest: join(homeDir, '.ia') },
    { name: '.ia_history', src: join(genovabaseRoot, '.ia_history'), dest: join(homeDir, '.ia_history') },
  ];

  let copied = 0;
  for (const item of globalsToSync) {
    if (!existsSync(item.src)) continue;

    const files = walkDir(item.src);
    for (const file of files) {
      const relPath = relative(item.src, file);
      const destFile = join(item.dest, relPath);

      if (shouldExclude(relPath)) {
        continue; // pula exclusões
      }

      copyFileSafely(file, destFile);
      copied++;

      // Faz backup também
      const backupDest = join(backupDir, item.name, relPath);
      copyFileSafely(file, backupDest);
    }
  }

  // 5. Dual-write skills
  dualWriteSkills({ genovabaseRoot, homeDir });

  // 6. Commit no genovabase
  const gitConfigArgs = ['-c', 'user.name=genova-cli', '-c', 'user.email=genova-cli@local'];
  try {
    execFileSync('git', [...gitConfigArgs, 'add', '.backup', '.claude', '.codex', '.gemini', '.opencode', '.ia', '.ia_history'], {
      cwd: genovabaseRoot,
      stdio: 'ignore',
    });
    execFileSync('git', [...gitConfigArgs, 'commit', '-m', `chore: sync-globals ${new Date().toISOString()}`], {
      cwd: genovabaseRoot,
      stdio: 'ignore',
    });
  } catch {
    // git pode falhar se nada mudou, tudo bem
  }

  return {
    mode: 'applied',
    backupDir,
    summary: `Sincronizados ${copied} arquivos. Backup em ${relative(genovabaseRoot, backupDir)}`,
  };
}
