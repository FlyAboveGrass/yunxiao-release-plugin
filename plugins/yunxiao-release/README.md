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
  "versionFile": "package.json",
  "announcementFile": null,
  "localConfigFile": ".codex/yunxiao-release.local.json",
  "runtimeFile": ".codex/runtime/yunxiao-release-mr.json",
  "commentsFile": ".codex/runtime/yunxiao-release-comments.md",
  "validationCommands": ["git diff --check"]
}
```

只需编辑 `.codex/yunxiao-release.json`。每个字段的含义、默认行为和来源如下：

| 字段 | 含义 | 不配置时的默认行为 | 从哪里获取或如何决定 |
|---|---|---|---|
| `organizationId` | 云效组织 ID | 无可用默认值；配置 Skill 会查询当前组织并要求确认，无法获取或未确认时停止 | 推荐由配置 Skill 调用 `get_current_organization_info` 读取并让你确认；也可在云效“管理后台 > 基本信息”查看 |
| `repositoryId` | 云效代码库数字 ID 的十进制字符串，如 `"2813489"` | 无可用默认值；配置 Skill 会查询候选仓库并要求确认，无法唯一确认时停止 | 推荐由配置 Skill 从当前 Git remote 提取仓库名，用 `list_repositories` 搜索候选并让你确认，再用 `get_repository` 核对返回的数字 `id`，以 `String(id)` 写入 |
| `remoteName` | 推送和同步使用的 Git remote 名称 | `origin` | 在项目中运行 `git remote -v`，选择指向目标云效代码库的 remote |
| `targetBranch` | MR 的目标分支 | `master` | 由项目分支策略和项目维护者确定；配置 Skill 只用 `get_branch` 验证该分支真实存在，不自行推断默认分支 |
| `reviewMode` | 创建或恢复 MR 后，插件是否进入评论同步和修复流程 | `ask` | 项目团队决定，值及行为见下文 |
| `reviewerMode` | 创建 MR 时如何从评审人白名单选择人员 | `ask` | 项目团队决定，值及行为见下文 |
| `reviewerUserIds` | 当前项目确认过的评审人用户 ID 白名单 | `[]`；`ask` 模式不指定评审人，`fixed` 模式报配置错误 | 配置 Skill 用 `search_organization_members` 搜索成员，用户确认后取返回的 `userId`；代码库权限由项目维护者另行确认 |
| `versionFile` | 收尾时需要更新的项目内版本文件 | `package.json` | 使用项目现有版本来源；不是 `package.json` 时改为实际路径，没有统一版本文件时显式设为 `null` 跳过 |
| `announcementFile` | 收尾时需要更新的项目内发版公告 | `null`，跳过公告修改 | 使用项目现有且团队确认的公告文件；项目没有公告文件时保持 `null` |
| `localConfigFile` | 当前成员本地身份配置路径 | `.codex/yunxiao-release.local.json` | 插件内部路径，通常无需修改；必须是项目内相对路径并被 Git 忽略 |
| `runtimeFile` | 当前分支与 MR 运行状态路径 | `.codex/runtime/yunxiao-release-mr.json` | 插件内部路径，通常无需修改；必须是项目内相对路径并被 Git 忽略 |
| `commentsFile` | MR 评论同步和处理记录路径 | `.codex/runtime/yunxiao-release-comments.md` | 插件内部路径，通常无需修改；必须是项目内相对路径并被 Git 忽略 |
| `validationCommands` | 创建 MR 和收尾前执行的最低验证命令列表 | `["git diff --check"]`；空数组无效 | 从项目 `AGENTS.md`、CI 配置和现有包脚本中选择，由团队维护；每条命令执行前都会展示并要求确认 |

不要从 remote URL 的文本格式猜组织或代码库 ID。配置 Skill 只从 remote 提取搜索词，最终写入值必须来自官方 MCP 返回结果并经过用户确认。云效官方文档也说明，组织 ID 可从管理后台基本信息获取，代码库查询结果包含代码库 `id`：[查询成员信息](https://help.aliyun.com/zh/yunxiao/developer-reference/getmember-query-member-information)、[查询代码库](https://help.aliyun.com/zh/yunxiao/developer-reference/getrepository-query-the-code-base)。

### `reviewMode`：Review 工作流模式

- `ask`（默认）：创建或恢复 MR 后询问是否进入评论同步和修复流程；进入收尾时再次确认，选择跳过即可继续。
- `required`：收尾前必须同步当前 MR 的完整评论，并处理或确认没有阻塞性的未解决评论。
- `skip`：不主动同步或处理评论，创建或恢复 MR 后直接提示进入收尾。

`reviewMode` 只控制插件的后续 Review 工作流，不会修改云效审批规则，也不代表 MR 已通过审批。

### `reviewerMode`：MR 评审人选择模式

- `ask`（默认）：创建 MR 前，从 `reviewerUserIds` 白名单中交互选择一个、多个、全部或不指定；白名单为空时不指定评审人。
- `fixed`：创建 MR 时自动使用 `reviewerUserIds` 中的全部成员；白名单为空时停止并报告配置错误。

`reviewerMode` 决定把谁作为评审人传给云效，与 `reviewMode` 是否处理 MR 评论是两个独立配置。

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

成员身份支持两种存储：项目内 `.codex/yunxiao-release.local.json`，或所有 worktree 共用的 `${CODEX_HOME:-$HOME/.codex}/.env`。项目配置存在时优先使用；只有缺失时才回退到 Codex Home。

推荐由配置 Skill 自动生成。安装完成并重启 Codex、新建会话后执行：

```text
$yunxiao-release:yunxiao-release-config 交互配置当前成员身份。
```

Skill 会执行以下操作：

1. 询问存储范围：`项目` 或 `Codex Home`。
2. 询问成员显示名称和用户 ID。
3. 通过云效官方 MCP 核对输入 ID 与当前 Token 用户完全一致，并验证组织和代码库可见性。
4. 项目模式写入忽略的本地 JSON；Codex Home 模式安全更新 `.env`，不读取或打印已有 Token。

生成结果如下：

```json
{
  "displayName": "张三",
  "userId": "云效 MCP 返回的当前用户 ID"
}
```

Codex Home 模式写入：

```dotenv
YUNXIAO_DISPLAY_NAME="张三"
YUNXIAO_USER_ID="云效 MCP 返回的当前用户 ID"
```

字段说明：

| 字段 | 必填 | 说明 |
|---|---|---|
| `displayName` | 是 | 当前成员的本地显示名称，由成员输入；不参与认证。 |
| `userId` | 是 | 由成员输入，并必须与云效官方 MCP 当前用户 ID 一致；禁止填写组织 ID、邮箱或用户名代替。 |

`tokenSource` 固定按 `environment` 处理，不再写入；旧项目配置中的该字段继续兼容但会被忽略。

项目模式写入后需确认文件已被忽略：

```bash
mkdir -p .codex
${EDITOR:-vi} .codex/yunxiao-release.local.json
git check-ignore -v .codex/yunxiao-release.local.json
```

若 `git check-ignore` 没有输出，重新运行安装脚本或 `configure-project.mjs` 补齐 `.gitignore` 规则。不要把 `YUNXIAO_ACCESS_TOKEN`、Authorization 头或其他认证信息写入项目文件。

项目路径由共享配置的 `localConfigFile` 控制。切换到 Codex Home 模式时，需删除现有项目成员配置，否则项目配置仍会优先；配置 Skill 会在删除前请求确认。切换 Token 或云效账号后，重新执行配置 Skill 并再次验证身份。

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
| `.codex/yunxiao-release.local.json` | 忽略 | 可选的项目成员名称和 MCP 用户 ID |
| `.codex/runtime/yunxiao-release-mr.json` | 忽略 | 分支与 MR 状态 |
| `.codex/runtime/yunxiao-release-comments.md` | 忽略 | 可选评论处理文档 |
| `${CODEX_HOME:-$HOME/.codex}/.env` | 不在项目中 | Token，以及可选的全局成员名称和 MCP 用户 ID |

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
