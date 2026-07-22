#!/usr/bin/env bash

set -euo pipefail

readonly RAW_ROOT='https://raw.githubusercontent.com/FlyAboveGrass/yunxiao-release-plugin/main'

select_installer() {
  case "$1" in
    1|codex|Codex) printf 'install-codex.sh\n' ;;
    2|claude|Claude|claude-code|'Claude Code') printf 'install-claude.sh\n' ;;
    *) return 1 ;;
  esac
}

choose_installer() {
  local choice
  printf '请选择使用的 Agent：\n  1) Codex\n  2) Claude Code\n请输入序号：' >&2
  IFS= read -r choice </dev/tty
  select_installer "$choice" || { echo '无效选择，请输入 1 或 2' >&2; return 1; }
}

# 统一入口只负责选择宿主，具体安装和认证仍由已验证的宿主脚本处理。
main() {
  command -v curl >/dev/null || { echo '缺少命令：curl' >&2; exit 1; }
  [[ -r /dev/tty ]] || { echo '安装需要交互式终端' >&2; exit 1; }

  local installer
  installer="$(choose_installer)"
  readonly TEMPORARY_FILE="$(mktemp)"
  trap 'rm -f "$TEMPORARY_FILE"' EXIT
  curl -fsSL "$RAW_ROOT/$installer" -o "$TEMPORARY_FILE"
  bash "$TEMPORARY_FILE" </dev/tty
}

if [[ -z "${BASH_SOURCE[0]:-}" || "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
