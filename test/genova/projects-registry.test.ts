import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  emptyRegistry,
  findProject,
  readRegistry,
  upsertProject,
  writeRegistry,
  type ProjectEntry,
} from '../../src/genova/core/projects-registry.js';

function makeEntry(overrides: Partial<ProjectEntry> = {}): ProjectEntry {
  return {
    name: 'GenovaIA',
    path: 'src/PROJETOS/GenovaIA',
    stack: 'node',
    genovaVersion: '1.0.0',
    registeredAt: '2026-07-04T00:00:00.000Z',
    updatedAt: '2026-07-04T00:00:00.000Z',
    ...overrides,
  };
}

describe('projects-registry', () => {
  it('le um registry inexistente como vazio', () => {
    const dir = mkdtempSync(join(tmpdir(), 'genova-registry-'));
    const registry = readRegistry(join(dir, 'projects.json'));
    expect(registry).toEqual(emptyRegistry());
  });

  it('escreve e le de volta o mesmo conteudo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'genova-registry-'));
    const path = join(dir, 'projects.json');
    const registry = upsertProject(emptyRegistry(), makeEntry());

    writeRegistry(path, registry);

    expect(readRegistry(path)).toEqual(registry);
  });

  it('upsert adiciona uma entrada nova', () => {
    const registry = upsertProject(emptyRegistry(), makeEntry());
    expect(registry.projects).toHaveLength(1);
    expect(findProject(registry, 'GenovaIA')).toEqual(makeEntry());
  });

  it('upsert substitui a entrada existente pelo nome, sem duplicar', () => {
    const first = upsertProject(emptyRegistry(), makeEntry());
    const updated = upsertProject(
      first,
      makeEntry({ genovaVersion: '1.1.0', updatedAt: '2026-07-05T00:00:00.000Z' })
    );

    expect(updated.projects).toHaveLength(1);
    expect(findProject(updated, 'GenovaIA')?.genovaVersion).toBe('1.1.0');
  });
});
