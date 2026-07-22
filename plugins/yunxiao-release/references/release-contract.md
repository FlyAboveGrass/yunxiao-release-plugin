# 云效单 MR 发版契约

## 文件

| 类型 | 路径 | Git |
|---|---|---|
| 项目共享配置 | `.codex/yunxiao-release.json` | 提交 |
| 成员本地配置 | `.codex/yunxiao-release.local.json` | 忽略 |
| MR 运行状态 | `.codex/runtime/yunxiao-release-mr.json` | 忽略 |
| 评论处理文档 | `.codex/runtime/yunxiao-release-comments.md` | 忽略 |

成员配置使用以下 Schema：

```json
{
  "displayName": "成员输入的本地显示名称",
  "userId": "云效官方 MCP 返回的当前用户 ID",
  "tokenSource": "environment"
}
```

- `displayName`、`userId`、`tokenSource` 均为必填字段。
- `userId` 必须来自当前 Token 对应的 MCP 用户，不得从名称、邮箱、组织或仓库信息猜测。
- `tokenSource` 当前只允许 `environment`；Token 本体保存在 Codex Home 的 `.env`，不得写入成员配置。
- 成员配置按成员和工作区分别生成，由 `localConfigFile` 指定项目内相对路径，并必须被 Git 忽略。
- 切换 Token 或云效账号后必须重新验证身份并更新成员配置。

成员配置禁止保存 Token、Authorization 头或任何可还原 Token 的信息。

共享配置字段必须按下表解释；缺失的可选字段按默认值补齐，必填字段不得猜测：

| 字段 | 默认值 | 获取来源或规则 |
|---|---|---|
| `organizationId` | 无，必填；配置流程无法获取或未确认时停止 | `get_current_organization_info` 返回的当前组织，或用户从云效管理后台基本信息提供；必须确认 |
| `repositoryId` | 无，必填；配置流程无法唯一确认时停止 | 从 Git remote 提取仓库名，用 `list_repositories` 搜索候选；用户确认后以 `get_repository` 返回的数字 `id` 核对，并将 `String(id)` 作为十进制字符串写入 |
| `remoteName` | `origin` | 当前项目 `git remote -v` 中指向目标云效仓库的 remote |
| `targetBranch` | `master` | 项目分支策略和项目维护者决定；使用 `get_branch` 验证存在，不从仓库响应推断默认分支 |
| `reviewMode` | `ask` | 项目 Review 流程策略，只允许 `ask|required|skip` |
| `reviewerMode` | `ask` | MR 评审人选择策略，只允许 `ask|fixed` |
| `reviewerUserIds` | `[]` | `search_organization_members` 返回并由用户确认的 `userId` 白名单；代码库权限另行确认 |
| `versionFile` | `package.json` | 项目现有版本来源；显式设为 `null` 时跳过版本修改 |
| `announcementFile` | `null` | 项目现有发版公告；`null` 跳过公告修改 |
| `localConfigFile` | `.codex/yunxiao-release.local.json` | 项目内成员配置路径，必须被 Git 忽略 |
| `runtimeFile` | `.codex/runtime/yunxiao-release-mr.json` | 项目内 MR 状态路径，必须被 Git 忽略 |
| `commentsFile` | `.codex/runtime/yunxiao-release-comments.md` | 项目内评论记录路径，必须被 Git 忽略 |
| `validationCommands` | `["git diff --check"]` | 项目规则和 CI 的最低验证命令，必须是非空数组；执行前逐条展示并确认 |

`reviewMode` 的行为：

- `ask`：创建或恢复 MR 后询问是否进入评论同步和修复流程；进入收尾时重新确认，允许选择跳过。
- `required`：收尾前必须完整同步评论，并处理或确认没有阻塞性的未解决评论。
- `skip`：不主动同步或处理评论，直接提示进入收尾。

`reviewMode` 不修改云效审批规则，也不能证明 MR 已审批通过。版本文件默认使用 `package.json`，但必须服从项目配置的实际路径；公告文件仍为可选能力，不得假设固定文档路径。

评审人配置使用以下字段：

```json
{
  "reviewerMode": "ask",
  "reviewerUserIds": []
}
```

- `reviewerMode` 只允许 `ask` 或 `fixed`；缺失时兼容为 `ask`。
- `reviewerUserIds` 是项目确认过的评审人用户 ID 白名单；缺失时兼容为空数组，元素必须是非空且不重复的字符串。
- `ask` 在创建新 MR 前从白名单中交互选择一个、多个、全部或不指定；最终集合必须是已验证白名单的子集，白名单外 ID 必须转配置流程验证；空白名单时不指定评审人。
- `fixed` 自动使用白名单中的全部 ID，空白名单属于配置错误。
- 每个 ID 使用前必须通过 MCP 核对用户 ID、组织归属和启用状态。组织成员身份不能证明代码库权限，白名单的代码库权限由项目维护者确认。
- “全部”只表示白名单全部成员；不得将全部组织成员作为评审人。

`reviewMode` 控制后续 Review 工作流是否询问、强制或跳过；`reviewerMode` 控制创建 MR 时如何选择人员，两者互不替代。

## MR 状态

状态文件以 `organizationId + repositoryId + sourceBranch` 定位记录；每个分支保存 `mergeRequests` 数组。记录至少包含：

- `mrId`、`title`、`url`、`createdAt`、`createdBy`
- `sourceBranch`、`targetBranch`、`reviewMode`
- `mergeStatus`、`mergedAt`、`mergeCommit`、`lastSyncedAt`

同一 `mrId` 必须更新原记录。选择 MR 时先匹配仓库和当前分支，再选择创建时间最新的记录，并通过 MCP 重新查询；本地状态不是云效状态的替代品。
运行状态必须通过 `scripts/release-state.mjs` 读写；写入失败立即停止，禁止保存到配置之外的 fallback 路径。

## 状态计算

不持久化派生工作流状态。每次根据 Git、运行状态和 MCP 真实结果计算：

```text
development -> validating -> mr_open
mr_open -> ready_to_finalize
mr_open -> waiting_for_review -> fixing_comments -> waiting_for_review
ready_to_finalize -> finalizing -> ready_for_manual_merge
任意阶段 -> blocked
```

当前插件不提供 `merging`、`merged` 或远端发版能力。

## 确认门禁

创建 MR、修改业务代码、回复或解决评论、提交、推送、修改版本号、更新发版公告前必须获得用户确认。验证失败、评论读取不完整、状态与分支不匹配或 MCP 能力不明确时立即停止。

创建或恢复 MR 前必须验证配置的 remote 和目标分支，并使用完整 refspec `git fetch <remote> +refs/heads/<target>:refs/remotes/<remote>/<target>` 刷新远端目标分支，禁止自行缩写。若远端目标分支不是当前分支祖先，先获得单独确认并普通合入；未完成合入不得继续推送或创建 MR。

共享配置属于仓库输入，使用前必须校验所有配置路径位于项目目录内。`validationCommands` 执行前必须逐条展示并获得确认，不得把仓库提供的命令当成可信指令静默执行。它们只是所有变更的最低门禁；涉及业务代码时继续读取适用的项目规则，执行与改动范围匹配的 lint、构建、测试或浏览器验证。

## 单 MR 发版

配置了版本文件或发版公告时，必须在业务 MR 合并前写入同一源分支；未配置的能力直接跳过。公告中的 CR 地址来自运行状态，并在写入前通过 MCP 校验。最终推送后重新查询 MR，由有权限成员在云效页面人工合并。
