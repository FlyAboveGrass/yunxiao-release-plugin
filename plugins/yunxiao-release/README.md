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

普通项目默认只向 `.gitignore` 追加两条规则：

```gitignore
/.codex/yunxiao-release.local.json
/.codex/runtime/
```

若项目原本已整体忽略 `.codex/`，脚本才会写入最小的重新包含规则，确保 `.codex/yunxiao-release.json` 可以提交。再次运行配置脚本会自动删除旧版本写入且已被 `/.codex/*` 覆盖的冗余规则。

## 配置项目

安装会生成以下共享配置；无需修改安装脚本，也无需向 `configure-project` 传命令行参数：

```json
{
  "organizationId": "",
  "repositoryId": "",
  "remoteName": "origin",
  "targetBranch": "master",
  "reviewMode": "ask",
  "reviewerMode": "ask",
  "reviewerUserIds": [],
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
- `reviewMode`：`ask`、`required` 或 `skip`，控制创建 MR 后的 Review 工作流。
- `reviewerMode`：`ask` 或 `fixed`，控制创建 MR 时如何选择评审人。
- `reviewerUserIds`：当前项目确认过的评审人用户 ID 白名单。
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

## 配置 MR 评审人

交互选择模式：

```json
{
  "reviewerMode": "ask",
  "reviewerUserIds": ["user-id-1", "user-id-2"]
}
```

创建新 MR 前，插件会验证白名单成员并展示名称和用户 ID，可选择一个、多个、`全部` 或 `不指定`。最终选择只能来自已验证白名单；临时输入新 ID 时必须先转配置 Skill 验证。`全部`只表示配置中的全部候选，不会选中整个组织的成员。白名单为空时保持兼容，创建 MR 时不指定评审人。

固定模式：

```json
{
  "reviewerMode": "fixed",
  "reviewerUserIds": ["user-id-1", "user-id-2"]
}
```

固定模式会把配置中的全部 ID 传给云效 `create_change_request`；此时白名单不能为空。每个 ID 使用前都会通过官方 MCP 校验用户 ID、组织归属和成员状态。

当前云效官方 MCP 只能查询组织成员，不能列出代码库成员及其权限。因此，插件不会把全部组织成员当成评审人；项目维护者需要确认白名单成员拥有当前代码库权限。可让配置 Skill 按成员名称搜索、展示匹配结果，并在你确认后写入共享配置：

```text
$yunxiao-release:yunxiao-release-config 将当前项目的 MR 评审人设置为“张三”和“李四”，创建 MR 时交互选择。
```

## 初始化成员身份

`.codex/yunxiao-release.local.json` 保存当前成员在本项目中的本地身份映射。它用于把成员显示名称、云效 MCP 当前用户 ID 和 Token 来源关联起来，不保存 Token，也不提交到 Git。每位成员、每个独立工作区都需要单独初始化。

推荐由配置 Skill 自动生成。安装完成并重启 Codex、新建会话后执行：

```text
$yunxiao-release:yunxiao-release-config 检查当前项目的云效配置，我的显示名称是“YOUR_NAME”。
```

Skill 会执行以下操作：

1. 读取 `.codex/yunxiao-release.json` 中的组织、代码库和目标分支。
2. 通过云效官方 MCP 查询当前 Token 对应的用户，验证组织和代码库可见性。
3. 将 MCP 返回的非敏感 `userId`、输入的显示名称和固定的 Token 来源写入本地配置。
4. 验证该文件和 `.codex/runtime/` 已被 Git 忽略。

生成结果如下：

```json
{
  "displayName": "张三",
  "userId": "云效 MCP 返回的当前用户 ID",
  "tokenSource": "environment"
}
```

字段说明：

| 字段 | 必填 | 说明 |
|---|---|---|
| `displayName` | 是 | 当前成员的本地显示名称，由成员输入；不参与认证。 |
| `userId` | 是 | 云效官方 MCP 返回的当前用户 ID，必须与当前 Token 身份一致；禁止猜测或填写组织 ID、邮箱、用户名。 |
| `tokenSource` | 是 | 当前只支持固定值 `environment`，表示 Token 从 Codex 进程环境中的 `YUNXIAO_ACCESS_TOKEN` 读取。 |

只有已经通过云效官方 MCP 确认 `userId` 时，才可手工创建该文件：

```bash
mkdir -p .codex
${EDITOR:-vi} .codex/yunxiao-release.local.json
git check-ignore -v .codex/yunxiao-release.local.json
```

若 `git check-ignore` 没有输出，重新运行安装脚本或 `configure-project.mjs` 补齐 `.gitignore` 规则。不要把 `YUNXIAO_ACCESS_TOKEN`、Authorization 头或其他认证信息写入此文件。Token 应保存在 `${CODEX_HOME:-$HOME/.codex}/.env`。

该路径由共享配置的 `localConfigFile` 控制；修改路径后仍使用相同字段，并需重新运行 `configure-project.mjs` 生成对应的忽略规则。切换 Token 或云效账号后，重新执行配置 Skill，更新 `userId` 并再次验证身份。

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

### 是否支持只安装到当前项目

不支持纯项目级插件安装。Codex 支持在项目的 `.agents/plugins/marketplace.json` 中声明项目级 marketplace，但安装后的插件副本仍缓存在 `~/.codex/plugins/cache/`，启用状态仍保存在 `~/.codex/config.toml`，不会完全隔离到单个项目。

因此，本项目的一键安装脚本属于当前用户级安装：插件对该用户的其他项目也可用；脚本只在当前 Git 项目中生成 `.codex/yunxiao-release.json` 等项目配置。若只需要项目级能力，可改用项目内的 `.agents/skills/` 和 `.codex/config.toml`，但这不等同于安装完整插件。

参见 Codex 官方文档：[Build plugins](https://learn.chatgpt.com/docs/build-plugins#build-your-own-curated-plugin-list)。

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
bash install.test.sh
node plugins/yunxiao-release/scripts/configure.test.mjs
node plugins/yunxiao-release/scripts/cli-entry.test.mjs
node plugins/yunxiao-release/scripts/release-state.test.mjs
bash -n install.sh
```

Codex 插件命令可通过 `codex plugin marketplace add --help` 和 `codex plugin add --help` 查看。
