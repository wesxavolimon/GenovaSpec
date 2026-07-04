import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PendingChoicesError,
  resolvePlanContract,
} from '../../src/genova/core/plan-contract.js';

const pendencies = [{ id: 'stack', description: 'qual stack usar?' }];

describe('resolvePlanContract', () => {
  it('retorna as pendencias em modo plan, mesmo sem escolhas', () => {
    const result = resolvePlanContract(pendencies, { plan: true });
    expect(result).toEqual({ mode: 'plan', pendencies });
  });

  it('aplica as escolhas passadas via --choices', () => {
    const result = resolvePlanContract(pendencies, {
      choices: { stack: 'node' },
    });
    expect(result).toEqual({ mode: 'apply', choices: { stack: 'node' } });
  });

  it('aplica as escolhas lidas de --choices-file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'genova-plan-contract-'));
    const file = join(dir, 'choices.json');
    writeFileSync(file, JSON.stringify({ stack: 'python' }));

    const result = resolvePlanContract(pendencies, { choicesFile: file });
    expect(result).toEqual({ mode: 'apply', choices: { stack: 'python' } });
  });

  it('lanca erro explicito com o JSON de pendencias quando nao ha --plan nem --choices', () => {
    expect(() => resolvePlanContract(pendencies, {})).toThrow(PendingChoicesError);
    try {
      resolvePlanContract(pendencies, {});
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PendingChoicesError);
      expect((error as PendingChoicesError).plan).toEqual({ pendencies });
    }
  });

  it('nao exige --choices quando nao ha pendencias', () => {
    const result = resolvePlanContract([], {});
    expect(result).toEqual({ mode: 'apply', choices: {} });
  });
});
