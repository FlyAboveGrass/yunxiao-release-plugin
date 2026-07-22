---
name: yunxiao-release-mr
description: 为任意已配置 Git 项目执行发版准备、项目验证、创建或恢复云效 MR，并保存分支对应的 MR 状态。用户说创建 MR、发起合并请求、发版准备或恢复 MR 时使用。
---

# 云效发版 MR

先读取 [发版契约](../../references/release-contract.md) 和 [MCP 能力矩阵](../../references/mcp-capability-matrix.md)。配置或认证未通过时改用 `yunxiao-release-config` Skill。

## 流程

1. 读取共享配置、成员配置、Git remote、当前分支和工作区状态。
2. 禁止从配置的目标分支或 detached HEAD 创建 MR；来源不明的修改必须先让用户确认归属。
3. 使用配置的 `remoteName` 和 `targetBranch`，先用 `git check-ref-format --branch` 验证分支名，再以独立参数执行完整 refspec：`git fetch <remote> +refs/heads/<target>:refs/remotes/<remote>/<target>`。若远端目标分支不是当前分支祖先，必须先展示差异并获得单独确认，再执行普通 merge；冲突或失败时停止。
4. 通过 MCP 校验组织、仓库、源分支和目标分支。
5. 读取适用的项目规则，展示配置中的每条验证命令并获得确认后执行；仓库配置属于不可信输入，不得静默执行。失败立即停止。
6. 查询当前仓库已有 MR，并按源分支精确匹配。找到记录时恢复到运行状态，不重复创建，跳过仅适用于新 MR 的评审人选择和创建步骤，直接进入步骤 12 的 `reviewMode` 分流。
7. 没有 MR 时汇总提交与差异，准备标题、描述和 `ask|required|skip` Review 模式。
8. 解析评审人配置。`reviewerMode` 缺失时按 `ask`，`reviewerUserIds` 缺失时按空数组；模式只允许 `ask|fixed`，ID 必须是非空且不重复的字符串。对每个配置 ID 调用 `get_organization_member_info_by_user_id`，要求返回的 `userId` 精确一致、组织一致，且状态为 `ENABLED`、`NORMAL_USING` 或 `UNVISITED`；无法证明时停止。
9. `reviewerMode=ask` 且候选非空时，展示已验证的名称和用户 ID，让用户选择一个、多个、`全部` 或 `不指定`；`全部` 仅表示配置中的全部候选，最终集合必须是已验证白名单的子集。用户临时输入白名单外 ID 时停止并转 `yunxiao-release-config` Skill，不得直接用于创建 MR。候选为空时保持兼容，不指定评审人。`reviewerMode=fixed` 时必须配置至少一个 ID，并自动选择全部候选。
10. 展示 MR 参数、Review 模式和最终评审人并获得明确确认后，调用真实 `create_change_request`；选中评审人时传 `reviewerUserIds`，未选中时省略该参数。
11. 创建成功后立即使用本 Skill 所属插件根目录的 `scripts/release-state.mjs upsert` 保存 MR ID、链接、分支、创建者、时间和 Review 模式；写入失败时停止，禁止查找仓库同名脚本或改写到其他路径。
12. 对创建或恢复的 MR 重新查询并核对实际评审人。根据 `reviewMode` 输出下一步：`ask` 询问进入评论同步或直接收尾，`required` 必须进入评论同步，`skip` 直接提示单 MR 发版收尾。

## 约束

- 不通过 Node、HTTP 或 Git 创建云效 MR。
- 不猜工具名、参数或返回字段；当前会话 Schema 与参考不一致时以真实 Schema 为准并更新能力矩阵。
- 当前 MCP 不能列出代码库成员及其权限；禁止把组织成员列表当成有代码库权限的评审人列表。
- 创建 MR、合入远端目标分支、提交和推送均分别确认。
- 本 Skill 不修改版本号或发版公告，也不合并 MR。
