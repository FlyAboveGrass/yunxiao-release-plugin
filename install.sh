#!/usr/bin/env bash

set -euo pipefail

readonly REPOSITORY='https://github.com/FlyAboveGrass/yunxiao-release-plugin.git'
readonly RAW_BASE='https://raw.githubusercontent.com/FlyAboveGrass/yunxiao-release-plugin/main/plugins/yunxiao-release/scripts'
readonly MARKETPLACE='yunxiao-release-community'
readonly PLUGIN='yunxiao-release'

# 已配置来源正常升级；仅在 CLI 明确报告失联缓存冲突时清理并重试。
configure_marketplace() {
  local marketplace_list
  if ! marketplace_list="$(codex plugin marketplace list)"; then
    return 1
  fi
  if awk -v target="$MARKETPLACE" 'NR > 1 && $1 == target { found = 1 } END { exit !found }' <<<"$marketplace_list"; then
    codex plugin marketplace upgrade "$MARKETPLACE"
    return
  fi

  local add_output
  if add_output="$(codex plugin marketplace add "$REPOSITORY" --ref main 2>&1)"; then
    [[ -z "$add_output" ]] || printf '%s\n' "$add_output"
    return
  fi
  if [[ "$add_output" != *"already added from a different source"* ]]; then
    printf '%s\n' "$add_output" >&2
    return 1
  fi

  echo "检测到未注册的 $MARKETPLACE 缓存，正在清理并重新添加。"
  codex plugin marketplace remove "$MARKETPLACE"
  codex plugin marketplace add "$REPOSITORY" --ref main
}

# 主流程依次验证环境、配置 Token、安装插件并初始化当前 Git 项目。
main() {
  for command in curl git node codex; do
    command -v "$command" >/dev/null || { echo "缺少命令：$command" >&2; exit 1; }
  done
  node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)" || {
    echo '需要 Node.js 20 或更高版本' >&2
    exit 1
  }

  git rev-parse --show-toplevel >/dev/null 2>&1 || { echo '请在 Git 项目内执行安装命令' >&2; exit 1; }
  [[ -r /dev/tty ]] || { echo '安装需要交互式终端' >&2; exit 1; }

  readonly TEMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TEMP_DIR"' EXIT
  curl -fsSL "$RAW_BASE/configure-token.mjs" -o "$TEMP_DIR/configure-token.mjs"
  curl -fsSL "$RAW_BASE/configure-project.mjs" -o "$TEMP_DIR/configure-project.mjs"

  printf '请输入 YUNXIAO_ACCESS_TOKEN（输入不可见）：' >/dev/tty
  IFS= read -r -s YUNXIAO_ACCESS_TOKEN </dev/tty
  printf '\n' >/dev/tty
  [[ -n "$YUNXIAO_ACCESS_TOKEN" ]] || { echo 'Token 不能为空' >&2; exit 1; }
  printf '%s' "$YUNXIAO_ACCESS_TOKEN" | node "$TEMP_DIR/configure-token.mjs"
  unset YUNXIAO_ACCESS_TOKEN
  test -s "${CODEX_HOME:-$HOME/.codex}/.env" || { echo 'Token 配置失败' >&2; exit 1; }

  configure_marketplace
  codex plugin add "$PLUGIN@$MARKETPLACE"

  readonly PROJECT_ROOT="$(git rev-parse --show-toplevel)"
  (cd "$PROJECT_ROOT" && node "$TEMP_DIR/configure-project.mjs")
  test -f "$PROJECT_ROOT/.codex/yunxiao-release.json" || { echo '项目配置生成失败' >&2; exit 1; }

  echo "安装完成。请编辑 $PROJECT_ROOT/.codex/yunxiao-release.json，然后重启 Codex 并新建会话。"
}

if [[ -z "${BASH_SOURCE[0]:-}" || "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
