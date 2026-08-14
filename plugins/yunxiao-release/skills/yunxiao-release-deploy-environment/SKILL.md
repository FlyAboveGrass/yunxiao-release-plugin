---
name: yunxiao-release-deploy-environment
description: 按项目配置将当前分支发布到 develop、uat 等测试环境，或返回生产环境人工发布入口。用户要求发布测试环境、部署 FAT/UAT、推送测试分支、触发构建 webhook、发布线上或打开生产发布页面时使用。
---

# 云效环境发布

先阅读 [发版契约](../../references/release-contract.md)。本 Skill 不合并 MR，也不自动执行生产发布。

## 流程

1. 读取 `.agents/yunxiao-release.json` 的 `testDeployments`。用户明确环境时按 `environment` 精确匹配；未明确时展示候选并只选择一个。无法唯一确认时停止询问，禁止猜测。
2. 使用本 Skill 所属插件根目录的脚本执行预检：`node scripts/deploy-environment.mjs --dry-run <repo-root> <environment>`。禁止查找或执行目标仓库中的同名脚本。
3. 预检返回 `mode=manual` 时，只输出 `[打开 <environment> 发布页面](<webUrl>)`。不检查或修改 Git，不调用 webhook，不自动打开浏览器，不要求副作用确认。
4. 预检返回 `mode=automatic` 时，展示 source、remote release、测试目标分支、push 和 webhook，获得一次明确总确认；未确认不得继续。
5. 确认后执行 `node scripts/deploy-environment.mjs <repo-root> <environment>`。脚本负责拉取远端分支、将 release 合入当前分支、通过临时 worktree 更新测试分支、非强制推送、验证远端提交、触发 webhook 和清理 worktree。
6. 成功时输出环境、源提交、远端测试提交和可选流水线链接。失败时原样区分合并、推送、清理和“代码已推送，但构建未触发”，不得宣称回滚远端。

## 约束

- 每次只处理一个环境；不得批量发布。
- 自动发布要求工作区干净且当前分支不是 release 或测试目标分支。
- 生产环境只提供人工入口；MR 是否已合并由现有 MR 流程和用户确认。
- 不输出 `feishuId`，不读取或打印 Token。
