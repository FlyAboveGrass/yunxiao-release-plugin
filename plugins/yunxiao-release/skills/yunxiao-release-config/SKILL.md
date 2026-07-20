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
7. 检查成员本地配置；缺失时询问成员显示名称。
8. 调用当前用户、组织、仓库和目标分支的只读工具验证认证与配置。
9. 检查 `reviewerMode` 只使用 `ask|fixed`，`reviewerUserIds` 只包含非空且不重复的字符串；`fixed` 至少需要一个 ID。
10. 对每个评审人 ID 调用 `get_organization_member_info_by_user_id`，核对返回的 `userId`、组织和启用状态。用户只提供名称时，可用 `search_organization_members` 查找并让用户确认，禁止按名称猜 ID。
11. 将 MCP 返回的非敏感 `userId`、成员显示名称和 `tokenSource: environment` 写入配置指定的本地文件。修改任何共享配置前必须展示变更并获得确认。
12. 使用 `git check-ignore` 验证成员配置和运行目录已被忽略。
13. 输出成员名称、MCP 用户、组织、仓库、remote、目标分支、Review 模式、评审人模式、已验证评审人、可选发版文件及权限验证结果。

## 安全规则

- 不读取、打印或写入 Token 原文。
- 首次安装缺少 Token 时让用户重新运行社区 `install.sh`；Token 过期或被撤销时才让用户运行 `configure-token.mjs`，不要要求手工编辑 `.env`。
- 只读调用不能证明写权限；将权限分为“已验证”“未验证”“缺失”，不得推断。
- 组织成员查询不能证明代码库权限。评审人白名单必须由用户确认；当前 MCP 无法自动生成“全部有代码库权限的成员”。
- 401、403、身份不匹配或仓库不可见时停止并给出不含认证数据的修复方法。
