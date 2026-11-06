import { describe, expect, it } from 'vitest';
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  updateProject,
  ProjectNotAdoptedError,
  ProjectNotRegisteredError,
} from '../../src/genova/core/update-project.js';
import { scaffoldProject } from '../../src/genova/core/scaffold-project.js';
import { readRegistry, writeRegistry } from '../../src/genova/core/projects-registry.js';

function tempWorkspace(): string {
  return mkdtempSync(join(tmpdir(), 'genova-update-'));
}

const baseScaffoldOptions = {
  stack: 'node',
  remote: 'https://example.com/demo.git',
  cliVersion: '1.0.0',
  choices: {},
};

describe('updateProject — UC-02 Backend Funcional', () => {
  it('projeto com .genova-version == cliVersion retorna already-up-to-date (noop)', () => {
    const workspaceRoot = tempWorkspace();
    const scaffoldResult = scaffoldProject({
      ...baseScaffoldOptions,
      name: 'demo',
      workspaceRoot,
    });
    if (scaffoldResult.mode !== 'apply') throw new Error('unreachable');

    const result = updateProject({
      cliVersion: '1.0.0',
      projectDir: scaffoldResult.projectDir,
      workspaceRoot,
      choices: {},
    });

    expect(result.mode).toBe('already-up-to-date');
    expect(result.version).toBe('1.0.0');
  });

  it('projeto desatualizado: atualiza .genova-version, reescreve .genova/rules.md, preserva CLAUDE.md byte-a-byte', () => {
    const workspaceRoot = tempWorkspace();
    const scaffoldResult = scaffoldProject({
      ...baseScaffoldOptions,
      name: 'demo',
      workspaceRoot,
      cliVersion: '1.0.0',
    });
    if (scaffoldResult.mode !== 'apply') throw new Error('unreachable');

    const projectDir = scaffoldResult.projectDir;
    const claudeMdBefore = readFileSync(join(projectDir, 'CLAUDE.md'), 'utf-8');

    // simula projeto desatualizado: muda .genova-version sem git commit
    writeFileSync(join(projectDir, '.genova-version'), '0.9.0\n', 'utf-8');

    const result = updateProject({
      cliVersion: '1.1.0',
      projectDir,
      workspaceRoot,
      choices: {},
    });

    expect(result.mode).toBe('applied');
    expect(result.from).toBe('0.9.0');
    expect(result.to).toBe('1.1.0');

    const versionAfter = readFileSync(join(projectDir, '.genova-version'), 'utf-8').trim();
    expect(versionAfter).toBe('1.1.0');

    const claudeMdAfter = readFileSync(join(projectDir, 'CLAUDE.md'), 'utf-8');
    expect(claudeMdAfter).toBe(claudeMdBefore);

    const rulesMdAfter = readFileSync(join(projectDir, '.genova', 'rules.md'), 'utf-8');
    expect(rulesMdAfter).toContain('Gerado por: `genova new` v1.1.0');
  });

  it('lanca ProjectNotAdoptedError se nao ha .genova-version', () => {
    const workspaceRoot = tempWorkspace();
    const projectDir = join(workspaceRoot, 'src', 'PROJETOS', 'orphan');
    execSync(`mkdir -p "${projectDir}"`, { shell: 'powershell' });

    expect(() =>
      updateProject({
        cliVersion: '1.0.0',
        projectDir,
        workspaceRoot,
        choices: {},
      })
    ).toThrow(ProjectNotAdoptedError);
  });

});

describe('updateProject — UC-02 Backend Integração', () => {
  it('git log mostra "chore: genova update <from> → <to>"', () => {
    const workspaceRoot = tempWorkspace();
    const scaffoldResult = scaffoldProject({
      ...baseScaffoldOptions,
      name: 'demo',
      workspaceRoot,
      cliVersion: '1.0.0',
    });
    if (scaffoldResult.mode !== 'apply') throw new Error('unreachable');

    const projectDir = scaffoldResult.projectDir;
    writeFileSync(join(projectDir, '.genova-version'), '0.9.0\n', 'utf-8');

    updateProject({
      cliVersion: '1.1.0',
      projectDir,
      workspaceRoot,
      choices: {},
    });

    const log = execFileSync('git', ['log', '--format=%s', '-n', '2'], {
      cwd: projectDir,
      encoding: 'utf-8',
    })
      .trim()
      .split('\n');

    expect(log[0]).toBe('chore: genova update 0.9.0 → 1.1.0');
    expect(log[1]).toBe('chore: scaffold');
  });

  it('projects.json é atualizado com novo genovaVersion e updatedAt timestamp', () => {
    const workspaceRoot = tempWorkspace();
    const scaffoldResult = scaffoldProject({
      ...baseScaffoldOptions,
      name: 'demo',
      workspaceRoot,
      cliVersion: '1.0.0',
    });
    if (scaffoldResult.mode !== 'apply') throw new Error('unreachable');

    const projectDir = scaffoldResult.projectDir;
    const registryBefore = readRegistry(join(workspaceRoot, 'projects.json'));
    const entryBefore = registryBefore.projects.find((p) => p.name === 'demo');
    const updatedAtBefore = entryBefore?.updatedAt ?? '';

    writeFileSync(join(projectDir, '.genova-version'), '0.9.0\n', 'utf-8');

    // aguarda ~1ms para garantir timestamp diferente
    const timeoutMs = 10;
    execSync(`powershell -Command "Start-Sleep -Milliseconds ${timeoutMs}"`, { stdio: 'ignore' });

    updateProject({
      cliVersion: '1.1.0',
      projectDir,
      workspaceRoot,
      choices: {},
    });

    const registryAfter = readRegistry(join(workspaceRoot, 'projects.json'));
    const entryAfter = registryAfter.projects.find((p) => p.name === 'demo');

    expect(entryAfter?.genovaVersion).toBe('1.1.0');
    expect(entryAfter?.updatedAt).not.toBe(updatedAtBefore);
  });
});

describe('updateProject — UC-02 Backend Unit (Plan Mode)', () => {
  it('--plan retorna pendencies vazias e alreadyUpToDate: true/false', () => {
    const workspaceRoot = tempWorkspace();
    const scaffoldResult = scaffoldProject({
      ...baseScaffoldOptions,
      name: 'demo',
      workspaceRoot,
      cliVersion: '1.0.0',
    });
    if (scaffoldResult.mode !== 'apply') throw new Error('unreachable');

    const projectDir = scaffoldResult.projectDir;

    // projeto up-to-date
    const resultUpToDate = updateProject({
      cliVersion: '1.0.0',
      projectDir,
      workspaceRoot,
      plan: true,
      choices: {},
    });
    expect(resultUpToDate.mode).toBe('plan');
    expect(resultUpToDate.pendencies).toEqual([]);
    expect(resultUpToDate.alreadyUpToDate).toBe(true);

    // projeto desatualizado
    writeFileSync(join(projectDir, '.genova-version'), '0.9.0\n', 'utf-8');
    const resultDesatualizado = updateProject({
      cliVersion: '1.0.0',
      projectDir,
      workspaceRoot,
      plan: true,
      choices: {},
    });
    expect(resultDesatualizado.mode).toBe('plan');
    expect(resultDesatualizado.pendencies).toEqual([]);
    expect(resultDesatualizado.alreadyUpToDate).toBe(false);
  });
});
