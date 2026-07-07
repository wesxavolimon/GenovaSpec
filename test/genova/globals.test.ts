import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBackupDir, listBackups, getMostRecentBackup } from '../../src/genova/core/backup.js';
import { shouldExclude, filterExcluded } from '../../src/genova/core/sync-exclusions.js';
import { diffGlobals } from '../../src/genova/core/diff-globals.js';

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'genova-globals-'));
}

describe('Backup — Backend Unit', () => {
  it('createBackupDir cria diretório com timestamp formato YYYYMMDDHHMMSS', () => {
    const backupRoot = tempDir();
    const backupDir = createBackupDir(backupRoot);

    const timestamp = require('node:path').basename(backupDir);
    expect(/^\d{14}$/.test(timestamp)).toBe(true);
    expect(existsSync(backupDir)).toBe(true);
  });

  it('listBackups retorna lista em ordem crescente', () => {
    const backupRoot = tempDir();
    const fsModule = require('node:fs');

    // Cria 3 timestamps fake
    fsModule.mkdirSync(join(backupRoot, '20260101000001'), { recursive: true });
    fsModule.mkdirSync(join(backupRoot, '20260101000003'), { recursive: true });
    fsModule.mkdirSync(join(backupRoot, '20260101000002'), { recursive: true });

    const backups = listBackups(backupRoot);
    expect(backups).toEqual(['20260101000001', '20260101000002', '20260101000003']);
  });

  it('getMostRecentBackup retorna maior timestamp', () => {
    const backupRoot = tempDir();
    const fsModule = require('node:fs');

    fsModule.mkdirSync(join(backupRoot, '20260101000001'), { recursive: true });
    fsModule.mkdirSync(join(backupRoot, '20260101000003'), { recursive: true });

    const recent = getMostRecentBackup(backupRoot);
    expect(recent).toBe('20260101000003');
  });

  it('listBackups retorna lista vazia se .backup nao existe', () => {
    const backupRoot = join(tempDir(), 'nonexistent', '.backup');
    const backups = listBackups(backupRoot);
    expect(backups).toEqual([]);
  });
});

describe('Sync Exclusions — Backend Unit', () => {
  it('shouldExclude filtra credenciais e cache', () => {
    expect(shouldExclude('.credentials.json')).toBe(true);
    expect(shouldExclude('oauth_creds.json')).toBe(true);
    expect(shouldExclude('something/sessions/token.json')).toBe(true);
    expect(shouldExclude('cache/file.dat')).toBe(true);
    expect(shouldExclude('node_modules/pkg')).toBe(true);
  });

  it('shouldExclude permite arquivos válidos', () => {
    expect(shouldExclude('.claude/CLAUDE.md')).toBe(false);
    expect(shouldExclude('.ia_history/INDEX.md')).toBe(false);
    expect(shouldExclude('SKILL.md')).toBe(false);
  });

  it('filterExcluded remove itens excluídos', () => {
    const paths = ['.claude/CLAUDE.md', '.credentials.json', '.ia/SKILLS/test.md', '.something/sessions/x.txt'];
    const filtered = filterExcluded(paths);
    expect(filtered).not.toContain('.credentials.json');
    expect(filtered).not.toContain('.something/sessions/x.txt');
    expect(filtered).toContain('.claude/CLAUDE.md');
  });
});

describe('Diff Globals — Backend Unit', () => {
  it('diffGlobals retorna synced=true se ambos arquivos idênticos ou inexistem', () => {
    const genovaRoot = tempDir();
    const homeDir = tempDir();
    const fsModule = require('node:fs');

    // Ambos inexistem = synced
    let result = diffGlobals(genovaRoot, homeDir);
    expect(result.synced).toBe(true);
    expect(result.drifts).toHaveLength(0);

    // Ambos idênticos = synced
    const content = '# test\n';
    fsModule.mkdirSync(join(genovaRoot, '.claude'), { recursive: true });
    fsModule.mkdirSync(join(homeDir, '.claude'), { recursive: true });
    writeFileSync(join(genovaRoot, '.claude', 'CLAUDE.md'), content, 'utf-8');
    writeFileSync(join(homeDir, '.claude', 'CLAUDE.md'), content, 'utf-8');

    result = diffGlobals(genovaRoot, homeDir);
    expect(result.synced).toBe(true);
  });

  it('diffGlobals reporta drift se conteúdo diferente', () => {
    const genovaRoot = tempDir();
    const homeDir = tempDir();

    const fsModule = require('node:fs');
    fsModule.mkdirSync(join(genovaRoot, '.claude'), { recursive: true });
    fsModule.mkdirSync(join(homeDir, '.claude'), { recursive: true });

    writeFileSync(join(genovaRoot, '.claude', 'CLAUDE.md'), 'genova content here\n', 'utf-8');
    writeFileSync(join(homeDir, '.claude', 'CLAUDE.md'), 'x\n', 'utf-8');

    const result = diffGlobals(genovaRoot, homeDir);
    expect(result.synced).toBe(false);
    expect(result.drifts.length).toBeGreaterThan(0);
    // Genova ahead porque tem mais conteúdo
    expect(result.drifts[0].direction).toBe('genovabase-ahead');
  });

  it('diffGlobals marca como global-ahead se global tem mais conteúdo', () => {
    const genovaRoot = tempDir();
    const homeDir = tempDir();

    const fsModule = require('node:fs');
    fsModule.mkdirSync(join(genovaRoot, '.claude'), { recursive: true });
    fsModule.mkdirSync(join(homeDir, '.claude'), { recursive: true });

    writeFileSync(join(genovaRoot, '.claude', 'CLAUDE.md'), 'x\n', 'utf-8');
    writeFileSync(join(homeDir, '.claude', 'CLAUDE.md'), 'muito mais conteúdo aqui\n', 'utf-8');

    const result = diffGlobals(genovaRoot, homeDir);
    expect(result.drifts[0].direction).toBe('global-ahead');
  });
});
