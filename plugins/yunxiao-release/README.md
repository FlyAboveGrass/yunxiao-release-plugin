# Yunxiao Release Plugin

通过阿里云云效官方 MCP，把 Git 项目从开发分支推进到单个 MR 的发版收尾阶段，支持 Codex 和 Claude Code。源码和下载地址：<https://github.com/FlyAboveGrass/yunxiao-release-plugin>。

## 能力边界

- 支持任意云效组织、代码库、Git remote 和目标分支。
- 创建或恢复当前分支的单个 MR，可选处理 Review 评论、版本文件和发版公告。
- 不合并 MR，也不绕过审批、流水线、冲突或保护分支。

## 安装

前置条件：Git、Node.js 20+、支持 Plugins 的 Codex 或 Claude Code，以及可访问目标云效组织和代码库的个人访问令牌。

代码库的个人访问令牌的获取方式在： https://account-devops.aliyun.com/settings/personalAccessToken 。

进入目标 Git 项目运行：

```bash
npx github:FlyAboveGrass/yunxiao-release-plugin
```

通过复选框选择 Codex、Claude Code 或两者。安装完成后会生成共享项目配置 `.agents/yunxiao-release.json`，并补充本地配置和运行文件所需的 `.gitignore` 规则。

建议使用用户级安装：同一宿主的多个项目可共享插件，每个项目仍通过 `.agents/yunxiao-release.json` 保存独立配置。一键安装默认使用用户级作用域。

选择 Codex 时，安装脚本会复用或交互式读取 `YUNXIAO_ACCESS_TOKEN`，保存到 `${CODEX_HOME:-$HOME/.codex}/.env`，然后安装插件。

选择 Claude Code 时，插件安装到用户级作用域。启动 Claude Code 后，先运行 `/plugin configure yunxiao-release@yunxiao-release-community` 配置 Token。

安装后初始化项目配置和当前成员身份：

```text
# Codex
$yunxiao-release:yunxiao-release-config 交互配置当前项目和成员身份。

# Claude Code
/yunxiao-release:yunxiao-release-config 交互配置当前项目和成员身份。
```

如果需要在其他 Git 项目中初始化共享配置，进入项目根目录运行：

```bash
npx github:FlyAboveGrass/yunxiao-release-plugin configure
```

该命令保留已有配置值，只补齐缺少的默认字段。

## 项目配置

共享配置位于 `.agents/yunxiao-release.json`：

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
  "localConfigFile": ".agents/yunxiao-release.local.json",
  "runtimeFile": ".agents/runtime/yunxiao-release-mr.json",
  "commentsFile": ".agents/runtime/yunxiao-release-comments.md",
  "validationCommands": ["git diff --check"]
}
```

| 字段 | 默认值 | 说明 |
|---|---|---|
| `organizationId` | 无，必填 | 云效组织 ID。推荐由配置 Skill 查询并确认，也可在云效“管理后台 > 基本信息”查看。 |
| `repositoryId` | 无，必填 | 云效代码库数字 ID 的字符串形式。推荐由配置 Skill 根据当前 remote 查询并确认。 |
| `remoteName` | `origin` | 推送和同步使用的 Git remote。可通过 `git remote -v` 确认。 |
| `targetBranch` | `master` | MR 的目标分支。应按项目分支策略配置。 |
| `reviewMode` | `ask` | Review 流程模式：`ask` 在创建或恢复 MR 后及收尾前询问；`required` 要求收尾前同步并处理评论；`skip` 跳过评论流程。该配置不改变云效审批规则。 |
| `reviewerMode` | `ask` | 评审人选择模式：`ask` 从白名单中选择一个、多个、全部或不指定，白名单为空时不指定；`fixed` 使用白名单中的全部成员，白名单为空时报错。 |
| `reviewerUserIds` | `[]` | 评审人用户 ID 白名单。配置 Skill 可按成员名称查询并写入；代码库权限需由项目维护者确认。 |
| `versionFile` | `package.json` | 收尾时更新的版本文件。没有统一版本文件时设为 `null`。 |
| `announcementFile` | `null` | 收尾时更新的发版公告。`null` 表示跳过。 |
| `localConfigFile` | `.agents/yunxiao-release.local.json` | 项目级成员身份配置，必须是项目内相对路径并被 Git 忽略。 |
| `runtimeFile` | `.agents/runtime/yunxiao-release-mr.json` | 当前分支和 MR 的运行状态，必须是项目内相对路径并被 Git 忽略。 |
| `commentsFile` | `.agents/runtime/yunxiao-release-comments.md` | MR 评论处理记录，必须是项目内相对路径并被 Git 忽略。 |
| `validationCommands` | `["git diff --check"]` | 创建 MR 和收尾前执行的最低验证命令。根据项目规则、CI 和现有脚本配置，必须是非空数组；每条命令执行前都会展示并确认。 |

## 成员身份与 Token

成员身份可存放在：

- 项目级：`.agents/yunxiao-release.local.json`
- 用户级：`${XDG_CONFIG_HOME:-$HOME/.config}/yunxiao-release/member.json`

项目级配置优先于用户级配置。用户级配置可供 Codex、Claude Code 和同一用户的多个 worktree 共用。

推荐使用配置 Skill 生成，内容如下：

```json
{
  "displayName": "张三",
  "userId": "云效 MCP 返回的当前用户 ID"
}
```

- `displayName` 是用户真实名字，不参与认证。
- `userId` 必须与当前 Token 对应的云效用户 ID 一致，不能使用组织 ID、邮箱或用户名代替。

项目级配置必须被 Git 忽略，可运行以下命令确认：

```bash
git check-ignore -v .agents/yunxiao-release.local.json
```

如果命令没有输出，重新运行安装命令或 `configure` 命令补齐忽略规则。

切换到用户级身份时，需要删除项目级身份文件，否则项目级配置仍会优先。切换 Token 或云效账号后，重新执行配置 Skill 验证成员身份。

### 更新 Token

Codex 更新 Token：

```bash
npx github:FlyAboveGrass/yunxiao-release-plugin token
```

检查当前 Codex Home 是否已配置 Token：

```bash
npx github:FlyAboveGrass/yunxiao-release-plugin token --check
```

更新后重启 Codex 并新建会话。Claude Code 通过 `/plugin` 打开 `yunxiao-release` 的 Configure 更新 Token。

## 使用

| 操作 | Codex | Claude Code | 说明 |
|---|---|---|---|
| 创建或恢复 MR | `$yunxiao-release:yunxiao-release-mr` | `/yunxiao-release:yunxiao-release-mr` | 验证当前分支、同步目标分支并创建或恢复 MR。需要合并目标分支时会先展示差异并确认。 |
| 同步评论 | `$yunxiao-release:yunxiao-release-comments` | `/yunxiao-release:yunxiao-release-comments` | 同步当前 MR 的评论和处理状态。 |
| 处理评论 | `$yunxiao-release:yunxiao-release-review-fix` | `/yunxiao-release:yunxiao-release-review-fix` | 分析并处理未解决评论。 |
| 发版收尾 | `$yunxiao-release:yunxiao-release-finalize` | `/yunxiao-release:yunxiao-release-finalize` | 按配置更新版本文件和发版公告，验证并推送到同一个 MR，等待有权限成员合并。 |

## 常见问题

### 安装后找不到插件

```bash
# Codex
codex plugin marketplace list
codex plugin list

# Claude Code
claude plugin marketplace list
claude plugin list
```

确认 marketplace `yunxiao-release-community` 和插件 `yunxiao-release` 已启用。Codex 重启并新建会话；Claude Code 执行 `/reload-plugins`。

### Token 配置后仍返回 401/403

重新配置 Token，并确认 Token 有权访问目标组织和代码库。

### `allRequirementsPass` 为 `false`

表示云效仍有审批、流水线、分支保护或其他门禁。

## 更新与卸载

更新插件：

```bash
# Codex
codex plugin marketplace upgrade yunxiao-release-community
codex plugin add yunxiao-release@yunxiao-release-community

# Claude Code
claude plugin marketplace update yunxiao-release-community
claude plugin update yunxiao-release@yunxiao-release-community --scope user
```

卸载插件和 marketplace：

```bash
# Codex
codex plugin remove yunxiao-release@yunxiao-release-community
codex plugin marketplace remove yunxiao-release-community

# Claude Code
claude plugin uninstall yunxiao-release@yunxiao-release-community --scope user
claude plugin marketplace remove yunxiao-release-community
```

操作后重启对应宿主。卸载不会删除项目配置、用户级成员配置或已保存的 Token。

## 运行限制

- 一键安装脚本支持 macOS、Linux 和 WSL，暂不支持原生 Windows PowerShell。
- 运行时依赖 Node.js 20+、Git、Codex Plugins 或 Claude Code Plugins，以及阿里云云效官方 MCP。

## 许可证

本项目采用 [MIT License](../../LICENSE)。
