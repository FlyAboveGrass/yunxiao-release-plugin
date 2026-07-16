#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { buildConfig, configureProject, writeProjectConfig } from './configure-project.mjs';
import { hasConfiguredToken, resolveEnvPath, upsertToken, writeToken } from './configure-token.mjs';

// 覆盖模板生成、已有配置保留、路径边界和 Token 安全写入主路径。
const run = () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'yunxiao-release-config-'));
  const config = buildConfig();
  assert.equal(config.organizationId, '');
  assert.equal(config.repositoryId, '');
  assert.equal(config.targetBranch, 'master');
  assert.equal(config.remoteName, 'origin');
  assert.equal(config.versionFile, null);
  assert.equal(buildConfig({ targetBranch: 'main', versionFile: 'VERSION' }).targetBranch, 'main');
  assert.throws(() => writeProjectConfig(rootDir, config), /不是 Git 仓库/);
  writeFileSync(resolve(rootDir, '.git'), 'gitdir: test\n');
  assert.throws(() => writeProjectConfig(rootDir, { ...config, runtimeFile: '../outside.json' }), /项目内相对路径/);
  configureProject(rootDir);
  assert.equal(JSON.parse(readFileSync(resolve(rootDir, '.codex/yunxiao-release.json'))).targetBranch, 'master');
  writeFileSync(
    resolve(rootDir, '.codex/yunxiao-release.json'),
    `${JSON.stringify({ ...config, organizationId: 'org', repositoryId: 'repo', targetBranch: 'release' })}\n`,
  );
  configureProject(rootDir);
  assert.equal(JSON.parse(readFileSync(resolve(rootDir, '.codex/yunxiao-release.json'))).targetBranch, 'release');
  assert.match(readFileSync(resolve(rootDir, '.gitignore'), 'utf8'), /\.codex\/runtime\//);

  const envPath = resolve(rootDir, 'codex-home/.env');
  mkdirSync(resolve(rootDir, 'codex-home'), { recursive: true });
  writeFileSync(envPath, 'OTHER=value\nYUNXIAO_ACCESS_TOKEN=old\n');
  writeToken(envPath, 'new-token');
  assert.equal(readFileSync(envPath, 'utf8'), 'OTHER=value\nYUNXIAO_ACCESS_TOKEN=new-token\n');
  assert.equal(statSync(envPath).mode & 0o777, 0o600);
  assert.equal(resolveEnvPath({ CODEX_HOME: resolve(rootDir, 'codex-home') }), envPath);
  assert.match(upsertToken('', 'token'), /^YUNXIAO_ACCESS_TOKEN=token$/m);
  assert.equal(hasConfiguredToken('YUNXIAO_ACCESS_TOKEN=\n'), false);
  assert.equal(hasConfiguredToken('YUNXIAO_ACCESS_TOKEN=token\n'), true);
  assert.throws(() => upsertToken('', 'bad\ntoken'), /包含换行符/);
  rmSync(rootDir, { recursive: true, force: true });
  console.log('configure self-test passed');
};

run();
