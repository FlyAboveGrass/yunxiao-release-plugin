#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const requiredConfigKeys = ['organizationId', 'repositoryId'];
const configDefaults = {
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
const requiredRecordKeys = [
  'mrId',
  'title',
  'url',
  'createdAt',
  'createdBy',
  'sourceBranch',
  'targetBranch',
  'reviewMode',
  'lastSyncedAt',
];

const fail = (message) => {
  throw new Error(message);
};

const readJson = (filePath) => {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`无法读取 JSON ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const ensureKeys = (value, keys, label) => {
  const missing = keys.filter((key) => value[key] === undefined || value[key] === '');
  if (missing.length > 0) {
    fail(`${label} 缺少字段: ${missing.join(', ')}`);
  }
};

const resolveProjectPath = (rootDir, configuredPath, label) => {
  if (typeof configuredPath !== 'string' || !configuredPath || isAbsolute(configuredPath)) {
    fail(`${label} 必须是项目内相对路径`);
  }
  const filePath = resolve(rootDir, configuredPath);
  const relativePath = relative(resolve(rootDir), filePath);
  if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
    fail(`${label} 必须位于项目目录内`);
  }
  return filePath;
};

// 兼容最小社区配置，并在读取时补齐不会改变云端状态的默认值。
const getConfig = (rootDir) => {
  const configPath = resolve(rootDir, '.codex/yunxiao-release.json');
  if (!existsSync(configPath)) {
    fail(`缺少项目共享配置: ${configPath}`);
  }
  const rawConfig = readJson(configPath);
  ensureKeys(rawConfig, requiredConfigKeys, '项目共享配置');
  const config = { ...configDefaults, ...rawConfig };
  if (!['ask', 'required', 'skip'].includes(config.reviewMode)) {
    fail(`reviewMode 必须是 ask、required 或 skip，当前为 ${config.reviewMode}`);
  }
  if (!Array.isArray(config.validationCommands) || config.validationCommands.length === 0) {
    fail('validationCommands 必须是非空数组');
  }
  ['localConfigFile', 'runtimeFile', 'commentsFile', 'versionFile', 'announcementFile']
    .filter((key) => config[key] !== null)
    .forEach((key) => resolveProjectPath(rootDir, config[key], key));
  return config;
};

const writeJsonAtomic = (filePath, value) => {
  mkdirSync(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporaryPath, filePath);
};

const getState = (rootDir, config) => {
  const statePath = resolveProjectPath(rootDir, config.runtimeFile, 'runtimeFile');
  const emptyState = {
    schemaVersion: 1,
    organizationId: config.organizationId,
    repositoryId: config.repositoryId,
    branches: {},
  };
  const state = existsSync(statePath) ? readJson(statePath) : emptyState;
  if (state.organizationId !== config.organizationId || state.repositoryId !== config.repositoryId) {
    fail('MR 运行状态与项目共享配置不匹配');
  }
  if (state.schemaVersion !== 1 || typeof state.branches !== 'object' || state.branches === null) {
    fail('MR 运行状态格式无效');
  }
  return { state, statePath };
};

const normalizeRecord = (record) => {
  ensureKeys(record, requiredRecordKeys, 'MR 记录');
  if (!['ask', 'required', 'skip'].includes(record.reviewMode)) {
    fail(`MR reviewMode 无效: ${record.reviewMode}`);
  }
  if (Number.isNaN(Date.parse(record.createdAt)) || Number.isNaN(Date.parse(record.lastSyncedAt))) {
    fail('MR createdAt 和 lastSyncedAt 必须是有效时间');
  }
  return {
    ...record,
    mrId: String(record.mrId),
    mergeStatus: record.mergeStatus ?? 'opened',
    mergedAt: record.mergedAt ?? null,
    mergeCommit: record.mergeCommit ?? null,
  };
};

// 同一 MR 按 mrId 原位更新，其他 MR 按创建时间排序，保证重复执行不会追加重复记录。
export const upsertMr = (rootDir, rawRecord) => {
  const config = getConfig(rootDir);
  const record = normalizeRecord(rawRecord);
  if (record.targetBranch !== config.targetBranch) {
    fail(`MR 目标分支必须是 ${config.targetBranch}，当前为 ${record.targetBranch}`);
  }
  const { state, statePath } = getState(rootDir, config);
  const branchRecords = state.branches[record.sourceBranch] ?? [];
  const existingIndex = branchRecords.findIndex(({ mrId }) => String(mrId) === record.mrId);
  const nextRecords =
    existingIndex < 0
      ? [...branchRecords, record]
      : branchRecords.map((item, index) => (index === existingIndex ? { ...item, ...record } : item));
  const nextState = {
    ...state,
    branches: {
      ...state.branches,
      [record.sourceBranch]: nextRecords.toSorted((left, right) => left.createdAt.localeCompare(right.createdAt)),
    },
  };
  writeJsonAtomic(statePath, nextState);
  return record;
};

export const getCurrentMr = (rootDir, sourceBranch) => {
  const config = getConfig(rootDir);
  const { state } = getState(rootDir, config);
  const records = state.branches[sourceBranch] ?? [];
  if (records.length === 0) {
    fail(`当前分支没有 MR 记录: ${sourceBranch}`);
  }
  return records.toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
};

export const checkConfig = (rootDir) => {
  const config = getConfig(rootDir);
  const localConfigPath = resolveProjectPath(rootDir, config.localConfigFile, 'localConfigFile');
  if (!existsSync(localConfigPath)) {
    fail(`缺少成员本地配置: ${localConfigPath}`);
  }
  const localConfig = readJson(localConfigPath);
  ensureKeys(localConfig, ['displayName', 'userId', 'tokenSource'], '成员本地配置');
  if (localConfig.tokenSource !== 'environment') {
    fail(`当前只支持 tokenSource: environment，当前为 ${localConfig.tokenSource}`);
  }
  return { config, localConfig };
};

const printHelp = () => {
  console.log(`Usage:
  node release-state.mjs check <repo-root>
  node release-state.mjs upsert <repo-root> <record-json-file>
  node release-state.mjs current <repo-root> <source-branch>`);
};

// CLI 只操作本地 JSON；云效读取和写入始终由插件声明的官方 MCP 完成。
const main = () => {
  const [command, rootArgument = '.', value] = process.argv.slice(2);
  const rootDir = resolve(rootArgument);
  if (!command || command === '--help') {
    printHelp();
    return;
  }
  if (command === 'check') {
    console.log(JSON.stringify(checkConfig(rootDir), null, 2));
    return;
  }
  if (command === 'upsert') {
    if (!value) {
      fail('upsert 需要 MR record JSON 文件');
    }
    console.log(JSON.stringify(upsertMr(rootDir, readJson(resolve(value))), null, 2));
    return;
  }
  if (command === 'current') {
    if (!value) {
      fail('current 需要 source branch');
    }
    console.log(JSON.stringify(getCurrentMr(rootDir, value), null, 2));
    return;
  }
  fail(`未知命令: ${command}`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
