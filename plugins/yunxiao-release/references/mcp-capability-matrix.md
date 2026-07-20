# 云效官方 MCP 能力矩阵

核验基线：阿里云官方 `alibabacloud-devops-mcp-server` 工具清单，2026-07-20 检查。每次实际执行仍须读取当前会话暴露的真实工具 Schema，不得仅凭本文件构造参数。

| 能力 | 当前工具 | 使用规则 |
|---|---|---|
| 当前用户 | `get_current_user` | 配置检查必调 |
| 当前组织 | `get_current_organization_info` | 配置检查必调 |
| 组织成员 | `get_organization_member_info_by_user_id`、`search_organization_members` | 校验评审人 ID、组织和成员状态；不能证明代码库权限 |
| 仓库/分支 | `get_repository`、`get_branch` | 校验项目与分支 |
| MR 查询 | `get_change_request`、`list_change_requests` | 恢复和复核 MR |
| MR 创建 | `create_change_request` | 明确确认后调用；使用 `reviewerUserIds` 传评审人用户 ID 数组 |
| MR 版本 | `list_change_request_patch_sets` | 评论同步前调用 |
| 评论读取 | `list_change_request_comments` | 分类型和解决状态读取 |
| 评论回复 | `create_change_request_comment` | 单独确认后调用 |
| 评论更新 | `update_change_request_comment` | 单独确认后解决或重开 |
| 流水线 | `get_pipeline`、`get_latest_pipeline_run` 等 | 仅在能证明与当前 MR 关联时采用 |

当前未确认 MR 合并、审批、保护分支和 MR CI 卡点工具。不得使用自定义 HTTP、旧 Node 脚本或 Git 本地合并代替。

当前未暴露 `ListRepositoryMembers` 对应工具，无法自动列出具有代码库权限的全部成员。交互选择和“全部”只能基于项目配置的 `reviewerUserIds` 白名单，禁止用全部组织成员替代。

评论查询 Schema 未暴露分页参数。必须检查真实响应是否有分页或截断标记；无法证明读取完整时进入 `blocked`，不得生成“全部评论已同步”的结论。
