# Local deployment on this host

English | [中文](local-deployment.zh.md)

This checkout is served by `dsh-web.service` from `/root/github/deepseek-harness`. After changing `packages/`, `apps/`, or frontend source, run `pnpm run build`. Do not restart `dsh-web.service` yourself; tell the user a restart is needed and wait for confirmation. Do not start a second `dsh web` instance manually; it conflicts with the service on the Web port.
