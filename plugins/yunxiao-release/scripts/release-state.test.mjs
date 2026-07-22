#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { checkConfig, getCurrentMr, upsertMr } from './release-state.mjs';

const writeJson = (filePath, value) => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

// 覆盖配置校验、同 MR 幂等更新和同分支选择最新 MR 三条状态主路径。
const run = () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'yunxiao-release-state-'));
  const codexDir = resolve(rootDir, '.codex');
  mkdirSync(codexDir, { recursive: true });
  writeJson(resolve(codexDir, 'yunxiao-release.json'), {
    organizationId: 'org-1',
    repositoryId: 'repo-1',
  });
  writeJson(resolve(codexDir, 'yunxiao-release.local.json'), {
    displayName: '@测试成员',
    userId: 'user-1',
  });
  const baseRecord = {
    mrId: '10',
    title: '初始标题',
    url: 'https://codeup.aliyun.com/example/change/10',
    createdAt: '2026-07-16T01:00:00.000Z',
    createdBy: 'user-1',
    sourceBranch: 'feature/example',
    targetBranch: 'master',
    reviewMode: 'ask',
    lastSyncedAt: '2026-07-16T01:01:00.000Z',
  };
  assert.equal(checkConfig(rootDir).config.targetBranch, 'master');
  assert.equal(checkConfig(rootDir).config.versionFile, 'package.json');
  assert.equal(checkConfig(rootDir).localConfig.userId, 'user-1');
  assert.equal(checkConfig(rootDir).memberConfigSource, 'project');
  const codexHome = resolve(rootDir, 'codex-home');
  mkdirSync(codexHome);
  writeFileSync(
    resolve(codexHome, '.env'),
    'YUNXIAO_DISPLAY_NAME="Home 成员"\nYUNXIAO_USER_ID="home-user"\n',
  );
  rmSync(resolve(codexDir, 'yunxiao-release.local.json'));
  const homeConfig = checkConfig(rootDir, { CODEX_HOME: codexHome });
  assert.deepEqual(homeConfig.localConfig, { displayName: 'Home 成员', userId: 'home-user' });
  assert.equal(homeConfig.memberConfigSource, 'codex-home');
  const emptyCodexHome = resolve(rootDir, 'empty-codex-home');
  mkdirSync(emptyCodexHome);
  writeFileSync(resolve(emptyCodexHome, '.env'), 'YUNXIAO_DISPLAY_NAME="不完整"\n');
  assert.throws(
    () => checkConfig(rootDir, { CODEX_HOME: emptyCodexHome }),
    /Codex Home 成员配置不完整/,
  );
  writeJson(resolve(codexDir, 'yunxiao-release.local.json'), {
    displayName: '@测试成员',
    userId: 'user-1',
    tokenSource: 'legacy-value',
  });
  assert.equal(checkConfig(rootDir, { CODEX_HOME: codexHome }).memberConfigSource, 'project');
  assert.equal(checkConfig(rootDir, { CODEX_HOME: codexHome }).localConfig.userId, 'user-1');
  upsertMr(rootDir, baseRecord);
  upsertMr(rootDir, { ...baseRecord, title: '更新标题' });
  upsertMr(rootDir, {
    ...baseRecord,
    mrId: '11',
    title: '最新 MR',
    url: 'https://codeup.aliyun.com/example/change/11',
    createdAt: '2026-07-16T02:00:00.000Z',
  });
  assert.equal(getCurrentMr(rootDir, 'feature/example').mrId, '11');
  writeJson(resolve(codexDir, 'yunxiao-release.json'), {
    organizationId: 'org-1',
    repositoryId: 'repo-1',
    runtimeFile: '../outside.json',
  });
  assert.throws(() => getCurrentMr(rootDir, 'feature/example'), /项目内相对路径|项目目录内/);
  rmSync(rootDir, { recursive: true, force: true });
  console.log('release-state self-test passed');
};

run();
