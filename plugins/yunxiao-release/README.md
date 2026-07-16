# Yunxiao Release Plugin

通过阿里云云效官方 MCP，把任意 Git 项目从开发分支推进到单个 MR 的发版收尾阶段。源码和下载地址：<https://github.com/FlyAboveGrass/yunxiao-release-plugin>。

## 能力边界

```text
开发与验证
  -> 同步可配置的远端目标分支
  -> 提交并推送源分支
  -> 创建或恢复单个云效 MR
  -> 可选 Review / 评论修复
  -> 可选版本文件 / 发版公告收尾
  -> 验证并推送到同一个 MR
  -> 等待有权限成员人工合并
```

- 支持任意云效组织、代码库、Git remote 和目标分支。
- `remoteName` 默认 `origin`，`targetBranch` 默认 `master`。
- Review 支持 `ask`、`required`、`skip`。
- 版本文件和发版公告均可选，不限定语言、框架或目录结构。
- 不提供 MR 合并能力，不绕过审批、流水线、冲突或保护分支。

## 一键安装并初始化当前项目

前置条件：Git、Node.js 20+、支持 Plugins 的 Codex CLI，以及可访问目标云效代码库的个人访问令牌。

进入要使用插件的 Git 项目，运行：

```bash
curl -fsSL https://raw.githubusercontent.com/FlyAboveGrass/yunxiao-release-plugin/main/install.sh | bash
```

安装脚本会依次：

1. 交互式隐藏读取 `YUNXIAO_ACCESS_TOKEN`。
2. 将 Token 写入 `${CODEX_HOME:-$HOME/.codex}/.env`，保留其他变量并设置权限为 `600`。
3. 从 GitHub 添加 marketplace 并安装插件。
4. 在当前 Git 项目生成 `.codex/yunxiao-release.json` 和必要的 `.gitignore` 规则。

脚本不会打印 Token，也不会将 Token 放入命令参数或 shell 历史。完成后编辑生成的配置文件，再重启 Codex 并新建会话。

## 配置项目

安装会生成以下共享配置；无需修改安装脚本，也无需向 `configure-project` 传命令行参数：

```json
{
  "organizationId": "",
  "repositoryId": "",
  "remoteName": "origin",
  "targetBranch": "master",
  "reviewMode": "ask",
  "versionFile": null,
  "announcementFile": null,
  "localConfigFile": ".codex/yunxiao-release.local.json",
  "runtimeFile": ".codex/runtime/yunxiao-release-mr.json",
  "commentsFile": ".codex/runtime/yunxiao-release-comments.md",
  "validationCommands": ["git diff --check"]
}
```

只需编辑 `.codex/yunxiao-release.json`：

- `organizationId`：必填，云效组织 ID。
- `repositoryId`：必填，云效代码库 ID。
- `remoteName`：可选，默认 `origin`。
- `targetBranch`：可选，默认 `master`；使用 `main`、`develop`、`release` 等分支时显式修改。
- `reviewMode`：`ask`、`required` 或 `skip`。
- `versionFile`、`announcementFile`：不需要对应能力时保持 `null`。
- `validationCommands`：执行前插件会展示完整命令并要求确认。

不要从 remote URL 猜组织或代码库 ID。请从云效页面获取，或安装后让配置 Skill 通过官方 MCP 查询并由你确认。

若安装时不在目标项目，之后可在任意 Git 项目根目录运行无参数配置脚本：

```bash
curl -fsSL https://raw.githubusercontent.com/FlyAboveGrass/yunxiao-release-plugin/main/plugins/yunxiao-release/scripts/configure-project.mjs \
  -o /tmp/yunxiao-configure-project.mjs
node /tmp/yunxiao-configure-project.mjs
rm /tmp/yunxiao-configure-project.mjs
```

脚本会保留已有配置值，只补齐缺少的默认字段。

## 初始化成员身份

重启 Codex 并新建会话后执行：

```text
$yunxiao-release:yunxiao-release-config 检查当前项目的云效配置，我的显示名称是“YOUR_NAME”。
```

Skill 会通过官方 MCP 验证 Token、用户、组织、代码库和目标分支，并将非敏感用户 ID 写入本地成员配置。

## 更新过期 Token

`configure-token.mjs` 仅用于更新过期或被撤销的 `YUNXIAO_ACCESS_TOKEN`：

```bash
curl -fsSL https://raw.githubusercontent.com/FlyAboveGrass/yunxiao-release-plugin/main/plugins/yunxiao-release/scripts/configure-token.mjs \
  -o /tmp/yunxiao-configure-token.mjs
node /tmp/yunxiao-configure-token.mjs
rm /tmp/yunxiao-configure-token.mjs
```

更新后重启 Codex 并新建会话。检查当前 Codex Home 是否已配置 Token：

```bash
curl -fsSL https://raw.githubusercontent.com/FlyAboveGrass/yunxiao-release-plugin/main/plugins/yunxiao-release/scripts/configure-token.mjs \
  -o /tmp/yunxiao-configure-token.mjs
node /tmp/yunxiao-configure-token.mjs --check
rm /tmp/yunxiao-configure-token.mjs
```

## 项目文件

| 文件 | Git | 用途 |
|---|---|---|
| `.codex/yunxiao-release.json` | 提交 | 团队共享配置 |
| `.codex/yunxiao-release.local.json` | 忽略 | 成员名称、MCP 用户 ID、Token 来源 |
| `.codex/runtime/yunxiao-release-mr.json` | 忽略 | 分支与 MR 状态 |
| `.codex/runtime/yunxiao-release-comments.md` | 忽略 | 可选评论处理文档 |
| `${CODEX_HOME:-$HOME/.codex}/.env` | 不在项目中 | `YUNXIAO_ACCESS_TOKEN` |

Token、Authorization 头和可还原 Token 的信息禁止进入项目、Git、日志或对话。配置中的项目路径必须是项目内相对路径。

## 使用

创建或恢复 MR：

```text
$yunxiao-release:yunxiao-release-mr 验证当前分支并创建或恢复云效 MR。
```

当前分支未包含远端目标分支时，插件会展示差异并单独确认普通 merge；验证、提交、推送和创建 MR 也分别确认。

跳过 Review，直接收尾：

```text
本次跳过 Review，不同步评论，直接执行 $yunxiao-release:yunxiao-release-finalize。
```

同步和处理评论：

```text
$yunxiao-release:yunxiao-release-comments 同步当前 MR 评论。
$yunxiao-release:yunxiao-release-review-fix 分析并处理未解决评论。
```

完成同一个 MR 的发版收尾：

```text
$yunxiao-release:yunxiao-release-finalize 完成当前同一个 MR 的发版收尾。
```

配置了版本文件或公告文件时才处理对应内容；最后停在等待有权限成员人工合并。

## 常见问题

### 安装后找不到插件

```bash
codex plugin marketplace list
codex plugin list
```

确认 marketplace `yunxiao-release-community` 和插件 `yunxiao-release` 已启用，然后重启 Codex 并新建会话。

### Token 配置后仍返回 401/403

使用上面的更新 Token 脚本，确认启动 Codex 时使用同一个 `CODEX_HOME`，并确认 Token 有权访问目标组织和代码库。不要把 Token 发到对话中排查。

### 不配置目标分支会怎样

默认创建到 `master`。项目使用其他目标分支时，必须修改共享配置中的 `targetBranch`。

### `allRequirementsPass` 为 `false`

云效仍有审批、流水线、分支保护或其他门禁。插件不会绕过门禁，也不提供合并能力。

## 更新与卸载

更新 marketplace 后重新安装最新插件：

```bash
codex plugin marketplace upgrade yunxiao-release-community
codex plugin add yunxiao-release@yunxiao-release-community
```

卸载插件和 marketplace：

```bash
codex plugin remove yunxiao-release@yunxiao-release-community
codex plugin marketplace remove yunxiao-release-community
```

操作后重启 Codex 并新建会话。卸载不会删除项目的 `.codex/yunxiao-release.json` 或 Codex Home 中的 Token。

## 当前限制

- 一键安装脚本面向 macOS、Linux 和 WSL；原生 Windows PowerShell 尚无对应脚本。
- 运行时依赖 Node.js 20+、Git、Codex Plugins 和阿里云云效官方 MCP。
- 当前文档只提供中文版本。

## 许可证

本项目采用 [MIT License](../../LICENSE)。

## 开发验证

```bash
python3 /path/to/plugin-creator/scripts/validate_plugin.py plugins/yunxiao-release
node plugins/yunxiao-release/scripts/configure.test.mjs
node plugins/yunxiao-release/scripts/release-state.test.mjs
bash -n install.sh
```

Codex 插件命令可通过 `codex plugin marketplace add --help` 和 `codex plugin add --help` 查看。
