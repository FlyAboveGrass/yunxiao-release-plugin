#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const defaultConfig = {
  organizationId: '',
  repositoryId: '',
  remoteName: 'origin',
  targetBranch: 'master',
  reviewMode: 'ask',
  versionFile: null,
  announcementFile: null,
  localConfigFile: '.codex/yunxiao-release.local.json',
  runtimeFile: '.codex/runtime/yunxiao-release-mr.json',
  commentsFile: '.codex/runtime/yunxiao-release-comments.md',
  validationCommands: ['git diff --check'],
};

export const buildConfig = (existing = {}) => ({ ...defaultConfig, ...existing });

const updateGitignore = (rootDir) => {
  const filePath = resolve(rootDir, '.gitignore');
  const current = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  const rules = ['.codex/yunxiao-release.local.json', '.codex/runtime/'];
  const missing = rules.filter((rule) => !current.split(/\r?\n/).includes(rule));
  const prefix = current.trimEnd();
  if (missing.length) writeFileSync(filePath, `${prefix ? `${prefix}\n` : ''}${missing.join('\n')}\n`);
};

const validateProjectPaths = (rootDir, config) => {
  ['localConfigFile', 'runtimeFile', 'commentsFile', 'versionFile', 'announcementFile']
    .filter((key) => config[key] !== null)
    .forEach((key) => {
      const relativePath = relative(resolve(rootDir), resolve(rootDir, config[key]));
      if (isAbsolute(config[key]) || !relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
        throw new Error(`${key} 必须是项目内相对路径`);
      }
    });
};

export const writeProjectConfig = (rootDir, config) => {
  if (!existsSync(resolve(rootDir, '.git'))) throw new Error(`当前目录不是 Git 仓库：${rootDir}`);
  validateProjectPaths(rootDir, config);
  const codexDir = resolve(rootDir, '.codex');
  const filePath = resolve(codexDir, 'yunxiao-release.json');
  mkdirSync(codexDir, { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`);
  updateGitignore(rootDir);
  return filePath;
};

// 无参数生成可直接编辑的共享配置；已有配置只补默认字段，避免覆盖用户值。
export const configureProject = (rootDir) => {
  const configPath = resolve(rootDir, '.codex/yunxiao-release.json');
  const existing = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {};
  return writeProjectConfig(rootDir, buildConfig(existing));
};

const main = () => {
  if (process.argv.includes('--help')) {
    console.log('Usage: node configure-project.mjs\n\n在当前 Git 项目生成 .codex/yunxiao-release.json。');
    return;
  }
  if (process.argv.length > 2) throw new Error('configure-project 不接受参数；生成后请直接编辑配置文件');
  console.log(`项目配置已写入 ${configureProject(process.cwd())}`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
