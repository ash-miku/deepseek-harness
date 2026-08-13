# Agent Note: Web 偏好持久化与 /api 全方法对局域网/ZeroTier 页面开放

Status: implemented

[English](2026-08-14-lan-web-preferences.md) | 中文

## 问题

Host 支撑的 Web 偏好（外观、语言、繁忙时 Enter 键行为）只对浏览器判定为回环的页面持久化。`ctx.connection.isLoopback` 由 `window.location.hostname` 推导（仅 `localhost`、`[::1]`、`127/8`），因此通过局域网 IP 或 ZeroTier 地址打开的页面，其 settings scope 以 `memory` 模式绑定：每次 `settings.mutate` 都不发请求直接短路，选择只作用于当前页面，刷新即回到 Host 默认值。该部署刻意向局域网与 ZeroTier 提供服务（全接口绑定，settings/credentials 已按信任围栏开放），客户端的判定与服务端自身的信任姿态矛盾——服务端本会接受这些写入。

服务端剩余的回环钉（`agentPreset.read/copy/openDocument/remove`、`host.pickDirectory`、`host.openPath`）又挡住了同一批受信任页面的预设管理、目录选择与本地打开；客户端还镜像了该钉，对非回环页面隐藏了 settings.yaml 文档操作与产物文件夹打开按钮。

## 决策

**Probe scope。** `SettingsScopeController` 增加第三种持久化模式 `probe`，用于所有非回环页面：先按 `host` 运行（发起初始读取，写入走线上），一旦 /api 信任围栏以 HTTP 403 拒绝 settings 调用即自行降级为 `memory`（fetch carrier 抛出 `transport failure for <path>: HTTP <status>`，可与瞬时网络故障区分）。被部署信任的页面（回环、推导出的局域网 IPv4 字面量、或声明的 `trustedHosts`）与回环完全一致地持久化；被拒绝的页面保持历史的进程内行为，且不再触碰 Host。欢迎通知存储（`WelcomeNoticeStore`）采用同样的 probe 语义。

**跟随围栏的客户端门控。** settings.yaml 文档操作与产物文件夹打开不再检查页面主机名：文档操作在 `connection.isLoopback` 或连接已建立时注册（同走围栏的 `host.describe` 已成功，即证明围栏接受了该页面）；文件夹打开仅以 Host 描述里的 `canOpenPath` 为准。

**移除回环专属方法钉。** `/api` 信任围栏（回环 + 推导局域网字面量 + `trustedHosts`）即整个配置平面的边界：删除 `LOOPBACK_ONLY_METHODS` 钉后，预设管理、目录选择与本地路径打开与 settings/credentials 走同一围栏。`trustedHosts` 仍是 DNS-rebinding 围栏而非认证层；在可信网络之外提供服务仍需要在服务器前加真正的认证层。

## 备选方案

**保留主机名判定并要求用户改用 127.0.0.1。** 该部署的目的就是局域网/ZeroTier 访问；服务端本已信任这些页面，客户端这道门是服务端并未执行的篱笆。

**每个消费方各自做一次性信任探测。** settings scope 本就拥有读写生命周期，在既有控制器上增加一个模式即可，无需新的传输面；文档操作与文件夹打开从已持有的信号推导信任。

**任何读取失败都降级。** 瞬时网络错误会永久禁用页面偏好；只有围栏自身的 403 判定才降级。

## 影响

外观、语言、繁忙时 Enter、模型配置、欢迎确认、权限默认值、预设管理、目录选择与本地打开均可从局域网与 ZeroTier 页面使用；当页面权威被围栏接受时持久化到 `$DSH_HOME/settings.yaml`。被拒绝的页面（默认回环部署）每个 scope 先支付一次 403 describe 再落入 memory 模式——净行为与之前相同，设置数据不会离开 Host。

ZeroTier 的 IP 字面量（100.x.x.x）属于非 internal 的 IPv4 地址，`resolveLanTrust` 会自动采样；若通过 DNS 名称而非 IP 字面量访问，仍需 `--trusted-host <name>`（或 `--trusted-host <name>:<port>`）。

单元测试覆盖：403 时 probe 降级、被接受时 probe 持久化、welcome-store 回退、围栏门控的文档操作、产物打开器、以及真实 HTTP 下的方法钉移除。
