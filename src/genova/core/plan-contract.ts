import { readFileSync } from 'node:fs';

export interface Pendency {
  id: string;
  description: string;
}

export interface PlanContractOptions {
  plan?: boolean;
  choices?: Record<string, string>;
  choicesFile?: string;
}

export interface PlanResult {
  mode: 'plan';
  pendencies: Pendency[];
}

export interface ChoicesResult {
  mode: 'apply';
  choices: Record<string, string>;
}

export class PendingChoicesError extends Error {
  readonly plan: { pendencies: Pendency[] };

  constructor(pendencies: Pendency[]) {
    super(
      'Pendencias sem --choices: rode novamente com --plan pra ver as opcoes, ' +
        'ou resolva com --choices/--choices-file.'
    );
    this.name = 'PendingChoicesError';
    this.plan = { pendencies };
  }
}

function loadChoices(options: PlanContractOptions): Record<string, string> | undefined {
  if (options.choices) {
    return options.choices;
  }
  if (options.choicesFile) {
    const raw = readFileSync(options.choicesFile, 'utf-8');
    return JSON.parse(raw) as Record<string, string>;
  }
  return undefined;
}

/**
 * Contrato agent-only (design.md D1): nenhum caminho espera stdin.
 * --plan sempre vence (mesmo com pendencias vazias, reporta o estado atual).
 */
export function resolvePlanContract(
  pendencies: Pendency[],
  options: PlanContractOptions
): PlanResult | ChoicesResult {
  if (options.plan) {
    return { mode: 'plan', pendencies };
  }

  const choices = loadChoices(options);

  if (pendencies.length > 0 && !choices) {
    throw new PendingChoicesError(pendencies);
  }

  return { mode: 'apply', choices: choices ?? {} };
}
