import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import { readTemplate, renderTemplate } from './templates.js';
import { classifyProjectFiles, hasRelevantContent } from './relevance-classifier.js';
import { readRegistry, upsertProject, writeRegistry, type ProjectStack } from './projects-registry.js';
import { resolvePlanContract, type Pendency, type PlanContractOptions } from './plan-contract.js';

export class ProjectAlreadyAdoptedError extends Error {
  constructor(projectDir: string) {
    super(
      `${projectDir} ja tem .genova-version. Rode "genova update" em seu lugar.`
    );
    this.name = 'ProjectAlreadyAdoptedError';
  }
}

export interface AdjustStandardOptions extends PlanContractOptions {
  projectDir: string;
  workspaceRoot: string;
  cliVersion: string;
  homeDirOverride?: string;
}

export interface AdjustStandardPlanResult {
  mode: 'plan';
  pendencies: Pendency[];
}

export interface AdjustStandardAppliedResult {
  mode: 'applied';
  projectDir: string;
}

function computeIaHistoryImportPath(genovaDir: string, home: string): string {
  const target = join(home, '.ia_history', 'INDEX.md');
  return relative(genovaDir, target).split('\\').join('/');
}

function buildAgentFilePendencies(projectDir: string): Pendency[] {
  const classified = classifyProjectFiles(projectDir);
  const pendencies: Pendency[] = [];

  for (const [file, result] of Object.entries(classified)) {
    if (result.isRelevant) {
      pendencies.push({
        id: `agent-file-${file}`,
        description: `${file} tem conteudo relevante (${result.reason}). Prepend rules.md import ou sobrescrever?`,
      });
    }
  }

  return pendencies;
}

function mergeGitignore(projectDir: string, newContent: string): void {
  const gitignorePath = join(projectDir, '.gitignore');
  const existing = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf-8') : '';
  const newLines = newContent.split('\n').filter((l) => l.trim().length > 0);
  const existingLines = existing.split('\n').filter((l) => l.trim().length > 0);

  const merged = Array.from(new Set([...existingLines, ...newLines])).join('\n') + '\n';
  writeFileSync(gitignorePath, merged, 'utf-8');
}

/**
 * `genova adjust-standard` (specs genova-project-sync, UC-05):
 * full adoption com standardization de projeto legado — verifica conteudo
 * relevante, gera pendencias, escreve arquivos, atualiza registry.
 */
export function adjustStandard(
  options: AdjustStandardOptions
): AdjustStandardPlanResult | AdjustStandardAppliedResult {
  if (existsSync(join(options.projectDir, '.genova-version'))) {
    throw new ProjectAlreadyAdoptedError(options.projectDir);
  }

  // Coleta pendências de conteúdo relevante
  const pendencies = buildAgentFilePendencies(options.projectDir);
  const contractResult = resolvePlanContract(pendencies, options);

  if (contractResult.mode === 'plan') {
    return { mode: 'plan', pendencies: contractResult.pendencies };
  }

  // Aplica mudanças
  ensureDir(join(options.projectDir, '.genova'));
  ensureDir(join(options.projectDir, 'openspec'));

  const home = options.homeDirOverride ?? homedir();
  const iaHistoryImportPath = computeIaHistoryImportPath(join(options.projectDir, '.genova'), home);

  // Extrai nome do projeto do path
  const projectName = relative(options.workspaceRoot, options.projectDir).split('\\').pop() ?? 'unknown';

  // Escreve/atualiza .genova/rules.md
  const rulesMd = renderTemplate(readTemplate('rules.md.tmpl'), {
    PROJECT_NAME: projectName,
    STACK: 'desconhecida',
    GENOVA_VERSION: options.cliVersion,
    IA_HISTORY_IMPORT_PATH: iaHistoryImportPath,
  });
  writeFileSync(join(options.projectDir, '.genova', 'rules.md'), rulesMd, 'utf-8');

  // Trata CLAUDE.md/AGENTS.md/GEMINI.md conforme escolha
  const choices = contractResult.choices ?? {};
  const classified = classifyProjectFiles(options.projectDir);

  for (const agentFile of ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md']) {
    const choiceKey = `agent-file-${agentFile}`;
    const result = classified[agentFile];

    if (!result.isRelevant || !choices[choiceKey]) {
      // Sobrescreve sem perguntar (arquivo sem conteúdo ou não era pendência)
      const template = readTemplate(`${agentFile}.tmpl`);
      writeFileSync(join(options.projectDir, agentFile), template, 'utf-8');
    } else if (choices[choiceKey] === 'prepend') {
      // Prependiza: adiciona @.genova/rules.md como primeira linha se não existir
      const existingContent = existsSync(join(options.projectDir, agentFile))
        ? readFileSync(join(options.projectDir, agentFile), 'utf-8')
        : '';

      if (!existingContent.trim().startsWith('@.genova/rules.md')) {
        const updated = '@.genova/rules.md\n\n' + existingContent;
        writeFileSync(join(options.projectDir, agentFile), updated, 'utf-8');
      }
    }
    // choice 'keep' faz nada
  }

  // Trata openspec/config.yaml: cria se não existe, sobrescreve se existe com drift
  ensureDir(join(options.projectDir, 'openspec'));
  const configYaml = renderTemplate(readTemplate('openspec-config.yaml.tmpl'), {
    PROJECT_NAME: projectName,
    STACK: 'desconhecida',
  });
  writeFileSync(join(options.projectDir, 'openspec', 'config.yaml'), configYaml, 'utf-8');

  // Mesclação de .gitignore
  const gitignoreContent = readTemplate('gitignore.tmpl');
  mergeGitignore(options.projectDir, gitignoreContent);

  // Escreve .genova-version
  writeFileSync(join(options.projectDir, '.genova-version'), options.cliVersion + '\n', 'utf-8');

  // Commit (se tiver git repo)
  if (existsSync(join(options.projectDir, '.git'))) {
    const gitConfigArgs = ['-c', 'user.name=genova-cli', '-c', 'user.email=genova-cli@local'];
    try {
      execFileSync('git', [...gitConfigArgs, 'add', '.genova', '.genova-version', '.gitignore', 'openspec/config.yaml'], {
        cwd: options.projectDir,
        stdio: 'ignore',
      });
      execFileSync('git', [...gitConfigArgs, 'commit', '-m', `chore: adopt via genova adjust-standard`], {
        cwd: options.projectDir,
        stdio: 'ignore',
      });
    } catch {
      // Se git falhar, segue mesmo assim (projeto pode não estar versionado)
    }
  }

  // Atualiza projects.json
  const registryPath = join(options.workspaceRoot, 'projects.json');
  const registry = existsSync(registryPath) ? readRegistry(registryPath) : { projects: [] };
  const relPath = relative(options.workspaceRoot, options.projectDir).split('\\').join('/');
  const now = new Date().toISOString();
  const updated = upsertProject(registry, {
    name: projectName,
    path: relPath,
    stack: null as unknown as ProjectStack, // stack desconhecida
    genovaVersion: options.cliVersion,
    registeredAt: now,
    updatedAt: now,
  });
  writeRegistry(registryPath, updated);

  return { mode: 'applied', projectDir: options.projectDir };
}

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}
