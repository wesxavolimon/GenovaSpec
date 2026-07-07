import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Dual-write de skills (design.md D6, specs genova-globals-mirror):
 * copia .ia/SKILLS/* e .ia_history/SKILLS/history/* para:
 * ~/.claude/skills/, ~/.codex/skills/, ~/.gemini/skills/, ~/.config/opencode/skills/
 */

export interface DualWriteConfig {
  genovabaseRoot: string;
  homeDir: string;
}

const AGENT_SKILL_DIRS = [
  { agent: 'claude', path: '.claude/skills' },
  { agent: 'codex', path: '.codex/skills' },
  { agent: 'gemini', path: '.gemini/skills' },
  { agent: 'opencode', path: '.config/opencode/skills' },
];

/**
 * Copia um diretório de skills recursivamente.
 */
function copySkillsDir(srcDir: string, destDir: string): void {
  if (!existsSync(srcDir)) return;

  mkdirSync(destDir, { recursive: true });

  const entries = readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      copySkillsDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Executa dual-write: copia .ia/SKILLS e .ia_history/SKILLS/history para
 * todos os agent global skills directories.
 */
export function dualWriteSkills(config: DualWriteConfig): void {
  const iaSkillsSrc = join(config.genovabaseRoot, '.ia', 'SKILLS');
  const iaHistorySkillsSrc = join(config.genovabaseRoot, '.ia_history', 'SKILLS', 'history');

  for (const agent of AGENT_SKILL_DIRS) {
    const destDir = join(config.homeDir, agent.path);

    // Copia .ia/SKILLS
    copySkillsDir(iaSkillsSrc, destDir);

    // Copia .ia_history/SKILLS/history
    copySkillsDir(iaHistorySkillsSrc, destDir);
  }
}
