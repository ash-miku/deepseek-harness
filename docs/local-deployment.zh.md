# 本机上的本地部署

[English](local-deployment.md) | 中文

本 checkout 由 `/root/github/deepseek-harness` 下的 `dsh-web.service` 提供服务。改动 `packages/`、`apps/` 或前端源码后，运行 `pnpm run build`。不要自行重启 `dsh-web.service`；告知用户需要重启并等待确认。不要手动再启动一个 `dsh web` 实例，它会与 Web 端口上的服务冲突。
