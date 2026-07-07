/**
 * Filtro de exclusão pra sync-globals (design.md D3, specs genova-globals-mirror):
 * nunca copia credenciais, sessões, cache, ou estado de runtime dos agentes.
 */

const EXCLUDED_PATTERNS = [
  '.credentials.json',
  'credentials.json',
  'oauth_creds.json',
  'auth.json',
  'settings.local.json',
  /sessions/,
  /cache/,
  /\.sqlite$/,
  /goals_\d+\.sqlite/,
  /memories_\d+\.sqlite/,
  /\.node_modules/,
  /node_modules/,
  /antigravity/,
];

/**
 * Retorna true se o arquivo/path deve ser excluído do sync.
 */
export function shouldExclude(filePath: string): boolean {
  for (const pattern of EXCLUDED_PATTERNS) {
    if (typeof pattern === 'string') {
      if (filePath.endsWith(pattern) || filePath.includes(`/${pattern}`) || filePath.includes(`\\${pattern}`)) {
        return true;
      }
    } else {
      // regex pattern
      if (pattern.test(filePath)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Filtra um array de file paths, removendo os que devem ser excluídos.
 */
export function filterExcluded(filePaths: string[]): string[] {
  return filePaths.filter((p) => !shouldExclude(p));
}
