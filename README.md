# Yunxiao Release Plugin

面向社区的 Codex / Claude Code 云效单 MR 发版插件。完整的安装、配置与使用指南见 [插件文档](plugins/yunxiao-release/README.md)。

在目标 Git 项目中运行统一安装入口，再通过复选框选择 Codex、Claude Code 或两者：

```bash
npx github:FlyAboveGrass/yunxiao-release-plugin
```

同时选择两个宿主时都会安装，但只启动 Codex 完成成员配置；Claude Code Token 延后到首次使用 Claude Code 插件时配置。

发布到 npm 后，入口可进一步缩短为 `npx yunxiao-release`。

本项目采用 [MIT License](LICENSE)。
