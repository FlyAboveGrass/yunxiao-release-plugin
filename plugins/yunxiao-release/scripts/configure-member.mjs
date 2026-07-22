#!/usr/bin/env node

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { resolveEnvPath, writeEnvFile } from './configure-token.mjs';

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
  if (configuredCount !== Object.keys(memberKeys).length) throw new Error('Codex Home 成员配置不完整');
  return normalizeMember(member);
};

export const upsertMemberEnv = (content, rawMember) => {
  const member = normalizeMember(rawMember);
  const keys = new Set(Object.values(memberKeys));
  const retainedLines = content.split(/\r?\n/).filter((line) => !keys.has(line.slice(0, line.indexOf('='))));
  const memberLines = Object.entries(memberKeys).map(([field, key]) => `${key}=${JSON.stringify(member[field])}`);
  return `${[...retainedLines.filter(Boolean), ...memberLines].join('\n')}\n`;
};

export const writeCodexHomeMember = (filePath, member) =>
  writeEnvFile(filePath, (content) => upsertMemberEnv(content, member));

// 直接读取 Codex Home 文件，确保刚写入配置后无需重启即可完成本地校验。
export const readCodexHomeMember = (env = process.env) => {
  const envPath = resolveEnvPath(env);
  return existsSync(envPath) ? readMemberFromEnvContent(readFileSync(envPath, 'utf8')) : null;
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
  const envPath = resolveEnvPath();
  writeCodexHomeMember(envPath, await readMember());
  console.log(`成员配置已安全写入 ${envPath}`);
};

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
