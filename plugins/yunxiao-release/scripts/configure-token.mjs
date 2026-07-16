#!/usr/bin/env node

import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const tokenKey = 'YUNXIAO_ACCESS_TOKEN';

export const resolveEnvPath = (env = process.env) =>
  resolve(env.CODEX_HOME || resolve(env.HOME || env.USERPROFILE || homedir(), '.codex'), '.env');

export const upsertToken = (content, token) => {
  if (!token || /[\r\n]/.test(token)) {
    throw new Error('Token 不能为空或包含换行符');
  }
  const retainedLines = content.split(/\r?\n/).filter((line) => !line.startsWith(`${tokenKey}=`));
  return `${[...retainedLines.filter(Boolean), `${tokenKey}=${token}`].join('\n')}\n`;
};

export const hasConfiguredToken = (content) =>
  content.split(/\r?\n/).some((line) => line.startsWith(`${tokenKey}=`) && line.slice(tokenKey.length + 1).trim());

// 终端使用 raw mode 隐藏输入；管道模式只读取 stdin，避免把 Token 放进命令参数和历史。
const readToken = async () => {
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8').trim();
  }
  process.stdout.write(`请输入 ${tokenKey}（输入不可见）：`);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolveToken, reject) => {
    const characters = [];
    process.stdin.on('data', (buffer) => {
      for (const character of buffer.toString('utf8')) {
        if (character === '\u0003') return reject(new Error('已取消'));
        if (character === '\r' || character === '\n') return resolveToken(characters.join(''));
        if (character === '\u007f') characters.pop();
        else characters.push(character);
      }
    });
  }).finally(() => {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write('\n');
  });
};

export const writeToken = (filePath, token) => {
  const current = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  mkdirSync(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporaryPath, upsertToken(current, token), { flag: 'wx', mode: 0o600 });
    renameSync(temporaryPath, filePath);
    chmodSync(filePath, 0o600);
  } catch (error) {
    rmSync(temporaryPath, { force: true });
    throw error;
  }
};

const main = async () => {
  const envPath = resolveEnvPath();
  if (process.argv.includes('--check')) {
    const configured = existsSync(envPath) && hasConfiguredToken(readFileSync(envPath, 'utf8'));
    console.log(configured ? `${tokenKey} 已配置：${envPath}` : `${tokenKey} 未配置：${envPath}`);
    process.exitCode = configured ? 0 : 1;
    return;
  }
  writeToken(envPath, await readToken());
  console.log(`${tokenKey} 已安全写入 ${envPath}`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
