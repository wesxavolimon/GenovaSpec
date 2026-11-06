import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Raiz do pacote GenovaSpec, seja rodando via `dist/` compilado ou direto
 * dos `.ts` fonte (vitest transpila on-the-fly, mas mantém a localização
 * do arquivo em `src/`) — em ambos os casos, subir 2 níveis a partir de
 * `genova/core/` chega na raiz do pacote.
 */
export function packageRoot(importMetaUrl: string): string {
  const here = dirname(fileURLToPath(importMetaUrl));
  return join(here, '../../..');
}

export function templatesDir(importMetaUrl: string): string {
  return join(packageRoot(importMetaUrl), 'src/genova/templates');
}
