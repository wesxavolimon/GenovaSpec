import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  InvalidStackError,
  MissingRemoteError,
  scaffoldProject,
} from '../../src/genova/core/scaffold-project.js';
import { readRegistry } from '../../src/genova/core/projects-registry.js';
import { PendingChoicesError } from '../../src/genova/core/plan-contract.js';

function tempWorkspace(): string {
  return mkdtempSync(join(tmpdir(), 'genova-new-'));
}

const baseOptions = {
  name: 'demo',
  stack: 'node',
  remote: 'https://example.com/demo.git',
  cliVersion: '1.0.0',
  choices: {},
};

describe('scaffoldProject — UC-01 Backend Funcional', () => {
  it('cria scaffold completo: .genova/rules.md, .genova-version, CLAUDE.md com @import na 1a linha', () => {
    const workspaceRoot = tempWorkspace();

    const result = scaffoldProject({ ...baseOptions, workspaceRoot });

    expect(result.mode).toBe('apply');
    if (result.mode !== 'apply') throw new Error('unreachable');

    expect(existsSync(join(result.projectDir, '.genova', 'rules.md'))).toBe(true);
    expect(existsSync(join(result.projectDir, '.genova-version'))).toBe(true);
    expect(readFileSync(join(result.projectDir, '.genova-version'), 'utf-8').trim()).toBe('1.0.0');

    const claudeMd = readFileSync(join(result.projectDir, 'CLAUDE.md'), 'utf-8');
    const firstNonEmptyLine = claudeMd.split('\n').find((l) => l.trim().length > 0);
    expect(firstNonEmptyLine).toBe('@.genova/rules.md');
  });

  it('7a: falha com exception quando falta --remote', () => {
    const workspaceRoot = tempWorkspace();
    expect(() =>
      scaffoldProject({ ...baseOptions, remote: undefined, workspaceRoot })
    ).toThrow(MissingRemoteError);
  });

  it('7b: reporta erro com JSON de pendencias quando ha conflito sem --choices/--plan', () => {
    const workspaceRoot = tempWorkspace();
    // primeira chamada cria o diretorio; a segunda deve achar pendencia de conflito
    scaffoldProject({ ...baseOptions, workspaceRoot });

    expect(() =>
      scaffoldProject({ ...baseOptions, choices: undefined, workspaceRoot })
    ).toThrow(PendingChoicesError);
  });

  it('rejeita stack invalida', () => {
    const workspaceRoot = tempWorkspace();
    expect(() =>
      scaffoldProject({ ...baseOptions, stack: 'rust', workspaceRoot })
    ).toThrow(InvalidStackError);
  });

  it('--plan reporta pendencias vazias sem tocar o disco', () => {
    const workspaceRoot = tempWorkspace();
    const result = scaffoldProject({
      ...baseOptions,
      plan: true,
      remote: undefined,
      workspaceRoot,
    });
    expect(result).toEqual({ mode: 'plan', pendencies: [] });
    expect(existsSync(join(workspaceRoot, 'src'))).toBe(false);
  });
});

describe('scaffoldProject — UC-01 Backend Integração', () => {
  it('git log -1 mostra "chore: scaffold" e projects.json contem a entrada', () => {
    const workspaceRoot = tempWorkspace();
    const result = scaffoldProject({ ...baseOptions, workspaceRoot });
    if (result.mode !== 'apply') throw new Error('unreachable');

    const log = execFileSync('git', ['log', '-1', '--format=%s'], {
      cwd: result.projectDir,
      encoding: 'utf-8',
    }).trim();
    expect(log).toBe('chore: scaffold');

    const registry = readRegistry(join(workspaceRoot, 'projects.json'));
    expect(registry.projects.some((p) => p.name === 'demo')).toBe(true);
  });

  it('gera bootstrap-setup com tasks.md nao marcado (nenhum [x])', () => {
    const workspaceRoot = tempWorkspace();
    const result = scaffoldProject({ ...baseOptions, workspaceRoot });
    if (result.mode !== 'apply') throw new Error('unreachable');

    const tasksMd = readFileSync(join(result.bootstrapChangeDir, 'tasks.md'), 'utf-8');
    expect(tasksMd).toMatch(/- \[ \] /);
    expect(tasksMd).not.toMatch(/- \[x\] /);
  });
});

describe('bootstrap java — Backend Unit (design.md Docker Isolation)', () => {
  it('nenhuma task referencia mvn/java fora de docker', () => {
    const workspaceRoot = tempWorkspace();
    const result = scaffoldProject({ ...baseOptions, stack: 'java', workspaceRoot });
    if (result.mode !== 'apply') throw new Error('unreachable');

    const tasksMd = readFileSync(join(result.bootstrapChangeDir, 'tasks.md'), 'utf-8');
    const offendingLines = tasksMd
      .split('\n')
      .filter((line) => /\b(mvn|java)\b/.test(line))
      .filter((line) => !/docker/i.test(line))
      // disclaimers tipo "sem `mvn`/`java` no host" descrevem a ausencia, nao uma invocacao
      .filter((line) => !/sem\s+`?\(?mvn|nunca\s+`?mvn/i.test(line));

    expect(offendingLines).toEqual([]);
  });

  it('gera checkboxes [ ] pra todas as stacks', () => {
    for (const stack of ['dotnet', 'node', 'java', 'python']) {
      const workspaceRoot = tempWorkspace();
      const result = scaffoldProject({
        ...baseOptions,
        stack,
        name: `demo-${stack}`,
        workspaceRoot,
      });
      if (result.mode !== 'apply') throw new Error('unreachable');
      const tasksMd = readFileSync(join(result.bootstrapChangeDir, 'tasks.md'), 'utf-8');
      expect(tasksMd).toMatch(/- \[ \] /);
    }
  });
});
