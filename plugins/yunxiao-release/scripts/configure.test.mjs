#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

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
  assert.equal(config.reviewerMode, 'ask');
  assert.deepEqual(config.reviewerUserIds, []);
  assert.equal(config.versionFile, 'package.json');
  assert.equal(buildConfig({ versionFile: null }).versionFile, null);
  assert.equal(buildConfig({ targetBranch: 'main', versionFile: 'VERSION' }).targetBranch, 'main');
  assert.throws(() => writeProjectConfig(rootDir, config), /不是 Git 仓库/);
  execFileSync('git', ['init'], { cwd: rootDir, stdio: 'ignore' });
  writeFileSync(resolve(rootDir, '.gitignore'), '.codex/\n');
  assert.throws(() => writeProjectConfig(rootDir, { ...config, runtimeFile: '../outside.json' }), /项目内相对路径/);
  configureProject(rootDir);
  assert.equal(JSON.parse(readFileSync(resolve(rootDir, '.codex/yunxiao-release.json'))).targetBranch, 'master');
  assert.equal(spawnSync('git', ['check-ignore', '.codex/yunxiao-release.json'], { cwd: rootDir }).status, 1);
  assert.equal(
    readFileSync(resolve(rootDir, '.gitignore'), 'utf8'),
    '.codex/\n!/.codex/\n/.codex/*\n!/.codex/yunxiao-release.json\n',
  );

  const simpleRoot = mkdtempSync(resolve(tmpdir(), 'yunxiao-release-simple-ignore-'));
  execFileSync('git', ['init'], { cwd: simpleRoot, stdio: 'ignore' });
  configureProject(simpleRoot);
  assert.equal(
    readFileSync(resolve(simpleRoot, '.gitignore'), 'utf8'),
    '/.codex/yunxiao-release.local.json\n/.codex/runtime/\n',
  );
  assert.equal(spawnSync('git', ['check-ignore', '.codex/yunxiao-release.json'], { cwd: simpleRoot }).status, 1);
  assert.equal(spawnSync('git', ['check-ignore', '.codex/yunxiao-release.local.json'], { cwd: simpleRoot }).status, 0);
  assert.equal(spawnSync('git', ['check-ignore', '.codex/runtime/state.json'], { cwd: simpleRoot }).status, 0);
  assert.equal(spawnSync('git', ['check-ignore', '.codex/other.json'], { cwd: simpleRoot }).status, 1);

  const legacyRoot = mkdtempSync(resolve(tmpdir(), 'yunxiao-release-legacy-ignore-'));
  execFileSync('git', ['init'], { cwd: legacyRoot, stdio: 'ignore' });
  writeFileSync(
    resolve(legacyRoot, '.gitignore'),
    '.codex/\n!/.codex/\n/.codex/*\n!/.codex/yunxiao-release.json\n/.codex/yunxiao-release.local.json\n/.codex/runtime/yunxiao-release-mr.json\n/.codex/runtime/yunxiao-release-comments.md\n',
  );
  configureProject(legacyRoot);
  assert.equal(
    readFileSync(resolve(legacyRoot, '.gitignore'), 'utf8'),
    '.codex/\n!/.codex/\n/.codex/*\n!/.codex/yunxiao-release.json\n',
  );
  writeFileSync(
    resolve(rootDir, '.codex/yunxiao-release.json'),
    `${JSON.stringify({
      ...config,
      organizationId: 'org',
      repositoryId: 'repo',
      targetBranch: 'release',
      localConfigFile: '.private/member.json',
      runtimeFile: '.runtime/mr.json',
      commentsFile: '.runtime/comments.md',
    })}\n`,
  );
  configureProject(rootDir);
  assert.equal(JSON.parse(readFileSync(resolve(rootDir, '.codex/yunxiao-release.json'))).targetBranch, 'release');
  ['.private/member.json', '.runtime/mr.json', '.runtime/comments.md'].forEach((file) => {
    assert.equal(spawnSync('git', ['check-ignore', file], { cwd: rootDir }).status, 0);
  });

  const symlinkRoot = mkdtempSync(resolve(tmpdir(), 'yunxiao-release-symlink-'));
  const outsideRoot = mkdtempSync(resolve(tmpdir(), 'yunxiao-release-outside-'));
  execFileSync('git', ['init'], { cwd: symlinkRoot, stdio: 'ignore' });
  symlinkSync(outsideRoot, resolve(symlinkRoot, '.codex'), 'dir');
  assert.throws(() => configureProject(symlinkRoot), /现有父路径必须位于项目目录内/);

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
  rmSync(symlinkRoot, { recursive: true, force: true });
  rmSync(outsideRoot, { recursive: true, force: true });
  rmSync(legacyRoot, { recursive: true, force: true });
  rmSync(simpleRoot, { recursive: true, force: true });
  rmSync(rootDir, { recursive: true, force: true });
  console.log('configure self-test passed');
};

run();
