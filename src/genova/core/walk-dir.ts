import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Caminha recursivamente por um diretório e retorna lista de files (não diretórios).
 */
export function walkDir(dir: string): string[] {
  const result: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkDir(fullPath));
    } else {
      result.push(fullPath);
    }
  }

  return result;
}
