import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export type ProjectStack = 'dotnet' | 'node' | 'java' | 'python' | null;

export interface ProjectEntry {
  name: string;
  path: string;
  stack: ProjectStack;
  genovaVersion: string | null;
  registeredAt: string;
  updatedAt: string;
}

export interface ProjectsRegistry {
  projects: ProjectEntry[];
}

export function emptyRegistry(): ProjectsRegistry {
  return { projects: [] };
}

export function readRegistry(path: string): ProjectsRegistry {
  if (!existsSync(path)) {
    return emptyRegistry();
  }
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as ProjectsRegistry;
}

export function writeRegistry(path: string, registry: ProjectsRegistry): void {
  writeFileSync(path, JSON.stringify(registry, null, 2) + '\n', 'utf-8');
}

/** Upsert por `name`: substitui a entrada existente ou adiciona uma nova. */
export function upsertProject(
  registry: ProjectsRegistry,
  entry: ProjectEntry
): ProjectsRegistry {
  const index = registry.projects.findIndex((p) => p.name === entry.name);
  if (index === -1) {
    return { projects: [...registry.projects, entry] };
  }
  const projects = [...registry.projects];
  projects[index] = entry;
  return { projects };
}

export function findProject(
  registry: ProjectsRegistry,
  name: string
): ProjectEntry | undefined {
  return registry.projects.find((p) => p.name === name);
}
