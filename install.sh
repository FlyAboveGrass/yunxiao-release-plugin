#!/usr/bin/env bash

set -euo pipefail

readonly RAW_ROOT='https://raw.githubusercontent.com/FlyAboveGrass/yunxiao-release-plugin/main'

# npm/GitHub npx 安装优先使用包内同版本脚本；curl 管道入口才回退到远端下载。
resolve_installer() {
  local installer="$1" temporary_dir="$2"
  local source_path="${BASH_SOURCE[0]:-}"
  if [[ -n "$source_path" && -f "$source_path" ]]; then
    local repository_root
    repository_root="$(cd "$(dirname "$source_path")" && pwd)"
    if [[ -f "$repository_root/$installer" ]]; then
      printf '%s\n' "$repository_root/$installer"
      return
    fi
  fi
  command -v curl >/dev/null || { echo '缺少命令：curl' >&2; return 1; }
  curl -fsSL "$RAW_ROOT/$installer" -o "$temporary_dir/$installer"
  printf '%s\n' "$temporary_dir/$installer"
}

render_agent_checkboxes() {
  local cursor="$1" codex_selected="$2" claude_selected="$3" redraw="$4"
  local codex_mark='◻' claude_mark='◻' codex_pointer=' ' claude_pointer=' '
  [[ "$codex_selected" -eq 1 ]] && codex_mark='◼'
  [[ "$claude_selected" -eq 1 ]] && claude_mark='◼'
  [[ "$cursor" -eq 0 ]] && codex_pointer='❯'
  [[ "$cursor" -eq 1 ]] && claude_pointer='❯'
  [[ "$redraw" -eq 1 ]] && printf '\033[4A' >&2
  printf '\033[2K请选择要安装的 Agent：\n' >&2
  printf '\033[2K%s %s Codex\n' "$codex_pointer" "$codex_mark" >&2
  printf '\033[2K%s %s Claude Code\n' "$claude_pointer" "$claude_mark" >&2
  printf '\033[2K↑↓ 移动，空格切换，回车确认，q 取消\n' >&2
}

# 复选框默认选中两个已支持宿主，并允许一次安装一个或多个 Agent。
choose_installers() {
  local input_path="${1:-/dev/tty}"
  local cursor=0 codex_selected=1 claude_selected=1 redraw=0 key sequence
  exec 3<"$input_path"
  while true; do
    render_agent_checkboxes "$cursor" "$codex_selected" "$claude_selected" "$redraw"
    IFS= read -r -s -n 1 key <&3 || { exec 3<&-; return 1; }
    case "$key" in
      '')
        if [[ "$codex_selected" -eq 0 && "$claude_selected" -eq 0 ]]; then
          printf '\a' >&2
          redraw=1
          continue
        fi
        break
        ;;
      ' ')
        if [[ "$cursor" -eq 0 ]]; then codex_selected=$((1 - codex_selected)); else claude_selected=$((1 - claude_selected)); fi
        ;;
      q|Q)
        printf '\n安装已取消。\n' >&2
        exec 3<&-
        return 130
        ;;
      $'\033')
        IFS= read -r -s -n 2 sequence <&3 || true
        [[ "$sequence" == '[A' ]] && cursor=$(((cursor + 1) % 2))
        [[ "$sequence" == '[B' ]] && cursor=$(((cursor + 1) % 2))
        ;;
    esac
    redraw=1
  done
  exec 3<&-
  printf '\n' >&2
  [[ "$codex_selected" -eq 1 ]] && printf 'install-codex.sh\n'
  [[ "$claude_selected" -eq 1 ]] && printf 'install-claude.sh\n'
  return 0
}

# 统一入口只负责选择宿主，具体安装和认证仍由已验证的宿主脚本处理。
main() {
  command -v git >/dev/null || { echo '缺少命令：git' >&2; exit 1; }
  git rev-parse --show-toplevel >/dev/null 2>&1 || { echo '请在 Git 项目内执行安装命令' >&2; exit 1; }
  [[ -r /dev/tty ]] || { echo '安装需要交互式终端' >&2; exit 1; }

  local installers installer installer_path
  installers="$(choose_installers)"
  readonly TEMPORARY_DIR="$(mktemp -d)"
  trap 'rm -rf "$TEMPORARY_DIR"' EXIT
  while IFS= read -r installer; do
    installer_path="$(resolve_installer "$installer" "$TEMPORARY_DIR")"
    bash "$installer_path" </dev/tty
  done <<<"$installers"
}

if [[ -z "${BASH_SOURCE[0]:-}" || "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
