import type { ProjectEntry, ProjectsRegistry } from './projects-registry.js';

function statusFor(entry: ProjectEntry, cliVersion: string): string {
  if (!entry.genovaVersion) {
    return 'não adotado';
  }
  return entry.genovaVersion === cliVersion ? 'atualizado' : 'desatualizado';
}

/**
 * View gerada a partir de `projects.json` (design.md D7) — nunca editada à mão.
 */
export function generateProjectsMd(
  registry: ProjectsRegistry,
  cliVersion: string
): string {
  const header = [
    '# Projects',
    '',
    '> Gerado por `genova` a partir de `projects.json`. Não editar à mão.',
    '',
    '| Nome | Path | Stack | Versão | Status |',
    '| --- | --- | --- | --- | --- |',
  ];

  if (registry.projects.length === 0) {
    return [...header, '| _(nenhum projeto registrado)_ | | | | |', ''].join('\n');
  }

  const rows = registry.projects.map((entry) => {
    const stack = entry.stack ?? 'desconhecida';
    const version = entry.genovaVersion ?? '—';
    const status = statusFor(entry, cliVersion);
    return `| ${entry.name} | ${entry.path} | ${stack} | ${version} | ${status} |`;
  });

  return [...header, ...rows, ''].join('\n');
}
