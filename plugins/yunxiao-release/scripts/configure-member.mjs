#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveCodexEnvPath } from './configure-token.mjs';

const memberKeys = {
  displayName: 'YUNXIAO_DISPLAY_NAME',
  userId: 'YUNXIAO_USER_ID',
};

export const normalizeMember = ({ displayName, userId }) => {
  const member = { displayName: displayName?.trim(), userId: userId?.trim() };
  for (const [key, value] of Object.entries(member)) {
    if (!value || /[\r\n\0]/.test(value)) throw new Error(`${key} 不能为空或包含换行符`);
  }
  return member;
};

const decodeEnvValue = (rawValue) => {
  const value = rawValue.trim();
  if (value.startsWith('"')) return JSON.parse(value);
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
};

const findEnvValue = (content, key) => {
  const line = content.split(/\r?\n/).find((item) => item.startsWith(`${key}=`));
  return line === undefined ? undefined : decodeEnvValue(line.slice(key.length + 1));
};

export const readMemberFromEnvContent = (content) => {
  const member = Object.fromEntries(
    Object.entries(memberKeys).map(([field, key]) => [field, findEnvValue(content, key)]),
  );
  const configuredCount = Object.values(member).filter((value) => value !== undefined).length;
  if (configuredCount === 0) return null;
  if (configuredCount !== Object.keys(memberKeys).length) throw new Error('旧 Codex Home 成员配置不完整');
  return normalizeMember(member);
};

export const resolveUserMemberPath = (env = process.env) => {
  const userHome = [env.HOME, env.USERPROFILE].find((candidate) => candidate && isAbsolute(candidate)) || homedir();
  const configHome = env.XDG_CONFIG_HOME && isAbsolute(env.XDG_CONFIG_HOME)
    ? env.XDG_CONFIG_HOME
    : resolve(userHome, '.config');
  return resolve(configHome, 'yunxiao-release/member.json');
};

// 用户身份写入宿主无关的 XDG 路径；旧 Codex Home 只作为读取兼容层。
export const writeUserMember = (filePath, rawMember) => {
  const member = normalizeMember(rawMember);
  mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(member, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    renameSync(temporaryPath, filePath);
    chmodSync(filePath, 0o600);
  } catch (error) {
    rmSync(temporaryPath, { force: true });
    throw error;
  }
};

export const readUserMember = (env = process.env) => {
  const memberPath = resolveUserMemberPath(env);
  if (existsSync(memberPath)) return normalizeMember(JSON.parse(readFileSync(memberPath, 'utf8')));
  const legacyPath = resolveCodexEnvPath(env);
  return existsSync(legacyPath) ? readMemberFromEnvContent(readFileSync(legacyPath, 'utf8')) : null;
};

const readMember = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

// CLI 只负责安全落盘；交互询问和 MCP 身份核对由配置 Skill 在调用前完成。
const main = async () => {
  if (process.argv.includes('--help')) {
    console.log('Usage: node configure-member.mjs < member.json');
    return;
  }
  const memberPath = resolveUserMemberPath();
  writeUserMember(memberPath, await readMember());
  console.log(`成员配置已安全写入 ${memberPath}`);
};

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
