import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerProject, AlreadyRegisteredError } from '../../src/genova/core/register-project.js';
import { readRegistry } from '../../src/genova/core/projects-registry.js';

function tempWorkspace(): string {
  return mkdtempSync(join(tmpdir(), 'genova-register-'));
}

describe('registerProject — UC-04 Backend Funcional', () => {
  it('cria .genova-version e adiciona a projects.json, nenhum outro arquivo tocado', () => {
    const workspaceRoot = tempWorkspace();
    const projectDir = join(workspaceRoot, 'src', 'PROJETOS', 'legacy-proj');
    const fsModule = require('node:fs');
    fsModule.mkdirSync(projectDir, { recursive: true });

    // Cria um arquivo arbitrário pra confirmar que não será tocado
    writeFileSync(join(projectDir, 'custom-file.txt'), 'custom content\n', 'utf-8');

    const result = registerProject({
      projectDir,
      workspaceRoot,
      cliVersion: '1.0.0',
    });

    expect(result.projectName).toBe('legacy-proj');
    expect(existsSync(join(projectDir, '.genova-version'))).toBe(true);
    expect(readFileSync(join(projectDir, '.genova-version'), 'utf-8').trim()).toBe('1.0.0');

    // Confirma que custom-file.txt não foi modificado
    expect(readFileSync(join(projectDir, 'custom-file.txt'), 'utf-8')).toBe('custom content\n');

    // Confirma que projects.json foi criado/atualizado
    const registry = readRegistry(join(workspaceRoot, 'projects.json'));
    const entry = registry.projects.find((p) => p.name === 'legacy-proj');
    expect(entry).toBeDefined();
    expect(entry?.stack).toBeNull();
    expect(entry?.genovaVersion).toBe('1.0.0');
  });

  it('lanca AlreadyRegisteredError se projeto ja esta em projects.json', () => {
    const workspaceRoot = tempWorkspace();
    const projectDir = join(workspaceRoot, 'src', 'PROJETOS', 'legacy-proj');
    const fsModule = require('node:fs');
    fsModule.mkdirSync(projectDir, { recursive: true });

    // Primeira chamada
    registerProject({
      projectDir,
      workspaceRoot,
      cliVersion: '1.0.0',
    });

    // Segunda chamada deve falhar
    expect(() =>
      registerProject({
        projectDir,
        workspaceRoot,
        cliVersion: '1.0.0',
      })
    ).toThrow(AlreadyRegisteredError);
  });
});

describe('registerProject — UC-04 Backend Integração', () => {
  it('projects.json eh gerado e entrada tem timestamps de registered/updated', () => {
    const workspaceRoot = tempWorkspace();
    const projectDir = join(workspaceRoot, 'src', 'PROJETOS', 'legacy-proj');
    const fsModule = require('node:fs');
    fsModule.mkdirSync(projectDir, { recursive: true });

    const result = registerProject({
      projectDir,
      workspaceRoot,
      cliVersion: '1.0.0',
    });

    expect(result.registeredAt).toBeDefined();
    expect(new Date(result.registeredAt).toISOString()).toBe(result.registeredAt);

    const registry = readRegistry(join(workspaceRoot, 'projects.json'));
    const entry = registry.projects.find((p) => p.name === 'legacy-proj');
    expect(entry?.registeredAt).toBe(result.registeredAt);
    expect(entry?.updatedAt).toBe(result.registeredAt);
  });
});

describe('genova register CLI — regression: cliVersion resolution', () => {
  it('CLI real invocation resolves cliVersion from program.version(), not fallback 0.0.0', () => {
    // Regressão: action() tinha assinatura (path, command) mas Commander real
    // passa (path, options, command) mesmo sem .option() declarado — o 2º
    // parâmetro é sempre `options` (objeto vazio se nenhuma opção existe).
    // Isso fazia `command.parent` ser undefined e cliVersion cair no fallback.
    const { Command } = require('commander');
    const program = new Command();
    program.name('genova').version('9.9.9');

    let capturedVersion: string | undefined;
    const sub = program.command('register <path>');
    sub.action((path: string, _options: unknown, command: any) => {
      capturedVersion = command.parent?.version() ?? '0.0.0';
    });

    program.parse(['node', 'genova', 'register', 'some/path']);

    expect(capturedVersion).toBe('9.9.9');
  });
});
