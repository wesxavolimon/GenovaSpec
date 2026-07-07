import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, dirname } from 'node:path';
import { readTemplate, renderTemplate } from './templates.js';
import { resolvePlanContract, type Pendency, type PlanContractOptions } from './plan-contract.js';
import {
  emptyRegistry,
  readRegistry,
  upsertProject,
  writeRegistry,
  type ProjectStack,
} from './projects-registry.js';

export type ProjectType = 'projeto' | 'mcp' | 'poc';

const TYPE_TO_BASE_DIR: Record<ProjectType, string> = {
  projeto: 'src/PROJETOS',
  mcp: 'src/MCPS',
  poc: 'src/PoCs',
};

const VALID_STACKS: ProjectStack[] = ['dotnet', 'node', 'java', 'python'];

const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export interface ScaffoldOptions extends PlanContractOptions {
  name: string;
  type?: ProjectType;
  stack: string;
  remote?: string;
  cliVersion: string;
  /** Raiz do workspace onde `src/PROJETOS|MCPS|PoCs/<nome>` e `projects.json` vivem. Default: cwd. */
  workspaceRoot?: string;
  /** Override de `$HOME`, só pra teste — evita depender do homedir real. */
  homeDirOverride?: string;
}

export interface ScaffoldPlanResult {
  mode: 'plan';
  pendencies: Pendency[];
}

export interface ScaffoldApplyResult {
  mode: 'apply';
  projectDir: string;
  bootstrapChangeDir: string;
}

export class MissingRemoteError extends Error {
  constructor() {
    super('genova new exige --remote <url> (o CLI nao pergunta via stdin).');
    this.name = 'MissingRemoteError';
  }
}

export class InvalidStackError extends Error {
  constructor(stack: string) {
    super(`Stack invalida: "${stack}". Use uma de: ${VALID_STACKS.join(', ')}.`);
    this.name = 'InvalidStackError';
  }
}

export class InvalidNameError extends Error {
  constructor(name: string) {
    super(`Nome de projeto invalido: "${name}".`);
    this.name = 'InvalidNameError';
  }
}

function computeIaHistoryImportPath(genovaDir: string, home: string): string {
  const target = join(home, '.ia_history', 'INDEX.md');
  const rel = relative(genovaDir, target).split('\\').join('/');
  return rel;
}

function detectPendencies(projectDir: string): Pendency[] {
  if (existsSync(projectDir) && readdirSync(projectDir).length > 0) {
    return [
      {
        id: 'target-exists',
        description: `Diretorio ${projectDir} ja existe e nao esta vazio.`,
      },
    ];
  }
  return [];
}

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

/**
 * `genova new` (design.md D1/D2/D8; specs genova-project-scaffold): cria só
 * scaffold (nunca código de aplicação), nunca espera stdin — conflitos vão
 * pelo contrato --plan/--choices (plan-contract.ts).
 */
export function scaffoldProject(
  options: ScaffoldOptions
): ScaffoldPlanResult | ScaffoldApplyResult {
  if (!NAME_PATTERN.test(options.name)) {
    throw new InvalidNameError(options.name);
  }
  if (!VALID_STACKS.includes(options.stack as ProjectStack)) {
    throw new InvalidStackError(options.stack);
  }

  const workspaceRoot = options.workspaceRoot ?? process.cwd();
  const type = options.type ?? 'projeto';
  const projectDir = join(workspaceRoot, TYPE_TO_BASE_DIR[type], options.name);

  const pendencies = detectPendencies(projectDir);
  const contractResult = resolvePlanContract(pendencies, options);

  if (contractResult.mode === 'plan') {
    return { mode: 'plan', pendencies: contractResult.pendencies };
  }

  if (!options.remote) {
    throw new MissingRemoteError();
  }

  const stack = options.stack as Exclude<ProjectStack, null>;

  ensureDir(projectDir);
  ensureDir(join(projectDir, '.genova'));
  ensureDir(join(projectDir, 'openspec', 'changes'));
  ensureDir(join(projectDir, 'openspec', 'specs'));
  ensureDir(join(projectDir, 'openspec', 'archive'));

  const home = options.homeDirOverride ?? homedir();
  const iaHistoryImportPath = computeIaHistoryImportPath(join(projectDir, '.genova'), home);

  const rulesMd = renderTemplate(readTemplate('rules.md.tmpl'), {
    PROJECT_NAME: options.name,
    STACK: stack,
    GENOVA_VERSION: options.cliVersion,
    IA_HISTORY_IMPORT_PATH: iaHistoryImportPath,
  });
  writeFileSync(join(projectDir, '.genova', 'rules.md'), rulesMd, 'utf-8');

  for (const agentFile of ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md']) {
    writeFileSync(
      join(projectDir, agentFile),
      readTemplate(`${agentFile}.tmpl`),
      'utf-8'
    );
  }

  const configYaml = renderTemplate(readTemplate('openspec-config.yaml.tmpl'), {
    PROJECT_NAME: options.name,
    STACK: stack,
  });
  writeFileSync(join(projectDir, 'openspec', 'config.yaml'), configYaml, 'utf-8');
  writeFileSync(join(projectDir, 'openspec', 'specs', '.gitkeep'), '', 'utf-8');
  writeFileSync(join(projectDir, 'openspec', 'archive', '.gitkeep'), '', 'utf-8');

  writeFileSync(join(projectDir, '.gitignore'), readTemplate('gitignore.tmpl'), 'utf-8');
  writeFileSync(join(projectDir, '.genova-version'), options.cliVersion + '\n', 'utf-8');

  const bootstrapChangeDir = createBootstrapChange(projectDir, options.name, stack);

  const gitConfigArgs = [
    '-c',
    'user.name=genova-cli',
    '-c',
    'user.email=genova-cli@local',
  ];
  execFileSync('git', ['init'], { cwd: projectDir, stdio: 'ignore' });
  execFileSync('git', [...gitConfigArgs, 'add', '-A'], { cwd: projectDir, stdio: 'ignore' });
  execFileSync('git', [...gitConfigArgs, 'commit', '-m', 'chore: scaffold'], {
    cwd: projectDir,
    stdio: 'ignore',
  });

  updateProjectsRegistry(workspaceRoot, options.name, projectDir, stack, options.cliVersion);

  return { mode: 'apply', projectDir, bootstrapChangeDir };
}

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

function createBootstrapChange(
  projectDir: string,
  projectName: string,
  stack: Exclude<ProjectStack, null>
): string {
  const changeDir = join(projectDir, 'openspec', 'changes', `c${timestamp()}-bootstrap-setup`);
  ensureDir(join(changeDir, 'specs'));

  writeFileSync(
    join(changeDir, 'proposal.md'),
    `# Proposta: bootstrap-setup\n\nSetup inicial de ${projectName} (stack: ${stack}) gerado por \`genova new\`. ` +
      'Scaffold apenas — nenhum código de aplicação foi criado; esta change cobre a fundação do projeto ' +
      '(estrutura, build, testes, Docker, CI, documentação).\n',
    'utf-8'
  );

  writeFileSync(
    join(changeDir, 'design.md'),
    `## Context\n\nProjeto novo, sem histórico. Bootstrap segue o template de stack \`${stack}\`.\n`,
    'utf-8'
  );

  const tasksTemplate = readTemplate(`bootstrap/${stack}/bootstrap-tasks.md.tmpl`);
  writeFileSync(
    join(changeDir, 'tasks.md'),
    renderTemplate(tasksTemplate, { PROJECT_NAME: projectName }),
    'utf-8'
  );

  writeFileSync(join(changeDir, 'specs', '.gitkeep'), '', 'utf-8');

  return changeDir;
}

function updateProjectsRegistry(
  workspaceRoot: string,
  name: string,
  projectDir: string,
  stack: Exclude<ProjectStack, null>,
  cliVersion: string
): void {
  const registryPath = join(workspaceRoot, 'projects.json');
  const registry = existsSync(registryPath) ? readRegistry(registryPath) : emptyRegistry();
  const now = new Date().toISOString();
  const updated = upsertProject(registry, {
    name,
    path: relative(workspaceRoot, projectDir).split('\\').join('/'),
    stack,
    genovaVersion: cliVersion,
    registeredAt: now,
    updatedAt: now,
  });
  ensureDir(dirname(registryPath));
  writeRegistry(registryPath, updated);
}
