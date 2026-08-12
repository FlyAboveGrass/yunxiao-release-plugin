# Yunxiao Release Plugin

通过阿里云云效官方 MCP，为 Codex 和 Claude Code 提供单 MR 发版流程，并支持发布测试分支或打开生产环境人工发布入口。插件不负责合并 MR。

## 安装

要求 Node.js 20+ 和 Git。在目标 Git 项目中运行：

```bash
npx github:FlyAboveGrass/yunxiao-release-plugin
```

安装时选择 Codex、Claude Code 或两者。配置、使用、更新与故障排查见 [插件文档](plugins/yunxiao-release/README.md)。

本项目采用 [MIT License](LICENSE)。
