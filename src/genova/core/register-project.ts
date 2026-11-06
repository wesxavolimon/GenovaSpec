import { existsSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { readRegistry, upsertProject, writeRegistry, type ProjectStack } from './projects-registry.js';

export class AlreadyRegisteredError extends Error {
  constructor(projectDir: string) {
    super(
      `${projectDir} ja esta registrado em projects.json. Rode "genova update" ou "genova adjust-standard" em seu lugar.`
    );
    this.name = 'AlreadyRegisteredError';
  }
}

export interface RegisterOptions {
  projectDir: string;
  workspaceRoot: string;
  cliVersion: string;
}

export interface RegisterResult {
  projectName: string;
  projectDir: string;
  registeredAt: string;
}

/**
 * `genova register` (specs genova-project-sync, UC-04):
 * leve adoption de projeto legado — só escreve .genova-version,
 * adiciona a projects.json. Nenhum outro arquivo é tocado.
 */
export function registerProject(options: RegisterOptions): RegisterResult {
  if (!existsSync(options.projectDir)) {
    throw new Error(`Diretorio ${options.projectDir} nao existe.`);
  }

  const registryPath = join(options.workspaceRoot, 'projects.json');
  const registry = existsSync(registryPath) ? readRegistry(registryPath) : { projects: [] };

  const relPath = relative(options.workspaceRoot, options.projectDir).split('\\').join('/');
  const existing = registry.projects.find((p) => p.path === relPath);
  if (existing) {
    throw new AlreadyRegisteredError(options.projectDir);
  }

  // Extrai nome do projeto do path (último component)
  const projectName = relPath.split('/').pop() ?? 'unknown';

  // Escreve .genova-version na raiz do projeto
  writeFileSync(join(options.projectDir, '.genova-version'), options.cliVersion + '\n', 'utf-8');

  // Adiciona entry em projects.json (stack: null = unknown)
  const now = new Date().toISOString();
  const updated = upsertProject(registry, {
    name: projectName,
    path: relPath,
    stack: null,
    genovaVersion: options.cliVersion,
    registeredAt: now,
    updatedAt: now,
  });
  writeRegistry(registryPath, updated);

  return { projectName, projectDir: options.projectDir, registeredAt: now };
}
