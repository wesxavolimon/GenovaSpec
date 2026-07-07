import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Determina se um arquivo (CLAUDE.md, AGENTS.md, GEMINI.md ou config.yaml) tem
 * conteúdo "relevante" que merece ser preservado (gerando pendência) ou pode ser
 * sobrescrito direto (UC-05, design.md D2).
 *
 * Regras:
 * - CLAUDE/AGENTS/GEMINI: "relevante" se tem mais que só `@.genova/rules.md` ou comentários vazios
 * - config.yaml: "relevante" se referencia arquivos inexistentes (drift)
 */

export interface RelevanceResult {
  isRelevant: boolean;
  reason?: string;
}

/**
 * Verifica se um arquivo CLAUDE.md/AGENTS.md/GEMINI.md tem conteúdo relevante.
 * Boilerplate puro ou só imports são desconsiderados.
 */
export function classifyAgentFile(filePath: string): RelevanceResult {
  if (!existsSync(filePath)) {
    return { isRelevant: false, reason: 'arquivo nao existe' };
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#'));

  // Só @import ou vazio = sem conteúdo relevante
  if (lines.length === 0 || (lines.length === 1 && lines[0].startsWith('@'))) {
    return { isRelevant: false, reason: 'so boilerplate ou import' };
  }

  return { isRelevant: true, reason: 'conteudo customizado encontrado' };
}

/**
 * Verifica se um arquivo openspec/config.yaml tem conteúdo relevante ou drift.
 * Relevant = contém referências a arquivos que não existem no projeto.
 */
export function classifyConfigYaml(filePath: string, projectRoot: string): RelevanceResult {
  if (!existsSync(filePath)) {
    return { isRelevant: false, reason: 'arquivo nao existe' };
  }

  const content = readFileSync(filePath, 'utf-8');

  // Busca por linhas com referências tipo `path:` ou `file:` ou `import:`
  const fileRefPattern = /(?:path|file|import|include):\s*["']?([^"'\n\s]+)["']?/gi;
  let match;
  const referencedFiles: string[] = [];

  while ((match = fileRefPattern.exec(content)) !== null) {
    referencedFiles.push(match[1]);
  }

  // Verifica se alguma referência aponta pra arquivo inexistente
  const hasDrift = referencedFiles.some((ref) => {
    // Resolve relative paths (e.g., ../HARNESS.md)
    const fullPath = ref.startsWith('/') || ref.includes(':') ? ref : join(projectRoot, ref);
    return !existsSync(fullPath);
  });

  if (hasDrift) {
    return { isRelevant: true, reason: 'drift detectado: referencias a arquivos inexistentes' };
  }

  return { isRelevant: false, reason: 'arquivo existe sem drift' };
}

/**
 * Classifica todos os arquivos relevantes de um projeto (CLAUDE.md, AGENTS.md, GEMINI.md, config.yaml).
 * Retorna um mapa de {arquivo -> RelevanceResult}.
 */
export function classifyProjectFiles(
  projectDir: string
): Record<string, RelevanceResult> {
  const results: Record<string, RelevanceResult> = {};

  for (const file of ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md']) {
    results[file] = classifyAgentFile(join(projectDir, file));
  }

  results['openspec/config.yaml'] = classifyConfigYaml(join(projectDir, 'openspec', 'config.yaml'), projectDir);

  return results;
}

/**
 * Determina se há alguma pendência de conteúdo relevante (arquivos que exigem
 * escolha entre prepend ou sobrescrever).
 */
export function hasRelevantContent(projectDir: string): boolean {
  const classified = classifyProjectFiles(projectDir);
  return Object.values(classified).some((r) => r.isRelevant);
}
