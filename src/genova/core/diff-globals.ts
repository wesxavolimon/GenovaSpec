import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Diff globals (UC-06, specs genova-globals-mirror):
 * compara genovabase mirror com reais ~/.claude, ~/.codex, etc.
 * Reporta drift sem side effects.
 */

export interface DriftReport {
  file: string;
  direction: 'genovabase-ahead' | 'global-ahead' | 'divergent';
  detail?: string;
}

export interface DiffGlobalsResult {
  synced: boolean;
  drifts: DriftReport[];
}

interface ComparisonItem {
  name: string;
  genovabasePath: string;
  globalPath: string;
}

const COMPARISON_ITEMS: ComparisonItem[] = [
  { name: '.claude/CLAUDE.md', genovabasePath: '.claude/CLAUDE.md', globalPath: '.claude/CLAUDE.md' },
  {
    name: '.claude/settings.json',
    genovabasePath: '.claude/settings.json',
    globalPath: '.claude/settings.json',
  },
  {
    name: '.codex/AGENTS.md',
    genovabasePath: '.codex/AGENTS.md',
    globalPath: '.codex/AGENTS.md',
  },
  {
    name: '.gemini/GEMINI.md',
    genovabasePath: '.gemini/GEMINI.md',
    globalPath: '.gemini/GEMINI.md',
  },
  {
    name: '.ia_history/INDEX.md',
    genovabasePath: '.ia_history/INDEX.md',
    globalPath: '.ia_history/INDEX.md',
  },
];

/**
 * Compara um arquivo do genovabase com o global.
 * Retorna null se sincronizado, DriftReport se divergente.
 */
function compareFile(
  genovabaseRoot: string,
  homeDir: string,
  item: ComparisonItem
): DriftReport | null {
  const genovaPath = join(genovabaseRoot, item.genovabasePath);
  const globalPath = join(homeDir, item.globalPath);

  const genovaExists = existsSync(genovaPath);
  const globalExists = existsSync(globalPath);

  if (!genovaExists && !globalExists) {
    return null; // both missing = synced
  }

  if (!genovaExists && globalExists) {
    return {
      file: item.name,
      direction: 'global-ahead',
      detail: 'existe no global, nao no genovabase',
    };
  }

  if (genovaExists && !globalExists) {
    return {
      file: item.name,
      direction: 'genovabase-ahead',
      detail: 'existe no genovabase, nao no global',
    };
  }

  // Ambos existem — compara conteúdo
  const genovaContent = readFileSync(genovaPath, 'utf-8');
  const globalContent = readFileSync(globalPath, 'utf-8');

  if (genovaContent === globalContent) {
    return null; // idêntico = synced
  }

  // Divergem — tenta inferir direção pela extensão ou conteúdo
  // Para arquivos de config/settings, global é "ahead" se tem mais conteúdo
  const divergent: DriftReport = {
    file: item.name,
    direction: 'divergent',
    detail: 'conteúdo diferente',
  };

  // Heurística simples: se global é maior, assume que global foi modificado (ahead)
  if (globalContent.length > genovaContent.length) {
    divergent.direction = 'global-ahead';
  } else if (genovaContent.length > globalContent.length) {
    divergent.direction = 'genovabase-ahead';
  }

  return divergent;
}

/**
 * Compara genovabase mirror com globals reais.
 * Retorna lista de drifts ou true se tudo sincronizado.
 */
export function diffGlobals(genovabaseRoot: string, homeDir: string): DiffGlobalsResult {
  const drifts: DriftReport[] = [];

  for (const item of COMPARISON_ITEMS) {
    const drift = compareFile(genovabaseRoot, homeDir, item);
    if (drift) {
      drifts.push(drift);
    }
  }

  return {
    synced: drifts.length === 0,
    drifts,
  };
}
