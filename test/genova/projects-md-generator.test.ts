import { describe, expect, it } from 'vitest';
import { generateProjectsMd } from '../../src/genova/core/projects-md-generator.js';
import { emptyRegistry, upsertProject } from '../../src/genova/core/projects-registry.js';

describe('generateProjectsMd', () => {
  it('gera markdown valido pra um registry vazio', () => {
    const md = generateProjectsMd(emptyRegistry(), '1.0.0');
    expect(md).toContain('# Projects');
    expect(md).toContain('nenhum projeto registrado');
  });

  it('gera uma linha por projeto, com status atualizado/desatualizado/nao adotado', () => {
    const registry = [
      { name: 'A', path: 'src/A', stack: 'node' as const, genovaVersion: '1.0.0', registeredAt: 't', updatedAt: 't' },
      { name: 'B', path: 'src/B', stack: 'dotnet' as const, genovaVersion: '0.9.0', registeredAt: 't', updatedAt: 't' },
      { name: 'C', path: 'src/C', stack: null, genovaVersion: null, registeredAt: 't', updatedAt: 't' },
    ].reduce((reg, entry) => upsertProject(reg, entry), emptyRegistry());

    const md = generateProjectsMd(registry, '1.0.0');

    expect(md).toContain('| A | src/A | node | 1.0.0 | atualizado |');
    expect(md).toContain('| B | src/B | dotnet | 0.9.0 | desatualizado |');
    expect(md).toContain('| C | src/C | desconhecida | — | não adotado |');
  });
});
