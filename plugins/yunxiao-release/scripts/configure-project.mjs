#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultConfig = {
  organizationId: '',
  repositoryId: '',
  remoteName: 'origin',
  targetBranch: 'master',
  reviewMode: 'ask',
  reviewerMode: 'ask',
  reviewerUserIds: [],
  versionFile: 'package.json',
  announcementFile: null,
  localConfigFile: '.codex/yunxiao-release.local.json',
  runtimeFile: '.codex/runtime/yunxiao-release-mr.json',
  commentsFile: '.codex/runtime/yunxiao-release-comments.md',
  validationCommands: ['git diff --check'],
};

export const buildConfig = (existing = {}) => ({ ...defaultConfig, ...existing });

const toIgnoreRule = (file) => `/${file.replaceAll('\\', '/')}`;

const getPrivateRules = (config) => {
  const runtimeRules =
    config.runtimeFile === defaultConfig.runtimeFile && config.commentsFile === defaultConfig.commentsFile
      ? ['/.codex/runtime/']
      : [toIgnoreRule(config.runtimeFile), toIgnoreRule(config.commentsFile)];
  return [toIgnoreRule(config.localConfigFile), ...runtimeRules];
};

const isIgnored = (rootDir, file) => {
  const result = spawnSync('git', ['check-ignore', '--no-index', '--quiet', '--', file], { cwd: rootDir });
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new Error(`无法检查 Git 忽略规则: ${result.stderr?.toString().trim() || 'git check-ignore 执行失败'}`);
};

// 普通项目只忽略两个本地目标；已有 .codex 整体规则时才补共享配置的最小放行规则。
const updateGitignore = (rootDir, config) => {
  const filePath = resolve(rootDir, '.gitignore');
  const current = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  const currentLines = current.split(/\r?\n/);
  const privateRules = getPrivateRules(config);
  const hasCodexWildcard = currentLines.includes('/.codex/*');
  const rules = hasCodexWildcard || isIgnored(rootDir, '.codex/yunxiao-release.json')
    ? ['!/.codex/', '/.codex/*', '!/.codex/yunxiao-release.json', ...privateRules.filter((rule) => !rule.startsWith('/.codex/'))]
    : privateRules;
  const generatedPrivateRules = new Set([
    ...getPrivateRules(defaultConfig),
    ...[config.localConfigFile, config.runtimeFile, config.commentsFile].map(toIgnoreRule),
  ]);
  const retainedLines = hasCodexWildcard
    ? currentLines.filter((rule) => !generatedPrivateRules.has(rule) || !rule.startsWith('/.codex/'))
    : currentLines;
  const missing = rules.filter((rule) => !retainedLines.includes(rule));
  const removedLegacyRules = retainedLines.length !== currentLines.length;
  if (!missing.length && !removedLegacyRules) return;
  const prefix = retainedLines.join('\n').trimEnd();
  const next = `${prefix ? `${prefix}\n` : ''}${missing.join('\n')}${missing.length ? '\n' : ''}`;
  writeFileSync(filePath, next);
};

// 同时校验词法路径和已存在父路径的真实位置，阻止绝对路径、穿越和符号链接逃逸。
const validateProjectPath = (rootDir, configuredPath, label) => {
  if (typeof configuredPath !== 'string' || !configuredPath || /[\r\n\0]/.test(configuredPath)) {
    throw new Error(`${label} 必须是非空项目内相对路径`);
  }
  const relativePath = relative(resolve(rootDir), resolve(rootDir, configuredPath));
  if (isAbsolute(configuredPath) || !relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error(`${label} 必须是项目内相对路径`);
  }
  const existingAncestor = (() => {
    const find = (filePath) => (existsSync(filePath) ? filePath : find(dirname(filePath)));
    return find(resolve(rootDir, configuredPath));
  })();
  const realRelativePath = relative(realpathSync(rootDir), realpathSync(existingAncestor));
  if (realRelativePath.startsWith('..') || isAbsolute(realRelativePath)) {
    throw new Error(`${label} 的现有父路径必须位于项目目录内`);
  }
};

const validateProjectPaths = (rootDir, config) => {
  ['localConfigFile', 'runtimeFile', 'commentsFile', 'versionFile', 'announcementFile']
    .filter((key) => config[key] !== null)
    .forEach((key) => validateProjectPath(rootDir, config[key], key));
  validateProjectPath(rootDir, '.codex/yunxiao-release.json', 'configFile');
  validateProjectPath(rootDir, '.gitignore', 'gitignoreFile');
};

export const writeProjectConfig = (rootDir, config) => {
  if (!existsSync(resolve(rootDir, '.git'))) throw new Error(`当前目录不是 Git 仓库：${rootDir}`);
  validateProjectPaths(rootDir, config);
  const codexDir = resolve(rootDir, '.codex');
  const filePath = resolve(codexDir, 'yunxiao-release.json');
  mkdirSync(codexDir, { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`);
  updateGitignore(rootDir, config);
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

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
