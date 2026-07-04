import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { templatesDir } from './package-root.js';

const TEMPLATES_ROOT = templatesDir(import.meta.url);

export function readTemplate(relativePath: string): string {
  return readFileSync(join(TEMPLATES_ROOT, relativePath), 'utf-8');
}

export function renderTemplate(content: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.split(`{{${key}}}`).join(value),
    content
  );
}
