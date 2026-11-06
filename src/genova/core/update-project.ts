import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import { readTemplate, renderTemplate } from './templates.js';
import { isUpToDate } from './version.js';
import { resolvePlanContract, type Pendency, type PlanContractOptions } from './plan-contract.js';
import { readRegistry, upsertProject, writeRegistry, type ProjectStack } from './projects-registry.js';

export interface UpdateProjectOptions extends PlanContractOptions {
  cliVersion: string;
  projectDir: string;
  workspaceRoot: string;
  homeDirOverride?: string;
}

export interface UpdatePlanResult {
  mode: 'plan';
  pendencies: Pendency[];
  alreadyUpToDate: boolean;
}

export interface UpdateAppliedResult {
  mode: 'applied';
  from: string;
  to: string;
}

export interface UpdateSkippedResult {
  mode: 'already-up-to-date';
  version: string;
}

export class ProjectNotAdoptedError extends Error {
  constructor(projectDir: string) {
    super(
      `${projectDir} nao tem .genova-version. Rode "genova register" ou "genova adjust-standard" primeiro.`
    );
    this.name = 'ProjectNotAdoptedError';
  }
}

export class ProjectNotRegisteredError extends Error {
  constructor(projectDir: string) {
    super(`${projectDir} nao esta em projects.json. Rode "genova register" primeiro.`);
    this.name = 'ProjectNotRegisteredError';
  }
}

function readGenovaVersion(projectDir: string): string | null {
  const path = join(projectDir, '.genova-version');
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8').trim();
}

function computeIaHistoryImportPath(genovaDir: string, home: string): string {
  const target = join(home, '.ia_history', 'INDEX.md');
  return relative(genovaDir, target).split('\\').join('/');
}

/**
 * `genova update` (specs genova-project-sync, genova-single-source-rules):
 * reescreve só `.genova/rules.md` — CLAUDE/AGENTS/GEMINI.md nunca são tocados.
 */
export function updateProject(
  options: UpdateProjectOptions
): UpdatePlanResult | UpdateAppliedResult | UpdateSkippedResult {
  const currentVersion = readGenovaVersion(options.projectDir);
  if (currentVersion === null) {
    throw new ProjectNotAdoptedError(options.projectDir);
  }

  const upToDate = isUpToDate(currentVersion, options.cliVersion);
  const pendencies: Pendency[] = [];
  const contractResult = resolvePlanContract(pendencies, options);

  if (contractResult.mode === 'plan') {
    return { mode: 'plan', pendencies, alreadyUpToDate: upToDate };
  }

  if (upToDate) {
    return { mode: 'already-up-to-date', version: currentVersion };
  }

  const registryPath = join(options.workspaceRoot, 'projects.json');
  const registry = readRegistry(registryPath);
  const relPath = relative(options.workspaceRoot, options.projectDir).split('\\').join('/');
  const entry = registry.projects.find((p) => p.path === relPath);
  if (!entry) {
    throw new ProjectNotRegisteredError(options.projectDir);
  }

  const home = options.homeDirOverride ?? homedir();
  const iaHistoryImportPath = computeIaHistoryImportPath(join(options.projectDir, '.genova'), home);

  const rulesMd = renderTemplate(readTemplate('rules.md.tmpl'), {
    PROJECT_NAME: entry.name,
    STACK: entry.stack ?? 'desconhecida',
    GENOVA_VERSION: options.cliVersion,
    IA_HISTORY_IMPORT_PATH: iaHistoryImportPath,
  });
  writeFileSync(join(options.projectDir, '.genova', 'rules.md'), rulesMd, 'utf-8');
  writeFileSync(join(options.projectDir, '.genova-version'), options.cliVersion + '\n', 'utf-8');

  const gitConfigArgs = ['-c', 'user.name=genova-cli', '-c', 'user.email=genova-cli@local'];
  execFileSync('git', [...gitConfigArgs, 'add', '.genova/rules.md', '.genova-version'], {
    cwd: options.projectDir,
    stdio: 'ignore',
  });
  execFileSync(
    'git',
    [...gitConfigArgs, 'commit', '-m', `chore: genova update ${currentVersion} → ${options.cliVersion}`],
    { cwd: options.projectDir, stdio: 'ignore' }
  );

  const now = new Date().toISOString();
  const updatedRegistry = upsertProject(registry, {
    ...entry,
    stack: entry.stack as ProjectStack,
    genovaVersion: options.cliVersion,
    updatedAt: now,
  });
  writeRegistry(registryPath, updatedRegistry);

  return { mode: 'applied', from: currentVersion, to: options.cliVersion };
}
