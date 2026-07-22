# Yunxiao Release Plugin

面向社区的 Codex / Claude Code 云效单 MR 发版插件。完整的安装、配置与使用指南见 [插件文档](plugins/yunxiao-release/README.md)。

在目标 Git 项目中运行统一安装入口，再通过复选框选择 Codex、Claude Code 或两者：

```bash
npx github:FlyAboveGrass/yunxiao-release-plugin
```

安装脚本会安装所选插件并生成共享的 `.agents/yunxiao-release.json`，不会自动启动 Codex 或 Claude Code。

安装后进入目标项目，手动启动所需宿主并完成配置。

Codex：

```bash
codex
```

在 Codex 中发送：

```text
$yunxiao-release:yunxiao-release-config 交互配置当前成员身份，并保存到用户级通用配置。
```

Claude Code：

```bash
claude
```

在 Claude Code 中依次发送：

```text
/plugin configure yunxiao-release@yunxiao-release-community
/yunxiao-release:yunxiao-release-config 交互配置当前成员身份，并保存到用户级通用配置。
```

成员身份由两个宿主共用，保存到 `${XDG_CONFIG_HOME:-$HOME/.config}/yunxiao-release/member.json`。

发布到 npm 后，入口可进一步缩短为 `npx yunxiao-release`。

本项目采用 [MIT License](LICENSE)。
