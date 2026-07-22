#!/usr/bin/env bash

set -euo pipefail

readonly CLAUDE_MARKETPLACE_SOURCE='FlyAboveGrass/yunxiao-release-plugin'
readonly RAW_BASE='https://raw.githubusercontent.com/FlyAboveGrass/yunxiao-release-plugin/main/plugins/yunxiao-release/scripts'
readonly MARKETPLACE='yunxiao-release-community'
readonly PLUGIN='yunxiao-release'
readonly CLAUDE_INSTALL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-}")" && pwd)"

prepare_script() {
  local script_name="$1" temporary_dir="$2"
  local bundled_dir="$CLAUDE_INSTALL_ROOT/plugins/yunxiao-release/scripts"
  if [[ -f "$bundled_dir/$script_name" ]]; then
    printf '%s\n' "$bundled_dir/$script_name"
    return
  fi
  command -v curl >/dev/null || { echo '缺少命令：curl' >&2; return 1; }
  curl -fsSL "$RAW_BASE/$script_name" -o "$temporary_dir/$script_name"
  printf '%s\n' "$temporary_dir/$script_name"
}

json_has_item() {
  local field="$1"
  local expected="$2"
  local second_field="${3:-}"
  local second_expected="${4:-}"
  node -e 'const data=JSON.parse(require("fs").readFileSync(0,"utf8"));const [field,expected,secondField,secondExpected]=process.argv.slice(1);process.exit(data.some(item=>item[field]===expected&&(!secondField||item[secondField]===secondExpected))?0:1)' "$field" "$expected" "$second_field" "$second_expected"
}

configure_claude_marketplace() {
  local marketplaces
  marketplaces="$(claude plugin marketplace list --json)"
  if printf '%s' "$marketplaces" | json_has_item name "$MARKETPLACE"; then
    if ! printf '%s' "$marketplaces" | json_has_item name "$MARKETPLACE" source github ||
      ! printf '%s' "$marketplaces" | json_has_item name "$MARKETPLACE" repo "$CLAUDE_MARKETPLACE_SOURCE"; then
      echo "marketplace $MARKETPLACE 已指向其他来源，停止安装" >&2
      return 1
    fi
    claude plugin marketplace update "$MARKETPLACE"
    return
  fi
  claude plugin marketplace add "$CLAUDE_MARKETPLACE_SOURCE"
}

configure_claude_plugin() {
  local plugins
  local plugin_id="$PLUGIN@$MARKETPLACE"
  plugins="$(claude plugin list --json)"
  if printf '%s' "$plugins" | json_has_item id "$plugin_id" scope user; then
    claude plugin update "$plugin_id" --scope user
    claude plugin enable "$plugin_id" --scope user
  else
    claude plugin install "$plugin_id" --scope user
  fi
}

configure_claude_token() {
  local project_root="$1"
  local plugin_id="$PLUGIN@$MARKETPLACE"
  echo '即将打开 Claude Code 插件配置。已有 Token 会保留；完成后退出会话，安装脚本将继续。'
  (cd "$project_root" && claude "/plugin configure $plugin_id")
}

start_claude_configuration() {
  local project_root="$1"
  local prompt='/yunxiao-release:yunxiao-release-config 交互配置当前成员身份。'
  echo '插件安装完成，正在启动 Claude Code 云效交互配置……'
  (cd "$project_root" && claude "$prompt")
}

# 主流程复用现有项目配置脚本；Token 由 Claude Code 的敏感 userConfig 管理。
main() {
  for command in git node claude; do
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
  local project_script
  project_script="$(prepare_script configure-project.mjs "$TEMP_DIR")"

  configure_claude_marketplace
  configure_claude_plugin </dev/tty

  readonly PROJECT_ROOT="$(git rev-parse --show-toplevel)"
  (cd "$PROJECT_ROOT" && node "$project_script")
  test -f "$PROJECT_ROOT/.agents/yunxiao-release.json" || { echo '项目配置生成失败' >&2; exit 1; }

  configure_claude_token "$PROJECT_ROOT" </dev/tty
  start_claude_configuration "$PROJECT_ROOT" </dev/tty
}

if [[ -z "${BASH_SOURCE[0]:-}" || "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
