#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const scriptsDir = dirname(fileURLToPath(import.meta.url));

// 通过目录别名启动真实 CLI，覆盖 macOS /var 与 /private/var 路径不一致的入口判断。
const run = () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'yunxiao-release-cli-'));
  const aliasDir = resolve(rootDir, 'scripts-alias');
  const projectDir = resolve(rootDir, 'project');
  const codexHome = resolve(rootDir, 'codex-home');
  symlinkSync(scriptsDir, aliasDir, 'dir');
  execFileSync('git', ['init', projectDir], { stdio: 'ignore' });

  const projectResult = spawnSync('node', [resolve(aliasDir, 'configure-project.mjs')], {
    cwd: projectDir,
    encoding: 'utf8',
  });
  assert.equal(projectResult.status, 0, projectResult.stderr);
  assert.match(projectResult.stdout, /项目配置已写入/);
  const projectConfig = JSON.parse(readFileSync(resolve(projectDir, '.codex/yunxiao-release.json')));
  assert.equal(projectConfig.targetBranch, 'master');
  assert.equal(projectConfig.reviewerMode, 'ask');
  assert.deepEqual(projectConfig.reviewerUserIds, []);

  const tokenResult = spawnSync('node', [resolve(aliasDir, 'configure-token.mjs')], {
    input: 'test-token',
    encoding: 'utf8',
    env: { ...process.env, CODEX_HOME: codexHome },
  });
  assert.equal(tokenResult.status, 0, tokenResult.stderr);
  assert.equal(readFileSync(resolve(codexHome, '.env'), 'utf8'), 'YUNXIAO_ACCESS_TOKEN=test-token\n');

  const stateResult = spawnSync('node', [resolve(aliasDir, 'release-state.mjs'), '--help'], { encoding: 'utf8' });
  assert.equal(stateResult.status, 0, stateResult.stderr);
  assert.match(stateResult.stdout, /release-state\.mjs check/);

  rmSync(rootDir, { recursive: true, force: true });
  console.log('cli entry self-test passed');
};

run();
