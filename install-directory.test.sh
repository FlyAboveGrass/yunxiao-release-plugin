#!/usr/bin/env bash

set -euo pipefail

readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TEST_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_DIR"' EXIT
touch "$TEST_DIR/input"

# 用普通输入文件替代控制终端，只模拟宿主安装，保留真实 Git 检测和项目配置执行。
for installer in install.sh install-codex.sh install-claude.sh; do
  for location in plain repository/nested; do
    case_dir="$TEST_DIR/$installer/${location%%/*}"
    mkdir -p "$case_dir"
    if [[ "$location" == repository/nested ]]; then
      git init -q "$case_dir"
      mkdir -p "$case_dir/nested"
    fi
    (
      cd "$TEST_DIR/$installer/$location"
      sed "s|/dev/tty|$TEST_DIR/input|g" "$ROOT_DIR/$installer" >"$case_dir/installer.sh"
      source "$case_dir/installer.sh"
      prepare_script() { printf '%s\n' "$ROOT_DIR/plugins/yunxiao-release/scripts/$1"; }
      configure_token() { :; }
      configure_marketplace() { :; }
      configure_claude_marketplace() { :; }
      codex() { printf '%s\n' "$*" >"$case_dir/installed"; }
      claude() { printf '%s\n' "$*" >"$case_dir/installed"; }
      configure_claude_plugin() { claude plugin install yunxiao-release@yunxiao-release-community --scope user; }
      choose_installers() { printf 'install-codex.sh\n'; }
      resolve_installer() {
        printf 'printf "installed\\n" >"%s"\n' "$case_dir/installed" >"$case_dir/mock-installer.sh"
        printf '%s\n' "$case_dir/mock-installer.sh"
      }
      main
    ) >"$case_dir/output"
    [[ -s "$case_dir/installed" ]] || { echo "$installer 未完成安装: $location" >&2; exit 1; }
    if [[ "$installer" == install.sh ]]; then
      continue
    fi
    if [[ "$location" == plain ]]; then
      grep -Fq '使用前请进入目标 Git 仓库根目录' "$case_dir/output"
      [[ ! -e "$case_dir/.gitignore" && ! -e "$case_dir/.agents" ]]
    else
      git -C "$case_dir" check-ignore -q .agents/yunxiao-release.local.json
      git -C "$case_dir" check-ignore -q .agents/runtime/yunxiao-release-mr.json
      [[ ! -e "$case_dir/nested/.gitignore" && ! -e "$case_dir/.agents/yunxiao-release.json" ]]
      if grep -Fq '当前目录不在 Git 仓库内' "$case_dir/output"; then
        echo "$installer 错误跳过 Git 项目配置" >&2
        exit 1
      fi
    fi
  done
done

printf 'install directory tests passed\n'
