import { Command } from 'commander';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readRegistry } from '../core/projects-registry.js';
import { generateProjectsMd } from '../core/projects-md-generator.js';

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('Lista projetos registrados e status (atualizado/desatualizado) — UC-09')
    .action((options, command: Command) => {
      const cliVersion = command.parent?.version() ?? '0.0.0';
      const registryPath = join(process.cwd(), 'projects.json');

      const registry = existsSync(registryPath) ? readRegistry(registryPath) : { projects: [] };

      const md = generateProjectsMd(registry, cliVersion);
      console.log(md);

      if (registry.projects.length === 0) {
        process.exitCode = 0; // vazio é ok
      }
    });
}
