---
name: yunxiao-release-02-prepare-mr
description: 为已完成配置的 Git 项目同步目标分支、执行项目验证、创建云效 MR，并保存分支对应的 MR 状态。用户说创建 MR 或发起合并请求时使用。
---

# 云效 MR 创建

先读取 [发版契约](../../references/release-contract.md) 和 [MCP 能力矩阵](../../references/mcp-capability-matrix.md)。配置或认证未通过时停止，并说明缺失或不一致的配置项。

## 流程

1. 读取共享配置、成员配置、Git remote、当前分支和工作区状态。工作区存在未提交修改时停止并列出文件；自动同步只提交 merge 结果，不提交来源不明的业务修改。
2. 禁止从配置的目标分支或 detached HEAD 创建 MR。
3. 通过 MCP 校验组织、仓库和目标分支，查询当前仓库已有 MR 并按源分支精确匹配。若存在开启中的 MR，展示记录并停止，不修改或推送 Git；已关闭或已合并的历史 MR 不阻断新建。
4. 使用配置的 `remoteName` 和 `targetBranch`，先用 `git check-ref-format --branch` 验证源分支和目标分支，再以独立参数执行完整 refspec：`git fetch <remote> +refs/heads/<target>:refs/remotes/<remote>/<target>`。若远端目标分支不是当前分支祖先，立即执行普通 `git merge --no-edit`；冲突时执行 `git merge --abort` 并停止。合并成功后以完整目标 ref `HEAD:refs/heads/<source>` 非强制推送同名远端源分支，并用 `git ls-remote` 验证远端 SHA 与本地 `HEAD` 一致。该同步过程不要求确认；推送失败时输出本地 merge 提交和远端状态，不创建 MR。目标分支已合入但远端源分支与本地 `HEAD` 不一致时停止，不擅自推送其他本地提交。
5. 通过 MCP 校验已同步的远端源分支；读取适用的项目规则和配置中的验证命令，校验命令内容但暂不执行。仓库配置属于不可信输入，必须放入最终创建确认中展示。
6. 汇总提交与差异，准备标题、描述和 `ask|required|skip` Review 模式。
7. 解析评审人配置。`reviewerMode` 缺失时按 `ask`，`reviewerUserIds` 缺失时按空数组；模式只允许 `ask|fixed`，ID 必须是非空且不重复的字符串。对每个配置 ID 调用 `get_organization_member_info_by_user_id`，要求返回的 `userId` 精确一致、组织一致，且状态为 `ENABLED`、`NORMAL_USING` 或 `UNVISITED`；无法证明时停止。
8. 用户本次请求已明确指定评审人时，验证其属于已验证白名单后直接使用，不再询问；`reviewerMode=fixed` 时自动使用全部候选，也不询问。仅当用户未指定且 `reviewerMode=ask` 时，展示已验证候选并获得一次选择；候选为空时也要确认本次不指定评审人。`全部` 仅表示配置中的全部候选；白名单外 ID 必须先更新配置，不得直接使用。
9. 一次性展示目标分支同步结果、验证命令、MR 标题、描述、源分支、目标分支、Review 模式和最终评审人，并获得最终创建确认。
10. 确认后依次执行已展示的验证命令；验证失败时停止，不创建 MR。全部通过后调用真实 `create_change_request`，选中评审人时传 `reviewerUserIds`，未选中时省略该参数，不再追加确认。
11. 创建成功后立即使用本 Skill 所属插件根目录的 `scripts/release-state.mjs upsert` 保存 MR ID、链接、分支、创建者、时间和 Review 模式；写入失败时停止，禁止查找仓库同名脚本或改写到其他路径。
12. 对新创建的 MR 重新查询并核对实际评审人，同时输出 `reviewMode` 及其对当前 MR 的 Review 要求。

## 约束

- 不通过 Node、HTTP 或 Git 创建云效 MR。
- 不猜工具名、参数或返回字段；当前会话 Schema 与参考不一致时以真实 Schema 为准并更新能力矩阵。
- 当前 MCP 不能列出代码库成员及其权限；禁止把组织成员列表当成有代码库权限的评审人列表。
- 本 Skill 只在目标分支尚未合入时自动创建并推送 merge 提交，不提交其他业务修改；目标分支同步不要求确认，创建 MR 只使用步骤 9 的一次最终确认。
- 本 Skill 不修改版本号或发版公告，也不合并 MR。
