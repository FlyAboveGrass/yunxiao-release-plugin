---
name: yunxiao-release-config
description: 初始化、更新或检查任意 Git 项目的云效发版配置、成员身份和 MR 评审人。用户提到初始化云效、配置 Token、检查 MCP 认证、切换成员、目标分支、评审人或发版配置缺失时使用。
---

# 云效发版配置

先阅读 [发版契约](../../references/release-contract.md) 和 [MCP 能力矩阵](../../references/mcp-capability-matrix.md)。

## 流程

1. 确认当前目录是 Git 仓库，读取 remote 和适用的项目规则。
2. 读取项目共享配置。缺失时运行插件根目录的无参数 `scripts/configure-project.mjs` 生成模板；不得猜测组织 ID 或仓库 ID。
3. 确认当前会话真实存在云效官方 MCP 工具，并读取其 Schema。
4. 缺少 `organizationId` 时调用 `get_current_organization_info` 获取当前组织 ID，并调用 `get_user_organizations` 将该 ID 映射为组织名称；用户要切换组织时也从组织列表展示候选。展示组织名称和 ID，经用户确认后才能写入共享配置。
5. 缺少 `repositoryId` 时读取配置 remote 的 URL，只提取仓库名作为 `list_repositories` 的搜索词；展示返回的仓库名称、路径、Web URL 和数字 ID，经用户确认后调用 `get_repository` 核对，并把返回值的 `String(id)` 作为十进制字符串写入。没有唯一确认时停止，不得从 remote URL 推导 ID。
6. 展示共享配置，说明每个字段的含义、默认行为和来源，确认 remote、目标分支、Review 模式、评审人模式、评审人白名单、可选发版文件、内部文件路径和验证命令；目标分支未配置时使用 `master`。
7. 检查项目成员配置和用户级 `.env` 成员配置；项目配置存在时优先使用。用户级配置沿用 Codex 兼容路径 `${CODEX_HOME:-$HOME/.codex}/.env`，Claude Code 也通过插件脚本直接读写；自定义 `CODEX_HOME` 时两个宿主必须使用相同环境变量才能共用。
8. 初始化或更新成员配置时，交互询问存储范围（`项目` 或 `用户级`）、成员显示名称和用户 ID，不要求输入 `tokenSource`。
9. 调用当前用户、组织、仓库和目标分支的只读工具验证认证与配置；用户输入的 ID 必须与 `get_current_user` 返回的 `userId` 精确一致，不一致时停止且不写入。
10. 检查 `reviewerMode` 只使用 `ask|fixed`，`reviewerUserIds` 只包含非空且不重复的字符串；`fixed` 至少需要一个 ID。
11. 对每个评审人 ID 调用 `get_organization_member_info_by_user_id`，核对返回的 `userId`、组织和启用状态。用户只提供名称时，可用 `search_organization_members` 查找并让用户确认，禁止按名称猜 ID。
12. 选择项目存储时，将 `displayName`、`userId` 写入 `localConfigFile` 并用 `git check-ignore` 验证；选择用户级存储时，通过 stdin 把 `{displayName, userId}` JSON 交给 `scripts/configure-member.mjs` 安全更新 `.env`，禁止把用户输入拼入 shell 命令。如果项目成员配置已存在，说明它会覆盖用户级配置，经用户确认后删除项目文件。
13. `tokenSource` 固定视为 `environment`，不写入新配置；旧项目文件存在该字段时忽略。
14. 输出配置来源、成员名称、MCP 用户、组织、仓库、remote、目标分支、Review 模式、评审人模式、已验证评审人、可选发版文件及权限验证结果。

## 安全规则

- 不读取、打印或写入 Token 原文。
- 用户输入的用户 ID 只是待核对值，未通过 `get_current_user` 精确匹配前不得写入任何存储。
- 首次安装缺少 Token 时让 Codex 用户重新运行 `install.sh`，让 Claude Code 用户通过 `/plugin` 配置敏感 `userConfig`；Codex Token 过期或被撤销时才运行 `configure-token.mjs`，不要要求手工编辑 `.env`。
- 只读调用不能证明写权限；将权限分为“已验证”“未验证”“缺失”，不得推断。
- 组织成员查询不能证明代码库权限。评审人白名单必须由用户确认；当前 MCP 无法自动生成“全部有代码库权限的成员”。
- 401、403、身份不匹配或仓库不可见时停止并给出不含认证数据的修复方法。
