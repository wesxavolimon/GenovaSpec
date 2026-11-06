import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateAll } from '../../src/genova/core/update-all.js';
import { scaffoldProject } from '../../src/genova/core/scaffold-project.js';
import { readRegistry } from '../../src/genova/core/projects-registry.js';

function tempWorkspace(): string {
  return mkdtempSync(join(tmpdir(), 'genova-update-all-'));
}

const baseScaffoldOptions = {
  stack: 'node',
  remote: 'https://example.com/demo.git',
  cliVersion: '1.0.0',
  choices: {},
};

describe('updateAll — UC-03 Backend Funcional', () => {
  it('--plan agrega pendencies vazias de todos os projetos', () => {
    const workspaceRoot = tempWorkspace();

    // scaffold 2 projetos
    for (const name of ['proj-a', 'proj-b']) {
      scaffoldProject({
        ...baseScaffoldOptions,
        name,
        workspaceRoot,
      });
    }

    const result = updateAll({
      workspaceRoot,
      cliVersion: '1.0.0',
      plan: true,
    });

    expect(result.mode).toBe('plan');
    expect(result.projects).toHaveLength(2);
    expect(result.projects[0].name).toBe('proj-a');
    expect(result.projects[0].pendencies).toEqual([]);
    expect(result.projects[1].name).toBe('proj-b');
    expect(result.projects[1].pendencies).toEqual([]);
  });

  it('update all sem --plan aplica a todos: altera .genova-version, reescreve .genova/rules.md', () => {
    const workspaceRoot = tempWorkspace();

    // scaffold 3 projetos em versoes distintas
    const names = ['proj-a', 'proj-b', 'proj-c'];
    for (const name of names) {
      scaffoldProject({
        ...baseScaffoldOptions,
        name,
        workspaceRoot,
        cliVersion: '1.0.0',
      });
    }

    // simula desatualização em todos
    const registry = readRegistry(join(workspaceRoot, 'projects.json'));
    for (const entry of registry.projects) {
      const projectDir = join(workspaceRoot, entry.path);
      writeFileSync(join(projectDir, '.genova-version'), '0.9.0\n', 'utf-8');
    }

    const result = updateAll({
      workspaceRoot,
      cliVersion: '1.1.0',
    });

    expect(result.mode).toBe('apply');
    expect(result.reports).toHaveLength(3);
    expect(result.reports[0].status).toBe('applied');
    expect(result.reports[1].status).toBe('applied');
    expect(result.reports[2].status).toBe('applied');

    // verifica que todas as versoes foram atualizadas
    for (const entry of registry.projects) {
      const projectDir = join(workspaceRoot, entry.path);
      const version = readFileSync(join(projectDir, '.genova-version'), 'utf-8').trim();
      expect(version).toBe('1.1.0');
    }
  });

  it('misto: alguns projetos ja uptodate, alguns aplicados', () => {
    const workspaceRoot = tempWorkspace();

    // scaffold proj-a com 1.0.0, proj-b com 1.1.0, proj-c com 1.0.0
    scaffoldProject({
      ...baseScaffoldOptions,
      name: 'proj-a',
      workspaceRoot,
      cliVersion: '1.0.0',
    });
    scaffoldProject({
      ...baseScaffoldOptions,
      name: 'proj-b',
      workspaceRoot,
      cliVersion: '1.1.0',
    });
    scaffoldProject({
      ...baseScaffoldOptions,
      name: 'proj-c',
      workspaceRoot,
      cliVersion: '1.0.0',
    });

    // updateAll com 1.1.0: proj-a desatualizado→applied, proj-b up-to-date, proj-c desatualizado→applied
    const result = updateAll({
      workspaceRoot,
      cliVersion: '1.1.0',
    });

    expect(result.mode).toBe('apply');
    expect(result.reports).toHaveLength(3);
    expect(result.reports.filter((r) => r.status === 'applied')).toHaveLength(2);
    expect(result.reports.filter((r) => r.status === 'already-up-to-date')).toHaveLength(1);
    expect(result.reports.find((r) => r.name === 'proj-b')?.status).toBe('already-up-to-date');
  });

  it('um projeto com path invalido nao aborta outros — marked failed com detail message', () => {
    const workspaceRoot = tempWorkspace();

    // scaffold 2 projetos validos
    for (const name of ['proj-a', 'proj-b']) {
      scaffoldProject({
        ...baseScaffoldOptions,
        name,
        workspaceRoot,
      });
    }

    // corrompe projects.json manualmente: muda path de proj-a para um path invalido
    const registry = readRegistry(join(workspaceRoot, 'projects.json'));
    const projA = registry.projects.find((p) => p.name === 'proj-a');
    if (!projA) throw new Error('proj-a not found');
    projA.path = 'src/PROJETOS/nonexistent-proj';
    writeFileSync(
      join(workspaceRoot, 'projects.json'),
      JSON.stringify(registry, null, 2) + '\n',
      'utf-8'
    );

    const result = updateAll({
      workspaceRoot,
      cliVersion: '1.1.0',
    });

    expect(result.mode).toBe('apply');
    expect(result.reports).toHaveLength(2);

    const reportA = result.reports.find((r) => r.name === 'proj-a');
    expect(reportA?.status).toBe('failed');
    expect(reportA?.detail).toBeDefined();

    // proj-b continua sendo atualizado normalmente
    const reportB = result.reports.find((r) => r.name === 'proj-b');
    expect(reportB?.status).toBe('applied');
  });
});

describe('updateAll — UC-03 Backend Integração', () => {
  it('--plan reporta alreadyUpToDate flags corretos por projeto', () => {
    const workspaceRoot = tempWorkspace();

    const result1 = scaffoldProject({
      ...baseScaffoldOptions,
      name: 'proj-up-to-date',
      workspaceRoot,
      cliVersion: '1.0.0',
    });
    if (result1.mode !== 'apply') throw new Error('unreachable');

    const result2 = scaffoldProject({
      ...baseScaffoldOptions,
      name: 'proj-desatualizado',
      workspaceRoot,
      cliVersion: '1.0.0',
    });
    if (result2.mode !== 'apply') throw new Error('unreachable');

    writeFileSync(join(result2.projectDir, '.genova-version'), '0.9.0\n', 'utf-8');

    const planResult = updateAll({
      workspaceRoot,
      cliVersion: '1.0.0',
      plan: true,
    });

    expect(planResult.mode).toBe('plan');
    expect(planResult.projects).toHaveLength(2);

    const groupUpToDate = planResult.projects.find((g) => g.name === 'proj-up-to-date');
    expect(groupUpToDate?.pendencies).toEqual([]);

    const groupDesatualizado = planResult.projects.find((g) => g.name === 'proj-desatualizado');
    expect(groupDesatualizado?.pendencies).toEqual([]);
  });

  it('projetos.json é atualizado com genovaVersion e updatedAt para cada projeto aplicado', () => {
    const workspaceRoot = tempWorkspace();

    for (const name of ['proj-a', 'proj-b']) {
      scaffoldProject({
        ...baseScaffoldOptions,
        name,
        workspaceRoot,
        cliVersion: '1.0.0',
      });
    }

    const registryBefore = readRegistry(join(workspaceRoot, 'projects.json'));
    const entryABefore = registryBefore.projects.find((p) => p.name === 'proj-a');
    const updatedAtABefore = entryABefore?.updatedAt;

    // simula desatualização
    const registry = readRegistry(join(workspaceRoot, 'projects.json'));
    for (const entry of registry.projects) {
      const projectDir = join(workspaceRoot, entry.path);
      writeFileSync(join(projectDir, '.genova-version'), '0.9.0\n', 'utf-8');
    }

    execSync(`powershell -Command "Start-Sleep -Milliseconds 10"`, { stdio: 'ignore' });

    updateAll({
      workspaceRoot,
      cliVersion: '1.1.0',
    });

    const registryAfter = readRegistry(join(workspaceRoot, 'projects.json'));
    const entryAAfter = registryAfter.projects.find((p) => p.name === 'proj-a');
    const entryBAfter = registryAfter.projects.find((p) => p.name === 'proj-b');

    expect(entryAAfter?.genovaVersion).toBe('1.1.0');
    expect(entryAAfter?.updatedAt).not.toBe(updatedAtABefore);

    expect(entryBAfter?.genovaVersion).toBe('1.1.0');
  });
});
