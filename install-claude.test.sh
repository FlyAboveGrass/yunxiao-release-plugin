#!/usr/bin/env bash

set -euo pipefail

readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TEST_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_DIR"' EXIT

claude plugin validate "$ROOT_DIR" --strict
claude plugin validate "$ROOT_DIR/plugins/yunxiao-release" --strict
node -e 'const fs=require("fs");const root=process.argv[1];const codex=JSON.parse(fs.readFileSync(`${root}/plugins/yunxiao-release/.codex-plugin/plugin.json`));const claude=JSON.parse(fs.readFileSync(`${root}/plugins/yunxiao-release/.claude-plugin/plugin.json`));const pkg=JSON.parse(fs.readFileSync(`${root}/package.json`));if(codex.version!==claude.version||codex.version!==pkg.version)process.exit(1)' "$ROOT_DIR"

source "$ROOT_DIR/install-claude.sh"

if [[ "$(prepare_script configure-project.mjs "$TEST_DIR")" != "$ROOT_DIR/plugins/yunxiao-release/scripts/configure-project.mjs" ]]; then
  echo 'Claude Code 安装必须优先复用包内配置脚本' >&2
  exit 1
fi

MOCK_MODE='missing'

# 模拟 Claude CLI 的未安装和已安装状态，并记录公开安装命令。
claude() {
  printf '%s\n' "$*" >>"$TEST_DIR/calls"
  case "$*" in
    'plugin marketplace list --json')
      if [[ "$MOCK_MODE" == 'installed' ]]; then
        printf '[{"name":"%s","source":"github","repo":"%s"}]\n' "$MARKETPLACE" "$CLAUDE_MARKETPLACE_SOURCE"
      elif [[ "$MOCK_MODE" == 'foreign' ]]; then
        printf '[{"name":"%s","source":"github","repo":"other/repository"}]\n' "$MARKETPLACE"
      else
        printf '[]\n'
      fi
      ;;
    'plugin list --json')
      if [[ "$MOCK_MODE" == 'installed' ]]; then
        printf '[{"id":"%s@%s","scope":"user","enabled":true}]\n' "$PLUGIN" "$MARKETPLACE"
      elif [[ "$MOCK_MODE" == 'disabled' ]]; then
        printf '[{"id":"%s@%s","scope":"user","enabled":false}]\n' "$PLUGIN" "$MARKETPLACE"
      elif [[ "$MOCK_MODE" == 'project' ]]; then
        printf '[{"id":"%s@%s","scope":"project"}]\n' "$PLUGIN" "$MARKETPLACE"
      else
        printf '[]\n'
      fi
      ;;
    'plugin enable yunxiao-release@yunxiao-release-community --scope user')
      if [[ "$MOCK_MODE" == 'installed' ]]; then
        echo 'Plugin is already enabled at user scope' >&2
        return 1
      fi
      ;;
    'plugin marketplace add FlyAboveGrass/yunxiao-release-plugin'|'plugin marketplace update yunxiao-release-community'|'plugin install yunxiao-release@yunxiao-release-community --scope user'|'plugin update yunxiao-release@yunxiao-release-community --scope user')
      ;;
    *)
      echo "未预期的 Claude 调用: $*" >&2
      return 1
      ;;
  esac
}

configure_claude_marketplace
configure_claude_plugin
expected_calls=$'plugin marketplace list --json\nplugin marketplace add FlyAboveGrass/yunxiao-release-plugin\nplugin list --json\nplugin install yunxiao-release@yunxiao-release-community --scope user'
if [[ "$(<"$TEST_DIR/calls")" != "$expected_calls" ]]; then
  echo '首次安装的 Claude CLI 调用不符合预期' >&2
  exit 1
fi

: >"$TEST_DIR/calls"
MOCK_MODE='installed'
configure_claude_marketplace
configure_claude_plugin
expected_calls=$'plugin marketplace list --json\nplugin marketplace update yunxiao-release-community\nplugin list --json\nplugin update yunxiao-release@yunxiao-release-community --scope user'
if [[ "$(<"$TEST_DIR/calls")" != "$expected_calls" ]]; then
  echo '重复安装的 Claude CLI 调用不符合预期' >&2
  exit 1
fi

: >"$TEST_DIR/calls"
MOCK_MODE='disabled'
configure_claude_plugin
expected_calls=$'plugin list --json\nplugin update yunxiao-release@yunxiao-release-community --scope user\nplugin enable yunxiao-release@yunxiao-release-community --scope user'
if [[ "$(<"$TEST_DIR/calls")" != "$expected_calls" ]]; then
  echo '已禁用插件更新后必须重新启用' >&2
  exit 1
fi

: >"$TEST_DIR/calls"
MOCK_MODE='foreign'
if configure_claude_marketplace 2>"$TEST_DIR/foreign-error"; then
  echo '同名异源 marketplace 必须停止安装' >&2
  exit 1
fi
if [[ "$(<"$TEST_DIR/foreign-error")" != "marketplace $MARKETPLACE 已指向其他来源，停止安装" ]]; then
  echo '同名异源 marketplace 错误信息不符合预期' >&2
  exit 1
fi
if [[ "$(<"$TEST_DIR/calls")" != 'plugin marketplace list --json' ]]; then
  echo '同名异源 marketplace 不应触发更新' >&2
  exit 1
fi

: >"$TEST_DIR/calls"
MOCK_MODE='project'
configure_claude_plugin
expected_calls=$'plugin list --json\nplugin install yunxiao-release@yunxiao-release-community --scope user'
if [[ "$(<"$TEST_DIR/calls")" != "$expected_calls" ]]; then
  echo '项目级插件不应阻止用户级安装' >&2
  exit 1
fi

printf 'claude install tests passed\n'
