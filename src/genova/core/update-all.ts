import { join } from 'node:path';
import { readRegistry } from './projects-registry.js';
import { updateProject } from './update-project.js';
import type { Pendency } from './plan-contract.js';

export interface ProjectPendencyGroup {
  name: string;
  path: string;
  pendencies: Pendency[];
}

export interface UpdateAllPlanResult {
  mode: 'plan';
  projects: ProjectPendencyGroup[];
}

export type ProjectUpdateStatus = 'applied' | 'already-up-to-date' | 'failed';

export interface ProjectUpdateReport {
  name: string;
  path: string;
  status: ProjectUpdateStatus;
  detail?: string;
}

export interface UpdateAllApplyResult {
  mode: 'apply';
  reports: ProjectUpdateReport[];
}

interface UpdateAllOptions {
  workspaceRoot: string;
  cliVersion: string;
  plan?: boolean;
  choicesByProject?: Record<string, Record<string, string>>;
  homeDirOverride?: string;
}

/**
 * `genova update all` (specs genova-project-sync): roda --plan em todos os
 * projetos e agrega as pendências num único JSON — nunca pergunta projeto
 * a projeto (UC-03).
 */
export function updateAll(
  options: UpdateAllOptions
): UpdateAllPlanResult | UpdateAllApplyResult {
  const registry = readRegistry(join(options.workspaceRoot, 'projects.json'));

  if (options.plan) {
    const projects: ProjectPendencyGroup[] = registry.projects.map((entry) => {
      let pendencies: Pendency[] = [];
      try {
        const result = updateProject({
          cliVersion: options.cliVersion,
          projectDir: join(options.workspaceRoot, entry.path),
          workspaceRoot: options.workspaceRoot,
          homeDirOverride: options.homeDirOverride,
          plan: true,
        });
        if (result.mode === 'plan') {
          pendencies = result.pendencies;
        }
      } catch {
        // erro de disco/adocao vira pendencia informativa, tratado como falha na aplicacao
        pendencies = [{ id: 'error', description: `Falha ao planejar ${entry.name}.` }];
      }
      return { name: entry.name, path: entry.path, pendencies };
    });
    return { mode: 'plan', projects };
  }

  const reports: ProjectUpdateReport[] = registry.projects.map((entry) => {
    const choices = options.choicesByProject?.[entry.name] ?? {};
    try {
      const result = updateProject({
        cliVersion: options.cliVersion,
        projectDir: join(options.workspaceRoot, entry.path),
        workspaceRoot: options.workspaceRoot,
        homeDirOverride: options.homeDirOverride,
        choices,
      });
      if (result.mode === 'already-up-to-date') {
        return { name: entry.name, path: entry.path, status: 'already-up-to-date' };
      }
      return { name: entry.name, path: entry.path, status: 'applied' };
    } catch (error) {
      return {
        name: entry.name,
        path: entry.path,
        status: 'failed',
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  });

  return { mode: 'apply', reports };
}
