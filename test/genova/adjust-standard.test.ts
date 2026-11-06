import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  adjustStandard,
  ProjectAlreadyAdoptedError,
} from '../../src/genova/core/adjust-standard.js';
import { classifyProjectFiles, classifyAgentFile } from '../../src/genova/core/relevance-classifier.js';
import { PendingChoicesError } from '../../src/genova/core/plan-contract.js';
import { readRegistry } from '../../src/genova/core/projects-registry.js';

function tempWorkspace(): string {
  return mkdtempSync(join(tmpdir(), 'genova-adjust-'));
}

describe('classifyAgentFile — Relevance Classifier', () => {
  it('arquivo vazio nao eh relevante', () => {
    const tmpDir = tempWorkspace();
    const filePath = join(tmpDir, 'CLAUDE.md');
    writeFileSync(filePath, '', 'utf-8');

    const result = classifyAgentFile(filePath);
    expect(result.isRelevant).toBe(false);
  });

  it('arquivo com so @import nao eh relevante', () => {
    const tmpDir = tempWorkspace();
    const filePath = join(tmpDir, 'CLAUDE.md');
    writeFileSync(filePath, '@.genova/rules.md\n', 'utf-8');

    const result = classifyAgentFile(filePath);
    expect(result.isRelevant).toBe(false);
  });

  it('arquivo com conteudo customizado eh relevante', () => {
    const tmpDir = tempWorkspace();
    const filePath = join(tmpDir, 'CLAUDE.md');
    writeFileSync(filePath, '@.genova/rules.md\n\n## Meu conteudo customizado\n\nTexto importante.\n', 'utf-8');

    const result = classifyAgentFile(filePath);
    expect(result.isRelevant).toBe(true);
  });

  it('arquivo inexistente nao eh relevante', () => {
    const result = classifyAgentFile('/nonexistent/CLAUDE.md');
    expect(result.isRelevant).toBe(false);
  });
});

describe('adjustStandard — UC-05 Backend Funcional', () => {
  it('lanca ProjectAlreadyAdoptedError se .genova-version ja existe', () => {
    const workspaceRoot = tempWorkspace();
    const projectDir = join(workspaceRoot, 'src', 'PROJETOS', 'proj');
    const fsModule = require('node:fs');
    fsModule.mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, '.genova-version'), '1.0.0\n', 'utf-8');

    expect(() =>
      adjustStandard({
        projectDir,
        workspaceRoot,
        cliVersion: '1.0.0',
        choices: {},
      })
    ).toThrow(ProjectAlreadyAdoptedError);
  });

  it('projeto sem conteudo relevante: sobrescreve tudo, nao gera pendencias', () => {
    const workspaceRoot = tempWorkspace();
    const projectDir = join(workspaceRoot, 'src', 'PROJETOS', 'proj');
    const fsModule = require('node:fs');
    fsModule.mkdirSync(projectDir, { recursive: true });
    fsModule.mkdirSync(join(projectDir, 'openspec'), { recursive: true });

    // Cria CLAUDE.md vazio (nao eh relevante)
    writeFileSync(join(projectDir, 'CLAUDE.md'), '', 'utf-8');

    const result = adjustStandard({
      projectDir,
      workspaceRoot,
      cliVersion: '1.0.0',
      choices: {},
    });

    expect(result.mode).toBe('applied');
    expect(existsSync(join(projectDir, '.genova-version'))).toBe(true);
    expect(existsSync(join(projectDir, '.genova', 'rules.md'))).toBe(true);

    // CLAUDE.md foi sobrescrito com template vazio/minimo
    const claudeMd = readFileSync(join(projectDir, 'CLAUDE.md'), 'utf-8');
    expect(claudeMd).toContain('@.genova/rules.md');
  });

  it('projeto com conteudo relevante: gera pendencia no --plan', () => {
    const workspaceRoot = tempWorkspace();
    const projectDir = join(workspaceRoot, 'src', 'PROJETOS', 'proj');
    const fsModule = require('node:fs');
    fsModule.mkdirSync(projectDir, { recursive: true });
    fsModule.mkdirSync(join(projectDir, 'openspec'), { recursive: true });

    // Cria CLAUDE.md com conteudo customizado
    writeFileSync(
      join(projectDir, 'CLAUDE.md'),
      '@.genova/rules.md\n\n# Meu conteudo important\n\nRegras custom do projeto.\n',
      'utf-8'
    );

    const result = adjustStandard({
      projectDir,
      workspaceRoot,
      cliVersion: '1.0.0',
      plan: true,
    });

    expect(result.mode).toBe('plan');
    expect(result.pendencies.length).toBeGreaterThan(0);
    expect(result.pendencies.some((p) => p.id === 'agent-file-CLAUDE.md')).toBe(true);
  });

  it('com --choices pode aplicar (keep conteudo customizado)', () => {
    const workspaceRoot = tempWorkspace();
    const projectDir = join(workspaceRoot, 'src', 'PROJETOS', 'proj');
    const fsModule = require('node:fs');
    fsModule.mkdirSync(projectDir, { recursive: true });
    fsModule.mkdirSync(join(projectDir, 'openspec'), { recursive: true });

    const customContent = '@.genova/rules.md\n\n# Meu conteudo important\n\nRegras custom do projeto.\n';
    writeFileSync(join(projectDir, 'CLAUDE.md'), customContent, 'utf-8');

    const result = adjustStandard({
      projectDir,
      workspaceRoot,
      cliVersion: '1.0.0',
      choices: { 'agent-file-CLAUDE.md': 'keep' },
    });

    expect(result.mode).toBe('applied');

    // CLAUDE.md foi preservado
    const claudeMdAfter = readFileSync(join(projectDir, 'CLAUDE.md'), 'utf-8');
    expect(claudeMdAfter).toBe(customContent);
  });
});

describe('adjustStandard — UC-05 Backend Integração', () => {
  it('projects.json eh atualizado e entry tem stack:null', () => {
    const workspaceRoot = tempWorkspace();
    const projectDir = join(workspaceRoot, 'src', 'PROJETOS', 'proj');
    const fsModule = require('node:fs');
    fsModule.mkdirSync(projectDir, { recursive: true });
    fsModule.mkdirSync(join(projectDir, 'openspec'), { recursive: true });

    const result = adjustStandard({
      projectDir,
      workspaceRoot,
      cliVersion: '1.0.0',
      choices: {},
    });

    expect(result.mode).toBe('applied');

    const registry = readRegistry(join(workspaceRoot, 'projects.json'));
    const entry = registry.projects.find((p) => p.name === 'proj');
    expect(entry).toBeDefined();
    expect(entry?.stack).toBeNull();
    expect(entry?.genovaVersion).toBe('1.0.0');
  });

  it('.gitignore eh mesclado (adiciona linhas novas, preserva existentes)', () => {
    const workspaceRoot = tempWorkspace();
    const projectDir = join(workspaceRoot, 'src', 'PROJETOS', 'proj');
    const fsModule = require('node:fs');
    fsModule.mkdirSync(projectDir, { recursive: true });
    fsModule.mkdirSync(join(projectDir, 'openspec'), { recursive: true });

    // Gitignore existente com conteudo custom
    writeFileSync(join(projectDir, '.gitignore'), 'custom-exclude/\nmy-cache/\n', 'utf-8');

    adjustStandard({
      projectDir,
      workspaceRoot,
      cliVersion: '1.0.0',
      choices: {},
    });

    const gitignore = readFileSync(join(projectDir, '.gitignore'), 'utf-8');
    // Preserva custom
    expect(gitignore).toContain('custom-exclude/');
    // Adiciona novo (template inclui worktrees/, graphify-out/, etc)
    expect(gitignore).toContain('worktrees/');
  });
});
