#!/usr/bin/env bash

set -euo pipefail

readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TEST_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_DIR"' EXIT

source "$ROOT_DIR/install.sh"

MOCK_MODE='stale'

# 模拟 Codex CLI 的四类状态，并记录调用顺序以验证清理边界。
codex() {
  printf '%s\n' "$*" >>"$TEST_DIR/calls"
  case "$*" in
    'plugin marketplace list')
      if [[ "$MOCK_MODE" == 'list-error' ]]; then
        echo 'Error: failed to list marketplaces' >&2
        return 1
      fi
      [[ "$MOCK_MODE" == 'configured' ]] && printf 'MARKETPLACE ROOT\n%s /tmp/source\n' "$MARKETPLACE"
      return 0
      ;;
    'plugin marketplace upgrade yunxiao-release-community')
      printf 'Upgraded marketplace.\n'
      ;;
    'plugin marketplace add https://github.com/FlyAboveGrass/yunxiao-release-plugin.git --ref main')
      if [[ "$MOCK_MODE" == 'stale' && ! -f "$TEST_DIR/retried" ]]; then
        touch "$TEST_DIR/retried"
        echo "Error: marketplace '$MARKETPLACE' is already added from a different source; remove it before adding this source" >&2
        return 1
      fi
      if [[ "$MOCK_MODE" == 'network-error' ]]; then
        echo 'Error: failed to clone marketplace' >&2
        return 1
      fi
      printf 'Added marketplace.\n'
      ;;
    'plugin marketplace remove yunxiao-release-community')
      printf 'Removed marketplace.\n'
      ;;
    *)
      echo "未预期的 Codex 调用: $*" >&2
      return 1
      ;;
  esac
}

if ! configure_marketplace; then
  echo '残留 marketplace 应自动恢复，但安装仍然失败' >&2
  exit 1
fi

expected_calls=$'plugin marketplace list\nplugin marketplace add https://github.com/FlyAboveGrass/yunxiao-release-plugin.git --ref main\nplugin marketplace remove yunxiao-release-community\nplugin marketplace add https://github.com/FlyAboveGrass/yunxiao-release-plugin.git --ref main'
actual_calls="$(<"$TEST_DIR/calls")"
if [[ "$actual_calls" != "$expected_calls" ]]; then
  printf '调用顺序不符合预期：\n%s\n' "$actual_calls" >&2
  exit 1
fi

: >"$TEST_DIR/calls"
MOCK_MODE='configured'
configure_marketplace
expected_calls=$'plugin marketplace list\nplugin marketplace upgrade yunxiao-release-community'
actual_calls="$(<"$TEST_DIR/calls")"
if [[ "$actual_calls" != "$expected_calls" ]]; then
  printf '已配置 marketplace 的调用顺序不符合预期：\n%s\n' "$actual_calls" >&2
  exit 1
fi

: >"$TEST_DIR/calls"
MOCK_MODE='network-error'
if configure_marketplace 2>"$TEST_DIR/network-error-output"; then
  echo '普通添加错误必须原样失败' >&2
  exit 1
fi
if [[ "$(<"$TEST_DIR/network-error-output")" != 'Error: failed to clone marketplace' ]]; then
  echo '普通添加错误没有原样返回' >&2
  exit 1
fi
expected_calls=$'plugin marketplace list\nplugin marketplace add https://github.com/FlyAboveGrass/yunxiao-release-plugin.git --ref main'
actual_calls="$(<"$TEST_DIR/calls")"
if [[ "$actual_calls" != "$expected_calls" ]]; then
  printf '普通错误不应触发清理：\n%s\n' "$actual_calls" >&2
  exit 1
fi

: >"$TEST_DIR/calls"
MOCK_MODE='list-error'
if configure_marketplace 2>"$TEST_DIR/list-error-output"; then
  echo 'marketplace 列表失败时必须停止安装' >&2
  exit 1
fi
if [[ "$(<"$TEST_DIR/list-error-output")" != 'Error: failed to list marketplaces' ]]; then
  echo 'marketplace 列表错误没有原样返回' >&2
  exit 1
fi
actual_calls="$(<"$TEST_DIR/calls")"
if [[ "$actual_calls" != 'plugin marketplace list' ]]; then
  printf '列表失败不应触发其他操作：\n%s\n' "$actual_calls" >&2
  exit 1
fi

piped_output="$(sed 's/^  main "$@"$/  printf "piped main invoked\\n"/' "$ROOT_DIR/install.sh" | bash)"
if [[ "$piped_output" != 'piped main invoked' ]]; then
  echo '通过 curl 管道执行时必须进入主流程' >&2
  exit 1
fi

printf 'install marketplace tests passed\n'
